/**
 * ICS Calendar Utility Functions
 * Generates and parses iCalendar (ICS) format for calendar sync
 */

// Escape special characters for ICS format
const escapeIcsText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
};

// Format date to ICS format (YYYYMMDDTHHmmssZ)
const formatIcsDate = (date: Date): string => {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

// Generate unique UID for ICS events
const generateUid = (prefix: string, id: string): string => {
  return `${prefix}-${id}@nilin.app`;
};

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  allDay?: boolean;
  recurrence?: string;
  attendees?: string[];
  organizer?: string;
  categories?: string[];
}

export interface IcsCalendar {
  prodId: string;
  events: IcsEvent[];
  timezone?: string;
}

/**
 * Generate ICS string from calendar data
 */
export const generateIcs = (calendar: IcsCalendar): string => {
  const lines: string[] = [];

  // Start calendar
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push(`PRODID:${calendar.prodId}`);
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');

  if (calendar.timezone) {
    lines.push(`X-WR-TIMEZONE:${calendar.timezone}`);
  }

  // Add events
  for (const event of calendar.events) {
    lines.push('BEGIN:VEVENT');

    // UID - use provided or generate
    lines.push(`UID:${event.uid || generateUid('evt', Date.now().toString())}`);

    // Timestamps
    const dtstamp = formatIcsDate(new Date());
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${event.allDay ? event.startDate.toISOString().split('T')[0].replace(/-/g, '') : formatIcsDate(event.startDate)}`);

    if (event.endDate) {
      lines.push(`DTEND:${event.allDay ? event.endDate.toISOString().split('T')[0].replace(/-/g, '') : formatIcsDate(event.endDate)}`);
    }

    // Summary (required)
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);

    // Optional fields
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }

    if (event.location) {
      lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    }

    if (event.recurrence) {
      lines.push(`RRULE:${event.recurrence}`);
    }

    if (event.organizer) {
      lines.push(`ORGANIZER:mailto:${event.organizer}`);
    }

    if (event.attendees && event.attendees.length > 0) {
      for (const attendee of event.attendees) {
        lines.push(`ATTENDEE:mailto:${attendee}`);
      }
    }

    if (event.categories && event.categories.length > 0) {
      lines.push(`CATEGORIES:${event.categories.join(',')}`);
    }

    lines.push('END:VEVENT');
  }

  // End calendar
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
};

/**
 * Parse ICS string into calendar data
 */
export const parseIcs = (icsString: string): IcsCalendar => {
  const lines = icsString.split(/\r?\n/);
  const events: IcsEvent[] = [];
  let currentEvent: Partial<IcsEvent> | null = null;
  let prodId = '-//Nilin//Service//EN';
  let timezone: string | undefined;

  for (const line of lines) {
    // Handle line folding (lines starting with space/tab are continuations)
    const unfoldedLine = line.replace(/\r?\n[ \t]/g, '');

    if (unfoldedLine === 'BEGIN:VCALENDAR') {
      continue;
    }

    if (unfoldedLine === 'END:VCALENDAR') {
      break;
    }

    if (unfoldedLine === 'BEGIN:VEVENT') {
      currentEvent = {};
      continue;
    }

    if (unfoldedLine === 'END:VEVENT') {
      if (currentEvent && currentEvent.startDate) {
        events.push(currentEvent as IcsEvent);
      }
      currentEvent = null;
      continue;
    }

    // Parse properties
    const colonIndex = unfoldedLine.indexOf(':');
    if (colonIndex === -1) continue;

    const property = unfoldedLine.substring(0, colonIndex);
    const value = unfoldedLine.substring(colonIndex + 1);

    // Parse property parameters (like ATTENDEE;CN="Name":email@example.com)
    const propertyParts = property.split(';');
    const propertyName = propertyParts[0];
    const params: Record<string, string> = {};
    for (let i = 1; i < propertyParts.length; i++) {
      const [key, val] = propertyParts[i].split('=');
      if (key && val) params[key.toLowerCase()] = val;
    }

    // Unescape ICS text
    const unescapedValue = value
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');

    switch (propertyName) {
      case 'PRODID':
        prodId = unescapedValue;
        break;
      case 'X-WR-TIMEZONE':
        timezone = unescapedValue;
        break;
      case 'UID':
        if (currentEvent) currentEvent.uid = unescapedValue;
        break;
      case 'SUMMARY':
        if (currentEvent) currentEvent.summary = unescapedValue;
        break;
      case 'DESCRIPTION':
        if (currentEvent) currentEvent.description = unescapedValue;
        break;
      case 'LOCATION':
        if (currentEvent) currentEvent.location = unescapedValue;
        break;
      case 'DTSTART':
        if (currentEvent) {
          // Check if it's an all-day event (DATE format without time)
          if (property.includes('VALUE=DATE') || !value.includes('T')) {
            currentEvent.allDay = true;
            currentEvent.startDate = new Date(`${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`);
          } else {
            currentEvent.startDate = parseIcsDateTime(value);
          }
        }
        break;
      case 'DTEND':
        if (currentEvent) {
          if (property.includes('VALUE=DATE') || !value.includes('T')) {
            currentEvent.endDate = new Date(`${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`);
          } else {
            currentEvent.endDate = parseIcsDateTime(value);
          }
        }
        break;
      case 'RRULE':
        if (currentEvent) currentEvent.recurrence = unescapedValue;
        break;
      case 'ATTENDEE':
        if (currentEvent) {
          const email = unescapedValue.replace('mailto:', '');
          if (!currentEvent.attendees) currentEvent.attendees = [];
          currentEvent.attendees.push(email);
        }
        break;
      case 'ORGANIZER':
        if (currentEvent) {
          currentEvent.organizer = unescapedValue.replace('mailto:', '');
        }
        break;
      case 'CATEGORIES':
        if (currentEvent) {
          currentEvent.categories = unescapedValue.split(',').map(c => c.trim());
        }
        break;
    }
  }

  return { prodId, events, timezone };
};

// Parse ICS datetime format to Date object
const parseIcsDateTime = (value: string): Date => {
  // Handle UTC format: 20240627T143000Z
  if (value.endsWith('Z')) {
    return new Date(value);
  }
  // Handle local format without timezone: 20240627T143000
  // Add T to make it parseable
  return new Date(value);
};

/**
 * Create ICS event for a booking
 */
export const createBookingEvent = (booking: {
  _id: string;
  serviceName: string;
  customerName?: string;
  scheduledDate: Date | string;
  scheduledTime: string;
  estimatedEndTime?: string;
  location?: string;
}): IcsEvent => {
  const startDate = new Date(booking.scheduledDate);
  const [hours, minutes] = booking.scheduledTime.split(':').map(Number);
  startDate.setHours(hours, minutes, 0, 0);

  const endDate = new Date(startDate);
  if (booking.estimatedEndTime) {
    const [endHours, endMinutes] = booking.estimatedEndTime.split(':').map(Number);
    endDate.setHours(endHours, endMinutes, 0, 0);
  } else {
    endDate.setHours(endDate.getHours() + 1);
  }

  return {
    uid: generateUid('booking', booking._id.toString()),
    summary: `${booking.serviceName}${booking.customerName ? ` with ${booking.customerName}` : ''}`,
    description: `Booking ID: ${booking._id}`,
    startDate,
    endDate,
    location: booking.location,
    categories: ['booking', 'nilin'],
  };
};

/**
 * Create ICS event for provider availability
 */
export const createAvailabilityEvent = (availability: {
  providerId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  label?: string;
}): IcsEvent => {
  const [startHour, startMin] = availability.startTime.split(':').map(Number);
  const [endHour, endMin] = availability.endTime.split(':').map(Number);

  const today = new Date();
  const dayOffset = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    .indexOf(availability.dayOfWeek.toLowerCase()) - today.getDay();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + dayOffset);
  targetDate.setHours(startHour, startMin, 0, 0);

  const endDate = new Date(targetDate);
  endDate.setHours(endHour, endMin, 0, 0);

  return {
    uid: generateUid('avail', `${availability.providerId}-${availability.dayOfWeek}`),
    summary: availability.label || 'Available',
    description: `Provider availability on ${availability.dayOfWeek}`,
    startDate: targetDate,
    endDate,
    recurrence: `FREQ=WEEKLY;BYDAY=${availability.dayOfWeek.substring(0, 2).toUpperCase()}`,
    categories: ['availability', 'nilin'],
  };
};
