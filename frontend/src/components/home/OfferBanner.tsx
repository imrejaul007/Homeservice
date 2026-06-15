import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Ticket, Clock, Check, AlertCircle, X, Gift } from 'lucide-react';
import { offerService } from '../../services/offerService';
import type { Offer } from '../../types/offer';
import { getOfferUsageLabel } from '../../utils/offerDisplay';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'react-hot-toast';
import { OFFER_GRADIENT_MAP } from '../../utils/offerDisplay';
import { usePriceConversion, localizeAedAmountsInText } from '../../utils/priceConverter';
import { cn } from '@/lib/utils';
import { CardBody, CardContainer, CardItem } from '@/components/ui/3d-card';

const GRADIENT_MAP = OFFER_GRADIENT_MAP;

// Premium gradient palettes for cards
const CARD_GRADIENTS = [
  'from-[#E8C4B8] via-[#D4A89A] to-[#C8988A]', // Rose Gold
  'from-[#F5E6D3] via-[#E8D4C0] to-[#D4C0A8]', // Champagne
  'from-[#F0E6DC] via-[#E5D8CC] to-[#D8C8B8]', // Soft Nude
  'from-[#E5D0D8] via-[#D8C0C8] to-[#C8B0B8]', // Blush Pink
  'from-[#F0E8E0] via-[#E8DED8] to-[#D8D0C8]', // Ivory
  'from-[#E8DDE5] via-[#D8D0D8] to-[#C8C0C8]', // Lavender
];

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
  const { convert, format, currency } = usePriceConversion();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [claimedOfferIds, setClaimedOfferIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [confirmModalOffer, setConfirmModalOffer] = useState<Offer | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    loadOffers();
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
        const claimedFromApi = data.filter((o: any) => o.isClaimed === true).map((o: any) => o._id);
        if (claimedFromApi.length > 0) {
          setClaimedOfferIds(prev => new Set([...prev, ...claimedFromApi]));
        }
        await syncClaimedStatus();
      }
    } catch (err) {
      console.error('Failed to load offers:', err);
      setLoadError('Unable to load offers.');
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
    setConfirmModalOffer(offer);
  };

  const executeClaim = async () => {
    const offer = confirmModalOffer;
    if (!offer) return;

    setConfirmModalOffer(null);
    setClaimingId(offer._id);

    try {
      const challenge = await offerService.getChallenge();
      let challengeId: string | undefined;
      let challengeAnswer: string | undefined;

      if (challenge.hasChallenge && challenge.challengeId && challenge.challenge) {
        challengeId = challenge.challengeId;
        const match = challenge.challenge.match(/What is (\d+)\s*\+\s*(\d+)\s*\?/i);
        if (match) {
          challengeAnswer = String(parseInt(match[1], 10) + parseInt(match[2], 10));
        }
      }

      const result = await offerService.claimOffer(offer._id, challengeId, challengeAnswer);

      if (result.success) {
        toast.success(result.message || 'Offer claimed!');
        setJustClaimed(offer._id);
        setClaimedOfferIds(prev => new Set([...prev, offer._id]));
        setTimeout(() => navigate('/search'), 1500);
      } else {
        toast.error(result.message || 'Failed to claim offer');
        await syncClaimedStatus();
      }
    } catch (error) {
      console.error('Claim offer failed:', error);
      toast.error('Failed to claim offer.');
      await syncClaimedStatus();
    } finally {
      setClaimingId(null);
    }
  };

  const handleOfferClick = (offer: Offer) => {
    navigate(`/offer/${offer._id}`);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direction === 'left' ? -520 : 520, behavior: 'smooth' });
    }
  };

  const getGradientClass = (gradient?: string): string => {
    return GRADIENT_MAP[gradient || ''] || 'from-[#E8C4B8] via-[#D4A89A] to-[#C8988A]';
  };

  const getDiscountText = (offer: Offer): string => {
    if (offer.type === 'percentage') return `${offer.value}% OFF`;
    if (offer.type === 'fixed') return `${format(convert(offer.value, 'AED'), currency)} OFF`;
    if (offer.type === 'free_service') return 'FREE SERVICE';
    return 'SPECIAL OFFER';
  };

  const getOfferSubtitle = (offer: Offer): string => {
    const raw = offer.displaySubtitle || offer.description || '';
    return localizeAedAmountsInText(raw, convert, format, currency);
  };

  const renderSkeleton = () => (
    <>
      {[1, 2, 3].map(i => (
        <div key={i} className="flex-shrink-0 w-[460px] sm:w-[500px] h-[460px] rounded-3xl bg-gray-200 animate-pulse" />
      ))}
    </>
  );

  const renderOffer = (offer: Offer, index: number) => {
    const isClaiming = claimingId === offer._id;
    const isJustClaimed = justClaimed === offer._id;
    const hasActiveClaim = offer.hasActiveClaim ?? claimedOfferIds.has(offer._id);
    const isFullyRedeemed = offer.isFullyRedeemed ?? false;
    const cannotClaim = hasActiveClaim || isFullyRedeemed;

    const countdown = offer.validUntil ? calculateCountdown(offer.validUntil) : null;
    const isExpiringSoon = countdown && countdown.total > 0 && countdown.days < 3;

    const gradientClass = CARD_GRADIENTS[index % CARD_GRADIENTS.length];

    return (
      <div
        key={offer._id}
        className="flex-shrink-0"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
          transition: `opacity 0.7s ease ${index * 120}ms, transform 0.7s ease ${index * 120}ms`,
        }}
      >
      <CardContainer
        className="w-[460px] sm:w-[500px]"
        containerClassName="py-0"
      >
        {/* Stacked back layer */}
        <CardItem
          translateZ={-55}
          className={cn(
            'pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br opacity-90',
            'translate-x-2.5 translate-y-3.5 scale-[0.97] shadow-lg border border-white/50',
            gradientClass
          )}
          aria-hidden
        />

        <CardBody
          onClick={() => handleOfferClick(offer)}
          className={cn(
            'relative w-full min-h-[460px] rounded-3xl overflow-hidden cursor-pointer',
            'shadow-[0_12px_40px_rgba(45,45,45,0.1)] hover:shadow-[0_28px_60px_rgba(45,45,45,0.18)]',
            'transition-shadow duration-300 ring-1 ring-nilin-charcoal/5 hover:ring-nilin-coral/20',
            isJustClaimed && 'ring-4 ring-green-400'
          )}
        >
          <CardItem translateZ={45} className="w-full h-full">
            <div className={cn(
              'relative min-h-[460px] p-9 sm:p-10 flex flex-col bg-gradient-to-br',
              gradientClass
            )}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/20 rounded-full blur-2xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/15 rounded-full blur-xl" />

              {/* Badge Row */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  {offer.displayBadge && (
                    <span className="px-4 py-2 bg-white/75 backdrop-blur-md rounded-full text-nilin-charcoal text-sm font-semibold uppercase tracking-wider shadow-sm">
                      {offer.displayBadge}
                    </span>
                  )}
                </div>
                <div className="px-4 py-2.5 bg-white/80 backdrop-blur-sm rounded-full flex items-center gap-2 shadow-sm">
                  <Gift className="w-5 h-5 text-nilin-coral" />
                  <span className="text-nilin-charcoal text-base font-bold">{getDiscountText(offer)}</span>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1">
                <h3 className="text-3xl font-serif text-nilin-charcoal mb-4 leading-tight">
                  {offer.displayTitle || offer.title}
                </h3>
                <p className="text-nilin-charcoal/80 text-base leading-relaxed mb-5">
                  {getOfferSubtitle(offer)}
                </p>

                {countdown && countdown.total > 0 && (
                  <div className={cn(
                    'flex items-center gap-2 mb-4',
                    isExpiringSoon && 'animate-pulse'
                  )}>
                    <Clock className="w-5 h-5 text-nilin-warmGray" />
                    <span className="text-nilin-warmGray text-base font-medium">
                      {countdown.days > 0
                        ? `${countdown.days}d ${countdown.hours}h remaining`
                        : `${countdown.hours}h ${countdown.minutes}m remaining`
                      }
                    </span>
                  </div>
                )}

                {getOfferUsageLabel(offer) && (
                  <p className="text-nilin-warmGray text-sm">{getOfferUsageLabel(offer)}</p>
                )}
              </div>

              {/* CTA Button */}
              <div className="mt-6">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!cannotClaim && !isClaiming) {
                      handleClaim(offer, e);
                    }
                  }}
                  disabled={isClaiming || cannotClaim}
                  className={cn(
                    'group/btn w-full py-5 sm:py-6 rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 transition-all duration-300',
                    'bg-nilin-charcoal text-white',
                    'hover:bg-nilin-coral hover:shadow-lg hover:-translate-y-0.5',
                    (cannotClaim || isClaiming) && 'opacity-70 cursor-not-allowed'
                  )}
                >
                  {isFullyRedeemed ? (
                    'Limit Reached'
                  ) : hasActiveClaim ? (
                    <>
                      <Check className="w-5 h-5" />
                      Claimed
                    </>
                  ) : isClaiming ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    <>
                      <span>Claim Experience</span>
                      <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover/btn:translate-x-1" />
                    </>
                  )}
                </button>
              </div>

              {/* Code Display */}
              <div className="mt-5 text-center">
                <span className="text-nilin-warmGray text-sm">or use code</span>
                <span className="ml-2 px-3.5 py-1.5 bg-white/70 backdrop-blur-sm rounded-lg font-mono text-nilin-charcoal text-base font-bold shadow-sm">
                  {offer.code}
                </span>
              </div>
            </div>
          </CardItem>
        </CardBody>
      </CardContainer>
      </div>
    );
  };

  return (
    <>
      {/* Confirmation Modal */}
      {confirmModalOffer && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm"
          onClick={() => setConfirmModalOffer(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-3xl p-8 max-w-md mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-serif text-nilin-charcoal">Claim Offer</h3>
              <button
                onClick={() => setConfirmModalOffer(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-nilin-charcoal mb-2">
              Ready to claim this exclusive offer?
            </p>
            <p className="text-sm text-nilin-warmGray mb-6">
              Use code <span className="font-mono font-bold text-nilin-coral">{confirmModalOffer.code}</span> at checkout.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModalOffer(null)}
                className="flex-1 px-6 py-3 rounded-2xl border border-nilin-border font-medium"
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

      <section className="py-16 px-2 sm:px-3 lg:px-4 bg-[#F6EFE8]">
        <div className="max-w-[100rem] mx-auto">
          {/* Header */}
          <div className="mb-10 px-1 sm:px-0">
            <div className={cn(
              'flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 lg:gap-10 mb-6 transition-all duration-700',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}>
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral/10 rounded-full mb-4">
                  <Sparkles className="w-4 h-4 text-nilin-coral" />
                  <span className="text-sm font-semibold text-nilin-coral uppercase tracking-wider">Exclusive</span>
                </div>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-light text-nilin-charcoal leading-tight">
                  Curated Experiences
                </h2>
              </div>
              <div className="lg:text-right lg:max-w-xl">
                <p className="text-nilin-charcoal/80 text-lg md:text-xl leading-relaxed mb-5">
                  Handpicked offers designed to help you look your best for every celebration.
                </p>
                <button
                  onClick={() => navigate('/search?offers=true')}
                  className="inline-flex items-center gap-2 text-lg font-semibold text-nilin-coral hover:text-nilin-rose transition-colors group"
                >
                  <span>View all offers</span>
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </div>

          {/* Carousel */}
          <div ref={carouselRef}>
            <div
              ref={scrollRef}
              className="flex gap-4 sm:gap-5 overflow-x-auto pt-2 pb-8 scrollbar-hide"
              style={{ scrollbarWidth: 'none' }}
            >
              {isLoading ? renderSkeleton() : loadError ? (
                <div className="w-full text-center py-16">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
                  <p className="text-nilin-charcoal mb-2">{loadError}</p>
                  <button
                    onClick={() => loadOffers()}
                    className="px-6 py-3 bg-nilin-coral text-white rounded-full hover:bg-nilin-rose transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : offers.length > 0 ? (
                offers.map((offer, index) => renderOffer(offer, index))
              ) : (
                <div className="w-full text-center py-16 text-nilin-warmGray">
                  <Gift className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium text-nilin-charcoal">No offers available right now</p>
                  <p className="text-sm">Check back soon for exciting deals!</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Arrows */}
          {offers.length > 3 && (
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={() => scroll('left')}
                className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                <svg className="w-5 h-5 text-nilin-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => scroll('right')}
                className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                <svg className="w-5 h-5 text-nilin-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default OfferBanner;