import React, { useState } from 'react';
import {
  Building2,
  Globe,
  Palette,
  Settings,
  Users,
  CreditCard,
  Check,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Copy,
  Eye,
  Edit,
  Trash2,
  Plus,
  Download,
  RefreshCw,
  Lock,
  Unlock,
  Shield,
  Zap
} from 'lucide-react';
import { cn } from '../../lib/utils';

type LicenseTier = 'starter' | 'professional' | 'enterprise';
type LicenseStatus = 'trial' | 'active' | 'suspended' | 'cancelled' | 'expired';

interface WhiteLabelLicense {
  licenseId: string;
  licenseKey: string;
  organizationName: string;
  tier: LicenseTier;
  status: LicenseStatus;
  currentPeriodEnd: Date;
  usage: {
    activeUsers: number;
    maxUsers: number;
    apiCalls: number;
    apiCallsLimit: number;
  };
  config: {
    branding: {
      companyName: string;
      primaryColor: string;
      secondaryColor: string;
      logoUrl?: string;
    };
    domain: {
      subdomain: string;
      customDomain?: string;
      domainVerified: boolean;
    };
  };
}

interface WhiteLabelDashboardProps {
  licenses: WhiteLabelLicense[];
  onSelectLicense: (license: WhiteLabelLicense) => void;
  onCreateLicense: () => void;
  onUpdateConfig: (licenseId: string, config: Partial<WhiteLabelLicense['config']>) => void;
}

const tierFeatures: Record<LicenseTier, string[]> = {
  starter: ['Basic white labeling', 'Custom subdomain', 'Basic analytics', '5 users'],
  professional: ['Full white labeling', 'Custom domain', 'API access', '25 users', 'Priority support'],
  enterprise: ['Unlimited everything', 'Multiple domains', 'Dedicated support', 'SLA guarantee'],
};

const WhiteLabelDashboard: React.FC<WhiteLabelDashboardProps> = ({
  licenses,
  onSelectLicense,
  onCreateLicense,
  onUpdateConfig,
}) => {
  const [selectedLicense, setSelectedLicense] = useState<WhiteLabelLicense | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'branding' | 'domain' | 'billing'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  };

  const statusColors: Record<LicenseStatus, { bg: string; text: string }> = {
    trial: { bg: 'bg-purple-100', text: 'text-purple-700' },
    active: { bg: 'bg-green-100', text: 'text-green-700' },
    suspended: { bg: 'bg-red-100', text: 'text-red-700' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-700' },
    expired: { bg: 'bg-amber-100', text: 'text-amber-700' },
  };

  const tierColors: Record<LicenseTier, string> = {
    starter: 'text-gray-600 bg-gray-100',
    professional: 'text-blue-600 bg-blue-100',
    enterprise: 'text-amber-600 bg-amber-100',
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
  };

  const selected = selectedLicense || licenses[0];

  if (!selected) {
    return (
      <div className="w-full max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-nilin-charcoal mb-2">No White Label Licenses</h2>
          <p className="text-nilin-gray mb-6">Create your first white label license to get started</p>
          <button
            onClick={onCreateLicense}
            className="inline-flex items-center gap-2 px-6 py-3 bg-nilin-coral text-white rounded-xl font-semibold hover:bg-nilin-coral/90 transition"
          >
            <Plus className="h-5 w-5" />
            Create License
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-nilin-charcoal">White Label Dashboard</h1>
          <p className="text-nilin-gray">{licenses.length} license{licenses.length > 1 ? 's' : ''} active</p>
        </div>
        <button
          onClick={onCreateLicense}
          className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg font-medium hover:bg-nilin-coral/90 transition"
        >
          <Plus className="h-5 w-5" />
          Create License
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - License List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-nilin-charcoal mb-3">Licenses</h3>
            <div className="space-y-2">
              {licenses.map((license) => (
                <div key={license.licenseId}>
                  <button
                    onClick={() => {
                      setSelectedLicense(license);
                      setExpandedOrgId(expandedOrgId === license.licenseId ? null : license.licenseId);
                    }}
                    className={cn(
                      'w-full text-left p-3 rounded-lg transition',
                      selected?.licenseId === license.licenseId
                        ? 'bg-nilin-coral/10 border border-nilin-coral/20'
                        : 'hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: license.config.branding.primaryColor }}
                        />
                        <span className="font-medium text-nilin-charcoal truncate">
                          {license.config.branding.companyName}
                        </span>
                      </div>
                      {expandedOrgId === license.licenseId ? (
                        <ChevronDown className="h-4 w-4 text-nilin-gray" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-nilin-gray" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium capitalize', tierColors[license.tier])}>
                        {license.tier}
                      </span>
                      <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium capitalize', statusColors[license.status].bg, statusColors[license.status].text)}>
                        {license.status}
                      </span>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {expandedOrgId === license.licenseId && (
                    <div className="mt-2 ml-4 pl-4 border-l-2 border-gray-200 space-y-2">
                      <div className="text-xs text-nilin-gray">
                        <p>Users: {license.usage.activeUsers}/{license.usage.maxUsers === -1 ? 'unlimited' : license.usage.maxUsers}</p>
                        <p>API: {license.usage.apiCalls.toLocaleString()}/{license.usage.apiCallsLimit.toLocaleString()}/mo</p>
                        <p>Expires: {formatDate(license.currentPeriodEnd)}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* License Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: selected.config.branding.primaryColor + '20' }}
                  >
                    <Building2 className="h-6 w-6" style={{ color: selected.config.branding.primaryColor }} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-nilin-charcoal">
                      {selected.config.branding.companyName}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium capitalize', tierColors[selected.tier])}>
                        {selected.tier}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium capitalize', statusColors[selected.status].bg, statusColors[selected.status].text)}>
                        {selected.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <Edit className="h-5 w-5 text-nilin-gray" />
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                    <Settings className="h-5 w-5 text-nilin-gray" />
                  </button>
                </div>
              </div>

              {/* License Key */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-xs text-nilin-gray">License Key</p>
                  <p className="font-mono font-medium">{selected.licenseKey}</p>
                </div>
                <button
                  onClick={() => handleCopyKey(selected.licenseKey)}
                  className="p-2 hover:bg-gray-200 rounded-lg transition"
                >
                  <Copy className="h-4 w-4 text-nilin-gray" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              {[
                { id: 'overview', label: 'Overview', icon: Building2 },
                { id: 'branding', label: 'Branding', icon: Palette },
                { id: 'domain', label: 'Domain', icon: Globe },
                { id: 'billing', label: 'Billing', icon: CreditCard },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={cn(
                    'flex-1 py-3 px-4 text-sm font-medium transition flex items-center justify-center gap-2',
                    activeTab === tab.id
                      ? 'text-nilin-coral border-b-2 border-nilin-coral'
                      : 'text-nilin-gray hover:text-nilin-charcoal'
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Usage Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3 mb-3">
                        <Users className="h-5 w-5 text-blue-600" />
                        <span className="text-sm font-medium text-nilin-gray">Active Users</span>
                      </div>
                      <p className="text-2xl font-bold text-nilin-charcoal">
                        {selected.usage.activeUsers}
                        <span className="text-lg font-normal text-nilin-gray">
                          /{selected.usage.maxUsers === -1 ? 'unlimited' : selected.usage.maxUsers}
                        </span>
                      </p>
                      <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${Math.min(100, (selected.usage.activeUsers / (selected.usage.maxUsers === -1 ? 10 : selected.usage.maxUsers)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3 mb-3">
                        <Zap className="h-5 w-5 text-amber-600" />
                        <span className="text-sm font-medium text-nilin-gray">API Calls</span>
                      </div>
                      <p className="text-2xl font-bold text-nilin-charcoal">
                        {selected.usage.apiCalls.toLocaleString()}
                        <span className="text-lg font-normal text-nilin-gray">
                          /{selected.usage.apiCallsLimit.toLocaleString()}
                        </span>
                      </p>
                      <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${(selected.usage.apiCalls / selected.usage.apiCallsLimit) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3 mb-3">
                        <Shield className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium text-nilin-gray">Status</span>
                      </div>
                      <p className="text-lg font-bold text-nilin-charcoal capitalize">{selected.status}</p>
                      <p className="text-sm text-nilin-gray">
                        Renews {formatDate(selected.currentPeriodEnd)}
                      </p>
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <h3 className="font-semibold text-nilin-charcoal mb-3">Included Features</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {tierFeatures[selected.tier].map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-800">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div>
                    <h3 className="font-semibold text-nilin-charcoal mb-3">Quick Actions</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <button className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition flex flex-col items-center gap-2">
                        <Eye className="h-5 w-5 text-nilin-gray" />
                        <span className="text-sm font-medium">Preview Site</span>
                      </button>
                      <button className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition flex flex-col items-center gap-2">
                        <Download className="h-5 w-5 text-nilin-gray" />
                        <span className="text-sm font-medium">Export Data</span>
                      </button>
                      <button className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition flex flex-col items-center gap-2">
                        <RefreshCw className="h-5 w-5 text-nilin-gray" />
                        <span className="text-sm font-medium">Sync Settings</span>
                      </button>
                      <button className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition flex flex-col items-center gap-2">
                        <ExternalLink className="h-5 w-5 text-nilin-gray" />
                        <span className="text-sm font-medium">Open Dashboard</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Branding Tab */}
              {activeTab === 'branding' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Logo Upload */}
                    <div>
                      <label className="block text-sm font-medium text-nilin-charcoal mb-2">Company Logo</label>
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                        {selected.config.branding.logoUrl ? (
                          <div className="flex flex-col items-center gap-4">
                            <img
                              src={selected.config.branding.logoUrl}
                              alt="Logo"
                              className="h-16 object-contain"
                            />
                            <button className="text-sm text-nilin-coral hover:underline">Change Logo</button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                              <Building2 className="h-8 w-8 text-gray-400" />
                            </div>
                            <button className="text-sm text-nilin-coral hover:underline">Upload Logo</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Colors */}
                    <div>
                      <label className="block text-sm font-medium text-nilin-charcoal mb-2">Brand Colors</label>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div>
                            <label className="block text-xs text-nilin-gray mb-1">Primary</label>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-10 h-10 rounded-lg border border-gray-200"
                                style={{ backgroundColor: selected.config.branding.primaryColor }}
                              />
                              <input
                                type="text"
                                value={selected.config.branding.primaryColor}
                                readOnly
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-nilin-gray mb-1">Secondary</label>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-10 h-10 rounded-lg border border-gray-200"
                                style={{ backgroundColor: selected.config.branding.secondaryColor }}
                              />
                              <input
                                type="text"
                                value={selected.config.branding.secondaryColor}
                                readOnly
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-2">Preview</label>
                    <div
                      className="rounded-xl p-6"
                      style={{ backgroundColor: selected.config.branding.primaryColor + '10' }}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: selected.config.branding.primaryColor }}
                        >
                          <Building2 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: selected.config.branding.primaryColor }}>
                            {selected.config.branding.companyName}
                          </p>
                          <p className="text-sm text-nilin-gray">Powered by Rezilla</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Domain Tab */}
              {activeTab === 'domain' && (
                <div className="space-y-6">
                  {/* Subdomain */}
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-2">Subdomain</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={selected.config.domain.subdomain}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <span className="text-nilin-gray">.rezilla.com</span>
                    </div>
                    <p className="text-xs text-nilin-gray mt-1">This is your default white label URL</p>
                  </div>

                  {/* Custom Domain */}
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-2">Custom Domain</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={selected.config.domain.customDomain || ''}
                        placeholder="e.g., services.yourcompany.com"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <button className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90">
                        Verify
                      </button>
                    </div>

                    {selected.config.domain.domainVerified ? (
                      <div className="mt-3 flex items-center gap-2 text-green-600">
                        <Check className="h-4 w-4" />
                        <span className="text-sm">Domain verified and SSL enabled</span>
                      </div>
                    ) : (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-amber-800">Domain not verified</p>
                            <p className="text-amber-700 mt-1">
                              Add a CNAME record pointing to {selected.config.domain.subdomain}.rezilla.com
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Domain Requirements */}
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <h4 className="font-medium text-nilin-charcoal mb-3">Setup Instructions</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-nilin-gray">
                      <li>Log in to your domain registrar (GoDaddy, Namecheap, etc.)</li>
                      <li>Navigate to DNS settings for your domain</li>
                      <li>Add a CNAME record:
                        <ul className="list-disc list-inside ml-6 mt-1">
                          <li>Host: <code className="bg-white px-1 rounded">@</code> or <code className="bg-white px-1 rounded">services</code></li>
                          <li>Value: <code className="bg-white px-1 rounded">{selected.config.domain.subdomain}.rezilla.com</code></li>
                          <li>TTL: 3600 (1 hour)</li>
                        </ul>
                      </li>
                      <li>Click "Verify Domain" once DNS has propagated</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Billing Tab */}
              {activeTab === 'billing' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-sm text-nilin-gray">Current Plan</p>
                      <p className="text-xl font-bold text-nilin-charcoal capitalize">{selected.tier}</p>
                      <p className="text-sm text-nilin-gray mt-1">Billed monthly</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-sm text-nilin-gray">Next Billing Date</p>
                      <p className="text-xl font-bold text-nilin-charcoal">{formatDate(selected.currentPeriodEnd)}</p>
                      <p className="text-sm text-nilin-gray mt-1">Auto-renew enabled</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-nilin-charcoal">Plan Actions</h3>
                    </div>
                    <div className="flex gap-3">
                      <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                        Upgrade Plan
                      </button>
                      <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                        Change Billing Cycle
                      </button>
                      <button className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition">
                        Cancel Subscription
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhiteLabelDashboard;
