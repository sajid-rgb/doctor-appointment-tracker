import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
  addNotification: (
    notification: Omit<AppNotification, 'id' | 'isRead' | 'createdAt'>
  ) => AppNotification;
  markAsRead: (id: string) => void;
  markAllAsRead: (recipientId: string) => void;
  deleteNotification: (id: string) => void;
  clearNotificationsForUser: (recipientId: string) => void;
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],

      addNotification: (notificationData) => {
        const newNotification: AppNotification = {
          ...notificationData,
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          isRead: false,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications],
        }));

        return newNotification;
      },

      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        })),

      markAllAsRead: (recipientId) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.recipientId === recipientId ? { ...n, isRead: true } : n
          ),
        })),

      deleteNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      clearNotificationsForUser: (recipientId) =>
        set((state) => ({
          notifications: state.notifications.filter(
            (n) => n.recipientId !== recipientId
          ),
        })),
    }),
    {
      name: 'carepoint-notifications',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (
          version < 2 &&
          persistedState &&
          Array.isArray(persistedState.notifications)
        ) {
          // Remove legacy notifications with recipientId === 'all' so they don't leak to other users
          const filtered = persistedState.notifications.filter(
            (n: any) => n?.recipientId && n.recipientId !== 'all'
          );
          return {
            ...persistedState,
            notifications: filtered,
          };
        }
        return persistedState;
      },
    }
  )
);
