import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  type Unsubscribe,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import type {
  AppNotification,
  NotificationType,
} from '../store/notificationStore';
import { withTimeout } from './authService';

const NOTIFICATIONS_COLLECTION = 'notifications';

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

function normalizeNotificationDoc(id: string, data: any): AppNotification {
  return {
    id,
    recipientId: data?.recipientId || '',
    recipientRole: data?.recipientRole || 'patient',
    title: data?.title || '',
    message: data?.message || '',
    type: (data?.type as NotificationType) || 'general',
    appointmentId: data?.appointmentId,
    doctorName: data?.doctorName,
    patientName: data?.patientName,
    date: data?.date,
    time: data?.time,
    serialNumber: data?.serialNumber,
    scheduledNotificationId: data?.scheduledNotificationId,
    scheduledFor: data?.scheduledFor,
    isRead: Boolean(data?.isRead),
    createdAt: data?.createdAt || new Date().toISOString(),
  };
}

/**
 * Subscribes to notifications in real-time from Cloud Firestore API.
 */
export function subscribeToNotifications(
  onUpdate: (notifications: AppNotification[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const notifRef = collection(db, NOTIFICATIONS_COLLECTION);

  return onSnapshot(
    notifRef,
    (snapshot) => {
      const notifications: AppNotification[] = [];
      snapshot.forEach((docSnap) => {
        notifications.push(
          normalizeNotificationDoc(docSnap.id, docSnap.data())
        );
      });
      // Sort newest first
      notifications.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      onUpdate(notifications);
    },
    (error) => {
      console.warn('Firestore notifications listener warning:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Fetches all notifications once from Cloud Firestore API with timeout protection.
 */
export async function fetchNotificationsFromFirestore(): Promise<
  AppNotification[]
> {
  try {
    const notifRef = collection(db, NOTIFICATIONS_COLLECTION);
    const snapshot = await withTimeout(getDocs(notifRef), 3000, null as any);
    if (!snapshot) return [];

    const notifications: AppNotification[] = [];
    snapshot.forEach((docSnap: any) => {
      notifications.push(normalizeNotificationDoc(docSnap.id, docSnap.data()));
    });
    notifications.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return notifications;
  } catch (error) {
    console.warn('Failed to fetch notifications from Firestore:', error);
    return [];
  }
}

/**
 * Saves a new notification to Cloud Firestore API.
 */
export async function saveNotificationToFirestore(
  notification: AppNotification
): Promise<void> {
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, notification.id);
    const sanitized = sanitizeForFirestore(notification);
    await withTimeout(setDoc(docRef, sanitized), 3000);
  } catch (error) {
    console.warn('Failed to save notification to Firestore API:', error);
  }
}

/**
 * Marks a single notification as read in Cloud Firestore API.
 */
export async function markNotificationAsReadInFirestore(
  id: string
): Promise<void> {
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, id);
    await withTimeout(
      updateDoc(docRef, { isRead: true }).catch(() =>
        setDoc(docRef, { isRead: true }, { merge: true })
      ),
      3000
    );
  } catch (error) {
    console.warn('Failed to mark notification as read in Firestore API:', error);
  }
}

/**
 * Marks all notifications for a specific recipient as read in Cloud Firestore API.
 */
export async function markAllNotificationsAsReadInFirestore(
  recipientId: string,
  notificationsToUpdate: AppNotification[]
): Promise<void> {
  try {
    const unreadForUser = notificationsToUpdate.filter(
      (n) => n.recipientId === recipientId && !n.isRead
    );
    if (unreadForUser.length === 0) return;

    const batch = writeBatch(db);
    for (const notif of unreadForUser) {
      const docRef = doc(db, NOTIFICATIONS_COLLECTION, notif.id);
      batch.update(docRef, { isRead: true });
    }
    await withTimeout(batch.commit(), 3000);
  } catch (error) {
    console.warn('Failed to mark all as read in Firestore API:', error);
  }
}

/**
 * Deletes a notification from Cloud Firestore API.
 */
export async function deleteNotificationFromFirestore(
  id: string
): Promise<void> {
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, id);
    await withTimeout(deleteDoc(docRef), 3000);
  } catch (error) {
    console.warn('Failed to delete notification from Firestore API:', error);
  }
}

/**
 * Clears all notifications for a specific recipient in Cloud Firestore API.
 */
export async function clearNotificationsForUserInFirestore(
  recipientId: string,
  notificationsToDelete: AppNotification[]
): Promise<void> {
  try {
    const forUser = notificationsToDelete.filter(
      (n) => n.recipientId === recipientId
    );
    if (forUser.length === 0) return;

    const batch = writeBatch(db);
    for (const notif of forUser) {
      const docRef = doc(db, NOTIFICATIONS_COLLECTION, notif.id);
      batch.delete(docRef);
    }
    await withTimeout(batch.commit(), 3000);
  } catch (error) {
    console.warn(
      'Failed to clear notifications for user in Firestore API:',
      error
    );
  }
}
