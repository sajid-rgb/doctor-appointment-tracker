import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
  password: string;
};

type AuthState = {
  users: DemoAccount[];
  user: AuthUser | null;
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  signUp: (
    name: string,
    email: string,
    password: string,
    role: SignUpRole
  ) => string | null;
  login: (email: string, password: string) => string | null;
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
  ) => void;
  logout: () => void;
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: [demoAdmin],
      user: null,
      hasHydrated: false,

      setHasHydrated: (value) => set({ hasHydrated: value }),

      signUp: (name, email, password, role) => {
        const normalizedEmail = email.trim().toLowerCase();

        if (normalizedEmail === ADMIN_EMAIL) {
          return 'This email is reserved for the admin account.';
        }

        if (get().users.some((item) => item.email === normalizedEmail)) {
          return 'An account with this email already exists.';
        }

        const account: DemoAccount = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: name.trim(),
          email: normalizedEmail,
          password,
          role,
        };

        set((state) => ({
          users: [...state.users, account],
          user: {
            id: account.id,
            name: account.name,
            email: account.email,
            role: account.role,
          },
        }));

        return null;
      },

      login: (email, password) => {
        const normalizedEmail = email.trim().toLowerCase();

        // Demo admin login works even if AsyncStorage has older saved users.
        if (normalizedEmail === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
          const { password: _password, ...safeAdmin } = demoAdmin;
          set({ user: safeAdmin });
          return null;
        }

        const account = get().users.find(
          (item) =>
            item.email === normalizedEmail &&
            item.password === password &&
            item.role !== 'admin'
        );

        if (!account) {
          return 'Invalid email or password.';
        }

        const { password: _password, ...safeUser } = account;
        set({ user: safeUser });

        return null;
      },

      updateUserProfile: (updates) =>
        set((state) => {
          if (!state.user) return state;

          const updatedUser = { ...state.user, ...updates };

          return {
            user: updatedUser,
            users: state.users.map((item) =>
              item.id === state.user?.id ? { ...item, ...updates } : item
            ),
          };
        }),

      logout: () => set({ user: null }),
    }),
    {
      name: 'carepoint-demo-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        users: state.users,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
