import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import Wallet from '../models/wallet.model';
import {
  calculateCommission,
  DEFAULT_COMMISSION_CONFIG,
  DEFAULT_PLATFORM_FEE_CONFIG,
} from './settlement.service';
import logger from '../utils/logger';

// Commission and platform fee rates
const COMMISSION_RATE = DEFAULT_COMMISSION_CONFIG.defaultRate;
const PLATFORM_FEE_RATE = DEFAULT_PLATFORM_FEE_CONFIG.type === 'percentage'
  ? DEFAULT_PLATFORM_FEE_CONFIG.value
  : 0;

// Total deduction rate
const TOTAL_DEDUCTION_RATE = COMMISSION_RATE + PLATFORM_FEE_RATE;

export interface ExpenseCategory {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  color: string;
  subcategories?: Array<{ name: string; amount: number }>;
}

export interface PLData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  revenueBreakdown: {
    bookings: number;
    tips: number;
    packages: number;
    other: number;
  };
  expenses: ExpenseCategory[];
  monthlyData: Array<{
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
  }>;
  comparison: {
    revenueChange: number;
    expensesChange: number;
    profitChange: number;
  };
}

interface MonthData {
  month: string;
  bookings: number;
  grossRevenue: number;
}

function getDateRange(period: '7d' | '30d' | '90d'): { startDate: Date; endDate: Date; previousStartDate: Date } {
  const now = new Date();
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);
  return { startDate, endDate: now, previousStartDate };
}

function getMonthName(date: Date): string {
  return date.toLocaleString('en-US', { month: 'short' });
}

/**
 * Calculate Profit & Loss data for a provider
 * FIX #4: Connect P&L to backend data
 */
export async function getProviderProfitLoss(
  providerId: string,
  period: '7d' | '30d' | '90d' = '30d'
): Promise<PLData> {
  const providerObjectId = new mongoose.Types.ObjectId(providerId);
  const { startDate, endDate, previousStartDate } = getDateRange(period);

  // Get completed bookings for the current period
  const currentBookings = await Booking.find({
    providerId: providerObjectId,
    status: 'completed',
    createdAt: { $gte: startDate, $lte: endDate },
  }).lean();

  // Get completed bookings for the previous period
  const previousBookings = await Booking.find({
    providerId: providerObjectId,
    status: 'completed',
    createdAt: { $gte: previousStartDate, $lt: startDate },
  }).lean();

  // Calculate gross revenue from bookings
  const grossRevenue = currentBookings.reduce(
    (sum, b) => sum + (b.pricing?.totalAmount || 0),
    0
  );

  // FIX #1 & #2: Calculate platform fees and commission deductions
  const platformFees = grossRevenue * PLATFORM_FEE_RATE;
  const commissions = grossRevenue * COMMISSION_RATE;
  const totalDeductions = platformFees + commissions;

  // Revenue breakdown
  const revenueBreakdown = {
    bookings: grossRevenue,
    tips: 0, // Would need tips field in booking model
    packages: 0, // Would need packages field in booking model
    other: 0,
  };

  // Expense categories (platform fees as expenses)
  const expenseColors = ['#E8B4A8', '#D4A5A0', '#C09590', '#A88580', '#8C7570', '#6B5A55', '#554540'];

  const expenses: ExpenseCategory[] = [
    {
      id: 'fees',
      name: 'Platform Fees',
      amount: Math.round(platformFees * 100) / 100,
      percentage: grossRevenue > 0 ? Math.round((platformFees / grossRevenue) * 100) : 0,
      color: expenseColors[0],
    },
    {
      id: 'commission',
      name: 'Commission',
      amount: Math.round(commissions * 100) / 100,
      percentage: grossRevenue > 0 ? Math.round((commissions / grossRevenue) * 100) : 0,
      color: expenseColors[1],
    },
  ];

  const totalExpenses = Math.round(totalDeductions * 100) / 100;
  const netProfit = Math.round((grossRevenue - totalDeductions) * 100) / 100;
  const profitMargin = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100 * 10) / 10 : 0;

  // Calculate previous period revenue
  const previousGrossRevenue = previousBookings.reduce(
    (sum, b) => sum + (b.pricing?.totalAmount || 0),
    0
  );
  const previousPlatformFees = previousGrossRevenue * PLATFORM_FEE_RATE;
  const previousCommissions = previousGrossRevenue * COMMISSION_RATE;
  const previousTotalDeductions = previousPlatformFees + previousCommissions;
  const previousNetProfit = previousGrossRevenue - previousTotalDeductions;

  // Calculate month-over-month comparison
  const revenueChange = previousGrossRevenue > 0
    ? Math.round(((grossRevenue - previousGrossRevenue) / previousGrossRevenue) * 1000) / 10
    : 0;

  const expensesChange = previousTotalDeductions > 0
    ? Math.round(((totalExpenses - previousTotalDeductions) / previousTotalDeductions) * 1000) / 10
    : 0;

  const profitChange = previousNetProfit !== 0
    ? Math.round(((netProfit - previousNetProfit) / Math.abs(previousNetProfit)) * 1000) / 10
    : netProfit > 0 ? 100 : 0;

  // Generate monthly data for the period
  const monthlyData = await generateMonthlyData(providerObjectId, period, TOTAL_DEDUCTION_RATE);

  logger.info('P&L data calculated', {
    providerId,
    period,
    grossRevenue,
    totalDeductions,
    netProfit,
    action: 'PL_CALCULATED',
  });

  return {
    totalRevenue: Math.round(grossRevenue),
    totalExpenses,
    netProfit,
    profitMargin,
    revenueBreakdown,
    expenses,
    monthlyData,
    comparison: {
      revenueChange,
      expensesChange,
      profitChange,
    },
  };
}

/**
 * Generate monthly data for P&L trend chart
 */
async function generateMonthlyData(
  providerId: Types.ObjectId,
  period: '7d' | '30d' | '90d',
  deductionRate: number
): Promise<Array<{ month: string; revenue: number; expenses: number; profit: number }>> {
  const now = new Date();
  const months = period === '7d' ? 1 : period === '90d' ? 3 : 2;

  const monthlyData: Array<{ month: string; revenue: number; expenses: number; profit: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    const monthBookings = await Booking.find({
      providerId,
      status: 'completed',
      createdAt: { $gte: monthDate, $lte: monthEnd },
    }).lean();

    const grossRevenue = monthBookings.reduce(
      (sum, b) => sum + (b.pricing?.totalAmount || 0),
      0
    );

    const expenses = Math.round(grossRevenue * deductionRate * 100) / 100;
    const profit = Math.round((grossRevenue - expenses) * 100) / 100;

    monthlyData.push({
      month: getMonthName(monthDate),
      revenue: Math.round(grossRevenue),
      expenses,
      profit,
    });
  }

  return monthlyData;
}

export default {
  getProviderProfitLoss,
};
