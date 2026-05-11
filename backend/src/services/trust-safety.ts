import Booking from '../models/booking.model';

export interface RiskScore {
  overall: number;
  recommendedAction: 'ALLOW' | 'REVIEW' | 'BLOCK';
}

export const calculateTrustScore = async (userId: string): Promise<RiskScore> => {
  const bookings = await Booking.find({ customerId: userId }).lean();
  const cancelled = bookings.filter(b => b.status === 'cancelled').length;
  const score = bookings.length > 0 ? Math.max(0, 100 - cancelled * 10) : 100;
  return {
    overall: score,
    recommendedAction: score > 70 ? 'ALLOW' : score > 40 ? 'REVIEW' : 'BLOCK',
  };
};

export default { calculateTrustScore };
