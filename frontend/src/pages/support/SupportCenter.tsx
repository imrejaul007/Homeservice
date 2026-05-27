
import { useState } from 'react';
import { MessageCircle, HelpCircle, Phone, Mail, ChevronRight } from 'lucide-react';

const FAQ_CATEGORIES = [
  { id: 'booking', title: 'Booking Issues', icon: '📅', count: 12 },
  { id: 'payment', title: 'Payments & Refunds', icon: '💳', count: 8 },
  { id: 'provider', title: 'Provider Issues', icon: '👤', count: 6 },
  { id: 'account', title: 'Account & Login', icon: '🔐', count: 5 },
];

const SAMPLE_FAQS = [
  { q: 'How do I cancel a booking?', a: 'Go to My Bookings → Select booking → Cancel. Cancellation is free up to 4 hours before scheduled time.' },
  { q: 'How long does refund take?', a: 'Refunds are processed within 5-7 business days to your original payment method.' },
  { q: 'How to change my address?', a: 'Go to Profile → Addresses → Add/Edit Address.' },
];

export function SupportCenter() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-nilin-coral text-white p-6">
        <h1 className="text-xl font-bold">How can we help?</h1>
      </div>

      {/* Quick Actions */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <button className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-sm">
            <MessageCircle className="w-6 h-6 text-blue-500" />
            <span className="text-sm font-medium">Chat with Us</span>
          </button>
          <button className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-sm">
            <Phone className="w-6 h-6 text-green-500" />
            <span className="text-sm font-medium">Call Support</span>
          </button>
        </div>
      </div>

      {/* FAQ Categories */}
      <div className="p-4">
        <h2 className="font-semibold mb-3">Browse by Topic</h2>
        <div className="space-y-3">
          {FAQ_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className="w-full bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm"
            >
              <span className="text-2xl">{cat.icon}</span>
              <div className="flex-1 text-left">
                <p className="font-medium">{cat.title}</p>
                <p className="text-sm text-gray-500">{cat.count} articles</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          ))}
        </div>
      </div>

      {/* Common FAQs */}
      <div className="p-4">
        <h2 className="font-semibold mb-3">Common Questions</h2>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {SAMPLE_FAQS.map((faq, i) => (
            <details key={i} className="p-4 border-b last:border-0">
              <summary className="font-medium cursor-pointer">{faq.q}</summary>
              <p className="mt-2 text-sm text-gray-600">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Create Ticket */}
      <div className="p-4">
        <button className="w-full py-3 bg-nilin-coral text-white rounded-xl font-medium">
          Create Support Ticket
        </button>
      </div>
    </div>
  );
}

export default SupportCenter;
