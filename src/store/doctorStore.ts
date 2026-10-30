import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  type AvailabilitySettings,
  DEFAULT_AVAILABILITY,
} from '../constants/availability';

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

type NewDoctorProfile = Omit<DoctorProfile, 'approvalStatus' | 'createdAt'>;

type DoctorState = {
  doctors: DoctorProfile[];
  registerDoctor: (doctor: NewDoctorProfile) => void;
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
  ) => void;
  updateApprovalStatus: (id: string, status: DoctorApprovalStatus) => void;
  updateDoctorAvailability: (
    id: string,
    availability: AvailabilitySettings
  ) => void;
};

export const useDoctorStore = create<DoctorState>()(
  persist(
    (set, get) => ({
      doctors: [],

      registerDoctor: (doctor) => {
        const exists = get().doctors.some(
          (item) =>
            item.id === doctor.id ||
            item.email.toLowerCase() === doctor.email.toLowerCase()
        );

        if (exists) return;

        set((state) => ({
          doctors: [
            ...state.doctors,
            {
              ...doctor,
              approvalStatus: 'pending',
              availability: doctor.availability ?? DEFAULT_AVAILABILITY,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      },

      updateDoctorProfile: (id, updates) =>
        set((state) => ({
          doctors: state.doctors.map((doctor) =>
            doctor.id === id ? { ...doctor, ...updates } : doctor
          ),
        })),

      updateApprovalStatus: (id, status) =>
        set((state) => ({
          doctors: state.doctors.map((doctor) =>
            doctor.id === id ? { ...doctor, approvalStatus: status } : doctor
          ),
        })),

      updateDoctorAvailability: (id, availability) =>
        set((state) => ({
          doctors: state.doctors.map((doctor) =>
            doctor.id === id ? { ...doctor, availability } : doctor
          ),
        })),
    }),
    {
      name: 'carepoint-doctors',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (
          version < 2 &&
          persistedState &&
          Array.isArray(persistedState.doctors)
        ) {
          const filteredDoctors = persistedState.doctors.filter(
            (doc: any) =>
              !['1', '2', '3', '4'].includes(doc?.id) &&
              !doc?.email?.toLowerCase()?.endsWith('@example.com')
          );

          return {
            ...persistedState,
            doctors: filteredDoctors,
          };
        }

        return persistedState;
      },
    }
  )
);

