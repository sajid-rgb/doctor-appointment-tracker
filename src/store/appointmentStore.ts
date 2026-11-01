import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  deleteAppointmentFromFirestore,
  fetchAppointmentsFromFirestore,
  saveAppointmentToFirestore,
  subscribeToAppointments,
  updateAppointmentSerialInFirestore,
  updateAppointmentStatusInFirestore,
} from '../services/appointmentService';
import { safeAsyncStorage } from './authStore';

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'completed'
  | 'cancelled';

export type UploadedPrescriptionFile = {
  name: string;
  uri: string;
  size?: number;
  mimeType?: string;
};

export type Appointment = {
  id: string;
  serialNumber: string;
  patientId?: string;
  patientName?: string;
  patientAge?: number;
  patientGender?: string;
  patientPhone?: string;
  bloodGroup?: string;
  condition?: string;
  previousDocuments?: string;
  prescriptionFiles?: UploadedPrescriptionFile[];
  additionalNotes?: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  fee: number;
  date: string;
  time: string;
  status: AppointmentStatus;
  createdAt: string;
};

export type NewAppointment = Omit<
  Appointment,
  'id' | 'status' | 'createdAt' | 'serialNumber'
> & {
  serialNumber?: string;
};

export function generateUniqueSerialNumber(
  doctorId: string,
  date: string,
  appointments: Appointment[]
): string {
  const doctorAppointments = appointments.filter(
    (a) =>
      a.doctorId === doctorId &&
      a.date === date &&
      a.status !== 'cancelled'
  );

  const usedNumbers = new Set<number>();
  for (const a of doctorAppointments) {
    if (a.serialNumber) {
      const match = a.serialNumber.match(/\d+/);
      if (match) {
        usedNumbers.add(parseInt(match[0], 10));
      }
    }
  }

  let next = 1;
  while (usedNumbers.has(next)) {
    next++;
  }

  return `SL-${String(next).padStart(2, '0')}`;
}

export function isSerialNumberTaken(
  serialNumber: string,
  appointmentId: string,
  doctorId: string,
  date: string,
  appointments: Appointment[]
): boolean {
  const normalized = serialNumber.trim().toUpperCase();
  return appointments.some(
    (a) =>
      a.id !== appointmentId &&
      a.doctorId === doctorId &&
      a.date === date &&
      a.status !== 'cancelled' &&
      (a.serialNumber || '').trim().toUpperCase() === normalized
  );
}

type AppointmentState = {
  appointments: Appointment[];
  isLoading: boolean;
  addAppointment: (appointment: NewAppointment) => Appointment;
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => void;
  updateAppointmentSerial: (id: string, serialNumber: string) => void;
  cancelAppointment: (id: string) => void;
  deleteAppointment: (id: string) => Promise<void>;
  getNextSerialNumber: (doctorId: string, date: string) => string;
  fetchAppointments: () => Promise<void>;
};

export const useAppointmentStore = create<AppointmentState>()(
  persist(
    (set, get) => ({
      appointments: [],
      isLoading: true,

      fetchAppointments: async () => {
        set({ isLoading: true });
        try {
          const appointments = await fetchAppointmentsFromFirestore();
          if (appointments.length > 0) {
            set({ appointments, isLoading: false });
          } else {
            set({ isLoading: false });
          }
        } catch {
          set({ isLoading: false });
        }
      },

  getNextSerialNumber: (doctorId: string, date: string) => {
    return generateUniqueSerialNumber(doctorId, date, get().appointments);
  },

  addAppointment: (newAppointment) => {
    const currentList = get().appointments;
    const serial =
      newAppointment.serialNumber ||
      generateUniqueSerialNumber(
        newAppointment.doctorId,
        newAppointment.date,
        currentList
      );

    const created: Appointment = {
      ...newAppointment,
      serialNumber: serial,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    // Optimistic local update
    set((state) => ({
      appointments: [created, ...state.appointments],
    }));

    // Persist to Cloud Firestore API
    saveAppointmentToFirestore(created).catch((err) => {
      console.warn('Failed to save appointment to Firestore API:', err);
    });

    return created;
  },

  updateAppointmentStatus: (id, status) => {
    // Optimistic local update
    set((state) => ({
      appointments: state.appointments.map((appointment) =>
        appointment.id === id ? { ...appointment, status } : appointment
      ),
    }));

    // Sync to Cloud Firestore API
    updateAppointmentStatusInFirestore(id, status).catch((err) => {
      console.warn('Failed to update appointment status in Firestore API:', err);
    });
  },

  updateAppointmentSerial: (id, serialNumber) => {
    const cleanSerial = serialNumber.trim();

    // Optimistic local update
    set((state) => ({
      appointments: state.appointments.map((appointment) =>
        appointment.id === id
          ? { ...appointment, serialNumber: cleanSerial }
          : appointment
      ),
    }));

    // Sync to Cloud Firestore API
    updateAppointmentSerialInFirestore(id, cleanSerial).catch((err) => {
      console.warn('Failed to update appointment serial in Firestore API:', err);
    });
  },

  cancelAppointment: (id) => {
    // Optimistic local update
    set((state) => ({
      appointments: state.appointments.map((appointment) =>
        appointment.id === id &&
        (appointment.status === 'pending' || appointment.status === 'confirmed')
          ? { ...appointment, status: 'cancelled' }
          : appointment
      ),
    }));

    // Sync to Cloud Firestore API
    updateAppointmentStatusInFirestore(id, 'cancelled').catch((err) => {
      console.warn('Failed to cancel appointment in Firestore API:', err);
    });
  },

  deleteAppointment: async (id) => {
    // Optimistic local update
    set((state) => ({
      appointments: state.appointments.filter(
        (appointment) => appointment.id !== id
      ),
    }));

    // Sync to Cloud Firestore API
    try {
      await deleteAppointmentFromFirestore(id);
    } catch (err) {
      console.warn('Failed to delete appointment from Firestore API:', err);
    }
  },
}),
    {
      name: 'carepoint-appointments-cache',
      storage: createJSONStorage(() => safeAsyncStorage),
      partialize: (state) => ({
        appointments: state.appointments,
      }),
      onRehydrateStorage: () => () => {
        useAppointmentStore.setState({ isLoading: false });
      },
    }
  )
);

// Real-time Cloud Firestore subscription for appointments
let unsubscribeAppointments: (() => void) | null = null;

export function initAppointmentsFirestoreListener(forceRestart = false): () => void {
  if (forceRestart && unsubscribeAppointments) {
    try {
      unsubscribeAppointments();
    } catch {}
    unsubscribeAppointments = null;
  }

  if (unsubscribeAppointments) return unsubscribeAppointments;

  unsubscribeAppointments = subscribeToAppointments(
    (appointments) => {
      useAppointmentStore.setState({
        appointments,
        isLoading: false,
      });
    },
    (error) => {
      console.warn('Firestore appointments subscription error:', error);
      if (unsubscribeAppointments) {
        try {
          unsubscribeAppointments();
        } catch {}
        unsubscribeAppointments = null;
      }
      useAppointmentStore.setState({ isLoading: false });
    }
  );

  return unsubscribeAppointments;
}

// Automatically start listening to Cloud Firestore API
initAppointmentsFirestoreListener();
