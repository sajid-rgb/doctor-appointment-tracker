import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
  addAppointment: (appointment: NewAppointment) => Appointment;
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => void;
  updateAppointmentSerial: (id: string, serialNumber: string) => void;
  cancelAppointment: (id: string) => void;
  getNextSerialNumber: (doctorId: string, date: string) => string;
};

export const useAppointmentStore = create<AppointmentState>()(
  persist(
    (set, get) => ({
      appointments: [],

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

        set((state) => ({
          appointments: [created, ...state.appointments],
        }));

        return created;
      },

      updateAppointmentStatus: (id, status) =>
        set((state) => ({
          appointments: state.appointments.map((appointment) =>
            appointment.id === id ? { ...appointment, status } : appointment
          ),
        })),

      updateAppointmentSerial: (id, serialNumber) =>
        set((state) => ({
          appointments: state.appointments.map((appointment) =>
            appointment.id === id
              ? { ...appointment, serialNumber: serialNumber.trim() }
              : appointment
          ),
        })),

      cancelAppointment: (id) =>
        set((state) => ({
          appointments: state.appointments.map((appointment) =>
            appointment.id === id &&
            (appointment.status === 'pending' ||
              appointment.status === 'confirmed')
              ? { ...appointment, status: 'cancelled' }
              : appointment
          ),
        })),
    }),
    {
      name: 'carepoint-appointments',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: (persistedState: any, version: number) => {
        if (persistedState && Array.isArray(persistedState.appointments)) {
          let updated = persistedState.appointments;

          // Version 2 cleanup of dummy doctors
          if (version < 2) {
            updated = updated.filter(
              (item: any) =>
                !['1', '2', '3', '4'].includes(item?.doctorId) &&
                ![
                  'Dr. Sarah Ahmed',
                  'Dr. Tanvir Hasan',
                  'Dr. Nusrat Jahan',
                  'Dr. Imran Chowdhury',
                ].includes(item?.doctorName)
            );
          }

          // Version 3: ensure every appointment has a serialNumber
          if (version < 3) {
            const counts: Record<string, number> = {};
            updated = updated.map((apt: any) => {
              if (apt.serialNumber) return apt;
              const key = `${apt.doctorId}_${apt.date}`;
              counts[key] = (counts[key] || 0) + 1;
              return {
                ...apt,
                serialNumber: `SL-${String(counts[key]).padStart(2, '0')}`,
              };
            });
          }

          return {
            ...persistedState,
            appointments: updated,
          };
        }

        return persistedState;
      },
    }
  )
);
