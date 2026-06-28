import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import { homeTrendingApi, type PlatformStats } from '../services/homeTrendingApi';
import { useCategories } from '../hooks/useCategories';

export default function BeautyServices() {
  const { categories, isLoading: categoriesLoading } = useCategories();
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    homeTrendingApi.getPlatformStats(abortController.signal).then(setStats).catch(() => setStats(null));
    return () => abortController.abort();
  }, []);

  const heroStats = [
    {
      num: stats ? `${stats.verifiedProfessionals.toLocaleString()}+` : '—',
      label: 'Verified Pros',
    },
    {
      num: stats ? `${stats.serviceCategories}+` : '—',
      label: 'Categories',
    },
    {
      num: stats && stats.averageRating > 0 ? `${stats.averageRating}/5` : '—',
      label: 'Rating',
    },
    {
      num: stats ? `${stats.happyClients.toLocaleString()}+` : '—',
      label: 'Happy Clients',
    },
  ];

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col overflow-x-hidden">
      <NavigationHeader showSearch={false} showCategoryTabs={false} />

      <section className="bg-gradient-to-r from-nilin-coral to-nilin-rose text-white py-12 sm:py-16 md:py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold mb-4 break-words">
            Beauty & Salon Services
          </h1>
          <p className="text-base sm:text-lg md:text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Book trusted beauty professionals for salon or home visits
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 max-w-3xl mx-auto">
            {heroStats.map((s) => (
              <div key={s.label} className="bg-white/20 rounded-xl px-4 py-3 min-h-11 flex flex-col justify-center">
                <span className="text-xl sm:text-2xl font-bold block">{s.num}</span>
                <span className="text-xs sm:text-sm opacity-80">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-serif text-nilin-charcoal text-center mb-8 sm:mb-12">
            Service Categories
          </h2>
          {categoriesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-nilin-coral" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {categories.slice(0, 6).map((cat) => (
                <Link
                  key={cat.slug}
                  to={`/category/${cat.slug}`}
                  className="bg-white rounded-2xl p-5 sm:p-6 shadow-md hover:shadow-xl transition min-h-[120px] flex flex-col"
                >
                  <div className="text-2xl mb-3">{cat.icon || '✨'}</div>
                  <h3 className="text-lg sm:text-xl font-semibold text-nilin-charcoal mb-2">{cat.name}</h3>
                  <p className="text-sm text-nilin-warmGray line-clamp-2">
                    {cat.description || 'Explore verified professionals and book instantly.'}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-white px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-serif text-nilin-charcoal mb-4">Join as a Professional</h2>
          <p className="text-nilin-warmGray mb-8">
            Grow your beauty business with NILIN. Reach new clients, manage bookings, and get paid securely.
          </p>
          <Link
            to="/register/provider"
            className="inline-flex items-center justify-center min-h-11 px-8 py-3 bg-nilin-coral text-white rounded-nilin font-medium hover:bg-nilin-rose transition-colors"
          >
            Become a Pro
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
