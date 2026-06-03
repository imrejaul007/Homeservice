import React from 'react';
import {
  Scissors,
  Paintbrush,
  Hand,
  Sparkles,
  Heart,
  Eye,
  Wind,
  Crown,
  BookOpen,
  Camera,
  ClipboardList,
  Layers,
  Home,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';

/** Lucide icon keys stored in DB (see categories.seeder.ts) */
export const CATEGORY_ICON_KEYS = [
  'scissors',
  'palette',
  'hand',
  'sparkles',
  'massage',
  'eye',
  'wind',
  'crown',
  'book',
  'camera',
  'clipboard',
  'home',
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

const ICON_BY_KEY: Record<string, LucideIcon> = {
  scissors: Scissors,
  paintbrush: Paintbrush,
  palette: Paintbrush,
  hand: Hand,
  sparkles: Sparkles,
  massage: Heart,
  eye: Eye,
  wind: Wind,
  crown: Crown,
  book: BookOpen,
  camera: Camera,
  clipboard: ClipboardList,
  home: Home,
};

const SLUG_ICON_FALLBACK: Record<string, CategoryIconKey> = {
  hair: 'scissors',
  makeup: 'palette',
  nails: 'hand',
  'skin-aesthetics': 'sparkles',
  'massage-body': 'massage',
  'personal-care': 'eye',
};

const SIZE_CLASS = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
} as const;

function isEmojiOrSingleChar(icon: string): boolean {
  const t = icon.trim();
  if (!t) return false;
  if (t.length <= 2 && !/^[a-z0-9-]+$/i.test(t)) return true;
  try {
    return /\p{Extended_Pictographic}/u.test(t);
  } catch {
    return false;
  }
}

export function resolveCategoryIconKey(icon?: string, slug?: string): CategoryIconKey {
  const raw = (icon || '').trim().toLowerCase();
  if (raw && ICON_BY_KEY[raw]) return raw as CategoryIconKey;
  if (slug && SLUG_ICON_FALLBACK[slug]) return SLUG_ICON_FALLBACK[slug];
  return 'sparkles';
}

export interface CategoryIconProps {
  icon?: string;
  slug?: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  style?: React.CSSProperties;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  icon,
  slug,
  size = 'md',
  className,
  style,
}) => {
  if (icon && isEmojiOrSingleChar(icon)) {
    return (
      <span className={cn('leading-none select-none', className)} style={style} aria-hidden>
        {icon.trim()}
      </span>
    );
  }

  const key = resolveCategoryIconKey(icon, slug);
  const Icon = ICON_BY_KEY[key] || Sparkles;

  return <Icon className={cn(SIZE_CLASS[size], 'text-nilin-charcoal', className)} style={style} />;
};

export default CategoryIcon;
