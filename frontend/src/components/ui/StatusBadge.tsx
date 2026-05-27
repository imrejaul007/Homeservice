import React from 'react';

interface StatusBadgeProps {
  status: 'active' | 'pending' | 'completed' | 'cancelled' | 'in_progress';
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const styles = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-100 text-blue-700'
  };
  const defaultLabels = { active: 'Active', pending: 'Pending', completed: 'Completed', cancelled: 'Cancelled', in_progress: 'In Progress' };
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
      {label || defaultLabels[status]}
    </span>
  );
};
