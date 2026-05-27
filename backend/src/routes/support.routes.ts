import { Router } from 'express';
const router = Router();

const faqs = [
  { id: '1', category: 'booking', question: 'How do I cancel?', answer: 'Go to My Bookings...' },
  { id: '2', category: 'payment', question: 'Refund timeline?', answer: '5-7 business days.' },
];

router.get('/faqs', (req, res) => {
  res.json({ faqs });
});

router.post('/tickets', (req, res) => {
  const { userId, category, subject, description } = req.body;
  // Create ticket
  res.json({ success: true, ticketId: Date.now().toString() });
});

router.get('/tickets/:userId', (req, res) => {
  res.json({ tickets: [] });
});

export default router;
