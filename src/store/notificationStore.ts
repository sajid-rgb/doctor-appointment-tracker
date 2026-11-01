import { create } from 'zustand';

import {
  clearNotificationsForUserInFirestore,
  deleteNotificationFromFirestore,
  fetchNotificationsFromFirestore,
  markAllNotificationsAsReadInFirestore,
  markNotificationAsReadInFirestore,
  saveNotificationToFirestore,
  subscribeToNotifications,
} from '../services/notificationService';

export type NotificationType =
  | 'doctor_new_appointment'
  | 'patient_appointment_reminder'
  | 'patient_booking_confirmation'
  | 'appointment_cancelled'
  | 'general';

export type AppNotification = {
  id: string;
  recipientId: string; // The specific user ID (or email) who receives this notification
  recipientRole: 'doctor' | 'patient' | 'admin';
  title: string;
  message: string;
  type: NotificationType;
  appointmentId?: string;
  doctorName?: string;
  patientName?: string;
  date?: string;
  time?: string;
  serialNumber?: string;
  scheduledNotificationId?: string;
  scheduledFor?: string;
  isRead: boolean;
  createdAt: string;
};

type NotificationState = {
  notifications: AppNotification[];
  isLoading: boolean;
  addNotification: (
    notification: Omit<AppNotification, 'id' | 'isRead' | 'createdAt'>
  ) => AppNotification;
  markAsRead: (id: string) => void;
  markAllAsRead: (recipientId: string) => void;
  deleteNotification: (id: string) => void;
  clearNotificationsForUser: (recipientId: string) => void;
  fetchNotifications: () => Promise<void>;
};

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  isLoading: true,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const notifications = await fetchNotificationsFromFirestore();
      set({ notifications, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addNotification: (notificationData) => {
    const newNotification: AppNotification = {
      ...notificationData,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    // Optimistic local update
    set((state) => ({
      notifications: [newNotification, ...state.notifications],
    }));

    // Persist to Cloud Firestore API
    saveNotificationToFirestore(newNotification).catch((err) => {
      console.warn('Failed to save notification to Firestore API:', err);
    });

    return newNotification;
  },

  markAsRead: (id) => {
    // Optimistic local update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    }));

    // Sync to Cloud Firestore API
    markNotificationAsReadInFirestore(id).catch((err) => {
      console.warn('Failed to mark notification as read in Firestore API:', err);
    });
  },

  markAllAsRead: (recipientId) => {
    const current = get().notifications;

    // Optimistic local update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.recipientId === recipientId ? { ...n, isRead: true } : n
      ),
    }));

    // Sync to Cloud Firestore API
    markAllNotificationsAsReadInFirestore(recipientId, current).catch((err) => {
      console.warn('Failed to mark all notifications as read in Firestore API:', err);
    });
  },

  deleteNotification: (id) => {
    // Optimistic local update
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));

    // Sync to Cloud Firestore API
    deleteNotificationFromFirestore(id).catch((err) => {
      console.warn('Failed to delete notification from Firestore API:', err);
    });
  },

  clearNotificationsForUser: (recipientId) => {
    const current = get().notifications;

    // Optimistic local update
    set((state) => ({
      notifications: state.notifications.filter(
        (n) => n.recipientId !== recipientId
      ),
    }));

    // Sync to Cloud Firestore API
    clearNotificationsForUserInFirestore(recipientId, current).catch((err) => {
      console.warn('Failed to clear notifications in Firestore API:', err);
    });
  },
}));

// Real-time Cloud Firestore subscription for notifications
let unsubscribeNotifications: (() => void) | null = null;

export function initNotificationFirestoreListener(forceRestart = false): () => void {
  if (forceRestart && unsubscribeNotifications) {
    try {
      unsubscribeNotifications();
    } catch {}
    unsubscribeNotifications = null;
  }

  if (unsubscribeNotifications) return unsubscribeNotifications;

  unsubscribeNotifications = subscribeToNotifications(
    (notifications) => {
      useNotificationStore.setState({
        notifications,
        isLoading: false,
      });
    },
    (error) => {
      console.warn('Firestore notifications subscription error:', error);
      if (unsubscribeNotifications) {
        try {
          unsubscribeNotifications();
        } catch {}
        unsubscribeNotifications = null;
      }
      useNotificationStore.setState({ isLoading: false });
    }
  );

  return unsubscribeNotifications;
}

// Automatically start listening to Cloud Firestore API
initNotificationFirestoreListener();
