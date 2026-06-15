import React from 'react';
import { PieChart } from 'lucide-react';
import { EmptyState } from '../../common/EmptyState';
import { formatPrice } from '../../../utils/currency';

export interface TopServiceItem {
  name: string;
  bookings: number;
  revenue: number;
  grossRevenue?: number;
}

interface TopServicesSectionProps {
  services: TopServiceItem[];
  revenueMode?: 'net' | 'gross';
}

export const TopServicesSection: React.FC<TopServicesSectionProps> = ({
  services,
  revenueMode = 'net'
}) => {
  const totalRevenue = services.reduce((sum, s) => {
    // Use gross revenue if available and gross mode is selected
    const revenue = revenueMode === 'gross' && s.grossRevenue !== undefined
      ? s.grossRevenue
      : s.revenue;
    return sum + revenue;
  }, 0);

  return (
    <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-nilin-coral/10 rounded-nilin">
          <PieChart className="h-5 w-5 text-nilin-coral" />
        </div>
        <h2 className="text-lg font-serif text-nilin-charcoal">Top Services</h2>
      </div>

      {services.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          }
          title="No completed bookings yet"
          description="Complete bookings to see your top services performance here."
          compact
        />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {services.map((service, index) => {
              // Use gross revenue if available and gross mode is selected
              const displayRevenue = revenueMode === 'gross' && service.grossRevenue !== undefined
                ? service.grossRevenue
                : service.revenue;
              const avgPrice =
                service.bookings > 0 ? Math.round(displayRevenue / service.bookings) : 0;
              const revenueShare =
                totalRevenue > 0 && services.length > 1
                  ? Math.round((displayRevenue / totalRevenue) * 100)
                  : null;

              return (
                <div
                  key={`${service.name}-${index}`}
                  className="rounded-nilin border border-nilin-border bg-white/60 p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-nilin-coral/10 text-nilin-coral text-sm font-semibold">
                        #{index + 1}
                      </span>
                      <span className="font-medium text-nilin-charcoal truncate">{service.name}</span>
                    </div>
                    {revenueShare !== null && (
                      <span className="text-xs text-nilin-warmGray flex-shrink-0">
                        {revenueShare}% of revenue
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-nilin-warmGray text-xs">Bookings</p>
                      <p className="font-medium text-nilin-charcoal">{service.bookings}</p>
                    </div>
                    <div>
                      <p className="text-nilin-warmGray text-xs">{revenueMode === 'gross' ? 'Gross' : 'Net'} Revenue</p>
                      <p className="font-medium text-nilin-charcoal">{formatPrice(displayRevenue)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-nilin-warmGray text-xs">Avg price</p>
                      <p className="font-medium text-nilin-charcoal">{formatPrice(avgPrice)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-nilin-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-nilin-warmGray">
                    Service
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-nilin-warmGray">
                    Bookings
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-nilin-warmGray">
                    {revenueMode === 'gross' ? 'Gross' : 'Net'} Revenue
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-nilin-warmGray">
                    Avg Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {services.map((service, index) => {
                  const displayRevenue = revenueMode === 'gross' && service.grossRevenue !== undefined
                    ? service.grossRevenue
                    : service.revenue;
                  return (
                    <tr
                      key={`${service.name}-${index}`}
                      className="border-b border-nilin-border last:border-b-0 hover:bg-nilin-muted/50 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <span className="text-nilin-warmGray text-sm">#{index + 1}</span>
                          <span className="font-medium text-nilin-charcoal">{service.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center text-nilin-charcoal">{service.bookings}</td>
                      <td className="py-4 px-4 text-right font-medium text-nilin-charcoal">
                        {formatPrice(displayRevenue)}
                      </td>
                      <td className="py-4 px-4 text-right text-nilin-warmGray">
                        {service.bookings > 0
                          ? formatPrice(Math.round(displayRevenue / service.bookings))
                          : formatPrice(0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
