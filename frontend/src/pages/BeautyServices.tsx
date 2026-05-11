import { useState } from 'react';

const BEAUTY_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    commission: '20%',
    bookings: 'Up to 50/month',
    features: ['Basic salon profile', 'Standard search', 'Email notifications'],
    popular: false,
    color: 'gray',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 299,
    period: 'AED/month',
    commission: '15%',
    bookings: 'Unlimited',
    features: ['Priority listing', 'Portfolio pages', 'Advanced analytics', 'Promotional tools', 'In-app chat'],
    popular: true,
    color: 'pink',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 799,
    period: 'AED/month',
    commission: '12%',
    bookings: 'Unlimited',
    features: ['Featured listing', 'API access', 'Dedicated support', 'White-label'],
    popular: false,
    color: 'purple',
  },
];

const METRICS = [
  { value: '180', label: 'AED', sub: 'Avg Booking' },
  { value: '15-20%', label: '', sub: 'Commission' },
  { value: '30', label: 'AED', sub: 'Net/Booking' },
  { value: '120', label: '', sub: 'Bookings/Month' },
  { value: '68%', label: '', sub: 'Repeat Rate' },
];

const CATEGORIES = [
  { name: 'Hair Styling', icon: '✂️', bg: 'bg-pink-500', desc: 'Cuts, coloring, keratin' },
  { name: 'Nail Art', icon: '💅', bg: 'bg-purple-500', desc: 'Manicure, pedicure' },
  { name: 'Spa & Wellness', icon: '🧖', bg: 'bg-cyan-500', desc: 'Massage, facials' },
  { name: 'Bridal Packages', icon: '💍', bg: 'bg-amber-500', desc: 'Wedding beauty' },
  { name: "Men's Grooming", icon: '💈', bg: 'bg-blue-500', desc: 'Barbershop services' },
  { name: 'Makeup Artistry', icon: '💄', bg: 'bg-red-500', desc: 'Professional makeup' },
];

export default function BeautyServices() {
  const [activePlan, setActivePlan] = useState('pro');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-r from-pink-500 to-purple-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Beauty & Salon Services</h1>
          <p className="text-xl mb-8 opacity-90">Book trusted beauty professionals for salon or home visits</p>
          <div className="flex justify-center gap-6 text-center flex-wrap">
            {[
              { num: '3,000+', label: 'Verified' },
              { num: '50+', label: 'Services' },
              { num: '4.8/5', label: 'Rating' },
              { num: '180 AED', label: 'Avg Booking' },
            ].map((s, i) => (
              <div key={i} className="bg-white/20 rounded-xl px-6 py-3">
                <span className="text-2xl font-bold block">{s.num}</span>
                <span className="text-sm opacity-80">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">6 Service Categories</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {CATEGORIES.map((cat) => (
            <div key={cat.name} className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition cursor-pointer">
              <div className={`w-14 h-14 ${cat.bg} rounded-xl flex items-center justify-center text-2xl mb-4`}>{cat.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{cat.name}</h3>
              <p className="text-gray-600">{cat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">Pricing Plans</h2>
          <p className="text-center text-gray-600 mb-12">Choose your salon plan</p>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {BEAUTY_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-2xl p-8 border-2 transition-all cursor-pointer ${
                  activePlan === plan.id ? 'border-pink-500 shadow-xl' : 'border-gray-200 hover:border-pink-300'
                } ${plan.popular ? 'relative' : ''}`}
                onClick={() => setActivePlan(plan.id)}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-pink-500 text-white px-4 py-1 rounded-full text-sm">Most Popular</span>
                )}
                <h3 className="text-2xl font-bold">{plan.name}</h3>
                <div className="my-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-500 ml-2">/{plan.period}</span>
                </div>
                <div className="text-sm text-gray-600 mb-6">{plan.commission} commission • {plan.bookings}</div>
                <ul className="space-y-2 mb-8">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-green-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-3 rounded-lg font-semibold ${
                  activePlan === plan.id ? 'bg-pink-500 text-white' : 'bg-gray-100'
                }`}>
                  {activePlan === plan.id ? 'Current' : 'Select'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Unit Economics */}
      <section className="py-16 container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">Unit Economics</h2>
        <div className="grid grid-cols-5 gap-4 max-w-4xl mx-auto">
          {METRICS.map((m, i) => (
            <div key={i} className="bg-white rounded-xl p-6 text-center shadow">
              <div className="text-2xl font-bold text-pink-600">{m.value}</div>
              {m.label && <div className="text-sm text-gray-500">{m.label}</div>}
              <div className="text-sm text-gray-600">{m.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-pink-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="flex justify-between max-w-4xl mx-auto">
            {['Browse', 'Book', 'Service', 'Rate', 'Earn'].map((step, i) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 bg-pink-500 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">{i + 1}</div>
                <div className="font-semibold">{step}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
