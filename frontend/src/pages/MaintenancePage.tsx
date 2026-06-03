import React from 'react';
import { Wrench, Mail, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { MaintenanceStatus } from '../services/platformApi';

interface MaintenancePageProps {
  status: MaintenanceStatus;
}

const MaintenancePage: React.FC<MaintenancePageProps> = ({ status }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-nilin-blush/40 to-white flex items-center justify-center p-6 font-sans">
      <div className="max-w-lg w-full text-center">
        <div className="w-20 h-20 rounded-full bg-nilin-blush mx-auto flex items-center justify-center mb-6">
          <Wrench className="w-10 h-10 text-nilin-coral" />
        </div>
        <h1 className="text-2xl font-serif text-nilin-charcoal mb-3">Service unavailable</h1>
        <p className="text-nilin-warmGray leading-relaxed mb-6">{status.message}</p>
        {status.estimatedDuration && (
          <p className="inline-flex items-center gap-2 text-sm text-nilin-charcoal bg-white/80 border border-nilin-border/50 rounded-full px-4 py-2 mb-6">
            <Clock className="w-4 h-4 text-nilin-coral" />
            Expected back in {status.estimatedDuration}
          </p>
        )}
        {status.supportEmail && (
          <a
            href={`mailto:${status.supportEmail}`}
            className="inline-flex items-center gap-2 text-sm text-nilin-coral hover:underline"
          >
            <Mail className="w-4 h-4" />
            {status.supportEmail}
          </a>
        )}
        <p className="text-xs text-nilin-warmGray mt-10">
          Admin?{' '}
          <Link to="/login" className="text-nilin-coral hover:underline">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default MaintenancePage;
