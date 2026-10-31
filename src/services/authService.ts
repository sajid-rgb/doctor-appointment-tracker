import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  type Unsubscribe,
  updateDoc,
} from 'firebase/firestore';

import { auth, db } from '../config/firebase';
import type { AuthUser, UserRole } from '../store/authStore';

export type SignUpRole = 'patient' | 'doctor';

export interface FirebaseSignUpPayload {
  name: string;
  email: string;
  password: string;
  role: SignUpRole;
}

export interface FirebaseLoginPayload {
  email: string;
  password: string;
}

export interface AuthResult {
  user: AuthUser | null;
  token?: string | null;
  error: string | null;
}

const USERS_COLLECTION = 'users';

/**
 * Utility to run an async operation with a maximum timeout.
 * Prevents hanging Firestore streams from blocking login or signup.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackValue?: T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve, reject) =>
      setTimeout(() => {
        if (fallbackValue !== undefined) {
          resolve(fallbackValue);
        } else {
          reject(new Error('Operation timed out'));
        }
      }, timeoutMs)
    ),
  ]);
}

/**
 * Removes undefined fields from objects before sending to Firestore
 */
export function sanitizeForFirestore(obj: any): any {
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

function normalizeUserDoc(id: string, data: any): AuthUser {
  return {
    id,
    name: data?.name || '',
    email: data?.email || '',
    role: (data?.role as UserRole) || 'patient',
    image: data?.image,
    phone: data?.phone,
    age:
      typeof data?.age === 'number'
        ? data.age
        : data?.age
        ? Number(data.age)
        : undefined,
    gender: data?.gender,
    bloodGroup: data?.bloodGroup,
    address: data?.address,
    emergencyContact: data?.emergencyContact,
    medicalHistory: data?.medicalHistory,
  };
}

/**
 * Translates Firebase Auth and Firestore error codes into friendly user messages.
 */
export function formatFirebaseAuthError(error: any): string {
  if (!error) return 'An unknown error occurred. Please try again.';

  if (typeof error === 'string') {
    return error;
  }

  const code = (error.code || '').toLowerCase();
  const rawMsg = (error.message || '').toLowerCase();

  if (
    code.includes('email-already-in-use') ||
    rawMsg.includes('email-already-in-use')
  ) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (code.includes('invalid-email') || rawMsg.includes('invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (
    code.includes('user-not-found') ||
    code.includes('wrong-password') ||
    code.includes('invalid-credential') ||
    rawMsg.includes('invalid-credential') ||
    rawMsg.includes('user-not-found') ||
    rawMsg.includes('wrong-password')
  ) {
    return 'Invalid email or password.';
  }
  if (code.includes('weak-password') || rawMsg.includes('weak-password')) {
    return 'Password is too weak. Please use at least 8 characters.';
  }
  if (code.includes('user-disabled') || rawMsg.includes('user-disabled')) {
    return 'This account has been disabled. Please contact support.';
  }
  if (
    code.includes('too-many-requests') ||
    rawMsg.includes('too-many-requests')
  ) {
    return 'Too many attempts. Please try again in a few minutes.';
  }
  if (
    code.includes('network-request-failed') ||
    rawMsg.includes('network-request-failed')
  ) {
    return 'Network error. Please check your internet connection.';
  }
  if (
    code.includes('operation-not-allowed') ||
    rawMsg.includes('operation-not-allowed')
  ) {
    return 'Email/Password sign-in is not enabled in Firebase Console. Please enable Email/Password in Firebase Console > Authentication > Sign-in method.';
  }
  if (
    code.includes('permission-denied') ||
    rawMsg.includes('permission-denied') ||
    rawMsg.includes('missing or insufficient permissions')
  ) {
    return 'Firestore permission denied: Please check your Cloud Firestore security rules in Firebase Console.';
  }
  if (code.includes('unavailable') || rawMsg.includes('unavailable')) {
    return 'The database service is currently unavailable. Please check your network and try again.';
  }
  if (
    code.includes('failed-precondition') ||
    rawMsg.includes('datastore mode')
  ) {
    return 'Firestore is configured in Datastore Mode on Google Cloud. Please switch to Firestore Native Mode in Firebase Console.';
  }
  if (
    code.includes('api-key-not-valid') ||
    rawMsg.includes('api-key-not-valid')
  ) {
    return 'Invalid Firebase API key. Please check your firebaseConfig credentials.';
  }

  // Clean Firebase boilerplate: "Firebase: Error (auth/something)."
  const cleaned = (error.message || '')
    .replace(/^Firebase:\s*/i, '')
    .replace(/\s*\(auth\/[a-z0-9-]+\)\.?/i, '')
    .trim();

  return cleaned || error.code || 'Operation failed. Please try again.';
}

/**
 * Signs up a new user using Firebase Authentication and stores user profile in Cloud Firestore.
 * Protected with a timeout to prevent hanging on misconfigured Firestore databases.
 */
export async function signUpWithFirebase(
  name: string,
  email: string,
  password: string,
  role: SignUpRole
): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  try {
    // 1. Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      normalizedEmail,
      password
    );
    const firebaseUser = userCredential.user;

    // 2. Set Firebase displayName
    if (cleanName) {
      try {
        await updateProfile(firebaseUser, { displayName: cleanName });
      } catch (profileErr) {
        console.warn('Firebase updateProfile warning:', profileErr);
      }
    }

    const authUser: AuthUser = {
      id: firebaseUser.uid,
      name: cleanName,
      email: normalizedEmail,
      role,
    };

    // 3. Attempt to initialize user document in Cloud Firestore (with 2500ms timeout)
    try {
      const newUserData: AuthUser & { createdAt: string } = {
        ...authUser,
        createdAt: new Date().toISOString(),
      };
      const userDocRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
      const sanitized = sanitizeForFirestore(newUserData);
      await withTimeout(setDoc(userDocRef, sanitized), 2500);
    } catch (firestoreError: any) {
      console.warn(
        'Firestore user creation non-fatal warning (timeout or Datastore mode):',
        firestoreError?.message || firestoreError
      );
    }

    const token = await firebaseUser.getIdToken().catch(() => firebaseUser.uid);
    return { user: authUser, token, error: null };
  } catch (error: any) {
    console.error('Firebase signUp error:', error);
    return { user: null, token: null, error: formatFirebaseAuthError(error) };
  }
}

/**
 * Signs in an existing user using Firebase Authentication and loads profile data.
 * Protected with a timeout so login always succeeds and redirects even if Firestore is slow/offline.
 */
export async function loginWithFirebase(
  email: string,
  password: string
): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    // 1. Sign in with Firebase Auth (Throws immediately if invalid credentials)
    const userCredential = await signInWithEmailAndPassword(
      auth,
      normalizedEmail,
      password
    );
    const firebaseUser = userCredential.user;

    // 2. Retrieve user document from Cloud Firestore with timeout protection
    let role: UserRole = 'patient';
    let profileData: Partial<AuthUser> = {};

    try {
      const userDocRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
      const userSnapshot = await withTimeout(
        getDoc(userDocRef),
        2500,
        null as any
      );

      if (
        userSnapshot &&
        typeof userSnapshot.exists === 'function' &&
        userSnapshot.exists()
      ) {
        const data = userSnapshot.data() as Partial<AuthUser>;
        role = (data.role as UserRole) || 'patient';
        profileData = data;
      }
    } catch (firestoreError) {
      console.warn(
        'Firestore user profile fetch timed out or offline:',
        firestoreError
      );
    }

    const authUser: AuthUser = {
      id: firebaseUser.uid,
      name:
        profileData.name ||
        firebaseUser.displayName ||
        normalizedEmail.split('@')[0],
      email: firebaseUser.email || normalizedEmail,
      role,
      image: profileData.image || firebaseUser.photoURL || undefined,
      phone: profileData.phone,
      age: profileData.age,
      gender: profileData.gender,
      bloodGroup: profileData.bloodGroup,
      address: profileData.address,
      emergencyContact: profileData.emergencyContact,
      medicalHistory: profileData.medicalHistory,
    };

    const token = await firebaseUser.getIdToken().catch(() => firebaseUser.uid);
    return { user: authUser, token, error: null };
  } catch (error: any) {
    console.error('Firebase login error:', error);
    return { user: null, token: null, error: formatFirebaseAuthError(error) };
  }
}

/**
 * Signs out the current user from Firebase Authentication.
 */
export async function logoutFirebase(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.warn('Firebase signOut warning:', error);
  }
}

/**
 * Updates user profile data in Cloud Firestore.
 */
export async function updateUserFirestoreProfile(
  userId: string,
  updates: Partial<AuthUser>
): Promise<void> {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    const sanitized = sanitizeForFirestore(updates);
    await withTimeout(setDoc(userDocRef, sanitized, { merge: true }), 3000);
  } catch (error) {
    console.warn('Failed to update user profile in Firestore:', error);
  }
}

/**
 * Subscribes to real-time users and patients updates from Cloud Firestore.
 */
export function subscribeToUsers(
  onUpdate: (users: AuthUser[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const usersRef = collection(db, USERS_COLLECTION);

  return onSnapshot(
    usersRef,
    (snapshot) => {
      const users: AuthUser[] = [];
      snapshot.forEach((docSnap) => {
        users.push(normalizeUserDoc(docSnap.id, docSnap.data()));
      });
      onUpdate(users);
    },
    (error) => {
      console.warn('Firestore users listener error:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Fetches all registered users/patients once from Cloud Firestore API.
 */
export async function fetchUsersFromFirestore(): Promise<AuthUser[]> {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const snapshot = await withTimeout(getDocs(usersRef), 3000, null as any);
    if (!snapshot) return [];

    const users: AuthUser[] = [];
    snapshot.forEach((docSnap: any) => {
      users.push(normalizeUserDoc(docSnap.id, docSnap.data()));
    });
    return users;
  } catch (error) {
    console.warn('Failed to fetch users from Firestore:', error);
    return [];
  }
}

/**
 * Subscribes to changes to a specific user's document in Cloud Firestore.
 */
export function subscribeToUserProfile(
  userId: string,
  onUpdate: (user: AuthUser | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const userDocRef = doc(db, USERS_COLLECTION, userId);

  return onSnapshot(
    userDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(normalizeUserDoc(docSnap.id, docSnap.data()));
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.warn(`Firestore user listener error for ${userId}:`, error);
      if (onError) onError(error);
    }
  );
}

/**
 * Fetches a single user document by ID from Cloud Firestore API with timeout.
 */
export async function fetchUserProfileById(
  userId: string
): Promise<AuthUser | null> {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    const snap = await withTimeout(getDoc(userDocRef), 2500, null as any);
    if (snap && typeof snap.exists === 'function' && snap.exists()) {
      return normalizeUserDoc(snap.id, snap.data());
    }
    return null;
  } catch (error) {
    console.warn(`Failed to fetch user profile for ${userId}:`, error);
    return null;
  }
}

/**
 * Gets the current Firebase Auth user ID token.
 */
export async function getFirebaseToken(): Promise<string | null> {
  try {
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Deletes a user document from Cloud Firestore API.
 */
export async function deleteUserFromFirestore(userId: string): Promise<void> {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    await withTimeout(deleteDoc(userDocRef), 3000);
  } catch (error) {
    console.warn(`Failed to delete user ${userId} from Firestore:`, error);
  }
}


