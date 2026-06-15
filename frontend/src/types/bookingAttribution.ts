export type BookingAttributionSource =
  | 'organic'
  | 'search'
  | 'profile'
  | 'ad'
  | 'direct'
  | 'repeat';

export interface BookingAttributionContext {
  source?: BookingAttributionSource;
  adCampaignId?: string;
  query?: string;
  position?: number;
  referrer?: string;
}

export function buildBookingAttributionMetadata(
  attribution?: BookingAttributionContext,
  fallbackSource: BookingAttributionSource = 'direct',
): Record<string, string | number | undefined> {
  const source = attribution?.source ?? fallbackSource;
  return {
    bookingSource: source,
    ...(attribution?.adCampaignId ? { adCampaignId: attribution.adCampaignId } : {}),
    ...(attribution?.query ? { searchQuery: attribution.query } : {}),
    ...(attribution?.position != null ? { searchPosition: attribution.position } : {}),
    ...(attribution?.referrer ? { referrer: attribution.referrer } : {}),
  };
}
