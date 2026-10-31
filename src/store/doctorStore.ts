import { create } from 'zustand';

import {
  type AvailabilitySettings,
  DEFAULT_AVAILABILITY,
} from '../constants/availability';
import {
  type DoctorApprovalStatus,
  type DoctorProfile,
  deleteDoctorFromFirestore,
  fetchDoctorsFromFirestore,
  type NewDoctorProfile,
  saveDoctorToFirestore,
  subscribeToDoctors,
  updateDoctorAvailabilityInFirestore,
  updateDoctorInFirestore,
  updateDoctorStatusInFirestore,
} from '../services/doctorService';

export type { DoctorApprovalStatus, DoctorProfile };

type DoctorState = {
  doctors: DoctorProfile[];
  isLoading: boolean;
  error: string | null;
  registerDoctor: (doctor: NewDoctorProfile) => Promise<void>;
  updateDoctorProfile: (
    id: string,
    updates: Partial<
      Pick<
        DoctorProfile,
        | 'name'
        | 'phone'
        | 'image'
        | 'specialty'
        | 'qualification'
        | 'experience'
        | 'fee'
        | 'bio'
        | 'hospital'
      >
    >
  ) => Promise<void>;
  updateApprovalStatus: (
    id: string,
    status: DoctorApprovalStatus
  ) => Promise<void>;
  updateDoctorAvailability: (
    id: string,
    availability: AvailabilitySettings
  ) => Promise<void>;
  deleteDoctor: (id: string) => Promise<void>;
  fetchDoctors: () => Promise<void>;
};

export const useDoctorStore = create<DoctorState>()((set, get) => ({
  doctors: [],
  isLoading: true,
  error: null,

  fetchDoctors: async () => {
    set({ isLoading: true, error: null });
    try {
      const doctors = await fetchDoctorsFromFirestore();
      set({ doctors, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error?.message || 'Failed to load doctors' });
    }
  },

  registerDoctor: async (doctor) => {
    const exists = get().doctors.some(
      (item) =>
        item.id === doctor.id ||
        item.email.toLowerCase() === doctor.email.toLowerCase()
    );

    if (exists) return;

    // Optimistic local update
    const optimisticRecord: DoctorProfile = {
      ...doctor,
      approvalStatus: 'pending',
      availability: doctor.availability ?? DEFAULT_AVAILABILITY,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      doctors: [...state.doctors, optimisticRecord],
    }));

    try {
      await saveDoctorToFirestore(doctor);
    } catch (err: any) {
      console.error('Failed to register doctor in Firestore API:', err);
      // Rollback optimistic update if Firestore write failed
      set((state) => ({
        doctors: state.doctors.filter((d) => d.id !== doctor.id),
      }));
      throw err;
    }
  },

  updateDoctorProfile: async (id, updates) => {
    const current = get().doctors.find(
      (d) =>
        d.id === id || (d.email && d.email.toLowerCase() === id.toLowerCase())
    );

    if (!current) {
      console.warn(`Doctor ${id} not found in store for update`);
      return;
    }

    // Build the complete, merged doctor profile preserving all essential fields
    const fullMergedDoctor: DoctorProfile = {
      ...current,
      ...updates,
      id: current.id,
      name:
        updates.name && updates.name.trim() !== ''
          ? updates.name.trim()
          : current.name,
      email: current.email,
      specialty:
        updates.specialty && updates.specialty.trim() !== ''
          ? updates.specialty.trim()
          : current.specialty,
      qualification:
        updates.qualification && updates.qualification.trim() !== ''
          ? updates.qualification.trim()
          : current.qualification,
      experience:
        updates.experience !== undefined
          ? updates.experience
          : current.experience,
      fee: updates.fee !== undefined ? updates.fee : current.fee,
      bio: updates.bio !== undefined ? updates.bio : current.bio,
      hospital:
        updates.hospital !== undefined ? updates.hospital : current.hospital,
      phone: updates.phone !== undefined ? updates.phone : current.phone,
      image: updates.image !== undefined ? updates.image : current.image,
      // CRITICAL: NEVER overwrite or reset approvalStatus on profile or photo update
      approvalStatus: current.approvalStatus || 'pending',
      createdAt: current.createdAt || new Date().toISOString(),
      availability: current.availability || DEFAULT_AVAILABILITY,
    };

    // Optimistic local update
    set((state) => ({
      doctors: state.doctors.map((doctor) =>
        doctor.id === current.id ? fullMergedDoctor : doctor
      ),
    }));

    // Send complete record to Firestore so nothing is lost or wiped
    try {
      await updateDoctorInFirestore(current.id, fullMergedDoctor);
    } catch (err) {
      console.warn('Failed to update doctor in Firestore API:', err);
    }
  },

  updateApprovalStatus: async (id, status) => {
    // Optimistic local update
    set((state) => ({
      doctors: state.doctors.map((doctor) =>
        doctor.id === id ? { ...doctor, approvalStatus: status } : doctor
      ),
    }));

    try {
      await updateDoctorStatusInFirestore(id, status);
    } catch (err) {
      console.warn('Failed to update approval status in Firestore API:', err);
    }
  },

  updateDoctorAvailability: async (id, availability) => {
    // Optimistic local update
    set((state) => ({
      doctors: state.doctors.map((doctor) =>
        doctor.id === id ? { ...doctor, availability } : doctor
      ),
    }));

    try {
      await updateDoctorAvailabilityInFirestore(id, availability);
    } catch (err) {
      console.warn('Failed to update availability in Firestore API:', err);
    }
  },

  deleteDoctor: async (id: string) => {
    // Optimistic local update
    set((state) => ({
      doctors: state.doctors.filter((d) => d.id !== id),
    }));

    try {
      await deleteDoctorFromFirestore(id);
    } catch (err) {
      console.warn('Failed to delete doctor from Firestore API:', err);
    }
  },
}));

// Real-time Cloud Firestore subscription: Keeps doctors synchronized across the entire app
let unsubscribeDoctors: (() => void) | null = null;

export function initDoctorFirestoreListener(): () => void {
  if (unsubscribeDoctors) return unsubscribeDoctors;

  unsubscribeDoctors = subscribeToDoctors(
    (incomingDoctors) => {
      const currentDoctors = useDoctorStore.getState().doctors;

      // Merge incoming Firestore doctors with current doctors so we never wipe local fields if Firestore returns partial doc
      const merged: DoctorProfile[] = incomingDoctors.map((fDoc) => {
        const existing = currentDoctors.find((d) => d.id === fDoc.id);
        if (!existing) return fDoc;

        return {
          ...fDoc,
          name: (fDoc.name && fDoc.name.trim()) || existing.name,
          email: (fDoc.email && fDoc.email.trim()) || existing.email,
          specialty:
            (fDoc.specialty && fDoc.specialty.trim()) || existing.specialty,
          qualification:
            (fDoc.qualification && fDoc.qualification.trim()) ||
            existing.qualification,
          experience: fDoc.experience || existing.experience,
          fee: fDoc.fee || existing.fee,
          bio: fDoc.bio || existing.bio,
          hospital:
            fDoc.hospital !== undefined ? fDoc.hospital : existing.hospital,
          phone: fDoc.phone !== undefined ? fDoc.phone : existing.phone,
          image: fDoc.image !== undefined ? fDoc.image : existing.image,
          approvalStatus:
            fDoc.approvalStatus || existing.approvalStatus || 'pending',
          availability:
            fDoc.availability ?? existing.availability ?? DEFAULT_AVAILABILITY,
        };
      });

      useDoctorStore.setState({
        doctors: merged,
        isLoading: false,
        error: null,
      });
    },
    (error) => {
      console.warn('Firestore doctors subscription error:', error);
      useDoctorStore.setState({
        isLoading: false,
        error: error.message,
      });
    }
  );

  return unsubscribeDoctors;
}

// Automatically start listening to Firestore API
initDoctorFirestoreListener();
