import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StripePaymentModal } from '../components/StripePaymentModal';
import { PaymentResult } from '../services/stripeService';
import { useAuthStore } from '../store/authStore';
import {
  DOCTOR_SUBSCRIPTION_PLANS,
  PATIENT_SUBSCRIPTION_PLANS,
  SubscriptionPlan,
  useSubscriptionStore,
} from '../store/subscriptionStore';

export default function SubscribeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const subscription = useSubscriptionStore((state) => state.subscription);
  const billingCycle = useSubscriptionStore((state) => state.billingCycle);
  const setBillingCycle = useSubscriptionStore((state) => state.setBillingCycle);
  const subscribe = useSubscriptionStore((state) => state.subscribe);
  const cancelSubscription = useSubscriptionStore((state) => state.cancelSubscription);

  const defaultRole = user?.role === 'doctor' ? 'doctor' : 'patient';
  const [roleTab, setRoleTab] = useState<'patient' | 'doctor'>(defaultRole);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  const isSubscribed = Boolean(
    subscription &&
      subscription.status === 'active' &&
      subscription.tier !== 'free' &&
      subscription.tier !== 'doctor_starter'
  );

  const currentPool =
    roleTab === 'doctor' ? DOCTOR_SUBSCRIPTION_PLANS : PATIENT_SUBSCRIPTION_PLANS;

  const plans = currentPool.filter((p) => {
    if (p.tier === 'free' || p.tier === 'doctor_starter') return true;
    return p.cycle === billingCycle;
  });

  const getActivePlanName = () => {
    if (!subscription) return '';
    if (subscription.tier === 'doctor_pro') return 'Doctor Pro Practice';
    if (subscription.tier === 'doctor_elite') return 'Doctor Clinic Elite';
    if (subscription.tier === 'vip') return 'CarePoint VIP Family Pass';
    return 'CarePoint Plus';
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (plan.tier === 'free' || plan.tier === 'doctor_starter') {
      Alert.alert(
        'Starter Plan Active',
        'You are currently enjoying our baseline features.'
      );
      return;
    }

    if (subscription?.planId === plan.id && subscription.status === 'active') {
      Alert.alert(
        'Active Subscription',
        'You are already subscribed to this membership plan.'
      );
      return;
    }

    setSelectedPlan(plan);
    setPaymentModalVisible(true);
  };

  const handlePaymentSuccess = async (result: PaymentResult) => {
    if (!user || !selectedPlan) return;

    try {
      await subscribe(user.id, selectedPlan, result.transactionId || 'txn_stripe');
      if (selectedPlan.targetRole === 'doctor') {
        Alert.alert(
          'Practice Plan Activated!',
          `Congratulations! Your ${selectedPlan.name} is now active. You have received the Verified Doctor Pro badge and top priority search ranking.\n\nReceipt: ${result.transactionId}`,
          [
            {
              text: 'View Doctor Dashboard',
              onPress: () => router.replace('/(doctor)'),
            },
            { text: 'Done', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert(
          'Subscription Activated!',
          `Welcome to ${selectedPlan.name}! Your discount and priority benefits are now active on your account.\n\nReceipt: ${result.transactionId}`,
          [
            {
              text: 'Find Doctors',
              onPress: () => router.push('/(tabs)/doctors'),
            },
            { text: 'Done', style: 'cancel' },
          ]
        );
      }
    } catch {
      Alert.alert(
        'Error',
        'Subscription could not be saved. Please contact support.'
      );
    }
  };

  const handleCancelSubscription = () => {
    if (!user) return;
    const planName = getActivePlanName();
    Alert.alert(
      'Cancel Membership',
      `Are you sure you want to cancel your ${planName}? You will lose plan benefits at the end of this billing cycle.`,
      [
        { text: 'Keep Membership', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            await cancelSubscription(user.id);
            Alert.alert(
              'Subscription Cancelled',
              'Your membership has been cancelled.'
            );
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </Pressable>
        <View style={styles.headerTitleBox}>
          <Text style={styles.title}>
            {roleTab === 'doctor'
              ? 'Doctor Practice Plans'
              : 'CarePoint Memberships'}
          </Text>
          <Text style={styles.subtitle}>
            {roleTab === 'doctor'
              ? 'Verified badges, unlimited bookings & top search ranking'
              : 'Unlock discounts & priority healthcare'}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Role Segmented Switcher */}
        <View style={styles.roleTabContainer}>
          <Pressable
            style={[styles.roleTab, roleTab === 'patient' && styles.activeRoleTab]}
            onPress={() => setRoleTab('patient')}
          >
            <Ionicons
              name="person"
              size={15}
              color={roleTab === 'patient' ? '#0F766E' : '#64748B'}
            />
            <Text
              style={[
                styles.roleTabText,
                roleTab === 'patient' && styles.activeRoleTabText,
              ]}
            >
              Patient Care Plans
            </Text>
          </Pressable>

          <Pressable
            style={[styles.roleTab, roleTab === 'doctor' && styles.activeRoleTab]}
            onPress={() => setRoleTab('doctor')}
          >
            <Ionicons
              name="medical"
              size={15}
              color={roleTab === 'doctor' ? '#0F766E' : '#64748B'}
            />
            <Text
              style={[
                styles.roleTabText,
                roleTab === 'doctor' && styles.activeRoleTabText,
              ]}
            >
              Doctor Practice Plans
            </Text>
          </Pressable>
        </View>

        {/* Active Subscription Banner if subscribed */}
        {isSubscribed && subscription && (
          <View style={styles.activeCard}>
            <View style={styles.activeHeader}>
              <View style={styles.activeBadge}>
                <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.activeBadgeText}>ACTIVE MEMBERSHIP</Text>
              </View>
              <Text style={styles.activePlanName}>{getActivePlanName()}</Text>
            </View>

            <View style={styles.activeDetails}>
              <View style={styles.activeDetailRow}>
                <Text style={styles.activeDetailLabel}>Status:</Text>
                <Text style={styles.activeDetailValue}>Active (Paid via Stripe)</Text>
              </View>
              <View style={styles.activeDetailRow}>
                <Text style={styles.activeDetailLabel}>Renewal Date:</Text>
                <Text style={styles.activeDetailValue}>
                  {new Date(subscription.renewalDate).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <View style={styles.activeDetailRow}>
                <Text style={styles.activeDetailLabel}>Stripe Transaction:</Text>
                <Text style={styles.activeDetailValue} numberOfLines={1}>
                  {subscription.paymentTransactionId}
                </Text>
              </View>
            </View>

            <Pressable style={styles.cancelSubButton} onPress={handleCancelSubscription}>
              <Text style={styles.cancelSubButtonText}>Cancel Subscription</Text>
            </Pressable>
          </View>
        )}

        {/* Cycle Toggle */}
        <View style={styles.cycleToggleContainer}>
          <Pressable
            style={[styles.cycleTab, billingCycle === 'monthly' && styles.activeCycleTab]}
            onPress={() => setBillingCycle('monthly')}
          >
            <Text
              style={[
                styles.cycleTabText,
                billingCycle === 'monthly' && styles.activeCycleTabText,
              ]}
            >
              Monthly Billing
            </Text>
          </Pressable>

          <Pressable
            style={[styles.cycleTab, billingCycle === 'yearly' && styles.activeCycleTab]}
            onPress={() => setBillingCycle('yearly')}
          >
            <View style={styles.yearlyLabelRow}>
              <Text
                style={[
                  styles.cycleTabText,
                  billingCycle === 'yearly' && styles.activeCycleTabText,
                ]}
              >
                Annual Billing
              </Text>
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>SAVE 25%</Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Plans List */}
        {plans.map((plan) => {
          const isCurrent =
            (plan.tier === 'free' && (!subscription || subscription.status !== 'active')) ||
            (subscription?.status === 'active' && subscription.planId === plan.id);

          return (
            <View
              key={plan.id}
              style={[
                styles.planCard,
                plan.popular && styles.popularCard,
                isCurrent && styles.currentCard,
              ]}
            >
              {Boolean(plan.badge) && (
                <View
                  style={[
                    styles.badgePill,
                    plan.popular ? styles.popularBadgePill : styles.regularBadgePill,
                  ]}
                >
                  <Text style={styles.badgePillText}>{plan.badge}</Text>
                </View>
              )}

              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <View style={styles.priceRow}>
                  {plan.priceBDT === 0 ? (
                    <Text style={styles.priceAmount}>Free</Text>
                  ) : (
                    <>
                      <Text style={styles.priceAmount}>৳{plan.priceBDT.toLocaleString()}</Text>
                      <Text style={styles.priceCycle}>
                        /{plan.cycle === 'yearly' ? 'year' : 'month'}
                      </Text>
                    </>
                  )}
                </View>
                {plan.priceUSD > 0 && (
                  <Text style={styles.priceUSD}>≈ ${plan.priceUSD} USD via Stripe</Text>
                )}
              </View>

              <View style={styles.featuresList}>
                {plan.features.map((feature, idx) => (
                  <View key={idx} style={styles.featureItem}>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={plan.popular ? '#0F766E' : '#16A34A'}
                    />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                style={[
                  styles.subscribeButton,
                  plan.popular && styles.popularButton,
                  isCurrent && styles.currentButton,
                ]}
                onPress={() => handleSelectPlan(plan)}
                disabled={isCurrent}
              >
                {isCurrent ? (
                  <View style={styles.btnRow}>
                    <Ionicons name="checkmark" size={16} color="#059669" />
                    <Text style={styles.currentButtonText}>Current Active Plan</Text>
                  </View>
                ) : (
                  <View style={styles.btnRow}>
                    <Ionicons name="card-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.subscribeButtonText}>
                      Subscribe with Stripe
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          );
        })}

        <View style={styles.securityBox}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#64748B" />
          <Text style={styles.securityText}>
            Protected by Stripe 256-bit SSL encryption. Cancel anytime with no hidden charges.
          </Text>
        </View>
      </ScrollView>

      {/* Stripe Payment Modal */}
      {selectedPlan && (
        <StripePaymentModal
          visible={paymentModalVisible}
          onClose={() => setPaymentModalVisible(false)}
          onSuccess={handlePaymentSuccess}
          amountBDT={selectedPlan.priceBDT}
          title={`${selectedPlan.name} Subscription`}
          subtitle={`${selectedPlan.cycle === 'yearly' ? 'Annual' : 'Monthly'} membership plan`}
          customerName={user?.name || ''}
          customerEmail={user?.email || ''}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  activeCard: {
    backgroundColor: '#0F766E',
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  activeHeader: {
    marginBottom: 12,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  activePlanName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  activeDetails: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginBottom: 14,
  },
  activeDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activeDetailLabel: {
    fontSize: 12,
    color: '#CCFBF1',
  },
  activeDetailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 1,
    textAlign: 'right',
  },
  cancelSubButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
  },
  cancelSubButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cycleToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  cycleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  activeCycleTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cycleTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  activeCycleTabText: {
    color: '#0F766E',
  },
  yearlyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  saveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  popularCard: {
    borderColor: '#0F766E',
    borderWidth: 2,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  currentCard: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  badgePill: {
    position: 'absolute',
    top: -12,
    right: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgePill: {
    backgroundColor: '#0F766E',
  },
  regularBadgePill: {
    backgroundColor: '#6366F1',
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  planHeader: {
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  planName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },
  priceAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F766E',
  },
  priceCycle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginLeft: 3,
  },
  priceUSD: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 2,
  },
  featuresList: {
    gap: 10,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    flex: 1,
  },
  subscribeButton: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularButton: {
    backgroundColor: '#0F766E',
  },
  currentButton: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subscribeButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  currentButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  securityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    marginTop: 10,
  },
  securityText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  roleTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  activeRoleTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  roleTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  activeRoleTabText: {
    color: '#0F766E',
    fontWeight: '800',
  },
});
