import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

const OLD_TAB_MAP: Record<string, string> = {
  overview: 'insights',
  performance: 'insights',
  revenue: 'insights',
  schedule: 'schedule',
  cancellations: 'cancellations',
  summary: 'summary',
  insights: 'insights',
};

const PERIOD_TO_RANGE: Record<string, string> = {
  week: '7d',
  month: '30d',
  quarter: '90d',
  year: '90d',
};

const ProviderInsightsRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();

  const rawTab = searchParams.get('tab') || 'insights';
  const tab = OLD_TAB_MAP[rawTab] || 'insights';

  const range =
    searchParams.get('range') ||
    (searchParams.get('period') ? PERIOD_TO_RANGE[searchParams.get('period')!] : null) ||
    '30d';

  const params = new URLSearchParams();
  params.set('tab', tab);
  params.set('range', range);

  return <Navigate to={`/provider/analytics?${params.toString()}`} replace />;
};

export default ProviderInsightsRedirect;
