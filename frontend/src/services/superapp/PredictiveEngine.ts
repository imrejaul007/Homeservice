// Predictive Engine - Rule-based booking predictions and automation
// Uses historical booking patterns and service data for deterministic predictions
import { create } from 'zustand';

export interface BookingSuggestion {
  serviceId: string;
  serviceName: string;
  suggestedTime: Date;
  reason: string;
  confidence: number; // 0-100
  savings?: number;
  urgency: 'low' | 'medium' | 'high';
}

export interface BookingPattern {
  frequencyDays: number;
  preferredServices: string[];
  preferredTimeSlots: string[];
  preferredProviders: string[];
  lastBooking: Date;
  seasonalTrend: 'increasing' | 'decreasing' | 'stable';
}

class PredictiveEngine {
  // Analyze user booking patterns
  analyzePatterns(bookings: any[]): BookingPattern {
    if (bookings.length === 0) {
      return {
        frequencyDays: 0,
        preferredServices: [],
        preferredTimeSlots: [],
        preferredProviders: [],
        lastBooking: new Date(),
        seasonalTrend: 'stable',
      };
    }

    // Calculate average frequency
    const sortedBookings = bookings.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    let totalDays = 0;
    for (let i = 1; i < sortedBookings.length; i++) {
      const diff = new Date(sortedBookings[i-1].createdAt).getTime() -
                   new Date(sortedBookings[i].createdAt).getTime();
      totalDays += diff / (1000 * 60 * 60 * 24);
    }
    const frequencyDays = sortedBookings.length > 1 ?
      totalDays / (sortedBookings.length - 1) : 30;

    // Get preferred services
    const serviceCounts: Record<string, number> = {};
    bookings.forEach(b => {
      serviceCounts[b.serviceId] = (serviceCounts[b.serviceId] || 0) + 1;
    });
    const preferredServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    // Get preferred time slots
    const timeSlots: Record<string, number> = {};
    bookings.forEach(b => {
      const hour = new Date(b.scheduledAt).getHours();
      const slot = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
      timeSlots[slot] = (timeSlots[slot] || 0) + 1;
    });
    const preferredTimeSlots = Object.entries(timeSlots)
      .sort((a, b) => b[1] - a[1])
      .map(([slot]) => slot);

    // Check seasonal trend
    const recentBookings = bookings.filter(b => {
      const daysSince = (Date.now() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 90;
    });
    const seasonalTrend = recentBookings.length > bookings.length * 0.6 ? 'increasing' :
                          recentBookings.length < bookings.length * 0.3 ? 'decreasing' : 'stable';

    return {
      frequencyDays,
      preferredServices,
      preferredTimeSlots,
      preferredProviders: [],
      lastBooking: new Date(sortedBookings[0].createdAt),
      seasonalTrend,
    };
  }

  // Generate next booking suggestion
  async getNextBookingSuggestion(
    userId: string,
    bookings: any[],
    services: any[]
  ): Promise<BookingSuggestion | null> {
    const patterns = this.analyzePatterns(bookings);

    if (patterns.frequencyDays === 0 || patterns.preferredServices.length === 0) {
      return null;
    }

    // Calculate days since last booking
    const daysSinceLast = (Date.now() - patterns.lastBooking.getTime()) / (1000 * 60 * 60 * 24);

    // Check if it's time for next booking
    if (daysSinceLast < patterns.frequencyDays * 0.8) {
      return null; // Too early
    }

    // Get most booked service
    const topServiceId = patterns.preferredServices[0];
    const service = services.find(s => s.id === topServiceId);

    if (!service) return null;

    // Calculate confidence based on pattern strength
    const confidence = Math.min(95,
      50 + // Base confidence
      (patterns.frequencyDays > 0 ? 20 : 0) + // Has regular pattern
      (patterns.preferredServices.length > 3 ? 15 : 0) + // Consistent preferences
      (patterns.seasonalTrend === 'increasing' ? 10 : 0) // Positive trend
    );

    // Calculate urgency
    let urgency: 'low' | 'medium' | 'high' = 'low';
    if (daysSinceLast > patterns.frequencyDays * 1.5) {
      urgency = 'high';
    } else if (daysSinceLast > patterns.frequencyDays) {
      urgency = 'medium';
    }

    // Generate reason - deterministic based on days since last booking
    let reason: string;
    if (daysSinceLast > patterns.frequencyDays * 1.5) {
      reason = `It's been ${Math.round(daysSinceLast)} days since your last ${service.name} - overdue for service`;
    } else if (patterns.seasonalTrend === 'increasing') {
      reason = `You've been booking more ${service.name} recently - time for your next appointment`;
    } else if (patterns.preferredTimeSlots.length > 0) {
      reason = `Based on your booking patterns, ${patterns.preferredTimeSlots[0]} is the best time for ${service.name}`;
    } else {
      reason = `It's been ${Math.round(daysSinceLast)} days since your last ${service.name}`;
    }

    // Calculate potential savings
    const savings = service.discount ? Math.round(service.price * (service.discount / 100)) : undefined;

    // Suggest optimal time based on preferences
    const preferredSlot = patterns.preferredTimeSlots[0] || 'afternoon';
    const suggestedTime = this.getNextOptimalTime(preferredSlot);

    return {
      serviceId: service.id,
      serviceName: service.name,
      suggestedTime,
      reason,
      confidence,
      savings,
      urgency,
    };
  }

  // Get next optimal time for a slot
  private getNextOptimalTime(preferredSlot: string): Date {
    const now = new Date();
    let hours: number;

    switch (preferredSlot) {
      case 'morning': hours = 10; break;
      case 'afternoon': hours = 14; break;
      case 'evening': hours = 18; break;
      case 'night': hours = 20; break;
      default: hours = 14;
    }

    const suggestion = new Date(now);
    suggestion.setDate(suggestion.getDate() + 1);
    suggestion.setHours(hours, 0, 0, 0);

    return suggestion;
  }

  // Predict service demand - deterministic based on day of week, time of year, and service popularity
  predictDemand(serviceId: string, date: Date): number {
    const dayOfWeek = date.getDay();
    const month = date.getMonth();
    const hour = date.getHours();

    // Base demand varies by day of week (0=Sunday)
    let demand = 50; // Base demand
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      demand = 75; // Weekends are busier
    } else if (dayOfWeek === 1 || dayOfWeek === 5) {
      demand = 60; // Monday and Friday are moderate
    }

    // Seasonal adjustment
    if (month >= 2 && month <= 4) demand *= 1.15; // Spring
    if (month >= 5 && month <= 8) demand *= 1.25; // Summer peak
    if (month >= 11 || month <= 1) demand *= 0.85; // Winter

    // Time of day adjustment
    if (hour >= 9 && hour <= 11) demand *= 1.1; // Morning peak
    if (hour >= 17 && hour <= 19) demand *= 1.15; // Evening peak
    if (hour < 8 || hour > 20) demand *= 0.6; // Off hours

    // Deterministic service-specific adjustment using serviceId hash
    const serviceHash = this.hashString(serviceId);
    demand += (serviceHash % 20) - 10; // Add -10 to +10 variance based on service

    return Math.max(10, Math.min(100, demand));
  }

  // Simple string hash for deterministic variation
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // Calculate optimal booking slot - deterministic based on time patterns
  getOptimalSlots(serviceId: string, date: Date): { time: string; availability: number }[] {
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Base availability by time slot (deterministic patterns)
    const baseAvailability = [45, 55, 50, 60, 40, 35]; // Morning, mid-morning, noon, afternoon, evening, late evening

    // Adjust for weekend (typically busier)
    if (isWeekend) {
      baseAvailability[0] = 35; // Saturday mornings book up fast
      baseAvailability[4] = 25; // Saturday evenings are popular
    }

    // Adjust for weekday patterns
    if (!isWeekend) {
      baseAvailability[0] = 50; // Weekday mornings have more availability
      baseAvailability[4] = 45; // Weekday evenings are less busy
    }

    // Deterministic service-specific adjustment
    const serviceHash = this.hashString(serviceId);
    const serviceAdjustment = (serviceHash % 15) - 7;

    const slots = ['9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM', '5:00 PM', '7:00 PM'];

    return slots.map((time, index) => ({
      time,
      availability: Math.max(5, Math.min(95, baseAvailability[index] + serviceAdjustment)),
    }));
  }
}

export const predictiveEngine = new PredictiveEngine();

// React hook for predictive suggestions
import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';

export function useBookingSuggestions(bookings: any[], services: any[]) {
  const [suggestion, setSuggestion] = useState<BookingSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    const fetchSuggestion = async () => {
      if (!user || bookings.length === 0) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const result = await predictiveEngine.getNextBookingSuggestion(user.id, bookings, services);
        setSuggestion(result);
      } catch (error) {
        console.error('Prediction error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestion();
  }, [user, bookings, services]);

  return { suggestion, isLoading, refresh: () => {} };
}

export default predictiveEngine;
