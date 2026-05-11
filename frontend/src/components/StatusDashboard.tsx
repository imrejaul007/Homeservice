import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Server, Database, Cloud, Mail, CreditCard, Wifi } from 'lucide-react';
import { apiService } from '../services/api';
import { API_BASE_URL } from '../config/api';

interface ServiceStatus {
  name: string;
  status: 'checking' | 'connected' | 'disconnected' | 'error' | 'not_configured';
  message?: string;
  details?: any;
  icon: React.ReactNode;
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
            details: dbStatus.details
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
            details: stripeStatus.details
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
            details: emailStatus.details
          };
        }
      } catch (error) {
        console.error('Error verifying services:', error);
      }

    } catch (error) {
      console.error('Error checking services:', error);
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
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />;
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
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Home Service Marketplace
              </h1>
              <p className="text-gray-600 mt-1">System Status Dashboard</p>
            </div>
            <button
              onClick={checkServices}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Overall Status */}
          <div className={`mt-6 p-4 rounded-lg ${
            allSystemsOperational ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <div className="flex items-center gap-3">
              {allSystemsOperational ? (
                <>
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-900">All Systems Operational</p>
                    <p className="text-sm text-green-700">
                      All services are running normally
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                  <div>
                    <p className="font-semibold text-yellow-900">Partial System Availability</p>
                    <p className="text-sm text-yellow-700">
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
              className={`bg-white rounded-lg shadow-md border-2 ${getStatusColor(service.status)} p-6 transition-all hover:shadow-lg`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    {service.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{service.name}</h3>
                    <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                      {getStatusIcon(service.status)}
                      {getStatusText(service.status)}
                    </p>
                  </div>
                </div>
              </div>

              {service.message && (
                <p className="mt-3 text-sm text-gray-600">{service.message}</p>
              )}

              {service.details && (
                <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(service.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Links & Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">API Endpoints</h3>
              <ul className="space-y-1 text-sm">
                <li>
                  <span className="text-gray-600">Health Check:</span>{' '}
                  <a href={`${API_BASE_URL.replace('/api', '')}/health`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {API_BASE_URL.replace('/api', '')}/health
                  </a>
                </li>
                <li>
                  <span className="text-gray-600">API Test:</span>{' '}
                  <a href={`${API_BASE_URL}/test`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {API_BASE_URL}/test
                  </a>
                </li>
                <li>
                  <span className="text-gray-600">Verify Services:</span>{' '}
                  <a href={`${API_BASE_URL}/verify`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {API_BASE_URL}/verify
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Development Info</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>Frontend Port: 5173</li>
                <li>Backend Port: 5000</li>
                <li>Environment: {import.meta.env.VITE_ENVIRONMENT || 'development'}</li>
                {lastChecked && (
                  <li>Last Checked: {lastChecked.toLocaleTimeString()}</li>
                )}
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Next Steps</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
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