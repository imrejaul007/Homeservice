import React, { useState } from 'react';
import {
  Users,
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  MapPin,
  Activity,
  Shield,
  Zap,
  FileText,
  X,
  GripVertical,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
} from 'lucide-react';
import {
  WIDGET_DEFINITIONS,
  WidgetDefinition,
  WidgetType,
  WidgetConfig,
} from '../../types/dashboard';

interface WidgetLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (widgetType: WidgetType) => void;
  onRemoveWidget: (widgetId: string) => void;
  activeWidgets: WidgetConfig[];
}

const iconMap: Record<string, React.ElementType> = {
  Users,
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  MapPin,
  Activity,
  Shield,
  Zap,
  FileText,
};

function WidgetIcon({ iconName, className = 'w-5 h-5' }: { iconName: string; className?: string }) {
  const Icon = iconMap[iconName] || LayoutGrid;
  return <Icon className={className} />;
}

function WidgetLibraryItem({
  definition,
  isActive,
  onAdd,
  onRemove,
  widgetId,
}: {
  definition: WidgetDefinition;
  isActive: boolean;
  onAdd: () => void;
  onRemove: () => void;
  widgetId?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
        isActive
          ? 'border-emerald-200 bg-emerald-50/50'
          : 'border-nilin-border/50 bg-white/40 hover:bg-white/60 hover:border-nilin-coral/30'
      }`}
    >
      <div className="w-10 h-10 rounded-lg bg-nilin-blush/50 flex items-center justify-center flex-shrink-0">
        <WidgetIcon iconName={definition.icon} className="w-5 h-5 text-nilin-coral" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-nilin-charcoal">{definition.title}</p>
        <p className="text-xs text-nilin-warmGray mt-0.5 line-clamp-1">{definition.description}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {isActive && widgetId ? (
          <button
            onClick={onRemove}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Remove from dashboard"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
            title="Add to dashboard"
          >
            <span className="text-lg font-medium">+</span>
          </button>
        )}
      </div>
    </div>
  );
}

function DraggableWidgetItem({
  definition,
  onDragStart,
  onDragEnd,
}: {
  definition: WidgetDefinition;
  onDragStart: (widgetType: WidgetType) => void;
  onDragEnd: () => void;
}) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('widgetType', definition.type);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart(definition.type);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      className="flex items-center gap-3 p-3 rounded-xl border border-nilin-border/50 bg-white/40 hover:bg-white/60 hover:border-nilin-coral/30 cursor-grab active:cursor-grabbing transition-all group"
    >
      <div className="w-8 h-8 rounded-lg bg-nilin-blush/50 flex items-center justify-center flex-shrink-0">
        <GripVertical className="w-4 h-4 text-nilin-warmGray/50 group-hover:text-nilin-warmGray" />
      </div>
      <div className="w-10 h-10 rounded-lg bg-nilin-blush/30 flex items-center justify-center flex-shrink-0">
        <WidgetIcon iconName={definition.icon} className="w-5 h-5 text-nilin-coral" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-nilin-charcoal">{definition.title}</p>
        <p className="text-xs text-nilin-warmGray mt-0.5 line-clamp-1">{definition.description}</p>
      </div>
    </div>
  );
}

export function WidgetLibrary({
  isOpen,
  onClose,
  onAddWidget,
  onRemoveWidget,
  activeWidgets,
}: WidgetLibraryProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('kpi');
  const [draggedWidget, setDraggedWidget] = useState<WidgetType | null>(null);

  const categories = [
    { id: 'kpi', label: 'KPI Cards', types: ['kpi-users', 'kpi-providers', 'kpi-bookings', 'kpi-revenue', 'kpi-churn', 'kpi-funnel', 'kpi-top-city'] },
    { id: 'chart', label: 'Charts', types: ['chart-revenue', 'chart-bookings', 'chart-geographic', 'chart-funnel'] },
    { id: 'activity', label: 'Activity', types: ['activity-feed', 'pending-actions', 'audit-log', 'service-approval'] },
    { id: 'actions', label: 'Actions', types: ['quick-actions'] },
  ];

  const isWidgetActive = (widgetType: WidgetType) => {
    return activeWidgets.some((w) => w.type === widgetType);
  };

  const getWidgetId = (widgetType: WidgetType) => {
    return activeWidgets.find((w) => w.type === widgetType)?.id;
  };

  const handleDragStart = (widgetType: WidgetType) => {
    setDraggedWidget(widgetType);
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in" />

      {/* Panel */}
      <div
        className="relative w-full max-w-md h-full bg-white shadow-xl animate-slide-in-right overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-nilin-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nilin-rose to-nilin-coral flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-serif text-nilin-charcoal">Widget Library</h2>
              <p className="text-xs text-nilin-warmGray">Drag widgets to add or click +</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl border border-nilin-border hover:bg-nilin-blush/40 transition-colors"
            aria-label="Close widget library"
          >
            <X className="w-5 h-5 text-nilin-charcoal" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {categories.map((category) => (
            <div key={category.id} className="space-y-2">
              <button
                onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
                className="flex items-center justify-between w-full text-left py-2"
              >
                <span className="text-sm font-semibold text-nilin-charcoal uppercase tracking-wide">
                  {category.label}
                </span>
                {expandedCategory === category.id ? (
                  <ChevronDown className="w-4 h-4 text-nilin-warmGray" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-nilin-warmGray" />
                )}
              </button>

              {expandedCategory === category.id && (
                <div className="space-y-2">
                  {category.types.map((type) => {
                    const definition = WIDGET_DEFINITIONS[type as WidgetType];
                    if (!definition) return null;

                    return (
                      <DraggableWidgetItem
                        key={type}
                        definition={definition}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Drag indicator */}
        {draggedWidget && (
          <div className="px-5 py-3 bg-nilin-coral/10 border-t border-nilin-coral/20">
            <p className="text-xs text-nilin-coral text-center">
              Drop the widget on the dashboard to add it
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-nilin-border bg-nilin-blush/20">
          <p className="text-xs text-nilin-warmGray text-center">
            {activeWidgets.length} widgets on dashboard
          </p>
        </div>
      </div>
    </div>
  );
}

export default WidgetLibrary;
