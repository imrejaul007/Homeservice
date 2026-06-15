import React, { useMemo, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Star, Clock, MapPin, Award, X, Check } from 'lucide-react';
import { useComparisonStore } from '../../stores/comparisonStore';
import { buildComparison, isServiceBestIn } from '../../services/comparisonService';
import { useNavigate } from 'react-router-dom';
import { usePriceConversion } from '../../utils/priceConverter';
import { cn } from '../../lib/utils';
import type { Service } from '../../types/search';

// Helper to get numeric price from price object
const getNumericPrice = (price: Service['price']): number => {
  if (typeof price === 'number') return price;
  if (price && typeof price === 'object') return price.amount;
  return 0;
};

interface ServiceComparisonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Animation delay helper for staggered metric rows
const getMetricDelay = (index: number) => `${index * 75}ms`;

// Badge type helper
const getBestBadgeInfo = (bests: string[]) => {
  if (bests.length >= 3) {
    return { label: 'Top Pick', isTopPick: true };
  }
  if (bests.length === 0) {
    return { label: '', isTopPick: false };
  }
  return { label: `Best ${bests[0]}`, isTopPick: false };
};

/**
 * Modal that displays 2-4 services side-by-side with a feature matrix
 * and "best" badges for price, rating, duration, and distance.
 */
const ServiceComparisonModal: React.FC<ServiceComparisonModalProps> = ({ open, onOpenChange }) => {
  const items = useComparisonStore((s) => s.items);
  const removeService = useComparisonStore((s) => s.removeService);
  const navigate = useNavigate();
  const { convert } = usePriceConversion();

  const services = useMemo(() => items.map((i) => i.service), [items]);

  // Auto-close modal when fewer than 2 services remain
  useEffect(() => {
    if (open && services.length < 2) {
      onOpenChange(false);
    }
  }, [open, services.length, onOpenChange]);

  // Convert all prices to AED for comparison
  const convertedServices = useMemo(() => {
    return services.map((service) => {
      const numericPrice = getNumericPrice(service.price);
      const convertedPrice = numericPrice > 0 ? convert(numericPrice) : service.price;
      return {
        ...service,
        price: convertedPrice,
      } as Service;
    });
  }, [services, convert]);

  const comparison = useMemo(() => buildComparison(convertedServices as Service[]), [convertedServices]);

  const handleViewDetails = (id: string) => {
    onOpenChange(false);
    navigate(`/services/${id}`);
  };

  const handleBookNow = (service: Service) => {
    onOpenChange(false);
    navigate(`/book/${service._id}`, { state: { service } });
  };

  const handleRemove = (e: React.MouseEvent, serviceId: string) => {
    e.stopPropagation();
    removeService(serviceId);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      className="max-w-5xl"
      title="Compare Services"
      description={`Comparing ${services.length} services side-by-side - best price, rating, duration and distance highlighted`}
      footer={
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          {services.map((service) => (
            <div key={`footer-action-${service._id}`} className="flex gap-2 flex-1 min-w-[200px]">
              <button
                onClick={() => handleViewDetails(service._id)}
                className="flex-1 px-3 py-2.5 bg-nilin-muted text-nilin-charcoal text-sm font-medium rounded-nilin hover:bg-nilin-blush active:scale-95 transition-all shadow-nilin focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
              >
                Details
              </button>
              <button
                onClick={() => handleBookNow(service)}
                className="flex-1 px-3 py-2.5 bg-nilin-coral text-nilin-charcoal text-sm font-medium rounded-nilin hover:bg-nilin-rose active:scale-95 transition-all shadow-nilin-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-rose focus-visible:ring-offset-2"
              >
                Book Now
              </button>
            </div>
          ))}
        </div>
      }
    >
      <div className="overflow-x-auto overflow-y-auto max-h-[60vh] -mx-6 px-6 pb-2 scrollbar-hide scroll-smooth [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div
          className="grid gap-3 min-w-max animate-fade-in"
          role="table"
          style={{ gridTemplateColumns: `160px repeat(${services.length}, minmax(220px, 1fr))` }}
        >
          {/* Service header row */}
          <div className="flex items-center text-xs font-bold text-nilin-charcoal/50 uppercase tracking-wide p-3">Compare</div>
          {services.map((service) => {
            const displayTitle = service.title || service.name;
            const bests = isServiceBestIn(service._id, comparison);
            const badgeInfo = getBestBadgeInfo(bests);
            return (
              <div
                key={service._id}
                className="bg-nilin-muted rounded-xl p-3 border border-nilin-border min-h-[200px] flex flex-col hover:shadow-nilin-warm transition-shadow relative"
              >
                <button
                  onClick={(e) => handleRemove(e, service._id)}
                  aria-label={`Remove ${displayTitle} from comparison`}
                  className="absolute top-2 right-2 p-2 w-4 h-4 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-nilin-charcoal/60 hover:text-nilin-error hover:bg-nilin-blush transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-error focus-visible:ring-offset-1"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>

                {service.image ? (
                  <button
                    onClick={() => handleViewDetails(service._id)}
                    aria-label={`View ${displayTitle} details`}
                    className="h-24 w-full bg-cover bg-center rounded-nilin mb-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                    style={{ backgroundImage: `url(${service.image})` }}
                  />
                ) : (
                  <div className="h-24 w-full bg-nilin-blush rounded-nilin mb-2 flex items-center justify-center">
                    <Award className="w-8 h-8 text-nilin-coral/50" aria-hidden="true" />
                  </div>
                )}

                <button
                  onClick={() => handleViewDetails(service._id)}
                  aria-label={`View ${displayTitle} details`}
                  className="text-left font-serif font-semibold text-sm text-nilin-charcoal line-clamp-2 cursor-pointer hover:text-nilin-rose transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-1 rounded pr-8"
                >
                  {displayTitle}
                </button>

                {bests.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {bests.length >= 3 ? (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-nilin-rose text-white text-[10px] font-semibold rounded-full transition-all duration-300"
                        aria-label="Top Pick"
                      >
                        <Award className="w-2.5 h-2.5" aria-hidden="true" />
                        Top Pick
                      </span>
                    ) : (
                      bests.map((label) => (
                        <span
                          key={label}
                          aria-label={`Best in ${label}`}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-nilin-coral text-nilin-charcoal text-[10px] font-semibold rounded-full transition-all duration-300"
                        >
                          <Award className="w-2.5 h-2.5" aria-hidden="true" />
                          Best {label}
                        </span>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Metric rows */}
          {comparison.metrics.map((metric, metricIndex) => (
            <React.Fragment key={metric.key}>
              <div
                role="rowheader"
                className="p-3 min-h-[48px] flex items-center text-sm font-bold text-nilin-charcoal/70 uppercase tracking-wide border-b border-nilin-border/30 animate-fade-in-up"
                style={{ animationDelay: getMetricDelay(metricIndex) }}
              >
                {metric.label}
              </div>
              {convertedServices.map((service) => {
                const isBest = metric.bestId === service._id;
                return (
                  <div
                    key={`${metric.key}-${service._id}`}
                    className={cn(
                      `p-3 min-h-[2.5rem] rounded-nilin flex items-center gap-2 text-sm border-b border-nilin-border/30 animate-fade-in-up`,
                      isBest
                        ? 'bg-nilin-blush border border-nilin-coral/30 font-semibold text-nilin-charcoal'
                        : 'bg-white border border-nilin-border text-nilin-charcoal'
                    )}
                    style={{ animationDelay: getMetricDelay(metricIndex) }}
                  >
                    {metric.key === 'price' && <span>{metric.format(service)}</span>}
                    {metric.key === 'rating' && (
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-nilin-coral text-nilin-coral" aria-hidden="true" />
                        {metric.format(service)}
                      </span>
                    )}
                    {metric.key === 'duration' && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-nilin-rose" aria-hidden="true" />
                        {metric.format(service)}
                      </span>
                    )}
                    {metric.key === 'distance' && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-nilin-rose" aria-hidden="true" />
                        {metric.format(service)}
                      </span>
                    )}
                    {isBest && <Check className="w-4 h-4 text-nilin-coral ml-auto" aria-hidden="true" />}
                  </div>
                );
              })}
            </React.Fragment>
          ))}

          {/* Provider row */}
          <div className="p-3 min-h-[48px] flex items-center text-sm font-bold text-nilin-charcoal/70 uppercase tracking-wide border-b border-nilin-border/50">
            Provider
          </div>
          {services.map((service) => (
            <div
              key={`provider-${service._id}`}
              className="p-3 min-h-[48px] rounded-nilin bg-white border border-nilin-border text-sm text-nilin-charcoal border-b border-nilin-border/50 flex items-center"
            >
              {service.provider?.businessName ||
                (service.provider?.firstName
                  ? `${service.provider.firstName} ${service.provider.lastName || ''}`.trim()
                  : 'Service Provider')}
            </div>
          ))}

          {/* Action row - placeholder for future bulk actions */}
        </div>
      </div>
    </Modal>
  );
};

export default ServiceComparisonModal;
