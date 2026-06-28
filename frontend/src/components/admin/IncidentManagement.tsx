import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  Search,
  Filter,
  Plus,
  Eye,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  Ticket,
  User,
  Calendar,
  Tag,
  BarChart3,
  Bell,
  FileText,
  AlertCircle
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface Incident {
  id: string;
  ticketNumber: string;
  type: 'complaint' | 'dispute' | 'technical' | 'billing' | 'safety';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'pending_customer' | 'resolved' | 'closed';
  category: string;
  subject: string;
  description: string;
  customerId?: string;
  customerName?: string;
  providerId?: string;
  providerName?: string;
  bookingId?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  messages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    senderRole: 'customer' | 'provider' | 'admin';
    message: string;
    timestamp: string;
  }>;
  resolution?: string;
  tags: string[];
  slaDeadline?: string;
}

interface IncidentStats {
  total: number;
  open: number;
  inProgress: number;
  pendingCustomer: number;
  resolved: number;
  avgResolutionTime: number;
  slaBreaches: number;
  byType: Array<{ type: string; count: number; color: string }>;
  byPriority: { low: number; medium: number; high: number; critical: number };
  trend: Array<{ date: string; created: number; resolved: number }>;
}

interface IncidentManagementProps {
  embedded?: boolean;
  onClose?: () => void;
}

const TYPE_CONFIG = {
  complaint: { label: 'Complaint', color: '#F59E0B', bgColor: 'bg-amber-100' },
  dispute: { label: 'Dispute', color: '#EF4444', bgColor: 'bg-red-100' },
  technical: { label: 'Technical', color: '#3B82F6', bgColor: 'bg-blue-100' },
  billing: { label: 'Billing', color: '#8B5CF6', bgColor: 'bg-purple-100' },
  safety: { label: 'Safety', color: '#DC2626', bgColor: 'bg-red-200' }
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200' }
};

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-red-100 text-red-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  pending_customer: { label: 'Pending Customer', color: 'bg-amber-100 text-amber-700' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700' }
};

export const IncidentManagement: React.FC<IncidentManagementProps> = ({
  embedded = false,
  onClose
}) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNewTicket, setShowNewTicket] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/incidents');

      if (response.data?.success) {
        setIncidents(response.data.data.incidents || []);
        setStats(response.data.data.stats);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      console.error('Error fetching incidents:', err);
      setError(getAdminFetchErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const handleUpdateStatus = async (incidentId: string, newStatus: Incident['status']) => {
    setActionLoading(incidentId);
    try {
      await api.patch(`/admin/incidents/${incidentId}`, { status: newStatus });
      setIncidents(prev => prev.map(inc =>
        inc.id === incidentId ? { ...inc, status: newStatus, updatedAt: new Date().toISOString() } : inc
      ));
    } catch (err) {
      console.error('Error updating incident:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedIncident || !newMessage.trim()) return;

    const message = {
      id: `m${Date.now()}`,
      senderId: 'admin',
      senderName: 'Admin',
      senderRole: 'admin' as const,
      message: newMessage,
      timestamp: new Date().toISOString()
    };

    setIncidents(prev => prev.map(inc =>
      inc.id === selectedIncident.id
        ? { ...inc, messages: [...inc.messages, message], updatedAt: new Date().toISOString() }
        : inc
    ));
    setSelectedIncident(prev => prev ? { ...prev, messages: [...prev.messages, message] } : null);
    setNewMessage('');
  };

  const filteredIncidents = incidents.filter(inc => {
    const matchesSearch =
      inc.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inc.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (inc.providerName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === 'all' || inc.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || inc.priority === priorityFilter;
    const matchesType = typeFilter === 'all' || inc.type === typeFilter;
    return matchesSearch && matchesStatus && matchesPriority && matchesType;
  });

  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-nilin-blush/30 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-nilin-blush/30 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm p-8', embedded ? '' : 'max-w-7xl mx-auto')}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Incidents</h3>
          <p className="text-sm text-nilin-warmGray mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
            <Ticket className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Incident Management</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Track and resolve customer issues</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewTicket(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl hover:shadow-nilin-warm transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Ticket
          </button>
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors">
              <XCircle className="w-5 h-5 text-nilin-warmGray" />
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5 text-nilin-warmGray', isRefreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Ticket className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.total || 0}</p>
          <p className="text-xs text-nilin-warmGray">Total</p>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
          <AlertTriangle className="w-5 h-5 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.open || 0}</p>
          <p className="text-xs text-nilin-warmGray">Open</p>
        </div>
        <div className="glass rounded-xl border border-blue-200/50 p-4 text-center">
          <Clock className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-blue-600">{stats?.inProgress || 0}</p>
          <p className="text-xs text-nilin-warmGray">In Progress</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{stats?.resolved || 0}</p>
          <p className="text-xs text-nilin-warmGray">Resolved</p>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
          <AlertCircle className="w-5 h-5 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.slaBreaches || 0}</p>
          <p className="text-xs text-nilin-warmGray">SLA Breaches</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Incident Trend</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Line type="monotone" dataKey="created" stroke="#EF4444" strokeWidth={2} name="Created" />
                <Line type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2} name="Resolved" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">By Type</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.byType || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={60}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="type"
                >
                  {stats?.byType?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {stats?.byType?.map(item => (
              <div key={item.type} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-nilin-warmGray">{item.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="pending_customer">Pending Customer</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Priority</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Types</option>
          <option value="complaint">Complaint</option>
          <option value="dispute">Dispute</option>
          <option value="technical">Technical</option>
          <option value="billing">Billing</option>
          <option value="safety">Safety</option>
        </select>
      </div>

      {/* Incident List */}
      <div className="space-y-3">
        {filteredIncidents.length === 0 ? (
          <div className="text-center py-12 text-nilin-warmGray">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <p className="font-medium">No incidents match your filters</p>
          </div>
        ) : (
          filteredIncidents.map(incident => {
            const typeConfig = TYPE_CONFIG[incident.type];
            const priorityConfig = PRIORITY_CONFIG[incident.priority];
            const statusConfig = STATUS_CONFIG[incident.status];
            const isSelected = selectedIncident?.id === incident.id;

            return (
              <div
                key={incident.id}
                className={cn(
                  'glass rounded-xl border p-4 transition-all',
                  incident.priority === 'critical' ? 'border-red-200 bg-red-50/30' :
                  incident.priority === 'high' ? 'border-orange-200 bg-orange-50/30' :
                  'border-nilin-border/50'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn('p-2 rounded-lg', typeConfig.bgColor)}>
                    <Ticket className="w-5 h-5" style={{ color: typeConfig.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-nilin-warmGray">{incident.ticketNumber}</span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium border', priorityConfig.color)}>
                        {priorityConfig.label}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusConfig.color)}>
                        {statusConfig.label}
                      </span>
                      {incident.slaDeadline && new Date(incident.slaDeadline) < new Date() && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                          SLA Breached
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-nilin-charcoal">{incident.subject}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-nilin-warmGray">
                      {incident.customerName && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {incident.customerName}
                        </span>
                      )}
                      {incident.providerName && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {incident.providerName}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(incident.createdAt).toLocaleDateString()}
                      </span>
                      {incident.messages.length > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {incident.messages.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {incident.status === 'open' && (
                      <button
                        onClick={() => handleUpdateStatus(incident.id, 'in_progress')}
                        disabled={actionLoading === incident.id}
                        className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors text-sm font-medium"
                      >
                        Start Work
                      </button>
                    )}
                    {incident.status === 'in_progress' && (
                      <button
                        onClick={() => handleUpdateStatus(incident.id, 'resolved')}
                        disabled={actionLoading === incident.id}
                        className="px-3 py-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors text-sm font-medium"
                      >
                        Resolve
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedIncident(isSelected ? null : incident)}
                      className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors"
                    >
                      {isSelected ? <ChevronUp className="w-4 h-4 text-nilin-warmGray" /> : <ChevronDown className="w-4 h-4 text-nilin-warmGray" />}
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-nilin-border/50">
                    <div className="mb-4">
                      <p className="text-sm font-medium text-nilin-charcoal mb-2">Description</p>
                      <p className="text-sm text-nilin-warmGray">{incident.description}</p>
                    </div>

                    {incident.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {incident.tags.map(tag => (
                          <span key={tag} className="px-2 py-1 bg-nilin-blush/50 rounded text-xs text-nilin-charcoal">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Messages */}
                    <div className="space-y-3 mb-4">
                      <p className="text-sm font-medium text-nilin-charcoal">Messages</p>
                      {incident.messages.length === 0 ? (
                        <p className="text-sm text-nilin-warmGray italic">No messages yet</p>
                      ) : (
                        incident.messages.map(msg => (
                          <div key={msg.id} className={cn(
                            'p-3 rounded-xl',
                            msg.senderRole === 'admin' ? 'bg-blue-50 ml-8' :
                            msg.senderRole === 'customer' ? 'bg-nilin-blush/30 mr-8' :
                            'bg-gray-50 mr-8'
                          )}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-nilin-charcoal">{msg.senderName}</span>
                              <span className="text-xs text-nilin-warmGray capitalize">{msg.senderRole}</span>
                              <span className="text-xs text-nilin-warmGray ml-auto">
                                {new Date(msg.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-nilin-charcoal">{msg.message}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Reply Box */}
                    {incident.status !== 'closed' && incident.status !== 'resolved' && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder="Type a message..."
                          className="flex-1 px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim()}
                          className="px-4 py-2 bg-nilin-coral text-white rounded-xl hover:bg-nilin-coral/90 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {incident.resolution && (
                      <div className="mt-4 p-3 bg-green-50 rounded-xl">
                        <p className="text-sm font-medium text-green-800 mb-1">Resolution</p>
                        <p className="text-sm text-green-700">{incident.resolution}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default IncidentManagement;
