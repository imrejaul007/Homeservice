import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Ticket, Clock, Check, AlertCircle, X } from 'lucide-react';
import { offerService } from '../../services/offerService';
import type { Offer } from '../../types/offer';
import { getOfferUsageLabel } from '../../utils/offerDisplay';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'react-hot-toast';
import { OFFER_GRADIENT_MAP } from '../../utils/offerDisplay';

const GRADIENT_MAP = OFFER_GRADIENT_MAP;

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

const calculateCountdown = (endDate: string | Date): CountdownTime => {
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const total = Math.max(0, end - now);

  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((total % (1000 * 60)) / 1000),
    total,
  };
};

const OfferBanner: React.FC = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuthStore();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [claimedOfferIds, setClaimedOfferIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [loadError, setLoadError] = useState<string | null>(null);
  // FIX P0-1: Modal at component root level for proper z-index
  const [confirmModalOffer, setConfirmModalOffer] = useState<Offer | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  useEffect(() => {
    loadOffers();

    // Update countdown timer every second
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // FIX P1-2: Fetch fresh claim status from server
  const syncClaimedStatus = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const { claims } = await offerService.getMyClaims();
      const claimedIds = new Set(
        claims
          .filter((c: any) => c.status === 'claimed')
          .map((c: any) => c.offer?._id || c.offerId)
          .filter(Boolean) as string[]
      );
      setClaimedOfferIds(claimedIds);
    } catch (err) {
      console.error('Failed to sync claim status:', err);
    }
  }, [isAuthenticated]);

  // Sync on page focus to catch stale state
  useEffect(() => {
    const handleFocus = () => syncClaimedStatus();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [syncClaimedStatus]);

  const loadOffers = async () => {
    try {
      setLoadError(null);
      setIsLoading(true);
      const data = await offerService.getActiveOffers();
      if (data && data.length > 0) {
        setOffers(data);

        // If API returns isClaimed status, use it
        const claimedFromApi = data
          .filter((o: any) => o.isClaimed === true)
          .map((o: any) => o._id);
        if (claimedFromApi.length > 0) {
          setClaimedOfferIds(prev => new Set([...prev, ...claimedFromApi]));
        }

        // Sync with server
        await syncClaimedStatus();
      }
    } catch (err) {
      console.error('Failed to load offers:', err);
      setLoadError('Unable to load offers. Please try again.');
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

    // FIX P1-2: Show confirmation modal before claiming
    setConfirmModalOffer(offer);
  };

  // FIX P0-1: Execute claim with challenge verification
  const executeClaim = async () => {
    const offer = confirmModalOffer;
    if (!offer) return;

    setConfirmModalOffer(null);
    setClaimingId(offer._id);

    try {
      // FIX P0-1: Get and solve challenge before claiming
      const challenge = await offerService.getChallenge();
      let challengeId: string | undefined;
      let challengeAnswer: string | undefined;

      if (challenge.hasChallenge && challenge.challengeId && challenge.challenge) {
        challengeId = challenge.challengeId;
        challengeAnswer = solveChallenge(challenge.challenge);
      }

      const result = await offerService.claimOffer(offer._id, challengeId, challengeAnswer);

      if (result.success) {
        toast.success(result.message || 'Offer claimed! Redirecting to book...');
        setJustClaimed(offer._id);

        // Add to claimed set - ONLY AFTER SUCCESS
        setClaimedOfferIds(prev => new Set([...prev, offer._id]));

        // Redirect to services page after a brief delay
        setTimeout(() => {
          navigate('/search');
        }, 1500);
      } else {
        toast.error(result.message || 'Failed to claim offer');
        // Sync with server to get correct state
        await syncClaimedStatus();
      }
    } catch (error) {
      console.error('Claim offer failed:', error);
      toast.error('Failed to claim offer. Please try again.');
      await syncClaimedStatus();
    } finally {
      setClaimingId(null);
    }
  };

  // FIX P0-1: Helper to solve math challenges
  const solveChallenge = (challenge: string): string => {
    if (!challenge) return '';

    // Format: "What is X + Y?"
    const match = challenge.match(/What is (\d+)\s*\+\s*(\d+)\s*\?/i);
    if (match) {
      return String(parseInt(match[1], 10) + parseInt(match[2], 10));
    }

    // Format: "X + Y = ?"
    const altMatch = challenge.match(/(\d+)\s*\+\s*(\d+)\s*=\s*\?/i);
    if (altMatch) {
      return String(parseInt(altMatch[1], 10) + parseInt(altMatch[2], 10));
    }

    return '';
  };

  const handleOfferClick = (offer: Offer) => {
    navigate(`/offer/${offer._id}`);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direction === 'left' ? -350 : 350, behavior: 'smooth' });
    }
  };

  // FIX P2-1: Keyboard navigation for carousel
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const offerCount = offers.length;
    if (offerCount === 0) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setFocusedIndex(prev => Math.max(0, prev - 1));
        scroll('left');
        break;
      case 'ArrowRight':
        e.preventDefault();
        setFocusedIndex(prev => Math.min(offerCount - 1, prev + 1));
        scroll('right');
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < offerCount) {
          handleOfferClick(offers[focusedIndex]);
        }
        break;
    }
  }, [offers, focusedIndex]);

  const getGradientClass = (gradient?: string): string => {
    return GRADIENT_MAP[gradient || ''] || 'from-rose-400 via-pink-400 to-rose-300';
  };

  const getDiscountText = (offer: Offer): string => {
    if (offer.type === 'percentage') return `${offer.value}% OFF`;
    if (offer.type === 'fixed') return `AED ${offer.value} OFF`;
    if (offer.type === 'free_service') return 'FREE SERVICE';
    return 'SPECIAL OFFER';
  };

  const hasServiceLinking = (offer: Offer): boolean => {
    return (offer.applicableServices?.length ?? 0) > 0 || (offer.applicableCategories?.length ?? 0) > 0;
  };

  const renderSkeleton = () => (
    <>
      {[1, 2, 3].map(i => (
        <div key={i} className="flex-shrink-0 w-[320px] md:w-[380px] h-48 rounded-2xl bg-gray-200 animate-pulse" />
      ))}
    </>
  );

  const renderOffer = (offer: Offer, index: number) => {
    const isClaiming = claimingId === offer._id;
    const isJustClaimed = justClaimed === offer._id;
    const hasActiveClaim = offer.hasActiveClaim ?? claimedOfferIds.has(offer._id);
    const isFullyRedeemed = offer.isFullyRedeemed ?? false;
    const cannotClaim = hasActiveClaim || isFullyRedeemed;
    const usageLabel = getOfferUsageLabel(offer);
    const isFocused = focusedIndex === index;

    // FIX P1-1: Calculate countdown with full precision
    const countdown = offer.validUntil ? calculateCountdown(offer.validUntil) : null;
    const isExpiringSoon = countdown && countdown.total > 0 && countdown.days < 3;
    const isExpired = countdown && countdown.total <= 0;

    return (
      <div
        key={offer._id}
        onClick={() => handleOfferClick(offer)}
        onFocus={() => setFocusedIndex(index)}
        tabIndex={0}
        role="article"
        aria-label={`Special offer: ${offer.displayTitle || offer.title}`}
        aria-current={hasActiveClaim ? 'true' : undefined}
        className={`flex-shrink-0 w-[320px] md:w-[380px] rounded-2xl overflow-hidden shadow-lg card-3d cursor-pointer transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-nilin-coral/50 ${
          isJustClaimed ? 'ring-4 ring-green-400 scale-[1.02]' : 'hover:scale-[1.02]'
        } ${isFocused ? 'ring-2 ring-nilin-coral' : ''}`}
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

            {usageLabel && (
              <p className="text-xs text-white/75 mt-2">{usageLabel}</p>
            )}

            {/* FIX P1-1: Full countdown display including seconds for urgency */}
            {countdown && !isExpired && (
              <div className={`flex items-center gap-1 mt-2 ${isExpiringSoon ? 'animate-pulse' : ''}`}>
                <Clock className="w-3 h-3 text-white/70" />
                <span className={`text-xs font-medium ${
                  countdown.days < 1 ? 'text-yellow-200' : 'text-white/70'
                }`}>
                  {countdown.days > 0
                    ? `${countdown.days}d ${countdown.hours}h ${countdown.minutes}m`
                    : countdown.hours > 0
                    ? `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`
                    : countdown.minutes > 0
                    ? `${countdown.minutes}m ${countdown.seconds}s`
                    : `${countdown.seconds}s`} left
                </span>
              </div>
            )}
            {isExpired && (
              <div className="flex items-center gap-1 mt-2">
                <AlertCircle className="w-3 h-3 text-yellow-200" />
                <span className="text-xs font-medium text-yellow-200">Expired</span>
              </div>
            )}
          </div>

          {/* Bottom section */}
          <div className="mt-auto pt-2 flex items-center justify-between z-10 relative">
            <span className="px-2 py-1 bg-white/20 rounded font-mono text-sm text-white font-bold">
              {offer.code}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!cannotClaim && !isClaiming) {
                  handleClaim(offer, e);
                }
              }}
              disabled={isClaiming || cannotClaim}
              aria-label={
                isFullyRedeemed
                  ? 'Offer usage limit reached'
                  : hasActiveClaim
                    ? 'Offer already claimed'
                    : 'Claim this offer'
              }
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer z-20 ${
                isFullyRedeemed
                  ? 'bg-white/30 text-white/80 cursor-not-allowed'
                  : hasActiveClaim
                  ? 'bg-green-500 text-white cursor-not-allowed'
                  : isClaiming
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-white text-gray-900 hover:bg-gray-100 shadow-lg'
              }`}
            >
              {isFullyRedeemed ? (
                <>Limit reached</>
              ) : hasActiveClaim ? (
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
    <>
      {/* FIX P1-1: Modal rendered at component root - not inside cards */}
      {confirmModalOffer && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
          onClick={() => setConfirmModalOffer(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-claim-title"
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="confirm-claim-title" className="text-lg font-serif text-nilin-charcoal">Confirm Claim</h3>
              <button
                onClick={() => setConfirmModalOffer(null)}
                className="p-1 hover:bg-gray-100 rounded-full"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-nilin-charcoal mb-2">
                Claim this offer?
              </p>
              <p className="text-sm text-nilin-warmGray">
                Use code <span className="font-mono font-bold text-nilin-coral">{confirmModalOffer.code}</span> at checkout to redeem your {getDiscountText(confirmModalOffer)} discount.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModalOffer(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-nilin-border"
              >
                Cancel
              </button>
              <button
                onClick={executeClaim}
                className="flex-1 btn-nilin flex items-center justify-center gap-2"
              >
                <Ticket className="w-4 h-4" />
                Claim
              </button>
            </div>
          </div>
        </div>
      )}

      <section
        className="py-8 px-4"
        aria-label="Special Offers"
        onKeyDown={handleKeyDown}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-serif text-nilin-charcoal">Special Offers</h2>
              <p className="text-sm text-nilin-warmGray">Claim and save on your next booking</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => scroll('left')}
                aria-label="Scroll left"
                className="glass-btn w-10 h-10 rounded-full flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-nilin-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => scroll('right')}
                aria-label="Scroll right"
                className="glass-btn w-10 h-10 rounded-full flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-nilin-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* FIX P2-2: Add role="region" for accessibility */}
          <div
            ref={carouselRef}
            role="region"
            aria-label="Offers carousel. Use arrow keys to navigate."
            aria-roledescription="carousel"
          >
            <div
              ref={scrollRef}
              className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide"
              style={{ scrollbarWidth: 'none' }}
            >
              {isLoading ? renderSkeleton() :
               loadError ? (
                <div className="w-full text-center py-12">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
                  <p className="text-lg font-medium text-nilin-charcoal">{loadError}</p>
                  <button
                    onClick={() => loadOffers()}
                    className="mt-2 px-4 py-2 bg-nilin-rose text-white rounded-lg hover:bg-nilin-coral"
                  >
                    Try Again
                  </button>
                </div>
              ) : offers.length > 0 ? (
                offers.map((offer, index) => renderOffer(offer, index))
              ) : (
                <div className="w-full text-center py-12 text-nilin-warmGray">
                  <Ticket className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No offers available right now</p>
                  <p className="text-sm">Check back soon for exciting deals!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default OfferBanner;
