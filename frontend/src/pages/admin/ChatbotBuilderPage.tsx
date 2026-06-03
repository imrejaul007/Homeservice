import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Plus,
  Edit3,
  Trash2,
  Play,
  Pause,
  X,
  Save,
  Loader2,
  RefreshCw,
  Search,
  MoreVertical,
  ChevronRight,
  Send,
  TestTube,
  Archive,
  Eye,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import { Skeleton } from '../../components/common/Skeleton';
import {
  iaAgentApi,
  type IAAgent,
  type IAAgentFormData,
  IAAgentCategory,
  IAAgentType,
  IAAgentStatus,
} from '../../services/iaAgentApi';
import { cn } from '../../lib/utils';

// ============================================================================
// Helper Components
// ============================================================================

function getStatusColor(status: IAAgentStatus): { bg: string; text: string; label: string } {
  switch (status) {
    case IAAgentStatus.Deployed:
      return { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Deployed' };
    case IAAgentStatus.Testing:
      return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Testing' };
    case IAAgentStatus.Draft:
      return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Draft' };
    case IAAgentStatus.Suspended:
      return { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Suspended' };
    case IAAgentStatus.Archived:
      return { bg: 'bg-red-100', text: 'text-red-800', label: 'Archived' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
  }
}

function getCategoryIcon(category: IAAgentCategory): string {
  switch (category) {
    case IAAgentCategory.Admin:
      return 'Admin';
    case IAAgentCategory.Provider:
      return 'Provider';
    case IAAgentCategory.Client:
      return 'Client';
    case IAAgentCategory.Partner:
      return 'Partner';
    default:
      return category;
  }
}

// ============================================================================
// Agent Card Component
// ============================================================================

interface AgentCardProps {
  agent: IAAgent;
  onEdit: (agent: IAAgent) => void;
  onDeploy: (agent: IAAgent) => void;
  onSuspend: (agent: IAAgent) => void;
  onArchive: (agent: IAAgent) => void;
}

function AgentCard({ agent, onEdit, onDeploy, onSuspend, onArchive }: AgentCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isSuspending, setIsSuspending] = useState(false);

  const statusStyle = getStatusColor(agent.status);
  const canDeploy = agent.status === IAAgentStatus.Draft || agent.status === IAAgentStatus.Testing;
  const canSuspend = agent.status === IAAgentStatus.Deployed;

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      await onDeploy(agent);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleSuspend = async () => {
    setIsSuspending(true);
    try {
      await onSuspend(agent);
    } finally {
      setIsSuspending(false);
    }
  };

  return (
    <div className="glass glass-blur rounded-2xl border border-nilin-border/50 overflow-hidden hover:border-nilin-coral/30 transition-all group">
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-nilin-rose/20 to-nilin-coral/10 flex items-center justify-center">
              <Bot className="w-6 h-6 text-nilin-coral" />
            </div>
            <div>
              <h3 className="font-medium text-nilin-charcoal font-sans">{agent.name}</h3>
              <p className="text-xs text-nilin-warmGray mt-0.5 line-clamp-1">
                {agent.description || 'No description'}
              </p>
            </div>
          </div>

          {/* Kebab Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg hover:bg-nilin-blush/40 transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="w-4 h-4 text-nilin-warmGray" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-xl border border-nilin-border/50 py-1 min-w-[160px]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(agent);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-nilin-charcoal hover:bg-nilin-blush/40"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </button>
                  {canDeploy && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        handleDeploy();
                      }}
                      disabled={isDeploying}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      {isDeploying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Deploy
                    </button>
                  )}
                  {canSuspend && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        handleSuspend();
                      }}
                      disabled={isSuspending}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-600 hover:bg-amber-50 disabled:opacity-50"
                    >
                      {isSuspending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Pause className="w-4 h-4" />
                      )}
                      Suspend
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onArchive(agent);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Archive className="w-4 h-4" />
                    Archive
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Status and Category */}
        <div className="flex items-center gap-2 mt-4">
          <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', statusStyle.bg, statusStyle.text)}>
            {statusStyle.label}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-nilin-blush/60 text-nilin-charcoal">
            {getCategoryIcon(agent.category)}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {agent.type}
          </span>
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-5 py-3 border-t border-nilin-border/30 flex items-center justify-between bg-nilin-blush/10">
        <div className="text-xs text-nilin-warmGray">
          v{agent.version}
          {agent.deployedAt && (
            <span className="ml-2">
              Deployed {new Date(agent.deployedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onEdit(agent)}
          className="inline-flex items-center gap-1 text-xs font-medium text-nilin-coral hover:text-nilin-rose"
        >
          View <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Agent Form Modal
// ============================================================================

interface AgentFormModalProps {
  agent?: IAAgent | null;
  onClose: () => void;
  onSave: (data: IAAgentFormData) => Promise<void>;
}

function AgentFormModal({ agent, onClose, onSave }: AgentFormModalProps) {
  const isEditing = !!agent;
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<IAAgentFormData>({
    name: agent?.name || '',
    description: agent?.description || '',
    category: agent?.category || IAAgentCategory.Client,
    type: agent?.type || IAAgentType.Assistant,
    status: agent?.status || IAAgentStatus.Draft,
    configuration: agent?.configuration || {
      temperature: 0.7,
      maxTokens: 2048,
      streaming: false,
    },
    instructions: agent?.instructions || '',
    knowledgeBase: agent?.knowledgeBase || [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-form-title"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-nilin-border/50 shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-nilin-border/50 flex items-center justify-between">
          <div>
            <h2 id="agent-form-title" className="text-xl font-serif text-nilin-charcoal">
              {isEditing ? 'Edit IA Agent' : 'Create IA Agent'}
            </h2>
            <p className="text-sm text-nilin-warmGray mt-1">
              {isEditing ? 'Update agent configuration' : 'Create a new chatbot agent'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-nilin-blush/40 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Name */}
          <label className="block text-sm font-medium text-nilin-charcoal font-sans">
            Name *
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 w-full px-4 py-2.5 rounded-xl border border-nilin-border/50 focus:ring-2 focus:ring-nilin-coral/30"
              placeholder="e.g., Customer Support Bot"
            />
          </label>

          {/* Description */}
          <label className="block text-sm font-medium text-nilin-charcoal font-sans">
            Description
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 w-full px-4 py-2.5 rounded-xl border border-nilin-border/50 focus:ring-2 focus:ring-nilin-coral/30"
              placeholder="Brief description of agent purpose"
            />
          </label>

          {/* Category and Type */}
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-nilin-charcoal font-sans">
              Category *
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as IAAgentCategory })}
                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-nilin-border/50 focus:ring-2 focus:ring-nilin-coral/30"
              >
                <option value={IAAgentCategory.Admin}>Admin</option>
                <option value={IAAgentCategory.Provider}>Provider</option>
                <option value={IAAgentCategory.Client}>Client</option>
                <option value={IAAgentCategory.Partner}>Partner</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-nilin-charcoal font-sans">
              Type *
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as IAAgentType })}
                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-nilin-border/50 focus:ring-2 focus:ring-nilin-coral/30"
              >
                <option value={IAAgentType.Assistant}>Assistant</option>
                <option value={IAAgentType.Recherche}>Recherche</option>
                <option value={IAAgentType.Support}>Support</option>
                <option value={IAAgentType.FAQ}>FAQ</option>
              </select>
            </label>
          </div>

          {/* Status (only for editing) */}
          {isEditing && (
            <label className="block text-sm font-medium text-nilin-charcoal font-sans">
              Status
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as IAAgentStatus })}
                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-nilin-border/50 focus:ring-2 focus:ring-nilin-coral/30"
              >
                <option value={IAAgentStatus.Draft}>Draft</option>
                <option value={IAAgentStatus.Testing}>Testing</option>
                <option value={IAAgentStatus.Deployed}>Deployed</option>
                <option value={IAAgentStatus.Suspended}>Suspended</option>
                <option value={IAAgentStatus.Archived}>Archived</option>
              </select>
            </label>
          )}

          {/* Instructions */}
          <label className="block text-sm font-medium text-nilin-charcoal font-sans">
            Instructions *
            <textarea
              required
              rows={4}
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="mt-1 w-full px-4 py-2.5 rounded-xl border border-nilin-border/50 focus:ring-2 focus:ring-nilin-coral/30 resize-none"
              placeholder="Define the agent's behavior and capabilities..."
            />
          </label>

          {/* Configuration */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-nilin-charcoal font-sans">Configuration</h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-nilin-warmGray">
                Temperature
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={formData.configuration?.temperature ?? 0.7}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      configuration: { ...formData.configuration!, temperature: parseFloat(e.target.value) },
                    })
                  }
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-nilin-border/50 text-sm"
                />
              </label>
              <label className="block text-xs text-nilin-warmGray">
                Max Tokens
                <input
                  type="number"
                  min={1}
                  value={formData.configuration?.maxTokens ?? 2048}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      configuration: { ...formData.configuration!, maxTokens: parseInt(e.target.value, 10) },
                    })
                  }
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-nilin-border/50 text-sm"
                />
              </label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-nilin-border/50 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-nilin-border/50 text-nilin-charcoal"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex-1 btn-nilin flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isEditing ? 'Save Changes' : 'Create Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export function ChatbotBuilderPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [agents, setAgents] = useState<IAAgent[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    deployed: number;
    testing: number;
    draft: number;
    suspended: number;
    archived: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<IAAgentCategory | 'All'>('All');
  const [selectedAgent, setSelectedAgent] = useState<IAAgent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<IAAgent | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  const loadAgents = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [agentsResult, statsResult] = await Promise.all([
        iaAgentApi.list({ isActive: true }),
        iaAgentApi.getStats().catch(() => null),
      ]);

      setAgents(agentsResult.agents);
      if (statsResult) {
        setStats({
          total: statsResult.total,
          deployed: statsResult.deployed,
          testing: statsResult.testing,
          draft: statsResult.draft,
          suspended: statsResult.suspended,
          archived: statsResult.archived,
        });
      }

      if (isRefresh) toast.success('Agents refreshed');
    } catch (error) {
      console.error('Failed to load agents:', error);
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Filter agents
  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || agent.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group agents by category
  const agentsByCategory = filteredAgents.reduce((acc, agent) => {
    if (!acc[agent.category]) {
      acc[agent.category] = [];
    }
    acc[agent.category].push(agent);
    return acc;
  }, {} as Record<IAAgentCategory, IAAgent[]>);

  const categories = Object.keys(agentsByCategory) as IAAgentCategory[];

  // Handlers
  const handleCreate = () => {
    setEditingAgent(null);
    setShowForm(true);
  };

  const handleEdit = (agent: IAAgent) => {
    setEditingAgent(agent);
    setShowForm(true);
  };

  const handleSave = async (data: IAAgentFormData) => {
    try {
      if (editingAgent) {
        await iaAgentApi.update(editingAgent._id, data);
        toast.success('Agent updated successfully');
      } else {
        await iaAgentApi.create(data);
        toast.success('Agent created successfully');
      }
      await loadAgents();
      setShowForm(false);
      setEditingAgent(null);
    } catch (error) {
      toast.error(editingAgent ? 'Failed to update agent' : 'Failed to create agent');
      throw error;
    }
  };

  const handleDeploy = async (agent: IAAgent) => {
    try {
      await iaAgentApi.deploy(agent._id);
      toast.success(`${agent.name} deployed successfully`);
      await loadAgents();
    } catch (error) {
      toast.error('Failed to deploy agent');
    }
  };

  const handleSuspend = async (agent: IAAgent) => {
    try {
      await iaAgentApi.suspend(agent._id);
      toast.success(`${agent.name} suspended`);
      await loadAgents();
    } catch (error) {
      toast.error('Failed to suspend agent');
    }
  };

  const handleArchive = async (agent: IAAgent) => {
    if (!confirm(`Archive "${agent.name}"? This will deactivate the agent.`)) return;
    try {
      await iaAgentApi.archive(agent._id);
      toast.success(`${agent.name} archived`);
      await loadAgents();
    } catch (error) {
      toast.error('Failed to archive agent');
    }
  };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => loadAgents(true)}
        disabled={refreshing}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass glass-blur border border-nilin-border/50 text-nilin-charcoal text-sm font-sans hover:bg-nilin-blush/40 disabled:opacity-50"
      >
        <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
        Refresh
      </button>
      <button
        type="button"
        onClick={handleCreate}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white text-sm font-medium font-sans shadow-nilin-warm hover:opacity-95"
      >
        <Plus className="w-4 h-4" />
        Create Agent
      </button>
    </div>
  );

  if (loading) {
    return (
      <AdminPageShell
        wideLayout
        title="Chatbot Builder"
        subtitle="Create and manage IA agents for TOUT, Admin, Provider, Client, and Partner"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Chatbot Builder', current: true },
        ]}
        headerActions={headerActions}
      >
        <div className="space-y-6">
          {/* Stats Skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          {/* Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        </div>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      wideLayout
      title="Chatbot Builder"
      subtitle="Create and manage IA agents for TOUT, Admin, Provider, Client, and Partner"
      breadcrumbItems={[
        { label: 'Admin', href: '/admin/dashboard' },
        { label: 'Chatbot Builder', current: true },
      ]}
      headerActions={headerActions}
    >
      <div className="space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-nilin-warmGray">Total</p>
              <p className="text-2xl font-serif text-nilin-charcoal mt-1">{stats.total}</p>
            </div>
            <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Deployed</p>
              <p className="text-2xl font-serif text-nilin-charcoal mt-1">{stats.deployed}</p>
            </div>
            <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Testing</p>
              <p className="text-2xl font-serif text-nilin-charcoal mt-1">{stats.testing}</p>
            </div>
            <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-600">Draft</p>
              <p className="text-2xl font-serif text-nilin-charcoal mt-1">{stats.draft}</p>
            </div>
            <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Suspended</p>
              <p className="text-2xl font-serif text-nilin-charcoal mt-1">{stats.suspended}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
            <input
              type="search"
              placeholder="Search agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-nilin-border/50 bg-white/60 font-sans focus:ring-2 focus:ring-nilin-coral/30"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                selectedCategory === 'All'
                  ? 'bg-nilin-coral text-white'
                  : 'bg-nilin-blush/40 text-nilin-charcoal hover:bg-nilin-blush/60'
              )}
            >
              All
            </button>
            {Object.values(IAAgentCategory).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                  selectedCategory === cat
                    ? 'bg-nilin-coral text-white'
                    : 'bg-nilin-blush/40 text-nilin-charcoal hover:bg-nilin-blush/60'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Agent Grid */}
        {filteredAgents.length === 0 ? (
          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-12 text-center">
            <Bot className="w-14 h-14 text-nilin-warmGray mx-auto mb-4 opacity-60" />
            <p className="font-medium text-nilin-charcoal font-sans">
              {searchTerm || selectedCategory !== 'All' ? 'No agents match your filters' : 'No IA agents yet'}
            </p>
            <p className="text-sm text-nilin-warmGray mt-2">
              {searchTerm || selectedCategory !== 'All'
                ? 'Try adjusting your search or filters'
                : 'Create your first IA agent to get started'}
            </p>
            {!searchTerm && selectedCategory === 'All' && (
              <button
                type="button"
                onClick={handleCreate}
                className="btn-nilin mt-4 flex items-center gap-2 mx-auto"
              >
                <Plus className="w-5 h-5" />
                Create Agent
              </button>
            )}
          </div>
        ) : selectedCategory === 'All' ? (
          // Group by category view
          <div className="space-y-8">
            {categories.map((category) => (
              <div key={category}>
                <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-nilin-blush/40 flex items-center justify-center text-sm font-bold">
                    {getCategoryIcon(category).charAt(0)}
                  </span>
                  {getCategoryIcon(category)}
                  <span className="text-sm font-sans text-nilin-warmGray">
                    ({agentsByCategory[category].length})
                  </span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agentsByCategory[category].map((agent) => (
                    <AgentCard
                      key={agent._id}
                      agent={agent}
                      onEdit={handleEdit}
                      onDeploy={handleDeploy}
                      onSuspend={handleSuspend}
                      onArchive={handleArchive}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Flat grid view
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent._id}
                agent={agent}
                onEdit={handleEdit}
                onDeploy={handleDeploy}
                onSuspend={handleSuspend}
                onArchive={handleArchive}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <AgentFormModal
          agent={editingAgent}
          onClose={() => {
            setShowForm(false);
            setEditingAgent(null);
          }}
          onSave={handleSave}
        />
      )}
    </AdminPageShell>
  );
}

export default ChatbotBuilderPage;
