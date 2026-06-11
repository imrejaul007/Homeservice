import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import TrendingFeedCard from '../components/home/TrendingFeedCard';
import { useTrendingFeed } from '../hooks/useTrendingFeed';
import type { TrendingFeedItem, TrendingFeedItemType } from '../types/trendingFeed';
import { homeTrendingApi } from '../services/homeTrendingApi';

type FilterTab = 'all' | TrendingFeedItemType;
type Period = '7d' | '30d';

const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'curated', label: 'Featured' },
  { id: 'experience', label: 'Transformations' },
  { id: 'service', label: 'Services' },
];

const TrendingPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [period, setPeriod] = useState<Period>('7d');

  const types = activeFilter === 'all' ? undefined : [activeFilter];

  const { items, metadata, isLoading, error, refresh } = useTrendingFeed({
    limit: 24,
    minItems: 4,
    period,
    types,
  });

  const subtitle = useMemo(() => {
    if (!metadata) return 'Discover what is trending on NILIN';
    const parts = [
      metadata.counts.curated ? `${metadata.counts.curated} featured` : null,
      metadata.counts.experience ? `${metadata.counts.experience} transformations` : null,
      metadata.counts.service ? `${metadata.counts.service} services` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Discover what is trending on NILIN';
  }, [metadata]);

  const handleCardClick = async (item: TrendingFeedItem) => {
    if (item.type === 'curated') {
      homeTrendingApi.trackClick(item.id).catch(() => undefined);
    }
    if (item.link.startsWith('http')) {
      window.open(item.link, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(item.link);
  };

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <main className="flex-1 py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-nilin-warmGray hover:text-nilin-coral mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full mb-4">
              <Sparkles className="w-4 h-4 text-nilin-coral" />
              <span className="text-sm text-nilin-charcoal">@NILIN.trending</span>
            </div>
            <h1 className="text-4xl font-serif text-nilin-charcoal mb-2">Trending Now</h1>
            <p className="text-nilin-warmGray">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-8">
            <div className="flex flex-wrap gap-2">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    activeFilter === tab.id
                      ? 'bg-nilin-coral text-white'
                      : 'bg-white text-nilin-charcoal border border-nilin-border/50 hover:border-nilin-coral/40'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 ml-auto">
              {(['7d', '30d'] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    period === p
                      ? 'bg-nilin-charcoal text-white'
                      : 'bg-white text-nilin-charcoal border border-nilin-border/50'
                  }`}
                >
                  {p === '7d' ? 'This Week' : 'This Month'}
                </button>
              ))}
              <button
                type="button"
                onClick={() => refresh()}
                className="p-2 rounded-full bg-white border border-nilin-border/50 hover:border-nilin-coral/40"
                aria-label="Refresh trending"
              >
                <RefreshCw className="w-4 h-4 text-nilin-charcoal" />
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] rounded-3xl bg-nilin-blush/40 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-nilin-border/30">
              <Sparkles className="w-12 h-12 text-nilin-coral mx-auto mb-4" />
              <p className="text-nilin-charcoal font-medium mb-2">No trending items yet</p>
              <p className="text-nilin-warmGray text-sm">Check back soon for the latest beauty trends.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
              {items.map((item) => (
                <TrendingFeedCard key={item.id} item={item} onClick={handleCardClick} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TrendingPage;
