/**
 * Server-side pricing. Prices are ALWAYS recomputed here from the stored
 * service document; any client-supplied rate/fee/total is ignored by design.
 *
 * Fee model (documented assumption): platform fee = round2(subtotal *
 * PLATFORM_FEE_RATE). If a `config/platform` doc exists its `feeRate`
 * overrides the deploy-time default, clamped to [0, 0.30].
 */
import { db, round2 } from './firestore';
import { PLATFORM_FEE_RATE } from './params';

export interface Pricing {
  rate: number; // per-hour rate from the service doc
  hours: number;
  subtotal: number; // rate * hours
  fee: number; // platform fee
  total: number; // subtotal + fee
}

async function resolveFeeRate(): Promise<number> {
  let rate = Number.parseFloat(PLATFORM_FEE_RATE.value());
  if (!Number.isFinite(rate) || rate < 0 || rate > 0.3) rate = 0.1;
  try {
    const cfg = await db.collection('config').doc('platform').get();
    const cfgRate = cfg.exists ? Number((cfg.data() ?? {}).feeRate) : NaN;
    if (Number.isFinite(cfgRate) && cfgRate >= 0 && cfgRate <= 0.3) rate = cfgRate;
  } catch {
    // config read failure falls back to the deploy-time default; never to client data.
  }
  return rate;
}

export async function computePricing(ratePerHour: number, hours: number): Promise<Pricing> {
  const feeRate = await resolveFeeRate();
  const rate = round2(ratePerHour);
  const subtotal = round2(rate * hours);
  const fee = round2(subtotal * feeRate);
  return { rate, hours, subtotal, fee, total: round2(subtotal + fee) };
}

export { round2 };
