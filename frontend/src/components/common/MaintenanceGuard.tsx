import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { fetchMaintenanceStatus, type MaintenanceStatus } from '../../services/platformApi';
import MaintenancePage from '../../pages/MaintenancePage';

const POLL_MS = 60_000;

const ALLOWED_PATHS = [
  '/maintenance',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/admin',
];

function isAllowedDuringMaintenance(pathname: string): boolean {
  return ALLOWED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export const MaintenanceGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchMaintenanceStatus();
      setStatus(next);

      const isAdmin = user?.role === 'admin';
      const onMaintenanceRoute = location.pathname === '/maintenance';

      if (next.maintenanceMode && !isAdmin && !isAllowedDuringMaintenance(location.pathname)) {
        if (!onMaintenanceRoute) {
          navigate('/maintenance', { replace: true, state: { from: location.pathname } });
        }
      } else if (!next.maintenanceMode && onMaintenanceRoute) {
        navigate('/', { replace: true });
      }
    } catch {
      // Fail open — do not block users if status endpoint is down
    } finally {
      setChecking(false);
    }
  }, [location.pathname, navigate, user?.role]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  if (checking && !status) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nilin-blush/20">
        <div className="w-10 h-10 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const maintenanceActive = Boolean(status?.maintenanceMode);

  if (maintenanceActive && !isAdmin) {
    if (location.pathname === '/maintenance') {
      return <MaintenancePage status={status!} />;
    }
    if (!isAllowedDuringMaintenance(location.pathname)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-nilin-blush/20">
          <div className="w-10 h-10 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default MaintenanceGuard;
