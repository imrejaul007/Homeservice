import React, { useState, useEffect, useCallback } from 'react';
import {
  Ticket,
  MessageCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Phone,
  ChevronDown,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import authService from '../../services/AuthService';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type TicketStatus = 'open' | 'in_progress' | 'pending_response' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'technical' | 'billing' | 'account' | 'service' | 'other';

export interface TicketStats {
  open: number;
  in_progress: number;
  pending_response: number;
  resolved: number;
  closed: number;
  total: number;
  resolvedToday: number;
  avgResponseTimeHours: number;
  priorityBreakdown: Record<TicketPriority, number>;
  categoryBreakdown: Record<string, number>;
}

export interface ChatStats {
  activeSessions: number;
  waitingInQueue: number;
  availableAgents: number;
  avgWaitTime: number;
  avgSessionDuration: number;
  totalChatsToday: number;
}

export interface AgentPerformance {
  agentId: string;
  agentName: string;
  activeChats: number;
  resolvedToday: number;
  avgResponseTime: number;
  rating: number;
}

export interface SupportDashboardProps {
  className?: string;
  onSelectTicket?: (ticketId: string) => void;
}

// ============================================
// API SERVICE
// ============================================

const dashboardApi = {
  async getTicketStats(): Promise<TicketStats> {
    const response = await authService.get<{ success: boolean; data: TicketStats }>(
      '/support/admin/tickets/stats'
    );
    return response.data;
  },

  async getChatStats(): Promise<ChatStats> {
    const response = await authService.get<{ success: boolean; data: ChatStats }>(
      '/support/chat/stats'
    );
    return response.data;
  },

  async getAgentPerformance(): Promise<AgentPerformance[]> {
    // Mock data for agent performance
    return [
      { agentId: '1', agentName: 'Sarah Johnson', activeChats: 3, resolvedToday: 12, avgResponseTime: 45, rating: 4.8 },
      { agentId: '2', agentName: 'Mike Chen', activeChats: 2, resolvedToday: 15, avgResponseTime: 38, rating: 4.9 },
      { agentId: '3', agentName: 'Emma Wilson', activeChats: 4, resolvedToday: 10, avgResponseTime: 52, rating: 4.7 },
    ];
  },

  async getRecentTickets(limit: number = 5): Promise<Array<{
    _id: string;
    ticketNumber: string;
    subject: string;
    status: TicketStatus;
    priority: TicketPriority;
    category: TicketCategory;
    createdAt: string;
    userName: string;
  }>> {
    const response = await authService.get<{ success: boolean; data: { tickets: any[] } }>(
      `/support/admin/tickets?limit=${limit}`
    );
    return response.data.tickets;
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getStatusColor = (status: TicketStatus): string => {
  const colors: Record<TicketStatus, string> = {
    open: 'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    pending_response: 'bg-orange-100 text-orange-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-700',
  };
  return colors[status];
};

const getPriorityColor = (priority: TicketPriority): string => {
  const colors: Record<TicketPriority, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-600',
    high: 'bg-orange-100 text-orange-600',
    urgent: 'bg-red-100 text-red-600',
  };
  return colors[priority];
};

const formatTime = (hours: number): string => {
  if (hours < 1) return '< 1h';
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ============================================
// STAT CARD COMPONENT
// ============================================

const StatCard: React.FC<{
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color: 'coral' | 'blue' | 'green' | 'orange' | 'purple';
}> = ({ title, value, subtitle, icon, trend, color }) => {
  const colorClasses = {
    coral: 'bg-nilin-coral/10 text-nilin-coral',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-orange-100 text-orange-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colorClasses[color])}>
          {icon}
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-sm font-medium',
            trend.isPositive ? 'text-green-600' : 'text-red-600'
          )}>
            {trend.isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {trend.value}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-nilin-charcoal mb-1">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
};

// ============================================
// PRIORITY BREAKDOWN COMPONENT
// ============================================

const PriorityBreakdown: React.FC<{ data: Record<TicketPriority, number> }> = ({ data }) => {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const priorities: TicketPriority[] = ['urgent', 'high', 'medium', 'low'];

  const colors: Record<TicketPriority, string> = {
    urgent: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-blue-500',
    low: 'bg-gray-400',
  };

  return (
    <div className="space-y-3">
      {priorities.map((priority) => {
        const count = data[priority] || 0;
        const percentage = total > 0 ? (count / total) * 100 : 0;

        return (
          <div key={priority}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="capitalize text-gray-600">{priority}</span>
              <span className="font-medium text-gray-900">{count}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', colors[priority])}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// CATEGORY BREAKDOWN COMPONENT
// ============================================

const CategoryBreakdown: React.FC<{ data: Record<string, number> }> = ({ data }) => {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

  const icons: Record<string, string> = {
    technical: '⚙️',
    billing: '💳',
    account: '🔐',
    service: '🛠️',
    other: '📝',
  };

  const colors: Record<string, string> = {
    technical: 'bg-purple-100 text-purple-600',
    billing: 'bg-green-100 text-green-600',
    account: 'bg-blue-100 text-blue-600',
    service: 'bg-orange-100 text-orange-600',
    other: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="space-y-2">
      {entries.map(([category, count]) => (
        <div key={category} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{icons[category] || '📝'}</span>
            <span className="text-sm text-gray-600 capitalize">{category}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{count}</span>
            <span className="text-xs text-gray-400">
              ({total > 0 ? Math.round((count / total) * 100) : 0}%)
            </span>
          </div>
        </div>
      ))}
      {entries.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No data available</p>
      )}
    </div>
  );
};

// ============================================
// AGENT PERFORMANCE TABLE COMPONENT
// ============================================

const AgentPerformanceTable: React.FC<{ agents: AgentPerformance[] }> = ({ agents }) => {
  return (
    <div className="space-y-3">
      {agents.map((agent) => (
        <div key={agent.agentId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-nilin-coral/10 flex items-center justify-center">
              <span className="text-sm font-medium text-nilin-coral">
                {agent.agentName.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900">{agent.agentName}</p>
              <p className="text-xs text-gray-500">{agent.activeChats} active chats</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <p className="font-medium text-gray-900">{agent.resolvedToday}</p>
              <p className="text-xs text-gray-400">Resolved</p>
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-900">{agent.avgResponseTime}s</p>
              <p className="text-xs text-gray-400">Avg Response</p>
            </div>
            <div className="text-center">
              <p className="font-medium text-amber-600">{agent.rating.toFixed(1)}</p>
              <p className="text-xs text-gray-400">Rating</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================
// RECENT TICKETS COMPONENT
// ============================================

const RecentTickets: React.FC<{
  tickets: Array<{
    _id: string;
    ticketNumber: string;
    subject: string;
    status: TicketStatus;
    priority: TicketPriority;
    createdAt: string;
    userName: string;
  }>;
  onSelect: (id: string) => void;
}> = ({ tickets, onSelect }) => {
  return (
    <div className="space-y-3">
      {tickets.map((ticket) => (
        <button
          key={ticket._id}
          onClick={() => onSelect(ticket._id)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-500">{ticket.ticketNumber}</span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full', getPriorityColor(ticket.priority))}>
                {ticket.priority}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
            <p className="text-xs text-gray-500 mt-1">{ticket.userName} • {formatDate(ticket.createdAt)}</p>
          </div>
          <span className={cn('text-xs px-2 py-1 rounded-full ml-2', getStatusColor(ticket.status))}>
            {ticket.status.replace('_', ' ')}
          </span>
        </button>
      ))}
      {tickets.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No recent tickets</p>
      )}
    </div>
  );
};

// ============================================
// MAIN SUPPORT DASHBOARD COMPONENT
// ============================================

export const SupportDashboard: React.FC<SupportDashboardProps> = ({
  className,
  onSelectTicket,
}) => {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null);
  const [chatStats, setChatStats] = useState<ChatStats | null>(null);
  const [agents, setAgents] = useState<AgentPerformance[]>([]);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch all dashboard data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [tickets, chats, agentData, recent] = await Promise.all([
        dashboardApi.getTicketStats(),
        dashboardApi.getChatStats().catch(() => null),
        dashboardApi.getAgentPerformance(),
        dashboardApi.getRecentTickets(5),
      ]);

      setTicketStats(tickets);
      setChatStats(chats);
      setAgents(agentData);
      setRecentTickets(recent);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Calculate totals
  const openTickets = ticketStats ? ticketStats.open + ticketStats.in_progress + ticketStats.pending_response : 0;
  const resolutionRate = ticketStats && ticketStats.total > 0
    ? Math.round((ticketStats.resolved / ticketStats.total) * 100)
    : 0;

  return (
    <div className={cn('bg-gray-50 min-h-screen p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-nilin-charcoal">Support Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 flex-1">{error}</p>
          <button onClick={fetchData} className="text-sm text-red-600 hover:text-red-700 font-medium">
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !ticketStats && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-nilin-coral animate-spin" />
        </div>
      )}

      {/* Dashboard Content */}
      {ticketStats && (
        <>
          {/* Ticket Stats */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-nilin-charcoal mb-4">Ticket Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <StatCard
                title="Open Tickets"
                value={openTickets}
                subtitle="Awaiting response"
                icon={<Ticket className="h-5 w-5" />}
                color="coral"
                trend={{ value: 12, isPositive: false }}
              />
              <StatCard
                title="Resolved Today"
                value={ticketStats.resolvedToday}
                icon={<CheckCircle className="h-5 w-5" />}
                color="green"
                trend={{ value: 8, isPositive: true }}
              />
              <StatCard
                title="Avg Response"
                value={formatTime(ticketStats.avgResponseTimeHours)}
                subtitle="Time to resolve"
                icon={<Clock className="h-5 w-5" />}
                color="blue"
              />
              <StatCard
                title="Resolution Rate"
                value={`${resolutionRate}%`}
                icon={<BarChart3 className="h-5 w-5" />}
                color="purple"
                trend={{ value: 5, isPositive: true }}
              />
              <StatCard
                title="Total Tickets"
                value={ticketStats.total}
                icon={<Users className="h-5 w-5" />}
                color="orange"
              />
            </div>
          </div>

          {/* Chat Stats */}
          {chatStats && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-nilin-charcoal mb-4">Live Chat</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  title="Active Chats"
                  value={chatStats.activeSessions}
                  icon={<MessageCircle className="h-5 w-5" />}
                  color="coral"
                />
                <StatCard
                  title="In Queue"
                  value={chatStats.waitingInQueue}
                  subtitle="Waiting for agent"
                  icon={<Clock className="h-5 w-5" />}
                  color="orange"
                />
                <StatCard
                  title="Available Agents"
                  value={chatStats.availableAgents}
                  icon={<Users className="h-5 w-5" />}
                  color="green"
                />
                <StatCard
                  title="Avg Wait Time"
                  value={`${chatStats.avgWaitTime}m`}
                  subtitle="Queue wait time"
                  icon={<Phone className="h-5 w-5" />}
                  color="blue"
                />
              </div>
            </div>
          )}

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Priority Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-nilin-charcoal">Priority Breakdown</h3>
                <PieChart className="h-5 w-5 text-gray-400" />
              </div>
              <PriorityBreakdown data={ticketStats.priorityBreakdown} />
            </div>

            {/* Category Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-nilin-charcoal">Category Breakdown</h3>
                <BarChart3 className="h-5 w-5 text-gray-400" />
              </div>
              <CategoryBreakdown data={ticketStats.categoryBreakdown} />
            </div>

            {/* Agent Performance */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-nilin-charcoal">Top Agents</h3>
                <Users className="h-5 w-5 text-gray-400" />
              </div>
              <AgentPerformanceTable agents={agents.slice(0, 3)} />
            </div>
          </div>

          {/* Recent Tickets */}
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-nilin-charcoal">Recent Tickets</h3>
              <button className="text-sm text-nilin-coral hover:text-nilin-coral/80 font-medium">
                View All
              </button>
            </div>
            <RecentTickets tickets={recentTickets} onSelect={onSelectTicket || (() => {})} />
          </div>
        </>
      )}
    </div>
  );
};

export default SupportDashboard;
