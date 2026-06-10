import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, LayoutDashboard, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const getFirstName = (name?: string, firstName?: string): string => {
  if (name?.trim()) return name.trim().split(' ')[0];
  if (firstName?.trim()) return firstName.trim();
  return 'there';
};

const LoggedInHomeBanner: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) return null;

  const isCustomer = user.role === 'customer';
  const dashboardPath = isCustomer ? '/customer/dashboard' : '/provider/dashboard';

  return (
    <section className="relative z-20 -mt-2 px-4 pb-2">
      <div className="max-w-7xl mx-auto">
        <div className="rounded-2xl border border-nilin-coral/25 bg-gradient-to-r from-white via-nilin-blush/40 to-white p-4 md:p-5 shadow-nilin flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-nilin-coral to-nilin-rose flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-nilin-warmGray">Welcome back</p>
              <p className="text-lg font-serif text-nilin-charcoal">
                Hi, {getFirstName(user.name, user.firstName)}
              </p>
              <p className="text-sm text-nilin-warmGray mt-0.5">
                {isCustomer
                  ? 'Pick up where you left off — bookings, wallet, and reviews in one place.'
                  : 'Manage your schedule and clients from your dashboard.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
            <Link
              to={dashboardPath}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-nilin-coral to-nilin-rose text-white text-sm font-semibold shadow-nilin-warm hover:shadow-nilin transition-all"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
            {isCustomer && (
              <Link
                to="/customer/book-services"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-nilin-border text-nilin-charcoal text-sm font-medium hover:bg-nilin-muted transition-colors"
              >
                <Calendar className="w-4 h-4 text-nilin-coral" />
                Book again
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LoggedInHomeBanner;
