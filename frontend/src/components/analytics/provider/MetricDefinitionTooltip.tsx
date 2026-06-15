import React, { useId, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  PROVIDER_METRIC_DEFINITIONS,
  type ProviderMetricDefinition,
  type ProviderMetricKey,
} from '../../../constants/providerMetricDefinitions';
import { cn } from '../../../lib/utils';

interface MetricDefinitionTooltipProps {
  metricKey: ProviderMetricKey;
  definition?: ProviderMetricDefinition;
  className?: string;
  iconClassName?: string;
}

export const MetricDefinitionTooltip: React.FC<MetricDefinitionTooltipProps> = ({
  metricKey,
  definition,
  className,
  iconClassName,
}) => {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const metric = definition ?? PROVIDER_METRIC_DEFINITIONS[metricKey];

  if (!metric) return null;

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        className={cn(
          'inline-flex items-center justify-center rounded-full text-nilin-warmGray hover:text-nilin-charcoal transition-colors',
          iconClassName,
        )}
        aria-label={`About ${metric.label}`}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-nilin bg-nilin-charcoal text-white text-xs p-3 shadow-lg pointer-events-none"
        >
          <p className="font-semibold mb-1">{metric.label}</p>
          <p className="text-white/90 leading-relaxed">{metric.description}</p>
          {metric.formula && (
            <p className="text-white/70 mt-2 italic">{metric.formula}</p>
          )}
        </div>
      )}
    </span>
  );
};
