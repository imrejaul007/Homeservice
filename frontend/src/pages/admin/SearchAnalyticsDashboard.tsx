import React, { useState, useEffect } from 'react';
import {
  Search,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronUp,
  Eye,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/services/api';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

interface SearchAnalytics {
  totalSearches: number;
  zeroResultSearches: number;
  refinementCount: number;
  averageClickPosition: number;
  topQueries: Array<{ query: string; count: number }>;
  zeroResultQueries: Array<{ query: string; count: number; timestamp: number }>;
  queryRefinements: Array<{ original: string; refined: string; timestamp: number }>;
}

interface RefinementPatterns {
  commonRefinements: Array<{ from: string; to: string; count: number }>;
  averageRefinementsPerSession: number;
  mostAbandonedQueryPattern: string | null;
}

const SearchAnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<SearchAnalytics | null>(null);
  const [refinementPatterns, setRefinementPatterns] = useState<RefinementPatterns | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('7d');
  const [expandedSection, setExpandedSection] = useState<string | null>('top-queries');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAnalytics = async () => {
    setIsRefreshing(true);
    try {
      setError(null);

      const [analyticsRes, patternsRes] = await Promise.all([
        api.get('/search/analytics'),
        api.get('/search/analytics/refinements'),
      ]);

      if (analyticsRes.data.success) {
        setAnalytics(analyticsRes.data.data);
      }
      if (patternsRes.data.success) {
        setRefinementPatterns(patternsRes.data.data);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch search analytics:', err);
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(message || 'Failed to load analytics');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeframe]);

  const handleRefresh = () => {
    fetchAnalytics();
  };

  const exportData = () => {
    if (!analytics) return;

    const data = {
      exportedAt: new Date().toISOString(),
      timeframe,
      summary: {
        totalSearches: analytics.totalSearches,
        zeroResultSearches: analytics.zeroResultSearches,
        zeroResultRate: analytics.totalSearches > 0
          ? ((analytics.zeroResultSearches / analytics.totalSearches) * 100).toFixed(2) + '%'
          : '0%',
        refinementCount: analytics.refinementCount,
        averageClickPosition: analytics.averageClickPosition.toFixed(2),
      },
      topQueries: analytics.topQueries.slice(0, 20),
      zeroResultQueries: analytics.zeroResultQueries.slice(0, 20),
      refinementPatterns: refinementPatterns?.commonRefinements.slice(0, 10) || [],
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-analytics-${timeframe}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <AdminPageShell
        title="Search Analytics"
        subtitle="Query insights · content gaps"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Search Analytics', current: true },
        ]}
        wideLayout
      >
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 text-nilin-coral animate-spin" />
        </div>
      </AdminPageShell>
    );
  }

  if (error) {
    return (
      <AdminPageShell
        title="Search Analytics"
        subtitle="Query insights · content gaps"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Search Analytics', current: true },
        ]}
        wideLayout
      >
        <div className="text-center max-w-md mx-auto py-12 px-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-serif text-nilin-charcoal mb-2">Unable to Load Analytics</h2>
          <p className="text-nilin-warmGray font-sans mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center justify-center min-h-11 px-5 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white font-sans hover:opacity-95 transition-opacity"
          >
            Try Again
          </button>
        </div>
      </AdminPageShell>
    );
  }

  const zeroResultRate = analytics && analytics.totalSearches > 0
    ? ((analytics.zeroResultSearches / analytics.totalSearches) * 100).toFixed(1)
    : '0';

  const statsCards = [
    {
      label: 'Total Searches',
      value: analytics?.totalSearches.toLocaleString() || '0',
      icon: Search,
      color: 'bg-blue-500',
      trend: null,
    },
    {
      label: 'Zero Results',
      value: analytics?.zeroResultSearches.toLocaleString() || '0',
      subValue: `${zeroResultRate}%`,
      icon: AlertTriangle,
      color: 'bg-amber-500',
      trend: parseFloat(zeroResultRate) > 10 ? 'up' : 'down',
    },
    {
      label: 'Refinements',
      value: analytics?.refinementCount.toLocaleString() || '0',
      icon: RefreshCw,
      color: 'bg-purple-500',
      trend: null,
    },
    {
      label: 'Avg Click Position',
      value: analytics?.averageClickPosition.toFixed(1) || '0',
      icon: Eye,
      color: 'bg-emerald-500',
      trend: parseFloat(analytics?.averageClickPosition.toFixed(1) || '0') <= 3 ? 'down' : 'up',
    },
  ];

  const sections = [
    {
      id: 'top-queries',
      title: 'Top Search Queries',
      description: 'Most popular search terms',
      icon: TrendingUp,
      data: analytics?.topQueries || [],
      renderItem: (item: any) => (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <Search className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-gray-900">{item.query}</span>
          </div>
          <span className="text-sm font-semibold text-gray-600">
            {item.count.toLocaleString()} searches
          </span>
        </div>
      ),
    },
    {
      id: 'zero-results',
      title: 'Zero Result Queries',
      description: 'Searches that returned no results - consider adding content',
      icon: AlertTriangle,
      data: analytics?.zeroResultQueries || [],
      renderItem: (item: any) => (
        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="font-medium text-gray-900">{item.query}</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold text-amber-600">
              {item.count} times
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'refinements',
      title: 'Query Refinements',
      description: 'How users modify their searches',
      icon: ArrowRight,
      data: refinementPatterns?.commonRefinements || [],
      renderItem: (item: any) => (
        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex-1 text-right">
            <span className="text-sm font-medium text-gray-600 truncate block">{item.from}</span>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-900 truncate block">{item.to}</span>
          </div>
          <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-1 rounded">
            {item.count}x
          </span>
        </div>
      ),
    },
    {
      id: 'abandoned',
      title: 'Abandoned Queries',
      description: 'Queries that led to no follow-up - potential content gaps',
      icon: Clock,
      data: analytics?.zeroResultQueries?.filter((q: any) => {
        return !refinementPatterns?.commonRefinements.some(
          (r: any) => r.from === q.query
        );
      }) || [],
      renderItem: (item: any) => (
        <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg opacity-75">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">{item.query}</span>
          </div>
          <span className="text-xs text-gray-500">
            {item.count} attempts
          </span>
        </div>
      ),
    },
  ];

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={timeframe}
        onChange={(e) => setTimeframe(e.target.value)}
        className="min-h-11 px-3 rounded-xl border border-nilin-border/50 bg-white/60 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
        aria-label="Select timeframe"
      >
        <option value="24h">Last 24 hours</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
      </select>
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl border border-nilin-border/50 bg-white/60 hover:bg-nilin-blush/40 transition-colors disabled:opacity-50"
        aria-label="Refresh analytics"
      >
        <RefreshCw className={`w-5 h-5 text-nilin-charcoal ${isRefreshing ? 'animate-spin' : ''}`} />
      </button>
      <button
        onClick={exportData}
        className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white text-sm font-medium font-sans hover:opacity-95 transition-opacity"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Export</span>
      </button>
    </div>
  );

  return (
    <ErrorBoundary>
      <AdminPageShell
        title="Search Analytics"
        subtitle="Monitor search behavior and identify content gaps"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Search Analytics', current: true },
        ]}
        headerActions={headerActions}
        wideLayout
      >
        <div id="main-content" className="space-y-6 overflow-x-hidden min-w-0">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                {stat.trend && (
                  <div className={`flex items-center gap-1 text-xs font-medium ${
                    stat.trend === 'down' ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {stat.trend === 'down' ? (
                      <TrendingDown className="w-3 h-3" />
                    ) : (
                      <TrendingUp className="w-3 h-3" />
                    )}
                    {stat.trend === 'down' ? 'Good' : 'Needs attention'}
                  </div>
                )}
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500">{stat.label}</span>
                {stat.subValue && (
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                    {stat.subValue}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Insights */}
        {refinementPatterns && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100 p-5 mb-8">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Key Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/60 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {refinementPatterns.averageRefinementsPerSession.toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">Avg refinements per session</div>
              </div>
              <div className="bg-white/60 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {refinementPatterns.commonRefinements.length}
                </div>
                <div className="text-sm text-gray-600">Common refinement patterns</div>
              </div>
              <div className="bg-white/60 rounded-lg p-4">
                <div className="text-2xl font-bold text-amber-600">
                  {refinementPatterns.mostAbandonedQueryPattern || 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Most abandoned query pattern</div>
              </div>
            </div>
          </div>
        )}

        {/* Expandable Sections */}
        <div className="space-y-4">
          {sections.map((section) => (
            <div
              key={section.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <button
                onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                className="w-full flex items-center justify-between min-h-11 p-4 sm:p-5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <section.icon className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">{section.title}</h3>
                    <p className="text-sm text-gray-500">{section.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {section.data.length} items
                  </span>
                  {expandedSection === section.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {expandedSection === section.id && (
                <div className="border-t border-gray-100 p-5">
                  {section.data.length > 0 ? (
                    <div className="space-y-3">
                      {section.data.slice(0, 10).map((item, index) => (
                        <div key={index}>
                          {section.renderItem(item)}
                        </div>
                      ))}
                      {section.data.length > 10 && (
                        <div className="text-center pt-2">
                          <span className="text-sm text-gray-500">
                            Showing 10 of {section.data.length} items
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No data available</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Recommendations */}
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recommendations</h3>
          <div className="space-y-4">
            {analytics && analytics.zeroResultSearches > analytics.totalSearches * 0.1 && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-100">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-900">High Zero-Result Rate</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    {zeroResultRate}% of searches return no results. Consider adding more content
                    for popular zero-result queries like "{analytics.zeroResultQueries[0]?.query}".
                  </p>
                </div>
              </div>
            )}
            {refinementPatterns?.mostAbandonedQueryPattern && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <Search className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Content Gap Detected</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Users frequently search for "{refinementPatterns.mostAbandonedQueryPattern}" but
                    can't find what they're looking for. Consider adding services or content for this query.
                  </p>
                </div>
              </div>
            )}
            {analytics && analytics.averageClickPosition > 5 && (
              <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-100">
                <BarChart3 className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-purple-900">Improve Search Ranking</h4>
                  <p className="text-sm text-purple-700 mt-1">
                    Users often click on results beyond position 5. Consider reviewing your search
                    ranking algorithm or adding more relevant content.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default SearchAnalyticsDashboard;
