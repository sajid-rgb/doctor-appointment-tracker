import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  type Unsubscribe,
  updateDoc,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import {
  type AvailabilitySettings,
  DEFAULT_AVAILABILITY,
} from '../constants/availability';
import { withTimeout } from './authService';

export type DoctorApprovalStatus = 'pending' | 'approved' | 'rejected';

export type DoctorProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  image?: string;
  specialty: string;
  qualification: string;
  experience: number;
  fee: number;
  bio: string;
  hospital?: string;
  approvalStatus: DoctorApprovalStatus;
  createdAt: string;
  availability?: AvailabilitySettings;
};

export type NewDoctorProfile = Omit<
  DoctorProfile,
  'approvalStatus' | 'createdAt'
>;

const DOCTORS_COLLECTION = 'doctors';

/**
 * Removes undefined fields from objects before sending to Firestore
 */
function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned;
  }
  return obj;
}

/**
 * Normalizes a document from Firestore into a typed DoctorProfile
 */
function normalizeDoctorDoc(id: string, data: any): DoctorProfile {
  return {
    id,
    name: data?.name || '',
    email: data?.email || '',
    phone: data?.phone,
    image: data?.image,
    specialty: data?.specialty || '',
    qualification: data?.qualification || '',
    experience:
      typeof data?.experience === 'number'
        ? data.experience
        : Number(data?.experience) || 0,
    fee:
      typeof data?.fee === 'number' ? data.fee : Number(data?.fee) || 0,
    bio: data?.bio || '',
    hospital: data?.hospital,
    approvalStatus:
      (data?.approvalStatus as DoctorApprovalStatus) || 'pending',
    createdAt: data?.createdAt || new Date().toISOString(),
    availability: data?.availability ?? DEFAULT_AVAILABILITY,
  };
}

/**
 * Subscribes to real-time doctor updates from Cloud Firestore.
 */
export function subscribeToDoctors(
  onUpdate: (doctors: DoctorProfile[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const doctorsRef = collection(db, DOCTORS_COLLECTION);

  return onSnapshot(
    doctorsRef,
    (snapshot) => {
      const doctors: DoctorProfile[] = [];
      snapshot.forEach((docSnap) => {
        doctors.push(normalizeDoctorDoc(docSnap.id, docSnap.data()));
      });
      onUpdate(doctors);
    },
    (error) => {
      console.warn('Firestore doctors listener warning:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Fetches all doctors once from Cloud Firestore API with timeout protection.
 */
export async function fetchDoctorsFromFirestore(): Promise<DoctorProfile[]> {
  try {
    const doctorsRef = collection(db, DOCTORS_COLLECTION);
    const snapshot = await withTimeout(getDocs(doctorsRef), 10000, null as any);
    if (!snapshot) return [];

    const doctors: DoctorProfile[] = [];
    snapshot.forEach((docSnap: any) => {
      doctors.push(normalizeDoctorDoc(docSnap.id, docSnap.data()));
    });
    return doctors;
  } catch (error) {
    console.warn('Failed to fetch doctors from Firestore (timed out or offline):', error);
    return [];
  }
}

/**
 * Fetches a single doctor document by ID from Cloud Firestore API with timeout protection.
 */
export async function fetchDoctorByIdFromFirestore(
  id: string
): Promise<DoctorProfile | null> {
  try {
    const docRef = doc(db, DOCTORS_COLLECTION, id);
    const snap = await withTimeout(getDoc(docRef), 10000, null as any);
    if (snap && typeof snap.exists === 'function' && snap.exists()) {
      return normalizeDoctorDoc(snap.id, snap.data());
    }
    return null;
  } catch (error) {
    console.warn(`Failed to fetch doctor ${id} from Firestore:`, error);
    return null;
  }
}

/**
 * Saves a new doctor registration directly to Cloud Firestore with timeout protection.
 */
export async function saveDoctorToFirestore(
  doctor: NewDoctorProfile
): Promise<DoctorProfile> {
  const doctorRecord: DoctorProfile = {
    ...doctor,
    approvalStatus: 'pending',
    availability: doctor.availability ?? DEFAULT_AVAILABILITY,
    createdAt: new Date().toISOString(),
  };

  try {
    const docRef = doc(db, DOCTORS_COLLECTION, doctor.id);
    const sanitized = sanitizeForFirestore(doctorRecord);
    await withTimeout(setDoc(docRef, sanitized, { merge: true }), 10000);
  } catch (error) {
    console.warn('Failed to save doctor to Firestore (timed out or offline):', error);
  }
  return doctorRecord;
}

/**
 * Updates an existing doctor profile in Cloud Firestore API.
 * Uses sanitizeForFirestore to ensure no undefined values are sent.
 */
export async function updateDoctorInFirestore(
  id: string,
  updates: Partial<DoctorProfile>
): Promise<void> {
  try {
    const docRef = doc(db, DOCTORS_COLLECTION, id);
    const sanitized = sanitizeForFirestore(updates);
    await withTimeout(setDoc(docRef, sanitized, { merge: true }), 10000);
  } catch (error) {
    console.warn('Failed to update doctor in Firestore:', error);
  }
}

/**
 * Updates a doctor's approval status in Cloud Firestore API.
 */
export async function updateDoctorStatusInFirestore(
  id: string,
  status: DoctorApprovalStatus
): Promise<void> {
  try {
    const docRef = doc(db, DOCTORS_COLLECTION, id);
    await withTimeout(
      updateDoc(docRef, { approvalStatus: status }).catch(() =>
        setDoc(docRef, { approvalStatus: status }, { merge: true })
      ),
      10000
    );
  } catch (error) {
    console.warn('Failed to update doctor approval status in Firestore:', error);
  }
}

/**
 * Updates a doctor's availability settings in Cloud Firestore API.
 */
export async function updateDoctorAvailabilityInFirestore(
  id: string,
  availability: AvailabilitySettings
): Promise<void> {
  try {
    const docRef = doc(db, DOCTORS_COLLECTION, id);
    const sanitized = sanitizeForFirestore(availability);
    await withTimeout(
      updateDoc(docRef, { availability: sanitized }).catch(() =>
        setDoc(docRef, { availability: sanitized }, { merge: true })
      ),
      10000
    );
  } catch (error) {
    console.warn('Failed to update doctor availability in Firestore:', error);
  }
}

/**
 * Deletes a doctor document from Cloud Firestore API.
 */
export async function deleteDoctorFromFirestore(id: string): Promise<void> {
  try {
    const docRef = doc(db, DOCTORS_COLLECTION, id);
    await withTimeout(deleteDoc(docRef), 10000);
  } catch (error) {
    console.warn(`Failed to delete doctor ${id} from Firestore:`, error);
  }
}

