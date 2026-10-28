/**
 * Typed, deploy-time parameters and secrets for the ServEm backend.
 * Nothing here is shipped to the client; Cloud Functions injects these at
 * runtime (see SECURITY.md for setup).
 */
import { defineSecret, defineString } from 'firebase-functions/params';

/** Region agreed for proximity to the Philippines. Keep in sync with SECURITY.md. */
export const REGION = 'asia-southeast1';

/** Production hosting origins — always allowed for CORS. */
export const PROD_ORIGINS = [
  'https://servem-ph.web.app',
  'https://servem-ph.firebaseapp.com',
] as const;

/** Extra comma-separated localhost origins for local development. */
export const ALLOWED_DEV_ORIGINS = defineString('ALLOWED_DEV_ORIGINS', {
  default: 'http://localhost:5173,http://localhost:5180,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:5180',
  description: 'Comma-separated extra origins allowed for CORS (dev only).',
});

/** Secret used only for the very first admin bootstrap. */
export const ADMIN_BOOTSTRAP_TOKEN = defineSecret('ADMIN_BOOTSTRAP_TOKEN');

/** PayMongo webhook signing secret. Empty/unset => webhook fails closed with 503. */
export const PAYMONGO_WEBHOOK_SECRET = defineSecret('PAYMONGO_WEBHOOK_SECRET');

/** Platform commission applied to the service rate when computing booking fees. */
export const PLATFORM_FEE_RATE = defineString('PLATFORM_FEE_RATE', {
  default: '0.10',
  description: 'Platform fee as a decimal fraction of the subtotal (0.00-0.30).',
});

/** Minimum PHP balance a ServMate may request as a payout. */
export const MIN_PAYOUT_PHP = defineString('MIN_PAYOUT_PHP', {
  default: '1000',
  description: 'Minimum payout amount in Philippine pesos.',
});

/** Kill switch for the scheduled audit-log retention sweep. Default off. */
export const ENABLE_AUDIT_RETENTION = defineString('ENABLE_AUDIT_RETENTION', {
  default: 'false',
  description: "Set 'true' to allow the daily job to delete auditLog entries older than AUDIT_RETENTION_DAYS.",
});

export const AUDIT_RETENTION_DAYS = defineString('AUDIT_RETENTION_DAYS', {
  default: '365',
  description: 'Age in days after which auditLog entries are eligible for deletion when retention is enabled.',
});
