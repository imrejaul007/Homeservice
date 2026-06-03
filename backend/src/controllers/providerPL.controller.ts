import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getProviderProfitLoss, PLData } from '../services/providerPL.service';

/**
 * Get Profit & Loss data for a provider
 * FIX #4: New endpoint for P&L data
 *
 * GET /api/provider/insights/profit-loss?period=30d
 */
export const getProfitLoss = asyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const providerId = user._id.toString();

    const period = (req.query.period as '7d' | '30d' | '90d') || '30d';

    // Validate period
    if (!['7d', '30d', '90d'].includes(period)) {
      res.status(400).json({
        success: false,
        error: 'Invalid period. Must be 7d, 30d, or 90d',
      });
      return;
    }

    const plData: PLData = await getProviderProfitLoss(providerId, period);

    res.json({
      success: true,
      data: plData,
      meta: {
        period,
        providerId,
        currency: 'AED',
      },
    });
  }
);

export default {
  getProfitLoss,
};
