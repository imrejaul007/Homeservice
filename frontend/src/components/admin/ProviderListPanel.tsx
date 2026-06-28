import React from 'react';
import {
  Building,
  Check,
  Eye,
  MapPin,
  Star,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ProviderWithUser } from '../../services/providerOpsApi';
import { AdminPagination } from './AdminPagination';

// ——— Display helpers ———

export function getProviderDisplayName(provider: ProviderWithUser): string {
  const name = provider.businessInfo?.businessName?.trim();
  if (name) return name;
  const email = typeof provider.userId === 'object' ? provider.userId?.email : undefined;
  if (email) {
    const local = email.split('@')[0];
    return local ? local.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : email;
  }
  return 'Unnamed provider';
}

export function getProviderSecondaryLine(provider: ProviderWithUser): string {
  const email = typeof provider.userId === 'object' ? provider.userId?.email : '';
  const name = provider.businessInfo?.businessName?.trim();
  if (name && email) return email;
  if (!name && email) return 'No business name set';
  return email || '—';
}

// ——— Status badge ———

export const ProviderStatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({
  status,
  size = 'sm',
}) => {
  const config: Record<string, { bg: string; text: string; border: string; label: string }> = {
    pending: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', label: 'Pending' },
    in_progress: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', label: 'Under Review' },
    approved: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', label: 'Approved' },
    verified: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', label: 'Approved' },
    rejected: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', label: 'Rejected' },
    suspended: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', label: 'Suspended' },
  };
  const c = config[status] || config.pending;
  const sizeClass = size === 'sm' ? 'text-xs px-2.5 py-1' : 'text-sm px-3 py-1';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium border',
        c.bg,
        c.text,
        c.border,
        sizeClass
      )}
    >
      {c.label}
    </span>
  );
};

// ——— Compact score bar (neutral when no data) ———

export const ScoreBar: React.FC<{ score?: number; label: string }> = ({ score, label }) => {
  const hasData = score != null;
  const value = score ?? 0;
  const barColor = !hasData
    ? 'bg-nilin-border'
    : value >= 80
      ? 'bg-emerald-500'
      : value >= 60
        ? 'bg-amber-500'
        : 'bg-orange-400';

  return (
    <div className="flex flex-col gap-0.5 min-w-[100px]" title={`${label}: ${hasData ? value : 'No data'}`}>
      <span className="text-[10px] font-medium uppercase tracking-wide text-nilin-warmGray">{label}</span>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-nilin-border/50 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: hasData ? `${Math.min(100, value)}%` : '0%' }}
          />
        </div>
        <span
          className={cn(
            'text-sm font-semibold tabular-nums w-7 text-right',
            hasData ? 'text-nilin-charcoal' : 'text-nilin-warmGray'
          )}
        >
          {hasData ? value : '—'}
        </span>
      </div>
    </div>
  );
};

// ——— KPI strip ———

export interface ProviderStatusCounts {
  total: number;
  pending: number;
  inProgress: number;
  approved: number;
  suspended: number;
  rejected: number;
}

export const ProviderKpiStrip: React.FC<{
  counts: ProviderStatusCounts;
  activeTab: string;
  onTabSelect: (tab: string) => void;
}> = ({ counts, activeTab, onTabSelect }) => {
  const items = [
    { id: 'all', label: 'Total', value: counts.total, accent: 'border-nilin-charcoal/20' },
    { id: 'pending', label: 'Pending', value: counts.pending, accent: 'border-amber-200' },
    { id: 'in_progress', label: 'Under review', value: counts.inProgress, accent: 'border-blue-200' },
    { id: 'approved', label: 'Approved', value: counts.approved, accent: 'border-emerald-200' },
    { id: 'suspended', label: 'Suspended', value: counts.suspended, accent: 'border-gray-300' },
    { id: 'rejected', label: 'Rejected', value: counts.rejected, accent: 'border-red-200' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onTabSelect(item.id)}
          className={cn(
            'text-left rounded-xl border px-3 py-2.5 transition-all',
            item.accent,
            activeTab === item.id
              ? 'bg-nilin-blush/40 border-nilin-coral/40 ring-1 ring-nilin-coral/30 shadow-sm'
              : 'bg-white/80 hover:bg-white border-nilin-border/60'
          )}
        >
          <p className="text-xs font-medium text-nilin-warmGray truncate">{item.label}</p>
          <p className="text-xl font-bold text-nilin-charcoal tabular-nums">{item.value}</p>
        </button>
      ))}
    </div>
  );
};

// ——— Table ———

type SortKey = 'createdAt' | 'qualityScore' | 'reliabilityScore' | 'name';

interface ProviderListPanelProps {
  providers: ProviderWithUser[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  sortBy: SortKey;
  sortOrder: 'asc' | 'desc';
  onSort: (column: SortKey) => void;
  onSelectProvider: (provider: ProviderWithUser) => void;
  onPageChange: (page: number) => void;
}

function SortHeader({
  label,
  column,
  sortBy,
  sortOrder,
  onSort,
  align = 'left',
}: {
  label: string;
  column: SortKey;
  sortBy: SortKey;
  sortOrder: 'asc' | 'desc';
  onSort: (c: SortKey) => void;
  align?: 'left' | 'center' | 'right';
}) {
  const active = sortBy === column;
  return (
    <th
      className={cn(
        'py-3.5 px-4 text-xs font-semibold text-nilin-warmGray uppercase tracking-wider',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right'
      )}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-nilin-charcoal transition-colors',
          active && 'text-nilin-charcoal',
          align === 'center' && 'mx-auto'
        )}
      >
        {label}
        {active ? (
          sortOrder === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}

export const ProviderListPanel: React.FC<ProviderListPanelProps> = ({
  providers,
  isLoading,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  sortBy,
  sortOrder,
  onSort,
  onSelectProvider,
  onPageChange,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-nilin-border" />
          <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-transparent border-t-nilin-coral animate-spin" />
        </div>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-nilin-blush/30 flex items-center justify-center">
          <Users className="w-8 h-8 text-nilin-warmGray" />
        </div>
        <p className="text-nilin-charcoal font-medium">No providers match your filters</p>
        <p className="text-nilin-warmGray text-sm mt-1">Try another status tab or clear search</p>
      </div>
    );
  }

  const rangeStart = (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="flex flex-col min-h-[420px]">
      <div className="overflow-x-auto flex-1">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr className="border-b border-nilin-border bg-nilin-cream/50">
              <SortHeader label="Provider" column="name" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              <th className="py-3.5 px-4 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">
                Status
              </th>
              <th className="py-3.5 px-4 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">
                Location
              </th>
              <SortHeader
                label="Performance"
                column="qualityScore"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
              <th className="py-3.5 px-4 text-center text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">
                Bookings
              </th>
              <th className="py-3.5 px-4 text-center text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">
                Rating
              </th>
              <th className="py-3.5 px-4 text-right text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nilin-border/60">
            {providers.map((provider) => {
              const quality = provider.analytics?.performanceMetrics?.qualityScore;
              const reliability = provider.analytics?.performanceMetrics?.punctualityScore;
              const city = provider.locationInfo?.primaryAddress?.city;
              const completed = provider.analytics?.bookingStats?.completedBookings ?? 0;
              const total = provider.analytics?.bookingStats?.totalBookings ?? 0;
              const rating = provider.reviewsData?.averageRating;
              const reviewCount = provider.reviewsData?.totalReviews ?? 0;

              return (
                <tr
                  key={provider._id}
                  className="group hover:bg-nilin-blush/20 transition-colors cursor-pointer"
                  onClick={() => onSelectProvider(provider)}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-nilin-coral/15 to-nilin-rose/15 flex items-center justify-center overflow-hidden ring-1 ring-nilin-border">
                          {provider.instagramStyleProfile?.profilePhoto ? (
                            <img
                              src={provider.instagramStyleProfile.profilePhoto}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Building className="w-6 h-6 text-nilin-coral" />
                          )}
                        </div>
                        {provider.instagramStyleProfile?.isVerified && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center ring-2 ring-white">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-nilin-charcoal truncate group-hover:text-nilin-coral transition-colors">
                          {getProviderDisplayName(provider)}
                        </p>
                        <p className="text-sm text-nilin-warmGray truncate">{getProviderSecondaryLine(provider)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <ProviderStatusBadge status={provider.verificationStatus?.overall || 'pending'} />
                  </td>
                  <td className="py-4 px-4">
                    {city ? (
                      <span className="text-sm text-nilin-charcoal inline-flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-nilin-warmGray shrink-0" />
                        {city}
                      </span>
                    ) : (
                      <span className="text-sm text-nilin-warmGray italic">Not set</span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex gap-6">
                      <ScoreBar score={quality} label="Quality" />
                      <ScoreBar score={reliability} label="Reliability" />
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-sm font-semibold text-nilin-charcoal tabular-nums">{completed}</span>
                    <span className="text-nilin-warmGray text-sm"> / {total}</span>
                    <p className="text-[10px] text-nilin-warmGray mt-0.5">completed</p>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-center gap-1.5">
                      {reviewCount > 0 ? (
                        <>
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                          <span className="text-sm font-semibold text-nilin-charcoal tabular-nums">
                            {rating?.toFixed(1) ?? '0.0'}
                          </span>
                          <span className="text-xs text-nilin-warmGray">({reviewCount})</span>
                        </>
                      ) : (
                        <span className="text-sm text-nilin-warmGray">No reviews</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProvider(provider);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-nilin-charcoal border border-nilin-border rounded-lg hover:bg-nilin-blush/40 hover:border-nilin-coral/30 transition-all"
                      aria-label="View provider details"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AdminPagination
        page={currentPage}
        totalPages={totalPages}
        total={totalCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        showPageNumbers
        showTotal
        className="flex-wrap gap-3 px-4 py-3 border-t border-nilin-border bg-nilin-cream/30 mt-auto"
        ariaLabel="Provider list pagination"
      />
    </div>
  );
};
