import React from 'react';
import { cn } from '../../lib/utils';
import { CATEGORY_ICON_KEYS, CategoryIcon, type CategoryIconKey } from './CategoryIcon';

interface CategoryIconPickerProps {
  value: string;
  onChange: (iconKey: CategoryIconKey) => void;
  slug?: string;
}

export const CategoryIconPicker: React.FC<CategoryIconPickerProps> = ({
  value,
  onChange,
  slug,
}) => {
  const selected = CATEGORY_ICON_KEYS.includes(value as CategoryIconKey)
    ? (value as CategoryIconKey)
    : 'sparkles';

  return (
    <div className="mt-2">
      <p className="text-xs text-nilin-warmGray mb-2 font-sans">Choose an icon</p>
      <div className="grid grid-cols-6 gap-2">
        {CATEGORY_ICON_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            title={key}
            className={cn(
              'flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border transition-all',
              selected === key
                ? 'border-nilin-coral bg-nilin-blush/60 ring-2 ring-nilin-coral/40'
                : 'border-nilin-border/50 bg-white/60 hover:border-nilin-coral/40 hover:bg-nilin-blush/30'
            )}
          >
            <CategoryIcon icon={key} slug={slug} size="lg" />
            <span className="text-[10px] text-nilin-warmGray capitalize truncate w-full text-center">
              {key}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryIconPicker;
