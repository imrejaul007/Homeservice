import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, DollarSign, Calendar, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Skeleton, StatsCardSkeleton } from '../../components/common/Skeleton';
import { useAuthStore } from '../../stores/authStore';

interface DashboardStats {
  totalUsers: number;
  activeProviders: number;
  todayBookings: number;
  revenue: number;
  pendingVerifications: number;
  activeIncidents: number;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Auth check
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeProviders: 0,
    todayBookings: 0,
    revenue: 0,
    pendingVerifications: 0,
    activeIncidents: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        {/* Skeleton Header */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="w-48 h-8" />
          <Skeleton className="w-32 h-10 rounded-lg" />
        </div>

        {/* Stats Grid Skeletons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>

        {/* Alert Section Skeleton */}
        <Skeleton className="w-full h-16 rounded-xl mb-6" />

        {/* Quick Actions Skeletons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <Skeleton className="w-20 h-4 mb-2" />
            <Skeleton className="w-16 h-3" />
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <Skeleton className="w-20 h-4 mb-2" />
            <Skeleton className="w-16 h-3" />
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <Skeleton className="w-20 h-4 mb-2" />
            <Skeleton className="w-16 h-3" />
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <Skeleton className="w-20 h-4 mb-2" />
            <Skeleton className="w-16 h-3" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold mb-6">Operations Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="blue" />
        <StatCard icon={CheckCircle} label="Active Providers" value={stats.activeProviders} color="green" />
        <StatCard icon={Calendar} label="Today's Bookings" value={stats.todayBookings} color="purple" />
        <StatCard icon={DollarSign} label="Revenue" value={`AED ${stats.revenue.toLocaleString()}`} color="yellow" />
      </div>

      {/* Alerts Section */}
      {stats.pendingVerifications > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle size={20} />
            <span className="font-medium">{stats.pendingVerifications} providers pending verification</span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ActionCard title="Users" link="/admin/customers" />
        <ActionCard title="Providers" link="/admin/providers" />
        <ActionCard title="Analytics" link="/admin/analytics" />
        <ActionCard title="Disputes" link="/admin/disputes" />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className={`w-10 h-10 rounded-lg bg-${color}-100 flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 text-${color}-600`} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

function ActionCard({ title, link }: { title: string; link: string }) {
  return (
    <a href={link} className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow block">
      <p className="font-medium text-gray-900">{title}</p>
      <p className="text-sm text-pink-500">Manage</p>
    </a>
  );
}

export default AdminDashboard;
