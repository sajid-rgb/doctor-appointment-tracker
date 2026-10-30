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
 * Notify the specific patient:
 * 1. Immediate confirmation in-app (only for this patient)
 * 2. Scheduled reminder 10 minutes before the appointment time (only for this patient)
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

  // 1. In-app booking confirmation specifically for this patient
  useNotificationStore.getState().addNotification({
    recipientId: patientId,
    recipientRole: 'patient',
    title: 'Appointment Confirmed 🎉',
    message: `Your appointment with Dr. ${doctorName} is confirmed for ${date} at ${time}. Serial: ${serialNumber}.`,
    type: 'patient_booking_confirmation',
    appointmentId,
    doctorName,
    patientName,
    date,
    time,
    serialNumber,
  });

  // 2. Calculate 10-minutes-before reminder time
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
