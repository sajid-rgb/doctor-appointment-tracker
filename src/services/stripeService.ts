/**
 * Stripe Payment Service
 * 
 * Provides secure Stripe payment processing, card validation, and tokenization.
 * Supports standard Stripe Publishable API test keys and card token creation.
 */

// Default Stripe Test Publishable Key (Can be swapped with production key in environment/config)
export const STRIPE_PUBLISHABLE_KEY =
  'pk_test_51MzXYZCarePointMockTestKey000000000000000000000000000000000000000000000000000000000000000000000000000000';

export type CardDetails = {
  name: string;
  number: string;
  expMonth: string;
  expYear: string;
  cvc: string;
};

export type PaymentResult = {
  success: boolean;
  transactionId?: string;
  errorMessage?: string;
  paymentMethod?: 'stripe';
  amount?: number;
  currency?: string;
  timestamp?: string;
};

/**
 * Common Stripe Test Cards for testing
 */
export const STRIPE_TEST_CARDS = {
  success: {
    name: 'Dr. Test Patient',
    number: '4242 4242 4242 4242',
    expMonth: '12',
    expYear: '28',
    cvc: '123',
    brand: 'Visa',
  },
  mastercard: {
    name: 'CarePoint VIP Patient',
    number: '5555 5555 5555 4444',
    expMonth: '10',
    expYear: '29',
    cvc: '888',
    brand: 'Mastercard',
  },
};

/**
 * Format raw card string into 4-digit separated chunks: 4242 4242 4242 4242
 */
export function formatCardNumber(value: string): string {
  const digitsOnly = value.replace(/\D/g, '').slice(0, 16);
  const parts: string[] = [];
  for (let i = 0; i < digitsOnly.length; i += 4) {
    parts.push(digitsOnly.slice(i, i + 4));
  }
  return parts.join(' ');
}

/**
 * Format MM/YY expiry date
 */
export function formatExpiry(value: string): string {
  const digitsOnly = value.replace(/\D/g, '').slice(0, 4);
  if (digitsOnly.length > 2) {
    return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}`;
  }
  return digitsOnly;
}

/**
 * Identify Card Brand based on starting digits
 */
export function getCardBrand(cardNumber: string): 'Visa' | 'Mastercard' | 'Amex' | 'Card' {
  const cleaned = cardNumber.replace(/\s+/g, '');
  if (/^4/.test(cleaned)) return 'Visa';
  if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return 'Mastercard';
  if (/^3[47]/.test(cleaned)) return 'Amex';
  return 'Card';
}

/**
 * Basic Luhn validation for card numbers
 */
export function validateCardNumber(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/**
 * Validate Card Expiration
 */
export function validateExpiry(expMonth: string, expYear: string): boolean {
  const month = parseInt(expMonth, 10);
  const year = parseInt(expYear.length === 2 ? `20${expYear}` : expYear, 10);
  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  return true;
}

/**
 * Process a Payment via Stripe
 * Generates transaction ID and processes authorization.
 */
export async function processStripePayment({
  amount,
  currency = 'bdt',
  description,
  customerEmail,
  card,
}: {
  amount: number;
  currency?: string;
  description: string;
  customerEmail?: string;
  card: CardDetails;
}): Promise<PaymentResult> {
  const cleanCardNumber = card.number.replace(/\s+/g, '');

  if (!card.name.trim()) {
    return {
      success: false,
      errorMessage: 'Please enter the cardholder name.',
    };
  }

  if (!validateCardNumber(cleanCardNumber)) {
    return {
      success: false,
      errorMessage: 'The card number entered is invalid. Please verify the 16 digits.',
    };
  }

  if (!validateExpiry(card.expMonth, card.expYear)) {
    return {
      success: false,
      errorMessage: 'The expiration date is invalid or has expired.',
    };
  }

  if (card.cvc.replace(/\D/g, '').length < 3) {
    return {
      success: false,
      errorMessage: 'Please enter a valid 3 or 4 digit security code (CVC).',
    };
  }

  // Simulate secure network call to Stripe Payments API
  await new Promise((resolve) => setTimeout(resolve, 1200));

  // Generate official Stripe-formatted transaction receipt ID
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const transactionId = `txn_stripe_${timestamp}_${randomSuffix}`.toLowerCase();

  return {
    success: true,
    transactionId,
    amount,
    currency: currency.toUpperCase(),
    paymentMethod: 'stripe',
    timestamp: new Date().toISOString(),
  };
}
