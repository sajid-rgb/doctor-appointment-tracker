import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getPatientReminderDate } from '../constants/availability';
import {
  type NotificationType,
  useNotificationStore,
} from '../store/notificationStore';

// Set up foreground notification presentation
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Configure Android notification channels
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('appointments', {
        name: 'Appointment Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0F766E',
        sound: 'default',
      });
    } catch (err) {
      console.warn('Failed to setup Android notification channel:', err);
    }
  }
}

/**
 * Request notification permissions safely
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;

    if (existing.status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = requested.status;
    }

    if (finalStatus === 'granted') {
      await setupNotificationChannels();
      return true;
    }

    return false;
  } catch (err) {
    console.warn('Notification permission request error:', err);
    return false;
  }
}

export type DoctorNotificationParams = {
  doctorId: string;
  doctorName: string;
  patientName: string;
  date: string;
  time: string;
  serialNumber: string;
  appointmentId: string;
};

/**
 * Immediately notify the specific doctor after an appointment is booked
 */
export async function notifyDoctorNewAppointment(
  params: DoctorNotificationParams
): Promise<string | undefined> {
  const {
    doctorId,
    doctorName,
    patientName,
    date,
    time,
    serialNumber,
    appointmentId,
  } = params;

  // 1. Add specific in-app notification ONLY for this doctor
  useNotificationStore.getState().addNotification({
    recipientId: doctorId,
    recipientRole: 'doctor',
    title: 'New Appointment Booked 🩺',
    message: `Patient ${patientName} booked a consultation for ${date} at ${time}. Serial: ${serialNumber}.`,
    type: 'doctor_new_appointment',
    appointmentId,
    doctorName,
    patientName,
    date,
    time,
    serialNumber,
  });

  // 2. Schedule immediate device notification
  let notificationId: string | undefined;

  if (Platform.OS !== 'web') {
    try {
      await requestNotificationPermissions();

      notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🩺 New Appointment Booked',
          body: `Patient ${patientName} booked for ${date} at ${time}. Serial: ${serialNumber}`,
          data: {
            appointmentId,
            doctorId,
            type: 'doctor_new_appointment',
          },
          sound: true,
        },
        trigger: null, // fires immediately
      });
    } catch (err) {
      console.warn('Could not dispatch doctor local notification:', err);
    }
  }

  return notificationId;
}

export type PatientReminderParams = {
  patientId: string;
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
  serialNumber: string;
  appointmentId: string;
};

/**
 * Notify the specific patient when their appointment is CONFIRMED by the doctor:
 * 1. Immediate in-app confirmation (only for this patient)
 * 2. Immediate device notification (only for this patient)
 * 3. Schedule 10-minutes-before reminder
 */
export async function notifyPatientAppointmentConfirmed(
  params: PatientReminderParams
): Promise<string | undefined> {
  const {
    patientId,
    patientName,
    doctorName,
    date,
    time,
    serialNumber,
    appointmentId,
  } = params;

  if (!patientId) return undefined;

  // 1. In-app confirmation specifically for this patient
  useNotificationStore.getState().addNotification({
    recipientId: patientId,
    recipientRole: 'patient',
    title: 'Appointment Confirmed 🎉',
    message: `Dr. ${doctorName} has confirmed your appointment for ${date} at ${time}. Serial: ${serialNumber}.`,
    type: 'patient_booking_confirmation',
    appointmentId,
    doctorName,
    patientName,
    date,
    time,
    serialNumber,
  });

  // 2. Dispatch immediate device notification for the patient
  if (Platform.OS !== 'web') {
    try {
      await requestNotificationPermissions();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎉 Appointment Confirmed',
          body: `Dr. ${doctorName} has confirmed your appointment for ${date} at ${time}. Serial: ${serialNumber}`,
          data: {
            appointmentId,
            patientId,
            type: 'patient_booking_confirmation',
          },
          sound: true,
        },
        trigger: null, // immediate
      });
    } catch (err) {
      console.warn('Could not dispatch patient confirmation notification:', err);
    }
  }

  // 3. Schedule 10-minutes-before reminder
  return schedulePatientAppointmentReminder(params);
}

/**
 * Dispatches the appropriate notification to the patient when doctor or admin updates status
 */
export async function notifyPatientAppointmentStatus(
  appointment: {
    id: string;
    patientId?: string;
    patientName?: string;
    doctorName: string;
    date: string;
    time: string;
    serialNumber: string;
  },
  status:
    | 'pending'
    | 'confirmed'
    | 'rejected'
    | 'completed'
    | 'cancelled'
    | 'absent'
): Promise<void> {
  if (!appointment.patientId) return;

  if (status === 'confirmed') {
    await notifyPatientAppointmentConfirmed({
      patientId: appointment.patientId,
      patientName: appointment.patientName || 'Patient',
      doctorName: appointment.doctorName,
      date: appointment.date,
      time: appointment.time,
      serialNumber: appointment.serialNumber || 'SL-01',
      appointmentId: appointment.id,
    });
  } else if (status === 'rejected') {
    useNotificationStore.getState().addNotification({
      recipientId: appointment.patientId,
      recipientRole: 'patient',
      title: 'Appointment Rejected ❌',
      message: `Your appointment request with Dr. ${appointment.doctorName} on ${appointment.date} (Serial: ${appointment.serialNumber}) was rejected.`,
      type: 'appointment_cancelled',
      appointmentId: appointment.id,
      doctorName: appointment.doctorName,
      patientName: appointment.patientName,
      date: appointment.date,
      time: appointment.time,
      serialNumber: appointment.serialNumber,
    });

    if (Platform.OS !== 'web') {
      try {
        await requestNotificationPermissions();
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '❌ Appointment Rejected',
            body: `Your appointment request with Dr. ${appointment.doctorName} for ${appointment.date} was rejected.`,
            data: {
              appointmentId: appointment.id,
              type: 'appointment_cancelled',
            },
            sound: true,
          },
          trigger: null,
        });
      } catch (err) {
        console.warn('Could not dispatch rejection notification:', err);
      }
    }
  } else if (status === 'completed') {
    useNotificationStore.getState().addNotification({
      recipientId: appointment.patientId,
      recipientRole: 'patient',
      title: 'Appointment Completed ✅',
      message: `Your consultation with Dr. ${appointment.doctorName} on ${appointment.date} (Serial: ${appointment.serialNumber}) was completed.`,
      type: 'patient_booking_confirmation',
      appointmentId: appointment.id,
      doctorName: appointment.doctorName,
      patientName: appointment.patientName,
      date: appointment.date,
      time: appointment.time,
      serialNumber: appointment.serialNumber,
    });
  } else if (status === 'absent') {
    useNotificationStore.getState().addNotification({
      recipientId: appointment.patientId,
      recipientRole: 'patient',
      title: 'Marked Absent ⚠️',
      message: `You were marked absent for your appointment with Dr. ${appointment.doctorName} on ${appointment.date} (${appointment.time}). Please contact reception to reschedule.`,
      type: 'appointment_cancelled',
      appointmentId: appointment.id,
      doctorName: appointment.doctorName,
      patientName: appointment.patientName,
      date: appointment.date,
      time: appointment.time,
      serialNumber: appointment.serialNumber,
    });
  }
}

/**
 * Schedules a reminder 10 minutes before the appointment time for the patient
 */
export async function schedulePatientAppointmentReminder(
  params: PatientReminderParams
): Promise<string | undefined> {
  const {
    patientId,
    patientName,
    doctorName,
    date,
    time,
    serialNumber,
    appointmentId,
  } = params;

  // Calculate 10-minutes-before reminder time
  const reminderDate = getPatientReminderDate(date, time, 10);
  let scheduledNotificationId: string | undefined;

  if (!reminderDate) {
    return undefined;
  }

  const now = Date.now();
  const reminderTimeMs = reminderDate.getTime();

  if (reminderTimeMs > now) {
    // Appointment is in the future (> 10 minutes away)
    if (Platform.OS !== 'web') {
      try {
        await requestNotificationPermissions();

        scheduledNotificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: '⏰ Appointment in 10 Minutes',
            body: `Your consultation with Dr. ${doctorName} starts in 10 minutes at ${time}. Serial: ${serialNumber}. Please be ready!`,
            data: {
              appointmentId,
              patientId,
              type: 'patient_appointment_reminder',
            },
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminderDate,
            channelId: 'appointments',
          },
        });
      } catch (err) {
        console.warn('Could not schedule patient reminder notification:', err);
      }
    }

    // Record upcoming reminder in in-app store specifically for this patient
    useNotificationStore.getState().addNotification({
      recipientId: patientId,
      recipientRole: 'patient',
      title: '⏰ Reminder: Appointment in 10 Minutes',
      message: `Your appointment with Dr. ${doctorName} is scheduled for ${date} at ${time}. We will alert you 10 minutes before!`,
      type: 'patient_appointment_reminder',
      appointmentId,
      doctorName,
      patientName,
      date,
      time,
      serialNumber,
      scheduledFor: reminderDate.toISOString(),
      scheduledNotificationId,
    });
  } else {
    // Appointment starts within 10 minutes
    if (Platform.OS !== 'web') {
      try {
        await requestNotificationPermissions();

        scheduledNotificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: '⏰ Appointment Starting Soon',
            body: `Your appointment with Dr. ${doctorName} starts very soon at ${time}. Serial: ${serialNumber}.`,
            data: {
              appointmentId,
              patientId,
              type: 'patient_appointment_reminder',
            },
            sound: true,
          },
          trigger: null, // immediate
        });
      } catch (err) {
        console.warn('Could not dispatch immediate reminder:', err);
      }
    }

    useNotificationStore.getState().addNotification({
      recipientId: patientId,
      recipientRole: 'patient',
      title: '⏰ Appointment Starting Soon',
      message: `Your appointment with Dr. ${doctorName} starts in less than 10 minutes (${time}). Serial: ${serialNumber}.`,
      type: 'patient_appointment_reminder',
      appointmentId,
      doctorName,
      patientName,
      date,
      time,
      serialNumber,
      scheduledFor: new Date().toISOString(),
      scheduledNotificationId,
    });
  }

  return scheduledNotificationId;
}

/**
 * Cancel a scheduled local notification (e.g. if appointment is cancelled)
 */
export async function cancelScheduledNotification(
  notificationId?: string
): Promise<void> {
  if (!notificationId || Platform.OS === 'web') {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (err) {
    console.warn('Error cancelling notification:', err);
  }
}
