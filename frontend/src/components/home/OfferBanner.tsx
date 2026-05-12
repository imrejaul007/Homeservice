import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { offerService } from '../../services/offerService';
import type { Offer } from '../../types/offer';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'react-hot-toast';

const GRADIENT_MAP: Record<string, string> = {
  'from-nilin-rose to-nilin-coral': 'from-rose-400 via-pink-400 to-rose-300',
  'from-nilin-charcoal to-gray-700': 'from-gray-800 via-gray-700 to-gray-600',
  'from-nilin-blush to-nilin-rose': 'from-pink-200 via-rose-300 to-pink-400',
};

const DEFAULT_OFFERS: Partial<Offer>[] = [
  {
    _id: '1',
    title: 'First Booking 20% Off',
    description: 'Use code NILIN20 on your first service',
    displayTitle: 'First Booking 20% Off',
    displaySubtitle: 'Use code NILIN20 on your first service',
    displayGradient: 'from-nilin-rose to-nilin-coral',
    code: 'NILIN20',
    type: 'percentage',
    value: 20,
    featured: true,
  },
  {
    _id: '2',
    title: 'Weekend Spa Special',
    description: 'Swedish & Deep Tissue from AED 199',
    displayTitle: 'Weekend Spa Special',
    displaySubtitle: 'Swedish & Deep Tissue from AED 199',
    displayGradient: 'from-nilin-charcoal to-gray-700',
    code: 'SPAWEEKEND',
    type: 'fixed',
    value: 199,
    featured: true,
  },
  {
    _id: '3',
    title: 'Bridal Glow Package',
    description: 'Complete bridal beauty from AED 1,499',
    displayTitle: 'Bridal Glow Package',
    displaySubtitle: 'Complete bridal beauty from AED 1,499',
    displayGradient: 'from-nilin-blush to-nilin-rose',
    code: 'BRIDAL',
    type: 'fixed',
    value: 1499,
    featured: true,
  },
];

const OfferBanner: React.FC = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuthStore();
  const [offers, setOffers] = useState<(Offer & { claimed?: boolean })[]>(DEFAULT_OFFERS as any[]);
  const [isLoading, setIsLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    try {
      setIsLoading(true);
      const data = await offerService.getActiveOffers();
      if (data && data.length > 0) {
        setOffers(data);
      }
    } catch (error) {
      console.error('Failed to load offers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaim = async (offer: Offer, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.error('Please sign in to claim offers');
      navigate('/login');
      return;
    }

    setClaimingId(offer._id);

    try {
      const result = await offerService.claimOffer(offer._id);
      if (result.success) {
        toast.success(result.message || 'Offer claimed successfully!');
        setOffers(prev => prev.map(o => o._id === offer._id ? { ...o, claimed: true } : o));
      } else {
        toast.error(result.message || 'Failed to claim offer');
      }
    } catch (error) {
      toast.error('Failed to claim offer. Please try again.');
    } finally {
      setClaimingId(null);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direction === 'left' ? -350 : 350, behavior: 'smooth' });
    }
  };

  const getGradientClass = (gradient?: string): string => {
    return GRADIENT_MAP[gradient || ''] || 'from-rose-400 via-pink-400 to-rose-300';
  };

  const renderSkeleton = () => (
    <>
      {[1, 2, 3].map(i => (
        <div key={i} className="flex-shrink-0 w-[320px] md:w-[380px] h-40 rounded-2xl bg-gray-200 animate-pulse" />
      ))}
    </>
  );

  const renderOffer = (offer: Offer & { claimed?: boolean }) => (
    <div
      key={offer._id}
      className="flex-shrink-0 w-[320px] md:w-[380px] rounded-2xl overflow-hidden shadow-lg card-3d"
    >
      <div className={`h-40 bg-gradient-to-br ${getGradientClass(offer.displayGradient)} p-6 flex flex-col justify-between`}>
        <div>
          {offer.displayBadge && (
            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-medium mb-2">
              {offer.displayBadge}
            </span>
          )}
          <h3 className="text-xl font-serif text-white mb-1">
            {offer.displayTitle || offer.title}
          </h3>
          <p className="text-sm text-white/80">
            {offer.displaySubtitle || offer.description}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-white/70">
            Code: <strong className="font-mono">{offer.code}</strong>
          </span>

          <button
            onClick={(e) => !offer.claimed && handleClaim(offer, e)}
            disabled={claimingId === offer._id || offer.claimed}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              offer.claimed
                ? 'bg-green-500/30 text-white/80 cursor-not-allowed'
                : 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30'
            }`}
          >
            {claimingId === offer._id ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Claiming...
              </>
            ) : offer.claimed ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Claimed
              </>
            ) : (
              <>
                Claim Offer
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <section className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-serif text-nilin-charcoal">Special Offers</h2>
            <p className="text-sm text-nilin-warmGray">Limited time deals</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => scroll('left')}
              className="glass-btn w-10 h-10 rounded-full flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-nilin-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => scroll('right')}
              className="glass-btn w-10 h-10 rounded-full flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-nilin-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          {isLoading ? renderSkeleton() : offers.map(renderOffer)}
        </div>
      </div>
    </section>
  );
};

export default OfferBanner;
