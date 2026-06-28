import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  FileText,
  Clock,
  ChevronRight,
  Plus,
  Calendar,
  Bell,
  Settings,
  Trash2,
  RefreshCw,
  X,
  Mail,
  AlertCircle,
} from 'lucide-react';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import { ReportBuilder } from '../../components/admin/ReportBuilder';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';
import { reportsApi } from '../../services/analyticsApi';
import { useAuthStore } from '../../stores/authStore';

interface ScheduledReport {
  _id: string;
  name: string;
  type: string;
  frequency: string;
  enabled: boolean;
  nextRunDate: string;
  recipients: string[];
  lastRunDate?: string;
  lastRunStatus?: string;
}

interface Tab {
  id: 'builder' | 'scheduled' | 'history';
  label: string;
  icon: React.ElementType;
}

const TABS: Tab[] = [
  { id: 'builder', label: 'Report Builder', icon: BarChart3 },
  { id: 'scheduled', label: 'Scheduled Reports', icon: Clock },
  { id: 'history', label: 'Report History', icon: FileText },
];

// Schedule Modal Component
interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (data: ScheduleReportData) => Promise<void>;
}

interface ScheduleReportData {
  name: string;
  reportType: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  recipients: string[];
  format: 'pdf' | 'csv' | 'json';
}

const REPORT_TYPE_TO_API: Record<string, string> = {
  bookings: 'booking',
  revenue: 'revenue',
  providers: 'provider',
  customers: 'customer',
  services: 'performance',
};

const ScheduleModal: React.FC<ScheduleModalProps> = ({ isOpen, onClose, onSchedule }) => {
  const [name, setName] = useState('');
  const [reportType, setReportType] = useState('bookings');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('weekly');
  const [recipients, setRecipients] = useState('');
  const [format, setFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportTypes = [
    { value: 'bookings', label: 'Bookings Report' },
    { value: 'revenue', label: 'Revenue Report' },
    { value: 'providers', label: 'Provider Performance' },
    { value: 'customers', label: 'Customer Analytics' },
    { value: 'services', label: 'Service Statistics' },
  ];

  const frequencies = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
  ];

  const formats = [
    { value: 'pdf', label: 'PDF' },
    { value: 'csv', label: 'CSV' },
    { value: 'json', label: 'JSON' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Report name is required');
      return;
    }
    if (!recipients.trim()) {
      setError('At least one recipient email is required');
      return;
    }

    const emailList = recipients.split(',').map(email => email.trim()).filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailList.some(email => !emailRegex.test(email))) {
      setError('Please enter valid email addresses');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSchedule({
        name,
        reportType,
        frequency,
        recipients: emailList,
        format,
      });
      onClose();
      // Reset form
      setName('');
      setReportType('bookings');
      setFrequency('weekly');
      setRecipients('');
      setFormat('pdf');
    } catch (err) {
      setError('Failed to schedule report');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="p-6 border-b border-nilin-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif text-nilin-charcoal">Schedule New Report</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-nilin-blush/50 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-nilin-warmGray" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-red-700 text-sm">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Report Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Monthly Bookings Overview"
              className="w-full px-4 py-3 border border-nilin-border rounded-xl focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-4 py-3 border border-nilin-border rounded-xl focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
            >
              {reportTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly' | 'quarterly')}
              className="w-full px-4 py-3 border border-nilin-border rounded-xl focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
            >
              {frequencies.map((freq) => (
                <option key={freq.value} value={freq.value}>{freq.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Recipient Emails
            </label>
            <input
              type="text"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="email@example.com, another@example.com"
              className="w-full px-4 py-3 border border-nilin-border rounded-xl focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
            />
            <p className="text-xs text-nilin-warmGray mt-1">Separate multiple emails with commas</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Format
            </label>
            <div className="flex gap-3">
              {formats.map((fmt) => (
                <button
                  key={fmt.value}
                  type="button"
                  onClick={() => setFormat(fmt.value as 'pdf' | 'csv' | 'xlsx')}
                  className={`flex-1 py-3 rounded-xl border-2 font-medium transition-all ${
                    format === fmt.value
                      ? 'border-nilin-coral bg-nilin-coral/5 text-nilin-coral'
                      : 'border-nilin-border text-nilin-warmGray hover:border-nilin-coral/30'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-nilin-border rounded-xl text-nilin-charcoal hover:bg-nilin-blush/50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-nilin-coral text-white rounded-xl hover:bg-nilin-rose transition-colors font-medium disabled:opacity-50"
            >
              {isSubmitting ? 'Scheduling...' : 'Schedule Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export function CustomReports() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'builder' | 'scheduled' | 'history'>(() =>
    initialTab === 'scheduled' || initialTab === 'history' || initialTab === 'builder' ? initialTab : 'builder'
  );
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [dueReportCount, setDueReportCount] = useState(0);
  const [runningDueReports, setRunningDueReports] = useState(false);
  const [triggeringReportId, setTriggeringReportId] = useState<string | null>(null);

  // Check admin access
  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  // Load scheduled reports
  useEffect(() => {
    if (activeTab === 'scheduled') {
      loadScheduledReports();
    }
  }, [activeTab]);

  const loadDueReports = async () => {
    try {
      const due = await reportsApi.getDueReports();
      setDueReportCount(due.count);
    } catch {
      setDueReportCount(0);
    }
  };

  const loadScheduledReports = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/reports/scheduled');
      if (response.data?.success) {
        setScheduledReports(response.data.data?.reports || []);
      }
      await loadDueReports();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(message || 'Failed to load scheduled reports');
    } finally {
      setLoading(false);
    }
  };

  const toggleReport = async (reportId: string, enabled: boolean) => {
    try {
      await api.post(`/admin/reports/scheduled/${reportId}/toggle`, { enabled: !enabled });
      toast.success(`Report ${enabled ? 'disabled' : 'enabled'}`);
      loadScheduledReports();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(message || 'Failed to update report');
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) return;

    try {
      await api.delete(`/admin/reports/scheduled/${reportId}`);
      toast.success('Report deleted');
      loadScheduledReports();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(message || 'Failed to delete report');
    }
  };

  const handleScheduleReport = async (data: ScheduleReportData) => {
    try {
      const response = await api.post('/admin/reports/scheduled', {
        name: data.name,
        type: REPORT_TYPE_TO_API[data.reportType] || data.reportType,
        frequency: data.frequency,
        recipients: data.recipients,
        format: data.format,
      });

      if (response.data?.success) {
        toast.success('Report scheduled successfully');
        loadScheduledReports();
      } else {
        throw new Error('Failed to schedule report');
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(message || 'Failed to schedule report');
      throw err;
    }
  };

  const runDueReports = async () => {
    setRunningDueReports(true);
    try {
      const result = await reportsApi.runDueReports();
      toast.success(`Processed ${result.processed} report(s): ${result.succeeded} succeeded, ${result.failed} failed`);
      await loadScheduledReports();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(message || 'Failed to run due reports');
    } finally {
      setRunningDueReports(false);
    }
  };

  const triggerReportNow = async (reportId: string) => {
    setTriggeringReportId(reportId);
    try {
      const result = await reportsApi.triggerReport(reportId);
      if (result.success) {
        toast.success('Report generated successfully');
      } else {
        toast.error(result.error || 'Report generation failed');
      }
      await loadScheduledReports();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(message || 'Failed to trigger report');
    } finally {
      setTriggeringReportId(null);
    }
  };

  const formatFrequency = (frequency: string) => {
    const labels: Record<string, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
    };
    return labels[frequency] || frequency;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-AE', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'success':
        return 'bg-emerald-100 text-emerald-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-nilin-blush text-nilin-charcoal';
    }
  };

  const renderBuilder = () => (
    <ReportBuilder />
  );

  const renderScheduledReports = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-serif text-nilin-charcoal">Scheduled Reports</h2>
          <p className="text-sm text-nilin-warmGray font-sans mt-1">
            Set up automated report delivery to your inbox
          </p>
        </div>
        <button
          onClick={() => setShowScheduleModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white text-sm font-medium font-sans shadow-nilin-warm btn-3d hover:opacity-95 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New Schedule
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-nilin-border/50 bg-white/60 p-4">
        <div>
          <p className="text-sm font-medium text-nilin-charcoal">Scheduled report executor</p>
          <p className="text-xs text-nilin-warmGray mt-1">
            {dueReportCount > 0
              ? `${dueReportCount} report(s) due for delivery`
              : 'No reports are currently due'}
          </p>
        </div>
        <button
          type="button"
          onClick={runDueReports}
          disabled={runningDueReports || dueReportCount === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-nilin-border/50 bg-white text-nilin-charcoal text-sm font-medium hover:bg-nilin-blush/40 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${runningDueReports ? 'animate-spin' : ''}`} />
          Run due reports
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse h-24 bg-nilin-blush/20 rounded-2xl" />
          ))}
        </div>
      ) : scheduledReports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-nilin-blush/40 flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-nilin-warmGray" />
          </div>
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">No Scheduled Reports</h3>
          <p className="text-sm text-nilin-warmGray font-sans max-w-md">
            Create your first scheduled report to automatically receive analytics via email on a regular basis.
          </p>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-nilin-border/50 bg-white/60 text-nilin-charcoal text-sm font-medium font-sans hover:bg-nilin-blush/40 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Scheduled Report
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {scheduledReports.map((report) => (
            <div
              key={report._id}
              className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5 hover:border-nilin-coral/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-base font-serif text-nilin-charcoal truncate">
                      {report.name}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium font-sans ${
                        report.enabled
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-nilin-blush text-nilin-warmGray'
                      }`}
                    >
                      {report.enabled ? 'Active' : 'Paused'}
                    </span>
                    {report.lastRunStatus && (
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium font-sans ${getStatusColor(
                          report.lastRunStatus
                        )}`}
                      >
                        {report.lastRunStatus === 'success' ? 'Success' : 'Failed'}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-nilin-warmGray font-sans">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {formatFrequency(report.frequency)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Bell className="w-4 h-4" />
                      {report.recipients.length} recipient{report.recipients.length !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      Next: {formatDate(report.nextRunDate)}
                    </span>
                    {report.lastRunDate && (
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-4 h-4" />
                        Last: {formatDate(report.lastRunDate)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => triggerReportNow(report._id)}
                    disabled={!report.enabled || triggeringReportId === report._id}
                    className="inline-flex items-center justify-center min-h-11 px-3 rounded-lg border border-nilin-border/50 text-sm text-nilin-charcoal hover:bg-nilin-blush/40 disabled:opacity-50"
                    title="Run report now"
                  >
                    {triggeringReportId === report._id ? 'Running…' : 'Run now'}
                  </button>
                  {/* Toggle switch */}
                  <button
                    onClick={() => toggleReport(report._id, report.enabled)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      report.enabled ? 'bg-emerald-500' : 'bg-nilin-border/50'
                    }`}
                    aria-label={report.enabled ? 'Disable report' : 'Enable report'}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        report.enabled ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>

                  <button
                    onClick={() => deleteReport(report._id)}
                    className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                    title="Delete report"
                    aria-label="Delete report"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-serif text-nilin-charcoal">Report History</h2>
          <p className="text-sm text-nilin-warmGray font-sans mt-1">
            View and download previously generated reports
          </p>
        </div>
        <button
          onClick={loadScheduledReports}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-nilin-border/50 bg-white/60 text-nilin-charcoal text-sm font-medium font-sans hover:bg-nilin-blush/40 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-nilin-blush/40 flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-nilin-warmGray" />
        </div>
        <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Report History</h3>
        <p className="text-sm text-nilin-warmGray font-sans max-w-md">
          Previously generated reports will appear here. Use the Report Builder to create new reports.
        </p>
        <button
          onClick={() => setActiveTab('builder')}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white text-sm font-medium font-sans shadow-nilin-warm btn-3d hover:opacity-95 transition-opacity"
        >
          <BarChart3 className="w-4 h-4" />
          Go to Report Builder
        </button>
      </div>
    </div>
  );

  return (
    <AdminPageShell
      title="Custom Reports"
      subtitle="Build and schedule custom analytics reports"
      breadcrumbItems={[
        { label: 'Admin', href: '/admin/dashboard' },
        { label: 'Reports', href: '/admin/reports' },
        { label: 'Custom Reports', current: true },
      ]}
    >
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-nilin-border/30 pb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium font-sans transition-all ${
              activeTab === tab.id
                ? 'bg-nilin-coral/10 text-nilin-coral border border-nilin-coral/30'
                : 'text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-blush/40 border border-transparent'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'builder' && renderBuilder()}
      {activeTab === 'scheduled' && renderScheduledReports()}
      {activeTab === 'history' && renderHistory()}

      {/* Schedule Modal */}
      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSchedule={handleScheduleReport}
      />
    </AdminPageShell>
  );
}

export default CustomReports;
