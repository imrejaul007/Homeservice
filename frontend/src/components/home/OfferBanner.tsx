import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Ticket, ShoppingBag, Clock, Check } from 'lucide-react';
import { offerService } from '../../services/offerService';
import type { Offer } from '../../types/offer';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'react-hot-toast';

const GRADIENT_MAP: Record<string, string> = {
  'from-nilin-rose to-nilin-coral': 'from-rose-400 via-pink-400 to-rose-300',
  'from-nilin-charcoal to-gray-700': 'from-gray-800 via-gray-700 to-gray-600',
  'from-nilin-blush to-nilin-rose': 'from-pink-200 via-rose-300 to-pink-400',
};

const OfferBanner: React.FC = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuthStore();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [claimedOfferIds, setClaimedOfferIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState<string | null>(null);

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    try {
      setIsLoading(true);
      const data = await offerService.getActiveOffers();
      if (data && data.length > 0) {
        setOffers(data);

        // If API returns isClaimed status, use it
        // FIX: Added isClaimed property to Offer type check
        const claimedFromApi = data
          .filter((o) => 'isClaimed' in o && o.isClaimed)
          .map((o) => o._id);
        if (claimedFromApi.length > 0) {
          setClaimedOfferIds(claimedFromApi);
        }
      }
    } catch (error) {
      console.error('Failed to load offers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaim = async (offer: Offer, e: React.MouseEvent) => {
    e.preventDefault();
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
        toast.success(result.message || 'Offer claimed! Redirecting to book...');
        setJustClaimed(offer._id);

        // Add to claimed list locally
        setClaimedOfferIds(prev => [...prev, offer._id]);

        // Redirect to services page after a brief delay
        setTimeout(() => {
          navigate('/search');
        }, 1500);
      } else {
        toast.error(result.message || 'Failed to claim offer');
      }
    } catch {
      toast.error('Failed to claim offer. Please try again.');
    } finally {
      setClaimingId(null);
    }
  };

  const handleOfferClick = (offer: Offer) => {
    // Always go to offer detail page
    navigate(`/offer/${offer._id}`);
  };

  const handleBrowseServices = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/services');
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direction === 'left' ? -350 : 350, behavior: 'smooth' });
    }
  };

  const getGradientClass = (gradient?: string): string => {
    return GRADIENT_MAP[gradient || ''] || 'from-rose-400 via-pink-400 to-rose-300';
  };

  const getDiscountText = (offer: Offer): string => {
    if (offer.type === 'percentage') {
      return `${offer.value}% OFF`;
    } else if (offer.type === 'fixed') {
      return `AED ${offer.value} OFF`;
    } else if (offer.type === 'free_service') {
      return 'FREE SERVICE';
    }
    return 'SPECIAL OFFER';
  };

  const hasServiceLinking = (offer: Offer): boolean => {
    // FIX: Added parentheses to fix operator precedence warning
    return (offer.applicableServices?.length ?? 0) > 0 || (offer.applicableCategories?.length ?? 0) > 0;
  };

  const renderSkeleton = () => (
    <>
      {[1, 2, 3].map(i => (
        <div key={i} className="flex-shrink-0 w-[320px] md:w-[380px] h-48 rounded-2xl bg-gray-200 animate-pulse" />
      ))}
    </>
  );

  const renderOffer = (offer: Offer) => {
    const isClaiming = claimingId === offer._id;
    const isJustClaimed = justClaimed === offer._id;
    const isAlreadyClaimed = claimedOfferIds.includes(offer._id);

    return (
      <div
        key={offer._id}
        onClick={() => handleOfferClick(offer)}
        className={`flex-shrink-0 w-[320px] md:w-[380px] rounded-2xl overflow-hidden shadow-lg card-3d cursor-pointer transition-all duration-300 ${
          isJustClaimed ? 'ring-4 ring-green-400 scale-[1.02]' : 'hover:scale-[1.02]'
        }`}
      >
        <div className={`min-h-[200px] bg-gradient-to-br ${getGradientClass(offer.displayGradient)} p-6 flex flex-col justify-between relative`}>
          {/* Discount Badge */}
          <div className="flex justify-between items-start">
            {offer.displayBadge && (
              <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-medium">
                {offer.displayBadge}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/25 backdrop-blur-sm rounded-full text-white text-sm font-bold">
              <Sparkles className="w-4 h-4" />
              {getDiscountText(offer)}
            </span>
          </div>

          <div className="my-3">
            <h3 className="text-xl font-serif text-white mb-1">
              {offer.displayTitle || offer.title}
            </h3>
            <p className="text-sm text-white/80">
              {offer.displaySubtitle || offer.description}
            </p>
            {hasServiceLinking(offer) && (
              <div className="flex items-center gap-1 mt-2">
                <span className="text-xs text-white/70 bg-white/10 px-2 py-1 rounded-full">
                  Limited to specific services
                </span>
              </div>
            )}
          </div>

          {/* Bottom section - Always visible */}
          <div className="mt-auto pt-2 flex items-center justify-between z-10 relative">
            <span className="px-2 py-1 bg-white/20 rounded font-mono text-sm text-white font-bold">
              {offer.code}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isAlreadyClaimed && !isClaiming) {
                  handleClaim(offer, e);
                }
              }}
              disabled={isClaiming || isAlreadyClaimed}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer z-20 ${
                isAlreadyClaimed
                  ? 'bg-green-500 text-white cursor-not-allowed'
                  : isClaiming
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-white text-gray-900 hover:bg-gray-100 shadow-lg'
              }`}
            >
              {isAlreadyClaimed ? (
                <>
                  <Check className="w-4 h-4" />
                  Claimed
                </>
              ) : isClaiming ? (
                <>
                  <span className="w-4 h-4 border-2 border-gray-400 border-t-gray-600 rounded-full animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <Ticket className="w-4 h-4" />
                  Claim Offer
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-serif text-nilin-charcoal">Special Offers</h2>
            <p className="text-sm text-nilin-warmGray">Claim and save on your next booking</p>
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
          {isLoading ? renderSkeleton() : offers.length > 0 ? offers.map(renderOffer) : (
            <div className="w-full text-center py-12 text-nilin-warmGray">
              <Ticket className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No offers available right now</p>
              <p className="text-sm">Check back soon for exciting deals!</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default OfferBanner;
