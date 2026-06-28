import mongoose from 'mongoose';
import CustomerProfile from '../models/customerProfile.model';
import { getStripe } from '../services/payment.service';

/**
 * Resolve or create a Stripe customer ID for a platform user.
 * Checks CustomerProfile first, then UserSubscription, then creates a new Stripe customer.
 */
export async function ensureStripeCustomerId(userId: mongoose.Types.ObjectId): Promise<string | null> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }

  const stripe = getStripe();
  let customerProfile = await CustomerProfile.findOne({ userId });

  if (customerProfile?.stripeCustomerId) {
    return customerProfile.stripeCustomerId;
  }

  const UserSubscription = (await import('../models/userSubscription.model')).default;
  const subscription = await UserSubscription.findByUserId(userId);
  if (subscription?.stripeCustomerId) {
    if (customerProfile) {
      customerProfile.stripeCustomerId = subscription.stripeCustomerId;
      await customerProfile.save();
    }
    return subscription.stripeCustomerId;
  }

  const User = (await import('../models/user.model')).default;
  const user = await User.findById(userId).lean();
  const customer = await stripe.customers.create({
    email: user?.email,
    metadata: { userId: userId.toString() },
  });

  if (customerProfile) {
    customerProfile.stripeCustomerId = customer.id;
    await customerProfile.save();
  } else {
    await CustomerProfile.create({ userId, stripeCustomerId: customer.id });
  }

  return customer.id;
}
