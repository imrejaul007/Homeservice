import axios from 'axios';
import { getApiUrl } from '../lib/getApiUrl';
import authService from './AuthService';

const API_URL = getApiUrl();

export interface SupportFaq {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
}

export async function fetchSupportFaqs(params?: {
  category?: string;
  search?: string;
}): Promise<SupportFaq[]> {
  const response = await axios.get(`${API_URL}/support/faqs`, {
    params,
    timeout: 10000,
  });
  return response.data.data?.faqs || response.data.faqs || [];
}

export async function fetchMyTickets(status?: string) {
  const response = await authService.get<{
    success: boolean;
    data: { tickets: unknown[] };
  }>('/support/tickets', { params: status ? { status } : undefined });
  return response.data.tickets;
}
