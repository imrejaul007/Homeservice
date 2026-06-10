/** Tailwind gradient classes — must be static for JIT */
export const OFFER_GRADIENT_MAP: Record<string, string> = {
  'from-nilin-rose to-nilin-coral': 'from-rose-400 via-orange-300 to-amber-400',
  'from-nilin-charcoal to-gray-700': 'from-gray-800 via-gray-700 to-gray-600',
  'from-nilin-blush to-nilin-rose': 'from-pink-200 via-rose-300 to-pink-400',
  'from-emerald-500 to-teal-600': 'from-emerald-500 via-teal-500 to-cyan-500',
  'from-violet-500 to-purple-600': 'from-violet-500 via-purple-500 to-fuchsia-500',
};

export function resolveOfferGradient(stored?: string): string {
  if (!stored) return OFFER_GRADIENT_MAP['from-nilin-rose to-nilin-coral'];
  return OFFER_GRADIENT_MAP[stored] || OFFER_GRADIENT_MAP['from-nilin-rose to-nilin-coral'];
}

export type ValidityTone = 'success' | 'warning' | 'danger' | 'muted';

export function getOfferUsageLabel(offer: {
  maxUsesPerUser?: number;
  remainingUses?: number;
  isFullyRedeemed?: boolean;
}): string | null {
  const max = offer.maxUsesPerUser ?? 1;
  if (max <= 1) {
    if (offer.isFullyRedeemed) return '1 use per customer — limit reached';
    return '1 use per customer';
  }
  if (offer.isFullyRedeemed) return `Limit reached (${max} uses per customer)`;
  if (typeof offer.remainingUses === 'number') {
    return `${offer.remainingUses} of ${max} uses left for you`;
  }
  return `Up to ${max} uses per customer`;
}

export function getOfferValidityLabel(
  validFrom: string | Date,
  validUntil: string | Date,
  isActive = true
): { text: string; tone: ValidityTone } {
  if (!isActive) {
    return { text: 'Inactive', tone: 'muted' };
  }

  const now = new Date();
  const start = new Date(validFrom);
  const end = new Date(validUntil);
  const dayMs = 86_400_000;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { text: 'Invalid dates', tone: 'danger' };
  }

  if (end < now) {
    return { text: 'Expired', tone: 'danger' };
  }

  if (start > now) {
    const days = Math.ceil((start.getTime() - now.getTime()) / dayMs);
    if (days <= 1) return { text: 'Starts tomorrow', tone: 'warning' };
    return { text: `Starts in ${days} days`, tone: 'warning' };
  }

  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / dayMs);
  if (daysLeft <= 0) return { text: 'Ends today', tone: 'warning' };
  if (daysLeft === 1) return { text: '1 day left', tone: 'success' };
  if (daysLeft <= 14) return { text: `${daysLeft} days left`, tone: 'success' };
  return { text: `${daysLeft} days left`, tone: 'muted' };
}

export function formatOfferDateRange(validFrom: string | Date, validUntil: string | Date): string {
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  return `${new Date(validFrom).toLocaleDateString('en-AE', opts)} – ${new Date(validUntil).toLocaleDateString('en-AE', opts)}`;
}

export function formatOfferValue(type: string, value: number): string {
  if (type === 'percentage') return `${value}%`;
  if (type === 'fixed') return `AED ${value}`;
  return 'Free service';
}
