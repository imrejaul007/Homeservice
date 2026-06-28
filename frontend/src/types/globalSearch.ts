// Shared types for Global Search functionality

export type SearchResultType = 'customer' | 'provider' | 'booking' | 'service' | 'dispute';

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
}

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
}
