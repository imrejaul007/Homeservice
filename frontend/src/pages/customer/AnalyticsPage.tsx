import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Users, Calendar, Star, BarChart3, Clock, MapPin } from 'lucide-react';

const AnalyticsPage: React.FC = () => {
  const stats = [
    { label: 'Total Bookings', value: '12', icon: Calendar, color: 'blue' },
    { label: 'Money Saved', value: '₹2,400', icon: TrendingUp, color: 'green' },
    { label: 'Avg Rating', value: '4.8', icon: Star, color: 'yellow' },
    { label: 'Hours Booked', value: '48', icon: Clock, color: 'purple' },
  ];

  const monthlyData = [
    { month: 'Jan', bookings: 2 },
    { month: 'Feb', bookings: 3 },
    { month: 'Mar', bookings: 5 },
    { month: 'Apr', bookings: 4 },
    { month: 'May', bookings: 6 },
    { month: 'Jun', bookings: 12 },
  ];

  const maxBookings = Math.max(...monthlyData.map(d => d.bookings));

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-500 text-white p-6">
        <div className="flex items-center gap-4 mb-4">
          <Link to="/customer/profile" className="p-2 -ml-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            My Activity
          </h1>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm">
            <div className={`w-10 h-10 rounded-full bg-${stat.color}-100 flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
            </div>
            <p className="text-2xl font-bold text-nilin-charcoal">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Monthly Activity Chart */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-nilin-charcoal mb-4">Monthly Activity</h2>
          <div className="flex items-end justify-between gap-2 h-32">
            {monthlyData.map((data) => (
              <div key={data.month} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-emerald-500 rounded-t-lg transition-all"
                  style={{ height: `${(data.bookings / maxBookings) * 100}%` }}
                />
                <p className="text-xs text-gray-500 mt-2">{data.month}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="px-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-nilin-charcoal mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {[
              { service: 'Deep Cleaning', date: 'Today', status: 'Completed', amount: '₹2,500' },
              { service: 'AC Repair', date: 'May 15', status: 'Completed', amount: '₹800' },
              { service: 'Plumbing', date: 'May 10', status: 'Completed', amount: '₹600' },
            ].map((booking, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-nilin-charcoal">{booking.service}</p>
                  <p className="text-xs text-gray-500">{booking.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-green-600">{booking.amount}</p>
                  <p className="text-xs text-green-600">{booking.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Explore More */}
      <div className="px-4 mt-4">
        <Link
          to="/search"
          className="block bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl p-4 text-center font-medium"
        >
          Book Another Service →
        </Link>
      </div>
    </div>
  );
};

export default AnalyticsPage;
