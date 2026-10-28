const philippinesFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const APP_TIME_ZONE = 'Asia/Manila';
export const APP_LOCALE = 'en-PH';

export function formatPhilippinePeso(amount: number, options?: { showCents?: boolean }) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: options?.showCents ? 2 : 0,
    maximumFractionDigits: options?.showCents ? 2 : 0,
  }).format(amount);
}

export function formatPhilippineDateTime(value: string | number | Date) {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

export function formatDistanceKm(kilometers: number) {
  return `${kilometers.toFixed(1)} km away`;
}

export function normalizePhilippineMobile(input: string) {
  const digits = input.replace(/\D/g, '');
  const local = digits.startsWith('63') ? digits.slice(2) : digits;

  if (!/^9\d{9}$/.test(local)) return null;
  return `+63 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export function validatePhilippinePostalCode(input: string) {
  return /^\d{4}$/.test(input.trim());
}

export const philippinePaymentMethods = [
  { id: 'gcash', label: 'GCash', description: 'Pay from your GCash wallet' },
  { id: 'maya', label: 'Maya', description: 'Pay from your Maya wallet' },
  { id: 'bank_transfer', label: 'Bank transfer', description: 'Send through online banking' },
  { id: 'cash_on_completion', label: 'Cash on completion', description: 'Pay after the job is finished' },
] as const;

export type PhilippinePaymentMethod = (typeof philippinePaymentMethods)[number]['id'];

export function paymentMethodLabel(method: string) {
  return philippinePaymentMethods.find((item) => item.id === method)?.label ?? 'Payment method';
}

/** ServEm platform commission, applied to the labour subtotal. */
export const PLATFORM_FEE_RATE = 0.1;

export function bookingTotals(ratePerHour: number, hours: number) {
  const subtotal = Math.round(ratePerHour * hours);
  const fee = Math.round(subtotal * PLATFORM_FEE_RATE);
  return { subtotal, fee, total: subtotal + fee };
}

export { philippinesFormatter as philippineCurrencyFormatter };
