import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  type Unsubscribe,
  updateDoc,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import type {
  Appointment,
  AppointmentStatus,
  UploadedPrescriptionFile,
} from '../store/appointmentStore';
import { withTimeout } from './authService';

const APPOINTMENTS_COLLECTION = 'appointments';

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

function normalizeAppointmentDoc(id: string, data: any): Appointment {
  return {
    id,
    serialNumber: data?.serialNumber || 'SL-01',
    patientId: data?.patientId,
    patientName: data?.patientName,
    patientAge:
      typeof data?.patientAge === 'number'
        ? data.patientAge
        : data?.patientAge
        ? Number(data.patientAge)
        : undefined,
    patientGender: data?.patientGender,
    patientPhone: data?.patientPhone,
    bloodGroup: data?.bloodGroup,
    condition: data?.condition,
    previousDocuments: data?.previousDocuments,
    prescriptionFiles: Array.isArray(data?.prescriptionFiles)
      ? data.prescriptionFiles
      : undefined,
    additionalNotes: data?.additionalNotes,
    doctorId: data?.doctorId || '',
    doctorName: data?.doctorName || '',
    specialty: data?.specialty || '',
    fee:
      typeof data?.fee === 'number' ? data.fee : Number(data?.fee) || 0,
    date: data?.date || '',
    time: data?.time || '',
    status: (data?.status as AppointmentStatus) || 'pending',
    createdAt: data?.createdAt || new Date().toISOString(),
  };
}

/**
 * Subscribes to real-time appointments from Cloud Firestore API.
 */
export function subscribeToAppointments(
  onUpdate: (appointments: Appointment[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);

  return onSnapshot(
    appointmentsRef,
    (snapshot) => {
      const appointments: Appointment[] = [];
      snapshot.forEach((docSnap) => {
        appointments.push(normalizeAppointmentDoc(docSnap.id, docSnap.data()));
      });
      // Sort newest first
      appointments.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      onUpdate(appointments);
    },
    (error) => {
      console.warn('Firestore appointments listener warning:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Fetches all appointments once from Cloud Firestore API with timeout protection.
 */
export async function fetchAppointmentsFromFirestore(): Promise<Appointment[]> {
  try {
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const snapshot = await withTimeout(getDocs(appointmentsRef), 10000, null as any);
    if (!snapshot) return [];

    const appointments: Appointment[] = [];
    snapshot.forEach((docSnap: any) => {
      appointments.push(normalizeAppointmentDoc(docSnap.id, docSnap.data()));
    });
    appointments.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return appointments;
  } catch (error) {
    console.warn('Failed to fetch appointments from Firestore:', error);
    return [];
  }
}

/**
 * Saves a new appointment to Cloud Firestore API.
 */
export async function saveAppointmentToFirestore(
  appointment: Appointment
): Promise<void> {
  try {
    const docRef = doc(db, APPOINTMENTS_COLLECTION, appointment.id);
    const sanitized = sanitizeForFirestore(appointment);
    await withTimeout(setDoc(docRef, sanitized), 10000);
  } catch (error) {
    console.warn('Failed to save appointment to Firestore API:', error);
  }
}

/**
 * Updates an appointment's status in Cloud Firestore API.
 */
export async function updateAppointmentStatusInFirestore(
  id: string,
  status: AppointmentStatus
): Promise<void> {
  try {
    const docRef = doc(db, APPOINTMENTS_COLLECTION, id);
    await withTimeout(
      updateDoc(docRef, { status }).catch(() =>
        setDoc(docRef, { status }, { merge: true })
      ),
      10000
    );
  } catch (error) {
    console.warn('Failed to update appointment status in Firestore API:', error);
  }
}

/**
 * Updates an appointment's serialNumber in Cloud Firestore API.
 */
export async function updateAppointmentSerialInFirestore(
  id: string,
  serialNumber: string
): Promise<void> {
  try {
    const docRef = doc(db, APPOINTMENTS_COLLECTION, id);
    await withTimeout(
      updateDoc(docRef, { serialNumber }).catch(() =>
        setDoc(docRef, { serialNumber }, { merge: true })
      ),
      10000
    );
  } catch (error) {
    console.warn('Failed to update appointment serial in Firestore API:', error);
  }
}

/**
 * Deletes an appointment from Cloud Firestore API.
 */
export async function deleteAppointmentFromFirestore(id: string): Promise<void> {
  try {
    const docRef = doc(db, APPOINTMENTS_COLLECTION, id);
    await withTimeout(deleteDoc(docRef), 10000);
  } catch (error) {
    console.warn(`Failed to delete appointment from Firestore API:`, error);
  }
}
