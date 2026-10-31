import AsyncStorage from '@react-native-async-storage/async-storage';
import { Analytics, getAnalytics, isSupported } from 'firebase/analytics';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

export const firebaseConfig = {
  apiKey: 'AIzaSyB31BhfdkNp65jJI1a_hm7ntDZ4_8Vqens',
  authDomain: 'test-project-73720a.firebaseapp.com',
  databaseURL: 'https://test-project-73720a.firebaseio.com',
  projectId: 'test-project-73720a',
  storageBucket: 'test-project-73720a.firebasestorage.app',
  messagingSenderId: '157941739316',
  appId: '1:157941739316:web:f5d0ad742455e2d645bf61',
  measurementId: 'G-39JZ5YK21C',
};

// Initialize Firebase App (prevents re-initialization on Fast Refresh / hot reloads)
export const app =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Cloud Firestore
export const db = getFirestore(app);

// Initialize Firebase Auth with persistence for React Native and Web
let authInstance: Auth;
try {
  if (Platform.OS === 'web') {
    authInstance = getAuth(app);
  } else {
    const getReactNativePersistence = (FirebaseAuth as any).getReactNativePersistence;
    if (typeof getReactNativePersistence === 'function') {
      authInstance = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } else {
      authInstance = getAuth(app);
    }
  }
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;

// Safe Analytics initialization (only supported in web/supported browser environments)
let analytics: Analytics | null = null;
if (Platform.OS === 'web') {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {
      // Analytics not supported or failed to initialize
    });
}

export { analytics };
export * from '../services/authService';
export * from '../services/doctorService';
export * from '../services/appointmentService';
export * from '../services/notificationService';
export default app;




