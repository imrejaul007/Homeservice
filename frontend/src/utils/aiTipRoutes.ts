const REVENUE_ROUTES: Record<string, string> = {
  pricing: '/provider/services',
  volume: '/provider/availability',
  efficiency: '/provider/bookings',
  retention: '/provider/services',
};

const PREVENTION_ROUTES: Record<string, string> = {
  reminder: '/provider/settings',
  confirmation: '/provider/settings',
  deposit: '/provider/settings',
  follow_up: '/provider/bookings',
};

const PREVENTION_ACTION_LABELS: Record<string, string> = {
  reminder: 'Configure booking reminders',
  confirmation: 'Enable booking confirmations',
  deposit: 'Set up deposit requirements',
  follow_up: 'View upcoming bookings',
};

export function getRevenueTipActionRoute(category: string): string {
  return REVENUE_ROUTES[category] || '/provider/analytics?tab=insights';
}

export function getPreventionTipActionRoute(type: string): string {
  return PREVENTION_ROUTES[type] || '/provider/bookings';
}

export function getPreventionActionLabel(type: string): string {
  return PREVENTION_ACTION_LABELS[type] || 'View bookings';
}
