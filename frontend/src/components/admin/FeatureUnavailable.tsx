import React from 'react';
import { Construction } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { FEATURE_UNAVAILABLE_MESSAGE } from '../../utils/adminDataHelpers';

interface FeatureUnavailableProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export const FeatureUnavailable: React.FC<FeatureUnavailableProps> = ({
  title = 'Feature not available',
  description = FEATURE_UNAVAILABLE_MESSAGE,
  onRetry,
  className,
}) => (
  <EmptyState
    icon={<Construction className="w-full h-full" />}
    title={title}
    description={description}
    variant="warning"
    action={
      onRetry
        ? { label: 'Try again', onClick: onRetry, variant: 'secondary' }
        : undefined
    }
    className={className}
  />
);

export default FeatureUnavailable;
