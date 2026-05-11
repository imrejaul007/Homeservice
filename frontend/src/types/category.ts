// Category Types for NILIN Architecture

export interface SubcategoryMetadata {
  averagePrice: number;
  averageDuration: number;
  popularTimes: string[];
  requiredSkills: string[];
}

export interface Subcategory {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  sortOrder?: number;
  isActive?: boolean;
  metadata?: SubcategoryMetadata;
}

export interface CategorySEO {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  isFeatured: boolean;
  comingSoon?: boolean;
  subcategoryCount: number;
  subcategories: Subcategory[];
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  seo?: CategorySEO;
}

export interface CategoryWithServices extends Category {
  serviceCount: number;
}

// API Response Types
export interface CategoriesResponse {
  success: boolean;
  data: {
    categories: Category[];
    total: number;
  };
}

export interface CategoryResponse {
  success: boolean;
  data: {
    category: CategoryWithServices;
  };
}

export interface SubcategoriesResponse {
  success: boolean;
  data: {
    categoryName: string;
    categorySlug: string;
    subcategories: Subcategory[];
  };
}

export interface CategoryStatsResponse {
  success: boolean;
  data: {
    categories: Array<{
      _id: string;
      name: string;
      slug: string;
      icon: string;
      color: string;
      serviceCount: number;
    }>;
  };
}

export interface CategorySearchResult {
  type: 'category' | 'subcategory';
  name: string;
  slug: string;
  parentCategory?: string;
}

export interface CategorySearchResponse {
  success: boolean;
  data: {
    results: CategorySearchResult[];
  };
}
