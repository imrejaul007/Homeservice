export interface SurgeConfig {
  multiplier: number;
  reason: string;
  validUntil: Date;
}

const SURGE_MULTIPLIERS = {
  peak: 1.5,
  weekend: 1.3,
  holiday: 2.0,
  lowSupply: 1.2,
};

export const getSurgeMultiplier = (_serviceId: string, date: Date): SurgeConfig => {
  const hour = date.getHours();
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  
  let multiplier = 1.0;
  let reason = 'standard';
  
  if (isWeekend) {
    multiplier = SURGE_MULTIPLIERS.weekend;
    reason = 'weekend';
  } else if (hour >= 9 && hour <= 12) {
    multiplier = SURGE_MULTIPLIERS.peak;
    reason = 'peak';
  }
  
  return {
    multiplier,
    reason,
    validUntil: new Date(Date.now() + 60 * 60 * 1000),
  };
};

export const experimentBucket = (userId: string, _experimentId: string): string => {
  const hash = userId.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
  return hash % 2 === 0 ? 'control' : 'variant';
};

export default { getSurgeMultiplier, experimentBucket };
