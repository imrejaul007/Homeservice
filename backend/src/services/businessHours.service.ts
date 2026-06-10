import { SUPPORT_CONTACT } from '../constants/contactSupport';

export interface HolidaySchedule {
  date: string;
  name: string;
  closed: boolean;
  hours?: string;
}

export const SUPPORT_HOLIDAYS: HolidaySchedule[] = [
  { date: '2026-01-01', name: "New Year's Day", closed: true },
  { date: '2026-06-05', name: 'Eid al-Adha', closed: true },
  { date: '2026-06-06', name: 'Eid al-Adha', closed: true },
  { date: '2026-12-02', name: 'UAE National Day', closed: true },
  { date: '2026-12-03', name: 'UAE National Day', closed: true },
];

export const REGIONAL_PHONES: Record<string, { phone: string; label: string; hours: string }> = {
  AE: { phone: '+971 4 123 4567', label: 'Dubai, UAE', hours: 'Sun-Thu 9am-6pm GST' },
  IN: { phone: '+91 80 1234 5678', label: 'Bengaluru, India', hours: 'Mon-Sat 9am-7pm IST' },
  SA: { phone: '+966 11 234 5678', label: 'Riyadh, KSA', hours: 'Sun-Thu 9am-6pm AST' },
  DEFAULT: { phone: SUPPORT_CONTACT.phone, label: 'International', hours: 'Sun-Thu 9am-6pm GST' },
};

function getGstNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: SUPPORT_CONTACT.timezone }));
}

function getTodayHoliday(): HolidaySchedule | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return SUPPORT_HOLIDAYS.find((h) => h.date === today);
}

export const businessHoursService = {
  isOpen(): boolean {
    const holiday = getTodayHoliday();
    if (holiday?.closed) return false;

    const gst = getGstNow();
    const day = gst.getDay();
    const hour = gst.getHours();

    if (day === 5 || day === 6) return false;
    return hour >= 9 && hour < 18;
  },

  getStatus(): { isOpen: boolean; message: string; holiday?: string } {
    const holiday = getTodayHoliday();
    if (holiday) {
      return {
        isOpen: !holiday.closed,
        message: holiday.closed ? `Closed — ${holiday.name}` : `Modified hours — ${holiday.name}`,
        holiday: holiday.name,
      };
    }

    const isOpen = this.isOpen();
    return {
      isOpen,
      message: isOpen
        ? 'Open now — Sun-Thu 9am-6pm GST'
        : 'Closed — Sun-Thu 9am-6pm GST',
    };
  },

  resolveRegionalPhone(region?: string): { phone: string; label: string; hours: string } {
    if (!region) return REGIONAL_PHONES.DEFAULT;
    const key = region.toUpperCase().slice(0, 2);
    return REGIONAL_PHONES[key] || REGIONAL_PHONES.DEFAULT;
  },

  getHolidays(): HolidaySchedule[] {
    return SUPPORT_HOLIDAYS;
  },
};
