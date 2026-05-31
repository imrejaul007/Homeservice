import React, { useState, useCallback } from 'react';
import {
  Search,
  Book,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Clock,
  Eye,
  ThumbsUp,
  MessageSquare,
  Loader2,
  FileText,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================
// Type Definitions
// ============================================

export type ArticleCategory = 'getting_started' | 'booking' | 'payment' | 'account' | 'troubleshooting' | 'provider' | 'faq';

export interface Article {
  id: string;
  title: string;
  description: string;
  content: string;
  category: ArticleCategory;
  tags: string[];
  views: number;
  helpful: number;
  notHelpful: number;
  relatedArticles: string[];
  lastUpdated: Date;
  readingTime: number;
  author: string;
  isFeatured?: boolean;
}

export interface CategorySection {
  id: ArticleCategory;
  title: string;
  description: string;
  icon: React.ReactNode;
  articleCount: number;
}

export interface KnowledgeBaseProps {
  articles: Article[];
  categories: CategorySection[];
  onArticleClick?: (article: Article) => void;
  onSearch?: (query: string) => Promise<Article[]>;
  onArticleFeedback?: (articleId: string, isHelpful: boolean) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

// ============================================
// Category Configuration
// ============================================

const CATEGORY_CONFIG: Record<ArticleCategory, { icon: React.ReactNode; color: string }> = {
  getting_started: { icon: <Book className="h-5 w-5" />, color: 'text-blue-500' },
  booking: { icon: <HelpCircle className="h-5 w-5" />, color: 'text-green-500' },
  payment: { icon: <FileText className="h-5 w-5" />, color: 'text-purple-500' },
  account: { icon: <HelpCircle className="h-5 w-5" />, color: 'text-orange-500' },
  troubleshooting: { icon: <HelpCircle className="h-5 w-5" />, color: 'text-red-500' },
  provider: { icon: <HelpCircle className="h-5 w-5" />, color: 'text-teal-500' },
  faq: { icon: <HelpCircle className="h-5 w-5" />, color: 'text-indigo-500' },
};

// ============================================
// Article Card Component
// ============================================

interface ArticleCardProps {
  article: Article;
  onClick: () => void;
  compact?: boolean;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, onClick, compact = false }) => {
  const categoryConfig = CATEGORY_CONFIG[article.category];

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-nilin-blush/50 transition-colors text-left"
      >
        <div className={cn('p-2 rounded-lg bg-nilin-blush/50', categoryConfig.color)}>
          {categoryConfig.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-nilin-charcoal line-clamp-1">{article.title}</p>
          <p className="text-xs text-nilin-warmGray">{article.readingTime} min read</p>
        </div>
        <ChevronRight className="h-4 w-4 text-nilin-warmGray" />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl border border-nilin-border hover:border-nilin-coral/50 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-lg bg-nilin-blush/50 group-hover:bg-nilin-coral/10 transition-colors', categoryConfig.color)}>
          {categoryConfig.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-nilin-charcoal group-hover:text-nilin-coral transition-colors">
            {article.title}
          </h4>
          <p className="text-sm text-nilin-warmGray mt-1 line-clamp-2">
            {article.description}
          </p>
          <div className="flex items-center gap-4 mt-3 text-xs text-nilin-warmGray">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {article.views.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              {article.helpful}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {article.readingTime} min
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};

// ============================================
// Category Section Component
// ============================================

interface CategorySectionProps {
  category: CategorySection;
  articles: Article[];
  onArticleClick: (article: Article) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

const CategorySectionComponent: React.FC<CategorySectionProps> = ({
  category,
  articles,
  onArticleClick,
  isExpanded,
  onToggle,
}) => {
  const categoryConfig = CATEGORY_CONFIG[category.id];

  return (
    <div className="border border-nilin-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-nilin-blush/30 transition-colors"
      >
        <div className={cn('p-2 rounded-lg bg-nilin-blush/50', categoryConfig.color)}>
          {category.icon}
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-medium text-nilin-charcoal">{category.title}</h3>
          <p className="text-sm text-nilin-warmGray">{category.articleCount} articles</p>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-nilin-warmGray" />
        ) : (
          <ChevronRight className="h-5 w-5 text-nilin-warmGray" />
        )}
      </button>

      {/* Articles */}
      {isExpanded && (
        <div className="border-t border-nilin-border p-2 space-y-1">
          {articles.slice(0, 5).map(article => (
            <ArticleCard
              key={article.id}
              article={article}
              onClick={() => onArticleClick(article)}
              compact
            />
          ))}
          {articles.length > 5 && (
            <button className="w-full flex items-center justify-center gap-2 p-2 text-sm text-nilin-coral font-medium hover:bg-nilin-coral/5 rounded-lg transition-colors">
              View all {articles.length} articles
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// Main Component
// ============================================

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({
  articles,
  categories,
  onArticleClick,
  onSearch,
  onArticleFeedback,
  isLoading = false,
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Article[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<ArticleCategory>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<ArticleCategory | null>(null);

  // Get featured articles
  const featuredArticles = articles.filter(a => a.isFeatured).slice(0, 4);

  // Handle search
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    if (onSearch) {
      setIsSearching(true);
      try {
        const results = await onSearch(query);
        setSearchResults(results);
      } catch (error) {
        console.error('Search failed:', error);
        // Fallback to local search
        const filtered = articles.filter(a =>
          a.title.toLowerCase().includes(query.toLowerCase()) ||
          a.description.toLowerCase().includes(query.toLowerCase()) ||
          a.tags.some(t => t.toLowerCase().includes(query.toLowerCase()))
        );
        setSearchResults(filtered);
      } finally {
        setIsSearching(false);
      }
    } else {
      // Local search
      const filtered = articles.filter(a =>
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        a.description.toLowerCase().includes(query.toLowerCase()) ||
        a.tags.some(t => t.toLowerCase().includes(query.toLowerCase()))
      );
      setSearchResults(filtered);
    }
  }, [articles, onSearch]);

  // Toggle category
  const toggleCategory = useCallback((categoryId: ArticleCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // Filter articles by category
  const getArticlesByCategory = useCallback((categoryId: ArticleCategory) => {
    return articles.filter(a => a.category === categoryId);
  }, [articles]);

  // Handle feedback
  const handleFeedback = useCallback(async (articleId: string, isHelpful: boolean) => {
    await onArticleFeedback?.(articleId, isHelpful);
  }, [onArticleFeedback]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-nilin-charcoal mb-2">Help Center</h2>
        <p className="text-nilin-warmGray">Find answers and guides for common questions</p>
      </div>

      {/* Search */}
      <div className="relative max-w-2xl mx-auto">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-nilin-warmGray" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search for articles, topics, or keywords..."
          className="w-full pl-12 pr-4 py-4 bg-white border-2 border-nilin-border rounded-2xl focus:outline-none focus:border-nilin-coral/50 focus:ring-4 focus:ring-nilin-coral/10 transition-all text-nilin-charcoal"
        />
        {isSearching && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-nilin-coral" />
        )}
      </div>

      {/* Search Results */}
      {searchResults !== null && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-nilin-warmGray">
              {searchResults.length} results for "{searchQuery}"
            </p>
            <button
              onClick={() => handleSearch('')}
              className="text-sm text-nilin-coral font-medium hover:underline"
            >
              Clear search
            </button>
          </div>

          {searchResults.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-nilin-border">
              <HelpCircle className="h-12 w-12 text-nilin-warmGray mx-auto mb-3" />
              <p className="text-nilin-charcoal font-medium">No articles found</p>
              <p className="text-sm text-nilin-warmGray mt-1">
                Try different keywords or browse categories below
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map(article => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onClick={() => onArticleClick?.(article)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Browse by Category */}
      {searchResults === null && (
        <>
          {/* Featured Articles */}
          {featuredArticles.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">Popular Articles</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {featuredArticles.map(article => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    onClick={() => onArticleClick?.(article)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Category Sections */}
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">Browse by Category</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(category => (
                <CategorySectionComponent
                  key={category.id}
                  category={category}
                  articles={getArticlesByCategory(category.id)}
                  onArticleClick={onArticleClick || (() => {})}
                  isExpanded={expandedCategories.has(category.id)}
                  onToggle={() => toggleCategory(category.id)}
                />
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-gradient-to-r from-nilin-blush/30 to-nilin-coral/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">Quick Help</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl hover:shadow-md transition-all">
                <div className="p-3 rounded-full bg-blue-100 text-blue-500">
                  <Book className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-nilin-charcoal">Getting Started</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl hover:shadow-md transition-all">
                <div className="p-3 rounded-full bg-green-100 text-green-500">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-nilin-charcoal">Booking Help</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl hover:shadow-md transition-all">
                <div className="p-3 rounded-full bg-purple-100 text-purple-500">
                  <FileText className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-nilin-charcoal">Payments</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl hover:shadow-md transition-all">
                <div className="p-3 rounded-full bg-orange-100 text-orange-500">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-nilin-charcoal">Contact Us</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Article Detail View */}
      {/* This would be a modal or page transition in a full implementation */}
    </div>
  );
};

export default KnowledgeBase;
