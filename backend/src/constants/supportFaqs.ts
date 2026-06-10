export interface SupportFaq {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
}

export const SUPPORT_FAQS: SupportFaq[] = [
  {
    id: 'faq-001',
    question: 'How do I cancel a booking?',
    answer:
      'Go to My Bookings, select the booking, and tap Cancel. Cancellations are free up to 4 hours before the scheduled time. Late cancellations may incur a fee per our cancellation policy.',
    category: 'booking',
    tags: ['cancel', 'booking', 'refund'],
  },
  {
    id: 'faq-002',
    question: 'How long does a refund take?',
    answer:
      'Refunds are processed within 5–7 business days to your original payment method. Wallet refunds are instant. You will receive an email confirmation when the refund is initiated.',
    category: 'payment',
    tags: ['refund', 'payment', 'billing'],
  },
  {
    id: 'faq-003',
    question: 'How do I reschedule a booking?',
    answer:
      'Open My Bookings, select the booking, and choose Reschedule. Pick a new date and time from available slots. Rescheduling is free if done at least 4 hours before the appointment.',
    category: 'booking',
    tags: ['reschedule', 'booking'],
  },
  {
    id: 'faq-004',
    question: 'How do I contact my service provider?',
    answer:
      'Once your booking is confirmed, go to the booking details page and tap Message Provider. You can also use the in-app chat from your dashboard.',
    category: 'booking',
    tags: ['provider', 'message', 'chat'],
  },
  {
    id: 'faq-005',
    question: 'What payment methods are accepted?',
    answer:
      'We accept credit/debit cards, Apple Pay, Google Pay, NILIN wallet, and cash on delivery (where available). All card payments are processed securely.',
    category: 'payment',
    tags: ['payment', 'wallet', 'card'],
  },
  {
    id: 'faq-006',
    question: 'How do I reset my password?',
    answer:
      'On the login page, tap Forgot Password and enter your email. You will receive a reset link within a few minutes. The link expires after 24 hours.',
    category: 'account',
    tags: ['password', 'login', 'account'],
  },
  {
    id: 'faq-007',
    question: 'How do I become a service provider?',
    answer:
      'Visit our provider registration page, complete your profile, upload required documents, and submit for verification. Our team reviews applications within 2–3 business days.',
    category: 'provider',
    tags: ['provider', 'onboarding', 'registration'],
  },
  {
    id: 'faq-008',
    question: 'What are your support hours?',
    answer:
      'Our support team is available Sunday through Thursday, 9:00 AM to 6:00 PM GST. Live AI chat is available 24/7. Email inquiries receive a response within 24 hours.',
    category: 'general',
    tags: ['hours', 'support', 'contact'],
  },
  {
    id: 'faq-009',
    question: 'How do I track my support ticket?',
    answer:
      'Log in and go to Customer Support → My Tickets. Each ticket shows its status, assigned team, and message history. You will also receive email updates.',
    category: 'general',
    tags: ['ticket', 'support', 'tracking'],
  },
  {
    id: 'faq-010',
    question: 'How do I update my address?',
    answer:
      'Go to Profile → Addresses → Add or Edit Address. You can save multiple addresses and set a default for faster booking.',
    category: 'account',
    tags: ['address', 'profile', 'account'],
  },
];
