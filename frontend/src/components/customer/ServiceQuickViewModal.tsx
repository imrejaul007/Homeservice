import React, { useState, useEffect, useRef } from 'react';
import { Clock, MapPin, Star, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import Modal from '../../components/common/Modal';
import type { Service } from '../../types/service';
import { searchApi } from '../../services/searchApi';
import { useNavigate } from 'react-router-dom';
import { usePriceConversion } from '../../utils/priceConverter';
import toast from 'react-hot-toast';

interface ServiceQuickViewModalProps {
  service: Service | null;
  open: boolean;
  onClose: () => void;
}

const ServiceQuickViewModal: React.FC<ServiceQuickViewModalProps> = ({ service, open, onClose }) => {
  const navigate = useNavigate();
  const { convert, format, currency } = usePriceConversion();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [fullService, setFullService] = useState<Service | null>(service);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // Reset image index when service changes
  useEffect(() => {
    setActiveImageIndex(0);
    setFullService(service);
  }, [service]);

  // Fetch full service details when modal opens
  useEffect(() => {
    if (!open || !service) return;
    // Abort any pending request
    controllerRef.current?.abort();
    setFetchError(null);
    // Already have enough data, no need to fetch
    if (service.description && service.images?.length > 0) {
      return;
    }
    setLoading(true);
    controllerRef.current = new AbortController();
    searchApi.getServiceById(service._id)
      .then((res) => {
        if (res.success && res.data?.service) {
          setFullService(res.data.service as Service);
        }
      })
      .catch((err) => {
        console.error(err);
        setFetchError('Failed to load service details. Please try again.');
        toast.error('Failed to load service details');
      })
      .finally(() => setLoading(false));
  }, [open, service?._id, service?.description, service?.images]);

  if (!service) return null;

  const displayService = fullService || service;
  const images = displayService.images?.length > 0 ? displayService.images : displayService.image ? [displayService.image] : [];
  const safeIndex = Math.min(activeImageIndex, images.length - 1);
  const displayTitle = displayService.title || displayService.name || 'Service';

  // Handle price which can be a number or object
  const rawPrice = typeof displayService.price === 'number'
    ? displayService.price
    : (displayService.price?.amount || 0);
  const priceCurrency = typeof displayService.price === 'object'
    ? displayService.price?.currency || 'AED'
    : 'AED';
  const displayPrice = convert(rawPrice, priceCurrency);

  const displayRating = typeof displayService.rating === 'number'
    ? displayService.rating
    : (displayService.rating?.average || 0);
  const ratingCount = displayService.reviewCount || (typeof displayService.rating === 'object' ? displayService.rating?.count : 0) || 0;

  const handleBookNow = () => {
    onClose();
    navigate(`/book/${service._id}`, { state: { service: displayService } });
  };

  const handleViewDetails = () => {
    onClose();
    navigate(`/services/${service._id}`);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="xl"
      title={`Quick View: ${displayTitle}`}
    >
      <div className="space-y-6">
        {/* Image Carousel */}
        {images.length > 0 ? (
          <div className="relative">
            <div className="aspect-video rounded-xl overflow-hidden bg-nilin-muted">
              <img
                src={images[safeIndex]}
                alt={`${displayTitle} - Image ${safeIndex + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setActiveImageIndex((i) => (i === 0 ? images.length - 1 : i - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-nilin-surface/90 rounded-full shadow-nilin-sm
                    hover:bg-nilin-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral transition-all duration-200 active:scale-95"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setActiveImageIndex((i) => (i === images.length - 1 ? 0 : i + 1))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-nilin-surface/90 rounded-full shadow-nilin-sm
                    hover:bg-nilin-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral transition-all duration-200 active:scale-95"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-5 h-5" aria-hidden="true" />
                </button>
                {/* Dots */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        idx === activeImageIndex ? 'bg-nilin-surface w-4' : 'bg-nilin-surface/50'
                      }`}
                      aria-label={`Go to image ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="aspect-video rounded-xl bg-nilin-blush/30 flex items-center justify-center">
            <span className="text-5xl opacity-40" aria-hidden="true">✨</span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            <div className="h-6 bg-nilin-blush/50 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-nilin-blush/50 rounded animate-pulse" />
            <div className="h-4 bg-nilin-blush/50 rounded animate-pulse w-1/2" />
          </div>
        ) : (
          <>
            {/* Category & Rating */}
            <div className="flex items-center justify-between">
              {displayService.category && (
                <span className="px-3 py-1 bg-nilin-muted text-nilin-charcoal text-xs font-medium rounded-lg">
                  {displayService.category}
                </span>
              )}
              {displayRating > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-nilin-coral text-nilin-coral" aria-hidden="true" />
                  <span className="text-sm font-semibold text-nilin-charcoal">{displayRating.toFixed(1)}</span>
                  {ratingCount > 0 && (
                    <span className="text-xs text-nilin-warmGray">({ratingCount} reviews)</span>
                  )}
                </div>
              )}
            </div>

            {/* Title */}
            <h2 className="text-lg md:text-xl font-bold text-nilin-charcoal">{displayTitle}</h2>

            {/* Description */}
            {displayService.description && (
              <p className="text-sm text-nilin-warmGray leading-relaxed line-clamp-3 overflow-y-auto">
                {displayService.description}
              </p>
            )}

            {/* Meta Info */}
            <div className="flex flex-wrap gap-4 items-center text-sm text-nilin-warmGray">
              {displayService.duration && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-nilin-rose" aria-hidden="true" />
                  <span>{displayService.duration} min</span>
                </div>
              )}
              {displayService.provider?.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-nilin-rose" aria-hidden="true" />
                  <span>{displayService.provider.location}</span>
                </div>
              )}
            </div>

            {/* Duration Options */}
            {displayService.durationOptions && displayService.durationOptions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-nilin-charcoal mb-2">Duration Options</h3>
                <ul className="space-y-1.5">
                  {displayService.durationOptions.map((option, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-nilin-warmGray">
                      <Check className="w-4 h-4 text-nilin-coral flex-shrink-0" aria-hidden="true" />
                      {option.label && <span className="font-medium">{option.label}:</span>}
                      <span>{option.duration} min</span>
                      {option.price && option.price > 0 ? (
                        <span className="text-nilin-coral font-semibold">
                          {format(convert(option.price, priceCurrency), currency)}
                        </span>
                      ) : (
                        <span className="text-nilin-success">Included</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Add-ons */}
            {displayService.addOns && displayService.addOns.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-nilin-charcoal mb-2">Available Add-ons:</h3>
                <ul className="space-y-1.5">
                  {displayService.addOns.map((addon, idx) => (
                    <li key={idx} className="flex items-center justify-between text-sm text-nilin-warmGray">
                      <span className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-nilin-coral flex-shrink-0" aria-hidden="true" />
                        {addon.name}
                        {addon.description && (
                          <span className="text-nilin-lightGray">- {addon.description}</span>
                        )}
                      </span>
                      {addon.price && addon.price > 0 ? (
                        <span className="text-nilin-coral font-semibold">
                          + {format(convert(addon.price, priceCurrency), currency)}
                        </span>
                      ) : (
                        <span className="text-nilin-success">Included</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Price & CTA */}
            <div className="flex items-center justify-between pt-4 border-t border-nilin-blush/30">
              <div>
                <p className="text-xs text-nilin-lightGray">Total Price</p>
                {displayPrice > 0 ? (
                  <p className="text-2xl font-bold text-nilin-charcoal">
                    {format(displayPrice, currency)}
                  </p>
                ) : (
                  <p className="text-lg font-semibold text-nilin-warmGray">Contact for price</p>
                )}
              </div>
              <button
                onClick={handleBookNow}
                className="px-6 py-3 bg-nilin-coral text-white font-semibold rounded-xl shadow-nilin-sm
                  hover:bg-nilin-rose hover:shadow-nilin
                  active:scale-95
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                  transition-all"
              >
                Book Now
              </button>
            </div>

            {/* View Full Details link */}
            <button
              onClick={handleViewDetails}
              className="w-full text-center text-sm text-nilin-coral hover:text-nilin-rose
                focus-visible:outline-none focus-visible:underline"
            >
              View full service details →
            </button>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ServiceQuickViewModal;
