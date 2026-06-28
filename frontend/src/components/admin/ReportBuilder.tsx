import React, { useState, useCallback } from 'react';
import {
  Calendar,
  BarChart3,
  Table,
  PieChart as PieChartIcon,
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  Star,
  CheckSquare,
  X,
  Save,
  FolderOpen,
  Plus,
  Trash2,
  RefreshCw,
  Filter,
  XAxis,
  YAxis,
  Layers,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';
import { ReportChart, ChartDataPoint, ChartConfig } from './ReportChart';

export interface ReportMetrics {
  totalBookings?: boolean;
  completedBookings?: boolean;
  cancelledBookings?: boolean;
  pendingBookings?: boolean;
  totalRevenue?: boolean;
  averageBookingValue?: boolean;
  newCustomers?: boolean;
  newProviders?: boolean;
  totalReviews?: boolean;
  averageRating?: boolean;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export type GroupingOption = 'day' | 'week' | 'month' | 'category' | 'provider';
export type ChartType = 'line' | 'bar' | 'pie' | 'table';

export interface ReportConfig {
  metrics: ReportMetrics;
  dateRange: DateRange;
  grouping: GroupingOption;
  chartType: ChartType;
}

export interface ReportTemplate {
  _id: string;
  name: string;
  description?: string;
  config: ReportConfig;
  createdAt: string;
}

export interface ReportResult {
  data: ChartDataPoint[];
  chartConfig: ChartConfig;
  summary: Record<string, number | string>;
  metadata: {
    generatedAt: string;
    dateRange: DateRange;
    grouping: GroupingOption;
    metrics: string[];
  };
}

const AVAILABLE_METRICS = [
  { key: 'totalBookings', label: 'Total Bookings', icon: BarChart3 },
  { key: 'completedBookings', label: 'Completed Bookings', icon: CheckSquare },
  { key: 'cancelledBookings', label: 'Cancelled Bookings', icon: X },
  { key: 'pendingBookings', label: 'Pending Bookings', icon: Clock },
  { key: 'totalRevenue', label: 'Total Revenue', icon: DollarSign },
  { key: 'averageBookingValue', label: 'Average Booking Value', icon: TrendingUp },
  { key: 'newCustomers', label: 'New Customers', icon: Users },
  { key: 'newProviders', label: 'New Providers', icon: Users },
  { key: 'totalReviews', label: 'Total Reviews', icon: Star },
  { key: 'averageRating', label: 'Average Rating', icon: Star },
] as const;

const GROUPING_OPTIONS: { value: GroupingOption; label: string; icon: React.ElementType }[] = [
  { value: 'day', label: 'By Day', icon: Calendar },
  { value: 'week', label: 'By Week', icon: Calendar },
  { value: 'month', label: 'By Month', icon: Calendar },
  { value: 'category', label: 'By Category', icon: Layers },
  { value: 'provider', label: 'By Provider', icon: Users },
];

const CHART_TYPES: { value: ChartType; label: string; icon: React.ElementType }[] = [
  { value: 'line', label: 'Line Chart', icon: XAxis },
  { value: 'bar', label: 'Bar Chart', icon: BarChart3 },
  { value: 'pie', label: 'Pie Chart', icon: PieChartIcon },
  { value: 'table', label: 'Table', icon: Table },
];

const PRESET_RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This month', days: 0, preset: 'month' },
  { label: 'Last month', days: 0, preset: 'lastMonth' },
  { label: 'This year', days: 0, preset: 'year' },
];

interface ReportBuilderProps {
  onSaveSuccess?: (template: ReportTemplate) => void;
}

export function ReportBuilder({ onSaveSuccess }: ReportBuilderProps) {
  // Report configuration state
  const [selectedMetrics, setSelectedMetrics] = useState<Set<keyof ReportMetrics>>(new Set(['totalBookings']));
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  });
  const [grouping, setGrouping] = useState<GroupingOption>('day');
  const [chartType, setChartType] = useState<ChartType>('bar');

  // Report data state
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Templates state
  const [savedTemplates, setSavedTemplates] = useState<ReportTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  // Load saved templates
  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const response = await api.get('/admin/reports/templates');
      if (response.data?.success) {
        setSavedTemplates(response.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  // Load templates on mount
  React.useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Toggle metric selection
  const toggleMetric = (key: keyof ReportMetrics) => {
    setSelectedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      // Ensure at least one metric is selected
      if (next.size === 0) {
        next.add('totalBookings');
      }
      return next;
    });
  };

  // Apply preset date range
  const applyPreset = (preset: typeof PRESET_RANGES[0]) => {
    const end = new Date();
    let start: Date;

    if (preset.days > 0) {
      start = new Date();
      start.setDate(start.getDate() - preset.days);
    } else if (preset.preset === 'month') {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
    } else if (preset.preset === 'lastMonth') {
      start = new Date(end.getFullYear(), end.getMonth() - 1, 1);
      end.setTime(start.getTime());
      end.setDate(0); // Last day of previous month
    } else if (preset.preset === 'year') {
      start = new Date(end.getFullYear(), 0, 1);
    } else {
      return;
    }

    setDateRange({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    });
  };

  // Generate report
  const generateReport = useCallback(async () => {
    if (selectedMetrics.size === 0) {
      toast.error('Please select at least one metric');
      return;
    }

    setLoading(true);
    setError(null);

    const metricsObj: ReportMetrics = {};
    selectedMetrics.forEach((key) => {
      metricsObj[key] = true;
    });

    try {
      const response = await api.post('/admin/reports/generate', {
        metrics: metricsObj,
        dateRange,
        grouping,
        chartType,
      });

      if (response.data?.success) {
        setReportResult(response.data.data);
        toast.success('Report generated successfully');
      } else {
        throw new Error(response.data?.error || 'Failed to generate report');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to generate report';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [selectedMetrics, dateRange, grouping, chartType]);

  // Save template
  const saveTemplate = useCallback(async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    const metricsObj: ReportMetrics = {};
    selectedMetrics.forEach((key) => {
      metricsObj[key] = true;
    });

    try {
      const response = await api.post('/admin/reports/templates', {
        name: templateName,
        description: templateDescription,
        config: {
          metrics: metricsObj,
          dateRange,
          grouping,
          chartType,
        },
      });

      if (response.data?.success) {
        toast.success('Template saved successfully');
        setShowTemplateModal(false);
        setTemplateName('');
        setTemplateDescription('');
        loadTemplates();
        onSaveSuccess?.(response.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save template');
    }
  }, [templateName, templateDescription, selectedMetrics, dateRange, grouping, chartType, loadTemplates, onSaveSuccess]);

  // Load template
  const loadTemplate = useCallback((template: ReportTemplate) => {
    const config = template.config;

    // Set metrics
    const metricsSet = new Set<keyof ReportMetrics>();
    Object.entries(config.metrics).forEach(([key, enabled]) => {
      if (enabled) {
        metricsSet.add(key as keyof ReportMetrics);
      }
    });
    setSelectedMetrics(metricsSet);

    // Set date range
    setDateRange({
      startDate: new Date(config.dateRange.startDate).toISOString().split('T')[0],
      endDate: new Date(config.dateRange.endDate).toISOString().split('T')[0],
    });

    // Set grouping and chart type
    setGrouping(config.grouping);
    setChartType(config.chartType);

    toast.success(`Loaded template: ${template.name}`);
  }, []);

  // Delete template
  const deleteTemplate = useCallback(async (templateId: string) => {
    try {
      await api.delete(`/admin/reports/templates/${templateId}`);
      toast.success('Template deleted');
      loadTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete template');
    }
  }, [loadTemplates]);

  // Export report data
  const exportData = useCallback((format: 'csv' | 'json') => {
    if (!reportResult) return;

    const data = reportResult.data;
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'csv') {
      const headers = ['Label', 'Value'];
      const rows = data.map((d) => [d.label, d.value.toString()]);
      content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      filename = `report-${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = 'text/csv';
    } else {
      content = JSON.stringify(reportResult, null, 2);
      filename = `report-${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported as ${format.toUpperCase()}`);
  }, [reportResult]);

  return (
    <div className="space-y-6">
      {/* Report Configuration */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Panel - Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metrics Selection */}
          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5 text-nilin-coral" />
              Select Metrics
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {AVAILABLE_METRICS.map(({ key, label, icon: Icon }) => (
                <label
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                    selectedMetrics.has(key)
                      ? 'bg-nilin-coral/10 border-nilin-coral/30'
                      : 'bg-white/40 border-nilin-border/40 hover:border-nilin-coral/20'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedMetrics.has(key)}
                    onChange={() => toggleMetric(key)}
                    className="sr-only"
                  />
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedMetrics.has(key)
                        ? 'bg-nilin-coral border-nilin-coral'
                        : 'border-nilin-warmGray/40'
                    }`}
                  >
                    {selectedMetrics.has(key) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <Icon className="w-4 h-4 text-nilin-warmGray" />
                  <span className="text-sm font-medium text-nilin-charcoal font-sans">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range and Grouping */}
          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-nilin-coral" />
              Date Range
            </h3>

            {/* Preset ranges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESET_RANGES.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => applyPreset(preset)}
                  className="px-3 py-1.5 text-xs font-medium text-nilin-charcoal bg-nilin-blush/40 rounded-lg hover:bg-nilin-coral/20 hover:text-nilin-coral transition-colors font-sans"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom date inputs */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="start-date" className="block text-xs font-medium text-nilin-warmGray mb-1.5 font-sans">
                  Start Date
                </label>
                <input
                  type="date"
                  id="start-date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-nilin-border/50 bg-white/60 text-nilin-charcoal text-sm font-sans focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral"
                />
              </div>
              <div>
                <label htmlFor="end-date" className="block text-xs font-medium text-nilin-warmGray mb-1.5 font-sans">
                  End Date
                </label>
                <input
                  type="date"
                  id="end-date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-nilin-border/50 bg-white/60 text-nilin-charcoal text-sm font-sans focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral"
                />
              </div>
            </div>
          </div>

          {/* Grouping and Chart Type */}
          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5">
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Grouping */}
              <div>
                <h4 className="text-sm font-medium text-nilin-charcoal mb-3 font-sans">Group By</h4>
                <div className="space-y-2">
                  {GROUPING_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <label
                      key={value}
                      className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                        grouping === value
                          ? 'bg-nilin-coral/10 text-nilin-coral'
                          : 'hover:bg-nilin-blush/40 text-nilin-charcoal'
                      }`}
                    >
                      <input
                        type="radio"
                        name="grouping"
                        value={value}
                        checked={grouping === value}
                        onChange={() => setGrouping(value)}
                        className="sr-only"
                      />
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium font-sans">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Chart Type */}
              <div>
                <h4 className="text-sm font-medium text-nilin-charcoal mb-3 font-sans">Chart Type</h4>
                <div className="grid grid-cols-2 gap-2">
                  {CHART_TYPES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setChartType(value)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                        chartType === value
                          ? 'bg-nilin-coral/10 border-nilin-coral/30 text-nilin-coral'
                          : 'bg-white/40 border-nilin-border/40 text-nilin-charcoal hover:border-nilin-coral/20'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium font-sans">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={generateReport}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white text-sm font-medium font-sans shadow-nilin-warm btn-3d hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4" />
                  Generate Report
                </>
              )}
            </button>

            <button
              onClick={() => setShowTemplateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-nilin-border/50 bg-white/60 text-nilin-charcoal text-sm font-medium font-sans hover:bg-nilin-blush/40 transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Template
            </button>

            {reportResult && (
              <>
                <button
                  onClick={() => exportData('csv')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-nilin-border/50 bg-white/60 text-nilin-charcoal text-sm font-medium font-sans hover:bg-nilin-blush/40 transition-colors"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => exportData('json')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-nilin-border/50 bg-white/60 text-nilin-charcoal text-sm font-medium font-sans hover:bg-nilin-blush/40 transition-colors"
                >
                  Export JSON
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right Panel - Saved Templates */}
        <div className="space-y-4">
          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif text-nilin-charcoal flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-nilin-coral" />
                Saved Templates
              </h3>
              <button
                onClick={loadTemplates}
                className="p-1.5 rounded-lg hover:bg-nilin-blush/40 transition-colors"
                title="Refresh templates"
              >
                <RefreshCw className={`w-4 h-4 text-nilin-warmGray ${templatesLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {templatesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse h-16 bg-nilin-blush/30 rounded-xl" />
                ))}
              </div>
            ) : savedTemplates.length === 0 ? (
              <div className="text-center py-8">
                <FolderOpen className="w-10 h-10 text-nilin-border mx-auto mb-2" />
                <p className="text-sm text-nilin-warmGray font-sans">No saved templates</p>
                <p className="text-xs text-nilin-warmGray/80 font-sans mt-1">
                  Save your report configurations for quick access
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedTemplates.map((template) => (
                  <div
                    key={template._id}
                    className="group flex items-start gap-3 p-3 rounded-xl bg-white/40 border border-nilin-border/40 hover:border-nilin-coral/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadTemplate(template)}>
                      <p className="text-sm font-medium text-nilin-charcoal font-sans truncate">
                        {template.name}
                      </p>
                      {template.description && (
                        <p className="text-xs text-nilin-warmGray font-sans mt-0.5 line-clamp-1">
                          {template.description}
                        </p>
                      )}
                      <p className="text-xs text-nilin-warmGray/70 font-sans mt-1">
                        {new Date(template.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTemplate(template._id);
                      }}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-500 transition-all"
                      title="Delete template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report Preview */}
      {reportResult && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(reportResult.summary).map(([key, value]) => (
              <div
                key={key}
                className="glass glass-blur rounded-xl border border-nilin-border/50 p-4"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-nilin-warmGray font-sans mb-1">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p className="text-2xl font-serif text-nilin-charcoal">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <ReportChart
            data={reportResult.data}
            config={reportResult.chartConfig}
            loading={loading}
            error={error}
            height={400}
          />

          {/* Metadata */}
          <div className="text-xs text-nilin-warmGray font-sans text-center">
            Generated at {new Date(reportResult.metadata.generatedAt).toLocaleString()} |{' '}
            {reportResult.metadata.metrics.join(', ')}
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowTemplateModal(false)}
          />
          <div className="relative glass glass-blur rounded-2xl border border-nilin-border/50 p-6 w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif text-nilin-charcoal">Save Template</h3>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-2 rounded-lg hover:bg-nilin-blush/40 transition-colors"
              >
                <X className="w-5 h-5 text-nilin-warmGray" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="template-name" className="block text-xs font-medium text-nilin-warmGray mb-1.5 font-sans">
                  Template Name *
                </label>
                <input
                  type="text"
                  id="template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Monthly Revenue Report"
                  className="w-full px-3 py-2 rounded-xl border border-nilin-border/50 bg-white/60 text-nilin-charcoal text-sm font-sans focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral"
                />
              </div>

              <div>
                <label htmlFor="template-description" className="block text-xs font-medium text-nilin-warmGray mb-1.5 font-sans">
                  Description (optional)
                </label>
                <textarea
                  id="template-description"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Weekly bookings analysis by category"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-nilin-border/50 bg-white/60 text-nilin-charcoal text-sm font-sans focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-nilin-border/50 bg-white/60 text-nilin-charcoal text-sm font-medium font-sans hover:bg-nilin-blush/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTemplate}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white text-sm font-medium font-sans shadow-nilin-warm btn-3d hover:opacity-95 transition-opacity"
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportBuilder;
