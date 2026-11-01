import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  CardDetails,
  PaymentResult,
  STRIPE_TEST_CARDS,
  formatCardNumber,
  formatExpiry,
  getCardBrand,
  processStripePayment,
} from '../services/stripeService';

interface StripePaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (result: PaymentResult) => void;
  amountBDT: number;
  title: string;
  subtitle?: string;
  customerName?: string;
  customerEmail?: string;
}

export function StripePaymentModal({
  visible,
  onClose,
  onSuccess,
  amountBDT,
  title,
  subtitle,
  customerName = '',
  customerEmail = '',
}: StripePaymentModalProps) {
  const [name, setName] = useState(customerName);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState<PaymentResult | null>(null);

  useEffect(() => {
    if (visible) {
      setName(customerName);
      setCardNumber('');
      setExpiry('');
      setCvc('');
      setErrorMessage('');
      setIsProcessing(false);
      setPaymentSuccess(null);
    }
  }, [visible, customerName]);

  const handleCardNumberChange = (text: string) => {
    setCardNumber(formatCardNumber(text));
    if (errorMessage) setErrorMessage('');
  };

  const handleExpiryChange = (text: string) => {
    setExpiry(formatExpiry(text));
    if (errorMessage) setErrorMessage('');
  };

  const handleFillTestCard = () => {
    const test = STRIPE_TEST_CARDS.success;
    setName(test.name);
    setCardNumber(test.number);
    setExpiry(`${test.expMonth}/${test.expYear}`);
    setCvc(test.cvc);
    setErrorMessage('');
  };

  const handlePay = async () => {
    const [expMonth, expYear] = expiry.split('/');
    if (!expMonth || !expYear) {
      setErrorMessage('Please enter a valid expiration date (MM/YY).');
      return;
    }

    const cardDetails: CardDetails = {
      name: name.trim(),
      number: cardNumber,
      expMonth,
      expYear,
      cvc: cvc.trim(),
    };

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const result = await processStripePayment({
        amount: amountBDT,
        currency: 'bdt',
        description: title,
        customerEmail,
        card: cardDetails,
      });

      if (result.success) {
        setPaymentSuccess(result);
        setTimeout(() => {
          onSuccess(result);
          onClose();
        }, 1200);
      } else {
        setErrorMessage(result.errorMessage || 'Payment could not be processed.');
      }
    } catch {
      setErrorMessage('A network error occurred while connecting to Stripe.');
    } finally {
      setIsProcessing(false);
    }
  };

  const cardBrand = getCardBrand(cardNumber);
  const usdAmount = (amountBDT / 120).toFixed(2);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (!isProcessing) onClose();
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.stripeBadge}>
                <Ionicons name="card-outline" size={16} color="#6366F1" />
                <Text style={styles.stripeBadgeText}>Stripe Secure Checkout</Text>
              </View>
              <View style={styles.sslBadge}>
                <Ionicons name="lock-closed" size={12} color="#059669" />
                <Text style={styles.sslBadgeText}>256-bit Encrypted</Text>
              </View>
            </View>

            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              disabled={isProcessing}
              hitSlop={10}
            >
              <Ionicons name="close" size={20} color="#64748B" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {/* Payment Summary */}
            <View style={styles.summaryBox}>
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryTitle} numberOfLines={2}>{title}</Text>
                {Boolean(subtitle) && (
                  <Text style={styles.summarySubtitle} numberOfLines={1}>{subtitle}</Text>
                )}
              </View>
              <View style={styles.summaryAmountBox}>
                <Text style={styles.summaryAmount}>৳{amountBDT.toLocaleString()}</Text>
                <Text style={styles.summaryAmountUSD}>≈ ${usdAmount} USD</Text>
              </View>
            </View>

            {/* Test Card Helper */}
            <Pressable style={styles.testCardButton} onPress={handleFillTestCard}>
              <Ionicons name="flash-outline" size={14} color="#0F766E" />
              <Text style={styles.testCardButtonText}>Quick-fill Stripe Test Card (4242...)</Text>
            </Pressable>

            {/* Error Message */}
            {Boolean(errorMessage) && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Success State */}
            {paymentSuccess ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={44} color="#16A34A" />
                <Text style={styles.successTitle}>Payment Approved!</Text>
                <Text style={styles.successText}>Receipt ID: {paymentSuccess.transactionId}</Text>
              </View>
            ) : (
              <>
                {/* Cardholder Name */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Cardholder Name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Name as printed on card"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    autoCapitalize="words"
                    editable={!isProcessing}
                  />
                </View>

                {/* Card Number */}
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Card Number</Text>
                    {cardNumber.length > 0 && (
                      <View style={styles.brandPill}>
                        <Text style={styles.brandPillText}>{cardBrand}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="card" size={18} color="#64748B" />
                    <TextInput
                      value={cardNumber}
                      onChangeText={handleCardNumberChange}
                      placeholder="4242 4242 4242 4242"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      maxLength={19}
                      style={styles.inputInner}
                      editable={!isProcessing}
                    />
                  </View>
                </View>

                {/* Expiry and CVC Row */}
                <View style={styles.rowTwoCols}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Expires</Text>
                    <TextInput
                      value={expiry}
                      onChangeText={handleExpiryChange}
                      placeholder="MM/YY"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      maxLength={5}
                      style={styles.input}
                      editable={!isProcessing}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.labelRow}>
                      <Text style={styles.label}>CVC</Text>
                      <Ionicons name="help-circle-outline" size={13} color="#94A3B8" />
                    </View>
                    <TextInput
                      value={cvc}
                      onChangeText={setCvc}
                      placeholder="123"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      maxLength={4}
                      secureTextEntry
                      style={styles.input}
                      editable={!isProcessing}
                    />
                  </View>
                </View>

                {/* Pay Button */}
                <Pressable
                  style={[styles.payButton, isProcessing && styles.disabledPayButton]}
                  onPress={handlePay}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <View style={styles.payButtonContent}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.payButtonText}>Contacting Stripe...</Text>
                    </View>
                  ) : (
                    <View style={styles.payButtonContent}>
                      <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
                      <Text style={styles.payButtonText}>
                        Pay ৳{amountBDT.toLocaleString()}
                      </Text>
                    </View>
                  )}
                </Pressable>

                <Text style={styles.footerNote}>
                  Payments are processed securely via Stripe. Your card information never touches our servers.
                </Text>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stripeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stripeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  sslBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sslBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  summaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  summaryInfo: {
    flex: 1,
    marginRight: 12,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  summarySubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  summaryAmountBox: {
    alignItems: 'flex-end',
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F766E',
  },
  summaryAmountUSD: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  testCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 10,
    paddingVertical: 9,
    marginBottom: 16,
  },
  testCardButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#16A34A',
  },
  successText: {
    fontSize: 12,
    color: '#64748B',
  },
  formGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  brandPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  brandPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: '#0F172A',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  inputInner: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    paddingVertical: 0,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  payButton: {
    backgroundColor: '#0F766E',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledPayButton: {
    opacity: 0.7,
  },
  payButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  footerNote: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 14,
  },
});
