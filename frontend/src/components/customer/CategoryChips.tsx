import React from 'react';

export interface CategoryChip {
  slug: string;
  name: string;
}

interface CategoryChipsProps {
  categories: CategoryChip[];
  activeCategory: string | null;
  onSelect: (slug: string) => void;
  onClear: () => void;
  maxChips?: number;
}

const CategoryChips: React.FC<CategoryChipsProps> = ({
  categories,
  activeCategory,
  onSelect,
  onClear,
  maxChips = 10,
}) => {
  if (categories.length === 0) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="Category filters"
      className="relative flex gap-2 overflow-x-auto pb-2"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {/* Left fade */}
      <div
        className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-nilin-cream to-transparent z-10 pointer-events-none"
        aria-hidden="true"
      />
      {/* Right fade */}
      <div
        className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-nilin-cream to-transparent z-10 pointer-events-none"
        aria-hidden="true"
      />

      {/* "All" chip - resets category */}
      <button
        type="button"
        onClick={onClear}
        aria-pressed={!activeCategory}
        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          !activeCategory
            ? 'bg-nilin-coral text-white shadow-nilin-sm'
            : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush/50 hover:text-nilin-rose'
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral`}
      >
        All
      </button>

      {/* Category chips */}
      {categories.slice(0, maxChips).map((cat) => (
        <button
          key={cat.slug}
          type="button"
          onClick={() => onSelect(cat.slug)}
          aria-pressed={activeCategory === cat.slug}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeCategory === cat.slug
              ? 'bg-nilin-coral text-white shadow-nilin-sm'
              : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush/50 hover:text-nilin-rose'
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
};

export default CategoryChips;
