import React, { useState } from 'react';
import {
  Clock,
  Eye,
  ThumbsUp,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Share2,
  Bookmark,
  Printer,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================
// Type Definitions
// ============================================

export interface Article {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  views: number;
  helpful: number;
  notHelpful: number;
  relatedArticles: RelatedArticle[];
  lastUpdated: Date;
  readingTime: number;
  author: string;
  breadcrumbs?: BreadcrumbItem[];
}

export interface RelatedArticle {
  id: string;
  title: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface FAQArticleProps {
  article: Article;
  onBack?: () => void;
  onRelatedClick?: (articleId: string) => void;
  onFeedback?: (isHelpful: boolean) => void;
  onShare?: () => void;
  className?: string;
}

// ============================================
// Table of Contents Component
// ============================================

interface TableOfContentsProps {
  content: string;
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ content }) => {
  // Extract headings from content
  const headings = content.match(/^#{1,3}\s+.+$/gm) || [];

  if (headings.length < 2) return null;

  return (
    <div className="bg-nilin-blush/30 rounded-xl p-4 mb-6">
      <h4 className="text-sm font-semibold text-nilin-charcoal mb-3">In this article</h4>
      <ul className="space-y-2">
        {headings.map((heading, index) => {
          const level = heading.match(/^#+/)?.[0].length || 1;
          const text = heading.replace(/^#+\s+/, '');
          return (
            <li
              key={index}
              className={cn(
                'text-sm text-nilin-warmGray hover:text-nilin-coral cursor-pointer transition-colors',
                level === 1 && 'font-medium',
                level === 2 && 'pl-3',
                level === 3 && 'pl-6'
              )}
              onClick={() => {
                const element = document.getElementById(text.toLowerCase().replace(/\s+/g, '-'));
                element?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {text}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

const FAQArticle: React.FC<FAQArticleProps> = ({
  article,
  onBack,
  onRelatedClick,
  onFeedback,
  onShare,
  className,
}) => {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [showFeedback, setShowFeedback] = useState(false);

  // Toggle section expansion
  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Parse content into sections
  const sections = article.content.split('\n\n').filter(Boolean);

  return (
    <div className={cn('bg-white rounded-2xl overflow-hidden', className)}>
      {/* Header */}
      <div className="p-6 border-b border-nilin-border">
        {/* Breadcrumbs */}
        {article.breadcrumbs && article.breadcrumbs.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-nilin-warmGray mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-1 hover:text-nilin-coral transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            {article.breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                <span>/</span>
                <span className={cn(crumb.href ? 'hover:text-nilin-coral cursor-pointer' : '')}>
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Category Badge */}
        <span className="inline-block px-3 py-1 bg-nilin-blush/50 text-nilin-coral text-xs font-medium rounded-full mb-3">
          {article.category}
        </span>

        {/* Title */}
        <h1 className="text-2xl font-bold text-nilin-charcoal mb-3">
          {article.title}
        </h1>

        {/* Meta Info */}
        <div className="flex items-center gap-4 text-sm text-nilin-warmGray">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {article.readingTime} min read
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {article.views.toLocaleString()} views
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Updated {new Date(article.lastUpdated).toLocaleDateString()}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => setIsBookmarked(!isBookmarked)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
              isBookmarked
                ? 'bg-nilin-coral/10 text-nilin-coral'
                : 'bg-nilin-blush/50 text-nilin-warmGray hover:text-nilin-charcoal'
            )}
          >
            <Bookmark className={cn('h-4 w-4', isBookmarked && 'fill-current')} />
            {isBookmarked ? 'Saved' : 'Save'}
          </button>
          <button
            onClick={onShare}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nilin-blush/50 text-nilin-warmGray hover:text-nilin-charcoal text-sm font-medium transition-colors"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nilin-blush/50 text-nilin-warmGray hover:text-nilin-charcoal text-sm font-medium transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Table of Contents */}
        <TableOfContents content={article.content} />

        {/* Description */}
        <p className="text-lg text-nilin-warmGray mb-6">
          {article.description}
        </p>

        {/* Content Sections */}
        <div className="prose prose-nilin max-w-none">
          {sections.map((section, index) => {
            // Check if it's a heading
            if (section.startsWith('#')) {
              const headingMatch = section.match(/^(#{1,3})\s+(.+)$/);
              if (headingMatch) {
                const level = headingMatch[1].length;
                const text = headingMatch[2];
                const id = text.toLowerCase().replace(/\s+/g, '-');

                const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3';
                return (
                  <HeadingTag
                    key={index}
                    id={id}
                    className={cn(
                      'text-nilin-charcoal font-bold mt-8 mb-4',
                      level === 1 && 'text-2xl',
                      level === 2 && 'text-xl',
                      level === 3 && 'text-lg'
                    )}
                  >
                    {text}
                  </HeadingTag>
                );
              }
            }

            // Check if it's a collapsible section
            if (section.startsWith('[!')) {
              const titleMatch = section.match(/\[!.+\]\((.+)\)/);
              if (titleMatch) {
                const title = titleMatch[1];
                const content = section.replace(/\[!.+\]\(.+\)\n?/, '');
                const isExpanded = expandedSections.has(index);

                return (
                  <div key={index} className="border border-nilin-border rounded-xl mb-4 overflow-hidden">
                    <button
                      onClick={() => toggleSection(index)}
                      className="w-full flex items-center justify-between p-4 bg-nilin-blush/20 hover:bg-nilin-blush/30 transition-colors"
                    >
                      <span className="font-medium text-nilin-charcoal">{title}</span>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-nilin-warmGray" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-nilin-warmGray" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="p-4 prose prose-sm max-w-none">
                        {content.split('\n').map((line, lineIndex) => (
                          <p key={lineIndex} className="mb-2">{line}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
            }

            // Check if it's a code block
            if (section.startsWith('```')) {
              const code = section.replace(/```\w*\n?/, '').replace(/```$/, '');
              return (
                <pre key={index} className="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto mb-4">
                  <code>{code}</code>
                </pre>
              );
            }

            // Regular paragraph
            return (
              <p key={index} className="text-nilin-charcoal mb-4 leading-relaxed">
                {section}
              </p>
            );
          })}
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex items-center gap-2 mt-8 pt-6 border-t border-nilin-border">
            <span className="text-sm text-nilin-warmGray">Tags:</span>
            {article.tags.map(tag => (
              <span
                key={tag}
                className="px-2 py-1 bg-nilin-blush/50 text-nilin-coral text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Feedback */}
        <div className="mt-8 p-6 bg-nilin-blush/20 rounded-xl">
          {showFeedback ? (
            <div className="text-center">
              <p className="text-nilin-charcoal font-medium mb-4">Thank you for your feedback!</p>
              <button
                onClick={() => setShowFeedback(false)}
                className="text-sm text-nilin-coral hover:underline"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-nilin-charcoal font-medium mb-4">
                Was this article helpful?
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => {
                    onFeedback?.(true);
                    setShowFeedback(true);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-white rounded-xl border border-nilin-border hover:border-green-500 hover:bg-green-50 transition-all"
                >
                  <ThumbsUp className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-nilin-charcoal">Yes</span>
                  <span className="text-sm text-nilin-warmGray">({article.helpful})</span>
                </button>
                <button
                  onClick={() => {
                    onFeedback?.(false);
                    setShowFeedback(true);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-white rounded-xl border border-nilin-border hover:border-red-500 hover:bg-red-50 transition-all"
                >
                  <ThumbsUp className="h-5 w-5 text-red-500 rotate-180" />
                  <span className="font-medium text-nilin-charcoal">No</span>
                  <span className="text-sm text-nilin-warmGray">({article.notHelpful})</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Related Articles */}
        {article.relatedArticles.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">Related Articles</h3>
            <div className="space-y-2">
              {article.relatedArticles.map(related => (
                <button
                  key={related.id}
                  onClick={() => onRelatedClick?.(related.id)}
                  className="w-full flex items-center justify-between p-4 bg-nilin-blush/20 rounded-xl hover:bg-nilin-blush/30 transition-colors text-left"
                >
                  <span className="text-nilin-charcoal font-medium">{related.title}</span>
                  <ExternalLink className="h-4 w-4 text-nilin-warmGray" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Contact Support */}
        <div className="mt-8 p-6 bg-gradient-to-r from-nilin-rose/10 to-nilin-coral/10 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-white">
              <MessageSquare className="h-6 w-6 text-nilin-coral" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-nilin-charcoal">Still need help?</h4>
              <p className="text-sm text-nilin-warmGray mt-1">
                Our support team is here to assist you with any questions.
              </p>
            </div>
            <button className="px-6 py-3 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors">
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQArticle;
