import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { safeAsyncStorage } from './storage';

export type SubscriptionTier =
  | 'free'
  | 'plus'
  | 'vip'
  | 'doctor_starter'
  | 'doctor_pro'
  | 'doctor_elite';

export type BillingCycle = 'monthly' | 'yearly';
export type PlanRole = 'patient' | 'doctor';

export type SubscriptionPlan = {
  id: string;
  targetRole: PlanRole;
  tier: SubscriptionTier;
  name: string;
  cycle: BillingCycle;
  priceBDT: number;
  priceUSD: number;
  badge?: string;
  discountPercent?: number; // e.g. 20 for 20% off consultation fees
  popular?: boolean;
  features: string[];
};

export type UserSubscription = {
  userId: string;
  planId: string;
  tier: SubscriptionTier;
  cycle: BillingCycle;
  status: 'active' | 'cancelled' | 'expired';
  startDate: string;
  renewalDate: string;
  amountBDT: number;
  paymentTransactionId: string;
};

export const PATIENT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    targetRole: 'patient',
    tier: 'free',
    name: 'Free Member',
    cycle: 'monthly',
    priceBDT: 0,
    priceUSD: 0,
    discountPercent: 0,
    features: [
      'Standard doctor search & booking',
      'Digital patient intake form',
      'In-app notification alerts',
      'View past appointment records',
    ],
  },
  {
    id: 'carepoint-plus-monthly',
    targetRole: 'patient',
    tier: 'plus',
    name: 'CarePoint Plus',
    cycle: 'monthly',
    priceBDT: 999,
    priceUSD: 9.99,
    discountPercent: 20,
    popular: true,
    badge: 'Most Popular',
    features: [
      '20% OFF all doctor consultation fees',
      'Priority appointment serials (SL-01 / SL-02)',
      'Free rescheduling at any time',
      'Unlimited digital prescription uploads',
      'Direct WhatsApp booking confirmations',
      'Verified Plus Patient Badge',
    ],
  },
  {
    id: 'carepoint-plus-yearly',
    targetRole: 'patient',
    tier: 'plus',
    name: 'CarePoint Plus (Annual)',
    cycle: 'yearly',
    priceBDT: 8999,
    priceUSD: 89.99,
    discountPercent: 25,
    badge: 'Save 25%',
    features: [
      '25% OFF all doctor consultation fees',
      'All CarePoint Plus Monthly benefits',
      '2 Months Free billing compared to monthly',
      'Family prescription archive',
      'Priority customer assistance',
    ],
  },
  {
    id: 'carepoint-vip-yearly',
    targetRole: 'patient',
    tier: 'vip',
    name: 'CarePoint VIP Family Pass',
    cycle: 'yearly',
    priceBDT: 14999,
    priceUSD: 149.99,
    discountPercent: 30,
    badge: 'Ultimate Care',
    features: [
      '30% OFF all doctor consultation fees',
      '2 FREE specialist consultations per year',
      'Coverage for up to 4 family members',
      'Top priority queue placement',
      '24/7 dedicated medical support line',
      'VIP Gold Badge across CarePoint',
    ],
  },
];

export const DOCTOR_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'doctor-starter',
    targetRole: 'doctor',
    tier: 'doctor_starter',
    name: 'Doctor Starter Practice',
    cycle: 'monthly',
    priceBDT: 0,
    priceUSD: 0,
    features: [
      'Standard directory listing',
      'Up to 15 appointments per month',
      'Basic weekly schedule manager',
      'Patient intake symptom review',
    ],
  },
  {
    id: 'doctor-pro-monthly',
    targetRole: 'doctor',
    tier: 'doctor_pro',
    name: 'Doctor Pro Practice',
    cycle: 'monthly',
    priceBDT: 2499,
    priceUSD: 24.99,
    popular: true,
    badge: 'Recommended',
    features: [
      'Verified Doctor Pro Badge in Search',
      'Unlimited patient appointment bookings',
      'Top ranking in doctor search results',
      '0% platform commission on patient fees',
      'Custom slot durations (15m, 20m, 30m, 45m)',
      'Direct WhatsApp booking slip dispatch',
      'Digital prescription archive & download',
    ],
  },
  {
    id: 'doctor-pro-yearly',
    targetRole: 'doctor',
    tier: 'doctor_pro',
    name: 'Doctor Pro Practice (Annual)',
    cycle: 'yearly',
    priceBDT: 23999,
    priceUSD: 239.99,
    badge: 'Save 20%',
    features: [
      'All Doctor Pro Monthly features included',
      '2 Months Free (Save ৳6,000 annually)',
      'Featured Gold Star badge on public profile',
      'Priority patient queue notification alerts',
      'Quarterly practice growth analytics',
    ],
  },
  {
    id: 'doctor-elite-yearly',
    targetRole: 'doctor',
    tier: 'doctor_elite',
    name: 'Doctor Clinic Elite',
    cycle: 'yearly',
    priceBDT: 49999,
    priceUSD: 499.99,
    badge: 'Multi-Chamber Elite',
    features: [
      'Top #1 Placement across all specialties',
      'Multi-chamber and clinic location setup',
      'Clinic assistant & receptionist sub-accounts',
      'Automated SMS & WhatsApp patient reminders',
      '24/7 dedicated practice support manager',
      'Custom clinic branding on patient slips',
    ],
  },
];

export const SUBSCRIPTION_PLANS = PATIENT_SUBSCRIPTION_PLANS;

type SubscriptionState = {
  subscription: UserSubscription | null;
  billingCycle: BillingCycle;
  isLoading: boolean;
  setBillingCycle: (cycle: BillingCycle) => void;
  fetchSubscription: (userId: string) => Promise<void>;
  subscribe: (
    userId: string,
    plan: SubscriptionPlan,
    transactionId: string
  ) => Promise<void>;
  cancelSubscription: (userId: string) => Promise<void>;
  getDiscountedFee: (baseFee: number) => number;
};

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      subscription: null,
      billingCycle: 'monthly',
      isLoading: false,

      setBillingCycle: (cycle) => set({ billingCycle: cycle }),

      fetchSubscription: async (userId: string) => {
        if (!userId) return;
        set({ isLoading: true });
        try {
          const subRef = doc(db, 'subscriptions', userId);
          const snap = await getDoc(subRef);
          if (snap.exists()) {
            set({ subscription: snap.data() as UserSubscription, isLoading: false });
          } else {
            set({ subscription: null, isLoading: false });
          }
        } catch (err) {
          console.warn('Failed to fetch subscription from Firestore:', err);
          set({ isLoading: false });
        }
      },

      subscribe: async (userId, plan, transactionId) => {
        const now = new Date();
        const renewal = new Date();
        if (plan.cycle === 'yearly') {
          renewal.setFullYear(renewal.getFullYear() + 1);
        } else {
          renewal.setMonth(renewal.getMonth() + 1);
        }

        const newSub: UserSubscription = {
          userId,
          planId: plan.id,
          tier: plan.tier,
          cycle: plan.cycle,
          status: 'active',
          startDate: now.toISOString(),
          renewalDate: renewal.toISOString(),
          amountBDT: plan.priceBDT,
          paymentTransactionId: transactionId,
        };

        // Optimistic update
        set({ subscription: newSub });

        try {
          // Persist to Cloud Firestore
          await setDoc(doc(db, 'subscriptions', userId), newSub, { merge: true });
          await setDoc(
            doc(db, 'users', userId),
            {
              subscriptionTier: plan.tier,
              subscriptionStatus: 'active',
            },
            { merge: true }
          );

          if (plan.targetRole === 'doctor') {
            await setDoc(
              doc(db, 'doctors', userId),
              {
                subscriptionTier: plan.tier,
                subscriptionStatus: 'active',
                isFeatured:
                  plan.tier === 'doctor_pro' || plan.tier === 'doctor_elite',
              },
              { merge: true }
            );
          }
        } catch (err) {
          console.warn('Failed to sync subscription to Firestore:', err);
        }
      },

      cancelSubscription: async (userId) => {
        const current = get().subscription;
        if (!current) return;

        const updated: UserSubscription = {
          ...current,
          status: 'cancelled',
        };

        set({ subscription: updated });

        try {
          await setDoc(
            doc(db, 'subscriptions', userId),
            { status: 'cancelled' },
            { merge: true }
          );
          await setDoc(
            doc(db, 'users', userId),
            { subscriptionStatus: 'cancelled' },
            { merge: true }
          );
          await setDoc(
            doc(db, 'doctors', userId),
            {
              subscriptionStatus: 'cancelled',
              isFeatured: false,
            },
            { merge: true }
          );
        } catch (err) {
          console.warn('Failed to cancel subscription in Firestore:', err);
        }
      },

      getDiscountedFee: (baseFee: number) => {
        const sub = get().subscription;
        if (!sub || sub.status !== 'active') return baseFee;

        let discountPercent = 0;
        if (sub.tier === 'plus') discountPercent = 20;
        if (sub.tier === 'vip') discountPercent = 30;

        const discounted = Math.round(baseFee * (1 - discountPercent / 100));
        return Math.max(0, discounted);
      },
    }),
    {
      name: 'carepoint-subscription-storage',
      storage: createJSONStorage(() => safeAsyncStorage),
      partialize: (state) => ({
        subscription: state.subscription,
        billingCycle: state.billingCycle,
      }),
    }
  )
);
