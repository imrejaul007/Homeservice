import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Server, Database, Cloud, Mail, CreditCard, Wifi } from 'lucide-react';
import { apiService } from '../services/api';
import { API_BASE_URL } from '../config/api';

interface ServiceStatus {
  name: string;
  status: 'checking' | 'connected' | 'disconnected' | 'error' | 'not_configured';
  message?: string;
  details?: ServiceDetails;
  icon: React.ReactNode;
}

interface ServiceDetails {
  latency?: number;
  error?: string;
  version?: string;
  uptime?: number;
  region?: string;
  [key: string]: unknown;
}

const StatusDashboard: React.FC = () => {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Frontend Build', status: 'connected', icon: <Server className="w-5 h-5" /> },
    { name: 'Backend API', status: 'checking', icon: <Wifi className="w-5 h-5" /> },
    { name: 'Database', status: 'checking', icon: <Database className="w-5 h-5" /> },
    { name: 'Cloudinary', status: 'checking', icon: <Cloud className="w-5 h-5" /> },
    { name: 'Stripe', status: 'checking', icon: <CreditCard className="w-5 h-5" /> },
    { name: 'Email Service', status: 'checking', icon: <Mail className="w-5 h-5" /> },
  ]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkServices = async () => {
    setIsRefreshing(true);
    const newServices = [...services];

    try {
      // Check Backend API
      try {
        const apiTest = await apiService.testConnection();
        newServices[1] = { ...newServices[1], status: 'connected', message: apiTest.message };
      } catch (error) {
        newServices[1] = { ...newServices[1], status: 'disconnected', message: 'Cannot connect to backend API' };
      }

      // Check all services at once
      try {
        const verifyResult = await apiService.verifyServices();

        // Database
        if (verifyResult.services?.database) {
          const dbStatus = verifyResult.services.database;
          newServices[2] = {
            ...newServices[2],
            status: dbStatus.status === 'connected' ? 'connected' : 'disconnected',
            details: { latency: dbStatus.details as unknown as number }
          };
        }

        // Cloudinary
        if (verifyResult.services?.external?.cloudinary) {
          const cloudStatus = verifyResult.services.external.cloudinary;
          newServices[3] = {
            ...newServices[3],
            status: cloudStatus.status === 'connected' ? 'connected' :
                   cloudStatus.status === 'not_configured' ? 'not_configured' : 'disconnected',
            message: cloudStatus.message
          };
        }

        // Stripe
        if (verifyResult.services?.external?.stripe) {
          const stripeStatus = verifyResult.services.external.stripe;
          newServices[4] = {
            ...newServices[4],
            status: stripeStatus.status === 'connected' ? 'connected' :
                   stripeStatus.status === 'not_configured' ? 'not_configured' : 'disconnected',
            message: stripeStatus.message,
          };
        }

        // Email
        if (verifyResult.services?.external?.email) {
          const emailStatus = verifyResult.services.external.email;
          newServices[5] = {
            ...newServices[5],
            status: emailStatus.status === 'connected' ? 'connected' :
                   emailStatus.status === 'not_configured' ? 'not_configured' : 'disconnected',
            message: emailStatus.message,
          };
        }
      } catch {
        // Error handled silently
      }

    } catch {
      // Error handled silently
    }

    setServices(newServices);
    setLastChecked(new Date());
    setIsRefreshing(false);
  };

  useEffect(() => {
    checkServices();

    // Auto-refresh every 30 seconds
    const interval = setInterval(checkServices, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'disconnected':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'not_configured':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      default:
        return <RefreshCw className="w-5 h-5 text-nilin-warmGray animate-spin" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-50 border-green-200';
      case 'disconnected':
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'not_configured':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-nilin-blush/50 border-nilin-border';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Error';
      case 'not_configured':
        return 'Not Configured';
      default:
        return 'Checking...';
    }
  };

  const allSystemsOperational = services.every(
    s => s.status === 'connected' || s.status === 'not_configured'
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-nilin p-6 mb-6 border border-nilin-border">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-serif font-light text-nilin-charcoal">
                System Status
              </h1>
              <p className="text-nilin-warmGray mt-1 font-sans">NILIN Platform Health Monitor</p>
            </div>
            <button
              onClick={checkServices}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl hover:shadow-nilin-warm transition-all disabled:opacity-50 font-sans font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Overall Status */}
          <div className={`mt-6 p-4 rounded-xl ${
            allSystemsOperational ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
          }`}>
            <div className="flex items-center gap-3">
              {allSystemsOperational ? (
                <>
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900 font-sans">All Systems Operational</p>
                    <p className="text-sm text-green-700 font-sans">
                      All services are running normally
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900 font-sans">Partial System Availability</p>
                    <p className="text-sm text-amber-700 font-sans">
                      Some services may be unavailable or not configured
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service, index) => (
            <div
              key={index}
              className={`bg-white rounded-xl shadow-nilin border-2 ${getStatusColor(service.status)} p-6 transition-all hover:shadow-nilin-lg`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-nilin-blush/50 rounded-xl">
                    {service.icon}
                  </div>
                  <div>
                    <h3 className="font-medium text-nilin-charcoal font-sans">{service.name}</h3>
                    <p className="text-sm text-nilin-warmGray flex items-center gap-2 mt-1 font-sans">
                      {getStatusIcon(service.status)}
                      {getStatusText(service.status)}
                    </p>
                  </div>
                </div>
              </div>

              {service.message && (
                <p className="mt-3 text-sm text-nilin-warmGray font-sans">{service.message}</p>
              )}

              {service.details && (
                <div className="mt-3 p-3 bg-nilin-blush/30 rounded-lg text-xs text-nilin-warmGray font-sans">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(service.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-8 bg-white rounded-2xl shadow-nilin p-6 border border-nilin-border">
          <h2 className="text-xl font-serif font-light text-nilin-charcoal mb-4">Quick Links & Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-nilin-charcoal mb-2 font-sans">API Endpoints</h3>
              <ul className="space-y-1 text-sm font-sans">
                <li>
                  <span className="text-nilin-warmGray">Health Check:</span>{' '}
                  <a href={`${API_BASE_URL.replace('/api', '')}/health`} target="_blank" rel="noopener noreferrer" className="text-nilin-coral hover:text-nilin-rose hover:underline">
                    {API_BASE_URL.replace('/api', '')}/health
                  </a>
                </li>
                <li>
                  <span className="text-nilin-warmGray">API Test:</span>{' '}
                  <a href={`${API_BASE_URL}/test`} target="_blank" rel="noopener noreferrer" className="text-nilin-coral hover:text-nilin-rose hover:underline">
                    {API_BASE_URL}/test
                  </a>
                </li>
                <li>
                  <span className="text-nilin-warmGray">Verify Services:</span>{' '}
                  <a href={`${API_BASE_URL}/verify`} target="_blank" rel="noopener noreferrer" className="text-nilin-coral hover:text-nilin-rose hover:underline">
                    {API_BASE_URL}/verify
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-nilin-charcoal mb-2 font-sans">Development Info</h3>
              <ul className="space-y-1 text-sm text-nilin-warmGray font-sans">
                <li>Frontend Port: 5173</li>
                <li>Backend Port: 5000</li>
                <li>Environment: {import.meta.env.VITE_ENVIRONMENT || 'development'}</li>
                {lastChecked && (
                  <li>Last Checked: {lastChecked.toLocaleTimeString()}</li>
                )}
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-nilin-blush/50 rounded-xl">
            <h3 className="font-medium text-nilin-charcoal mb-2 font-sans">Next Steps</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-nilin-warmGray font-sans">
              <li>Ensure MongoDB is running (local or Atlas)</li>
              <li>Configure environment variables in backend/.env</li>
              <li>Install dependencies: npm run install:all</li>
              <li>Start development: npm run dev</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusDashboard;
