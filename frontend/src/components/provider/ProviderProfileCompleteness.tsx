/**
 * ProviderProfileCompleteness - Visual progress bar showing profile completion
 * Provider Dashboard Component
 */
import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  ChevronRight,
  User,
  MapPin,
  Phone,
  Mail,
  Shield,
  FileText,
  Image,
  Star
} from 'lucide-react';

export interface ProfileCompletenessData {
  // Basic Info
  hasName: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  hasAvatar: boolean;
  // Provider Profile
  hasBusinessName: boolean;
  hasBio: boolean;
  hasProfileComplete: boolean;
  // Location
  hasAddress: boolean;
  hasServiceAreas: boolean;
  hasCoordinates: boolean;
  // Verification
  isIdentityVerified: boolean;
  isBackgroundChecked: boolean;
  hasBusinessDocuments: boolean;
  // Services
  hasServices: boolean;
  serviceCount: number;
  // Portfolio
  hasPortfolio: boolean;
  portfolioItemCount: number;
  // Reviews
  hasReviews: boolean;
  averageRating: number;
}

export interface ProviderProfileCompletenessProps {
  /** Profile completeness data */
  data: ProfileCompletenessData;
  /** Callback when section is clicked */
  onSectionClick?: (section: string) => void;
  /** Currency code */
  currency?: string;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

const SECTION_ORDER = [
  { id: 'basic', label: 'Basic Info', icon: User },
  { id: 'business', label: 'Business Details', icon: FileText },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'verification', label: 'Verification', icon: Shield },
  { id: 'services', label: 'Services', icon: Star },
  { id: 'portfolio', label: 'Portfolio', icon: Image },
];

const SECTION_ITEMS: Record<string, { key: keyof ProfileCompletenessData; label: string; weight: number }[]> = {
  basic: [
    { key: 'hasName', label: 'Display name', weight: 1 },
    { key: 'hasEmail', label: 'Email address', weight: 1 },
    { key: 'hasPhone', label: 'Phone number', weight: 1 },
    { key: 'hasAvatar', label: 'Profile photo', weight: 1 },
  ],
  business: [
    { key: 'hasBusinessName', label: 'Business name', weight: 2 },
    { key: 'hasBio', label: 'Bio / description', weight: 1 },
  ],
  location: [
    { key: 'hasAddress', label: 'Primary address', weight: 2 },
    { key: 'hasServiceAreas', label: 'Service areas', weight: 1 },
    { key: 'hasCoordinates', label: 'Location coordinates', weight: 1 },
  ],
  verification: [
    { key: 'isIdentityVerified', label: 'Identity verified', weight: 2 },
    { key: 'isBackgroundChecked', label: 'Background check', weight: 1 },
    { key: 'hasBusinessDocuments', label: 'Business documents', weight: 1 },
  ],
  services: [
    { key: 'hasServices', label: 'At least one service', weight: 3 },
  ],
  portfolio: [
    { key: 'hasPortfolio', label: 'Portfolio items', weight: 2 },
  ],
};

// =============================================================================
// Item Row Component
// =============================================================================

interface ItemRowProps {
  label: string;
  isComplete: boolean;
  onClick?: () => void;
}

const ItemRow: React.FC<ItemRowProps> = ({ label, isComplete, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors text-left',
      isComplete
        ? 'text-green-700 hover:bg-green-50'
        : 'text-nilin-warmGray hover:bg-nilin-muted/50',
      onClick && 'cursor-pointer'
    )}
    disabled={!onClick}
  >
    <span className="text-sm">{label}</span>
    {isComplete ? (
      <CheckCircle2 className="w-4 h-4 text-green-600" />
    ) : (
      <Circle className="w-4 h-4 text-nilin-lightGray" />
    )}
  </button>
);

// =============================================================================
// Section Component
// =============================================================================

interface SectionProps {
  id: string;
  label: string;
  icon: React.ElementType;
  items: { key: keyof ProfileCompletenessData; label: string; weight: number }[];
  data: ProfileCompletenessData;
  sectionScore: number;
  onClick?: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}

const Section: React.FC<SectionProps> = ({
  id,
  label,
  icon,
  items,
  data,
  sectionScore,
  onClick,
  isExpanded,
  onToggle,
}) => {
  const Icon = icon;
  const completedCount = items.filter(item => data[item.key]).length;
  const totalCount = items.length;
  const isComplete = completedCount === totalCount;

  return (
    <div className="border border-nilin-border rounded-xl overflow-hidden">
      {/* Section Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-nilin-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            isComplete ? 'bg-green-100' : 'bg-nilin-coral/10'
          )}>
            <Icon className={cn(
              'w-4 h-4',
              isComplete ? 'text-green-600' : 'text-nilin-coral'
            )} />
          </div>
          <div className="text-left">
            <p className={cn(
              'text-sm font-medium',
              isComplete ? 'text-green-700' : 'text-nilin-charcoal'
            )}>
              {label}
            </p>
            <p className="text-xs text-nilin-warmGray">
              {completedCount}/{totalCount} complete
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress indicator */}
          <div className="w-16 h-1.5 bg-nilin-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                isComplete ? 'bg-green-500' : 'bg-nilin-coral'
              )}
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
          <ChevronRight className={cn(
            'w-4 h-4 text-nilin-warmGray transition-transform',
            isExpanded && 'rotate-90'
          )} />
        </div>
      </button>

      {/* Section Content */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-nilin-border/50">
          <div className="pt-2 space-y-0.5">
            {items.map(item => (
              <ItemRow
                key={item.key}
                label={item.label}
                isComplete={!!data[item.key]}
                onClick={onClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const ProviderProfileCompleteness: React.FC<ProviderProfileCompletenessProps> = ({
  data,
  onSectionClick,
  className,
}) => {
  const [expandedSection, setExpandedSection] = React.useState<string | null>('basic');

  // Calculate overall completeness score
  const { score, breakdown } = useMemo(() => {
    const sectionScores: Record<string, { score: number; total: number }> = {};
    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(SECTION_ITEMS).forEach(([sectionId, items]) => {
      let sectionScore = 0;
      let sectionWeight = 0;

      items.forEach(item => {
        const weight = item.weight;
        sectionWeight += weight;
        totalWeight += weight;
        if (data[item.key]) {
          sectionScore += weight;
          totalScore += weight;
        }
      });

      sectionScores[sectionId] = { score: sectionScore, total: sectionWeight };
    });

    const overallScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;

    return { score: overallScore, breakdown: sectionScores };
  }, [data]);

  // Get color based on score
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-600';
    if (s >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (s: number) => {
    if (s >= 80) return 'bg-green-500';
    if (s >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (s: number) => {
    if (s >= 90) return 'Excellent';
    if (s >= 70) return 'Good';
    if (s >= 50) return 'Needs Work';
    return 'Incomplete';
  };

  // Find incomplete sections for the "Complete next" section
  const incompleteSections = SECTION_ORDER.filter(section => {
    const sectionData = breakdown[section.id];
    return sectionData && sectionData.score < sectionData.total;
  });

  const handleSectionClick = (sectionId: string) => {
    if (onSectionClick) {
      onSectionClick(sectionId);
    }
  };

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-nilin-charcoal">
            Profile Completeness
          </h3>
          <p className="text-sm text-nilin-warmGray">
            Complete your profile to build trust with customers
          </p>
        </div>
        <div className="text-right">
          <p className={cn('text-2xl font-bold', getScoreColor(score))}>
            {score}%
          </p>
          <p className="text-xs text-nilin-warmGray">{getScoreLabel(score)}</p>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-6">
        <div className="h-3 bg-nilin-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', getScoreBg(score))}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Score Legend */}
      <div className="flex items-center justify-center gap-6 mb-6 pb-4 border-b border-nilin-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-xs text-nilin-warmGray">Complete</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-xs text-nilin-warmGray">In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-xs text-nilin-warmGray">Missing</span>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {SECTION_ORDER.map(section => {
          const sectionData = breakdown[section.id];
          const sectionScore = sectionData ? Math.round((sectionData.score / sectionData.total) * 100) : 0;
          const isComplete = sectionScore === 100;

          return (
            <Section
              key={section.id}
              id={section.id}
              label={section.label}
              icon={section.icon}
              items={SECTION_ITEMS[section.id]}
              data={data}
              sectionScore={sectionScore}
              isExpanded={expandedSection === section.id}
              onToggle={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
              onClick={!isComplete ? () => handleSectionClick(section.id) : undefined}
            />
          );
        })}
      </div>

      {/* Complete Next CTA */}
      {incompleteSections.length > 0 && (
        <div className="mt-6 pt-4 border-t border-nilin-border">
          <p className="text-xs text-nilin-warmGray mb-2">Complete next:</p>
          <div className="flex flex-wrap gap-2">
            {incompleteSections.slice(0, 3).map(section => {
              const sectionData = breakdown[section.id];
              const sectionScore = sectionData ? Math.round((sectionData.score / sectionData.total) * 100) : 0;
              const Icon = section.icon;

              return (
                <button
                  key={section.id}
                  onClick={() => handleSectionClick(section.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nilin-coral/10 text-nilin-coral hover:bg-nilin-coral/20 transition-colors text-xs font-medium"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Success State */}
      {score === 100 && (
        <div className="mt-6 pt-4 border-t border-green-200 bg-green-50 rounded-xl p-4 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-green-700">Profile Complete!</p>
          <p className="text-xs text-green-600 mt-1">
            Your profile is fully set up. Great job!
          </p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default ProviderProfileCompleteness;
