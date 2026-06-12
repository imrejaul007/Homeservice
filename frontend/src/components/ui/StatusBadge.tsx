import React from 'react';

interface StatusBadgeProps {
  status: 'active' | 'pending' | 'completed' | 'cancelled' | 'in_progress' | 'confirmed' | 'no_show' | 'refunded' | 'rejected' | 'flagged';
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-blue-100 text-blue-700',
    no_show: 'bg-gray-100 text-gray-600',
    refunded: 'bg-orange-100 text-orange-700',
    rejected: 'bg-red-100 text-red-700',
    flagged: 'bg-red-100 text-red-700',
  };
  const defaultLabels: Record<string, string> = {
    active: 'Active',
    pending: 'Pending',
    completed: 'Completed',
    cancelled: 'Cancelled',
    in_progress: 'In Progress',
    confirmed: 'Confirmed',
    no_show: 'No Show',
    refunded: 'Refunded',
    rejected: 'Rejected',
    flagged: 'Flagged',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {label || defaultLabels[status] || status}
    </span>
  );
};
