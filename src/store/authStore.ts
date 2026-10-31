import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { auth } from '../config/firebase';
import {
  deleteUserFromFirestore,
  fetchUserProfileById,
  fetchUsersFromFirestore,
  loginWithFirebase,
  logoutFirebase,
  signUpWithFirebase,
  subscribeToUserProfile,
  subscribeToUsers,
  updateUserFirestoreProfile,
} from '../services/authService';

export const AUTH_TOKEN_STORAGE_KEY = 'carepoint_auth_token';
const ADMIN_SESSION_TOKEN = 'carepoint-admin-session-token';

export const safeAsyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web' && typeof window === 'undefined') return null;
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web' && typeof window === 'undefined') return;
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web' && typeof window === 'undefined') return;
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};

export type UserRole = 'patient' | 'doctor' | 'admin';
type SignUpRole = 'patient' | 'doctor';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  image?: string;
  phone?: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  address?: string;
  emergencyContact?: string;
  medicalHistory?: string;
};

type DemoAccount = AuthUser & {
  password?: string;
};

type AuthState = {
  users: DemoAccount[];
  user: AuthUser | null;
  token: string | null;
  hasHydrated: boolean;
  isLoadingUsers: boolean;
  setHasHydrated: (value: boolean) => void;
  setToken: (token: string | null) => void;
  signUp: (
    name: string,
    email: string,
    password: string,
    role: SignUpRole
  ) => Promise<string | null>;
  login: (email: string, password: string) => Promise<string | null>;
  updateUserProfile: (
    updates: Partial<
      Pick<
        AuthUser,
        | 'name'
        | 'image'
        | 'phone'
        | 'age'
        | 'gender'
        | 'bloodGroup'
        | 'address'
        | 'emergencyContact'
        | 'medicalHistory'
      >
    >
  ) => Promise<void>;
  logout: () => void;
  fetchUsers: () => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
};

const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PASSWORD = '123456';

const demoAdmin: DemoAccount = {
  id: 'carepoint-admin',
  name: 'CarePoint Admin',
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
  role: 'admin',
};

// Real-time listener reference for the current active user
let unsubscribeCurrentUser: (() => void) | null = null;

function attachCurrentUserListener(userId: string) {
  if (unsubscribeCurrentUser) {
    unsubscribeCurrentUser();
    unsubscribeCurrentUser = null;
  }
  if (!userId || userId === demoAdmin.id) return;

  unsubscribeCurrentUser = subscribeToUserProfile(userId, (updatedProfile) => {
    if (updatedProfile) {
      useAuthStore.setState({ user: updatedProfile });
    }
  });
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: [demoAdmin],
      user: null,
      token: null,
      hasHydrated: false,
      isLoadingUsers: true,

      setHasHydrated: (value) => set({ hasHydrated: value }),
      setToken: (token) => {
        set({ token });
        if (token) {
          safeAsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token).catch(() => {});
        } else {
          safeAsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY).catch(() => {});
        }
      },

      fetchUsers: async () => {
        set({ isLoadingUsers: true });
        try {
          const firestoreUsers = await fetchUsersFromFirestore();
          const hasAdmin = firestoreUsers.some((u) => u.email === ADMIN_EMAIL);
          const combined = hasAdmin
            ? firestoreUsers
            : [demoAdmin, ...firestoreUsers.filter((u) => u.id !== demoAdmin.id)];

          set({ users: combined, isLoadingUsers: false });
        } catch {
          set({ isLoadingUsers: false });
        }
      },

      signUp: async (name, email, password, role) => {
        const normalizedEmail = email.trim().toLowerCase();

        if (normalizedEmail === ADMIN_EMAIL) {
          return 'This email is reserved for the admin account.';
        }

        // Firebase Auth sign up & Firestore user document creation
        const result = await signUpWithFirebase(name, email, password, role);

        if (result.error || !result.user) {
          return result.error || 'Sign up failed. Please try again.';
        }

        const newUser = result.user;
        const authToken = result.token || newUser.id;

        // Only store token in AsyncStorage; user profile lives in Firestore
        set((state) => ({
          users: [
            ...state.users.filter((item) => item.email !== normalizedEmail),
            newUser,
          ],
          user: newUser,
          token: authToken,
        }));

        safeAsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken).catch(() => {});
        attachCurrentUserListener(newUser.id);
        return null;
      },

      login: async (email, password) => {
        const normalizedEmail = email.trim().toLowerCase();

        // Demo admin login
        if (normalizedEmail === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
          const { password: _password, ...safeAdmin } = demoAdmin;
          const authToken = ADMIN_SESSION_TOKEN;
          set({ user: safeAdmin, token: authToken });
          safeAsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken).catch(() => {});
          return null;
        }

        // Firebase Auth sign in & Firestore profile load
        const result = await loginWithFirebase(email, password);

        if (result.error || !result.user) {
          // Fallback check against loaded firestore users if offline
          const localAccount = get().users.find(
            (item) =>
              item.email === normalizedEmail &&
              item.password === password &&
              item.role !== 'admin'
          );

          if (localAccount) {
            const { password: _password, ...safeUser } = localAccount;
            const authToken = safeUser.id;
            set({ user: safeUser, token: authToken });
            safeAsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken).catch(() => {});
            return null;
          }

          return result.error || 'Invalid email or password.';
        }

        const loggedInUser = result.user;
        const authToken = result.token || loggedInUser.id;

        // Set memory state and save ONLY token to AsyncStorage
        set((state) => ({
          user: loggedInUser,
          token: authToken,
          users: state.users.some((item) => item.id === loggedInUser.id)
            ? state.users.map((item) =>
                item.id === loggedInUser.id ? { ...item, ...loggedInUser } : item
              )
            : [...state.users, loggedInUser],
        }));

        safeAsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken).catch(() => {});
        attachCurrentUserListener(loggedInUser.id);
        return null;
      },

      updateUserProfile: async (updates) => {
        const currentUser = get().user;
        if (!currentUser) return;

        // Optimistic local update
        const updatedUser = { ...currentUser, ...updates };
        set((state) => ({
          user: updatedUser,
          users: state.users.map((item) =>
            item.id === currentUser.id ? { ...item, ...updates } : item
          ),
        }));

        // Write directly to Cloud Firestore API
        if (currentUser.id && currentUser.role !== 'admin') {
          try {
            await updateUserFirestoreProfile(currentUser.id, updates);
          } catch (err) {
            console.warn('Failed to update user profile in Firestore API:', err);
          }
        }
      },

      logout: () => {
        if (unsubscribeCurrentUser) {
          unsubscribeCurrentUser();
          unsubscribeCurrentUser = null;
        }
        logoutFirebase().catch(() => {});
        safeAsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY).catch(() => {});
        set({ user: null, token: null });
      },

      deleteUser: async (userId: string) => {
        if (userId === demoAdmin.id) return;

        // Optimistic local update
        set((state) => ({
          users: state.users.filter((item) => item.id !== userId),
          user: state.user?.id === userId ? null : state.user,
        }));

        // Delete from Cloud Firestore API
        try {
          await deleteUserFromFirestore(userId);
        } catch (err) {
          console.warn('Failed to delete user from Firestore API:', err);
        }
      },
    }),
    {
      name: 'carepoint-demo-auth',
      storage: createJSONStorage(() => safeAsyncStorage),
      partialize: (state) => ({
        // Note: As requested, ONLY the auth token is stored in AsyncStorage!
        // All user profiles, doctors, patients, and appointments are stored in Cloud Firestore API.
        token: state.token,
      }),
      onRehydrateStorage: () => async (state) => {
        // Read persisted token
        const persistedToken = state?.token || (await safeAsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY));

        if (persistedToken === ADMIN_SESSION_TOKEN) {
          const { password: _password, ...safeAdmin } = demoAdmin;
          useAuthStore.setState({ user: safeAdmin, token: persistedToken, hasHydrated: true });
          return;
        }

        // If there's an active Firebase session, load user profile from Firestore API
        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            const token = await firebaseUser.getIdToken().catch(() => firebaseUser.uid);
            const userProfile = await fetchUserProfileById(firebaseUser.uid);

            const resolvedUser: AuthUser = userProfile || {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: 'patient',
            };

            useAuthStore.setState({
              user: resolvedUser,
              token,
              hasHydrated: true,
            });

            safeAsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token).catch(() => {});
            attachCurrentUserListener(resolvedUser.id);
          } else {
            // No active Firebase session
            const currentToken = useAuthStore.getState().token;
            if (currentToken && currentToken !== ADMIN_SESSION_TOKEN) {
              useAuthStore.setState({ user: null, token: null });
              safeAsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY).catch(() => {});
            }
            useAuthStore.setState({ hasHydrated: true });
          }
          unsubscribeAuth();
        });

        // Safety fallback: if Firebase onAuthStateChanged takes longer than 2.5s, mark hydrated
        setTimeout(() => {
          if (!useAuthStore.getState().hasHydrated) {
            useAuthStore.setState({ hasHydrated: true });
          }
        }, 2500);
      },
    }
  )
);

// Real-time Cloud Firestore subscription for all users and patients
let unsubscribeUsers: (() => void) | null = null;

export function initUsersFirestoreListener(): () => void {
  if (unsubscribeUsers) return unsubscribeUsers;

  unsubscribeUsers = subscribeToUsers(
    (firestoreUsers) => {
      const hasAdmin = firestoreUsers.some((u) => u.email === ADMIN_EMAIL);
      const combined = hasAdmin
        ? firestoreUsers
        : [demoAdmin, ...firestoreUsers.filter((u) => u.id !== demoAdmin.id)];

      useAuthStore.setState({
        users: combined,
        isLoadingUsers: false,
      });
    },
    (error) => {
      console.warn('Firestore users subscription error:', error);
      useAuthStore.setState({ isLoadingUsers: false });
    }
  );

  return unsubscribeUsers;
}

// Automatically start listening to Cloud Firestore API
initUsersFirestoreListener();
