// Comprehensive IANA timezone list grouped by region
// Includes major cities and common timezones (~75 options)

export interface TimezoneOption {
  value: string;  // IANA timezone identifier
  label: string;  // Human-readable label
  offset: string; // UTC offset for display
}

export const timezones: TimezoneOption[] = [
  // UTC / GMT
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: '+00:00' },
  { value: 'GMT', label: 'GMT (Greenwich Mean Time)', offset: '+00:00' },

  // North America
  { value: 'America/New_York', label: 'New York (Eastern)', offset: '-05:00' },
  { value: 'America/Chicago', label: 'Chicago (Central)', offset: '-06:00' },
  { value: 'America/Denver', label: 'Denver (Mountain)', offset: '-07:00' },
  { value: 'America/Phoenix', label: 'Phoenix (Arizona)', offset: '-07:00' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (Pacific)', offset: '-08:00' },
  { value: 'America/Anchorage', label: 'Anchorage (Alaska)', offset: '-09:00' },
  { value: 'Pacific/Honolulu', label: 'Honolulu (Hawaii)', offset: '-10:00' },
  { value: 'America/Toronto', label: 'Toronto (Eastern)', offset: '-05:00' },
  { value: 'America/Vancouver', label: 'Vancouver (Pacific)', offset: '-08:00' },
  { value: 'America/Mexico_City', label: 'Mexico City', offset: '-06:00' },

  // South America
  { value: 'America/Sao_Paulo', label: 'Sao Paulo (Brazil)', offset: '-03:00' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires', offset: '-03:00' },
  { value: 'America/Santiago', label: 'Santiago (Chile)', offset: '-04:00' },
  { value: 'America/Lima', label: 'Lima (Peru)', offset: '-05:00' },
  { value: 'America/Bogota', label: 'Bogota (Colombia)', offset: '-05:00' },
  { value: 'America/Caracas', label: 'Caracas (Venezuela)', offset: '-04:00' },

  // Europe
  { value: 'Europe/London', label: 'London (UK)', offset: '+00:00' },
  { value: 'Europe/Dublin', label: 'Dublin (Ireland)', offset: '+00:00' },
  { value: 'Europe/Lisbon', label: 'Lisbon (Portugal)', offset: '+00:00' },
  { value: 'Europe/Paris', label: 'Paris (France)', offset: '+01:00' },
  { value: 'Europe/Berlin', label: 'Berlin (Germany)', offset: '+01:00' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (Netherlands)', offset: '+01:00' },
  { value: 'Europe/Brussels', label: 'Brussels (Belgium)', offset: '+01:00' },
  { value: 'Europe/Rome', label: 'Rome (Italy)', offset: '+01:00' },
  { value: 'Europe/Madrid', label: 'Madrid (Spain)', offset: '+01:00' },
  { value: 'Europe/Vienna', label: 'Vienna (Austria)', offset: '+01:00' },
  { value: 'Europe/Warsaw', label: 'Warsaw (Poland)', offset: '+01:00' },
  { value: 'Europe/Prague', label: 'Prague (Czech Republic)', offset: '+01:00' },
  { value: 'Europe/Stockholm', label: 'Stockholm (Sweden)', offset: '+01:00' },
  { value: 'Europe/Oslo', label: 'Oslo (Norway)', offset: '+01:00' },
  { value: 'Europe/Copenhagen', label: 'Copenhagen (Denmark)', offset: '+01:00' },
  { value: 'Europe/Helsinki', label: 'Helsinki (Finland)', offset: '+02:00' },
  { value: 'Europe/Athens', label: 'Athens (Greece)', offset: '+02:00' },
  { value: 'Europe/Bucharest', label: 'Bucharest (Romania)', offset: '+02:00' },
  { value: 'Europe/Kiev', label: 'Kyiv (Ukraine)', offset: '+02:00' },
  { value: 'Europe/Moscow', label: 'Moscow (Russia)', offset: '+03:00' },
  { value: 'Europe/Istanbul', label: 'Istanbul (Turkey)', offset: '+03:00' },

  // Middle East & Caucasus
  { value: 'Asia/Dubai', label: 'Dubai (UAE)', offset: '+04:00' },
  { value: 'Asia/Riyadh', label: 'Riyadh (Saudi Arabia)', offset: '+03:00' },
  { value: 'Asia/Jerusalem', label: 'Jerusalem (Israel)', offset: '+02:00' },
  { value: 'Asia/Tehran', label: 'Tehran (Iran)', offset: '+03:30' },
  { value: 'Asia/Kuwait', label: 'Kuwait', offset: '+03:00' },
  { value: 'Asia/Qatar', label: 'Doha (Qatar)', offset: '+03:00' },
  { value: 'Asia/Yerevan', label: 'Yerevan (Armenia)', offset: '+04:00' },

  // Asia
  { value: 'Asia/Karachi', label: 'Karachi (Pakistan)', offset: '+05:00' },
  { value: 'Asia/Kolkata', label: 'Mumbai/Delhi (India)', offset: '+05:30' },
  { value: 'Asia/Dhaka', label: 'Dhaka (Bangladesh)', offset: '+06:00' },
  { value: 'Asia/Bangkok', label: 'Bangkok (Thailand)', offset: '+07:00' },
  { value: 'Asia/Jakarta', label: 'Jakarta (Indonesia)', offset: '+07:00' },
  { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh (Vietnam)', offset: '+07:00' },
  { value: 'Asia/Singapore', label: 'Singapore', offset: '+08:00' },
  { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur (Malaysia)', offset: '+08:00' },
  { value: 'Asia/Manila', label: 'Manila (Philippines)', offset: '+08:00' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong', offset: '+08:00' },
  { value: 'Asia/Shanghai', label: 'Shanghai (China)', offset: '+08:00' },
  { value: 'Asia/Taipei', label: 'Taipei (Taiwan)', offset: '+08:00' },
  { value: 'Asia/Seoul', label: 'Seoul (South Korea)', offset: '+09:00' },
  { value: 'Asia/Tokyo', label: 'Tokyo (Japan)', offset: '+09:00' },

  // Australia & Pacific
  { value: 'Australia/Perth', label: 'Perth (Western Australia)', offset: '+08:00' },
  { value: 'Australia/Darwin', label: 'Darwin (Northern Territory)', offset: '+09:30' },
  { value: 'Australia/Adelaide', label: 'Adelaide (South Australia)', offset: '+09:30' },
  { value: 'Australia/Brisbane', label: 'Brisbane (Queensland)', offset: '+10:00' },
  { value: 'Australia/Sydney', label: 'Sydney (NSW)', offset: '+10:00' },
  { value: 'Australia/Melbourne', label: 'Melbourne (Victoria)', offset: '+10:00' },
  { value: 'Pacific/Auckland', label: 'Auckland (New Zealand)', offset: '+12:00' },
  { value: 'Pacific/Fiji', label: 'Fiji', offset: '+12:00' },
  { value: 'Pacific/Guam', label: 'Guam', offset: '+10:00' },

  // Africa
  { value: 'Africa/Cairo', label: 'Cairo (Egypt)', offset: '+02:00' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (South Africa)', offset: '+02:00' },
  { value: 'Africa/Lagos', label: 'Lagos (Nigeria)', offset: '+01:00' },
  { value: 'Africa/Nairobi', label: 'Nairobi (Kenya)', offset: '+03:00' },
  { value: 'Africa/Casablanca', label: 'Casablanca (Morocco)', offset: '+01:00' },
];

// Group timezones by region for organized display
export const timezonesByRegion: Record<string, TimezoneOption[]> = {
  'UTC / GMT': timezones.filter(tz => tz.value === 'UTC' || tz.value === 'GMT'),
  'North America': timezones.filter(tz => tz.value.startsWith('America/') && ['New_York', 'Chicago', 'Denver', 'Phoenix', 'Los_Angeles', 'Anchorage', 'Toronto', 'Vancouver', 'Mexico_City'].some(city => tz.value.includes(city))),
  'South America': timezones.filter(tz => tz.value.startsWith('America/') && ['Sao_Paulo', 'Buenos_Aires', 'Santiago', 'Lima', 'Bogota', 'Caracas'].some(city => tz.value.includes(city))),
  'Europe': timezones.filter(tz => tz.value.startsWith('Europe/')),
  'Middle East & Caucasus': timezones.filter(tz => ['Asia/Dubai', 'Asia/Riyadh', 'Asia/Jerusalem', 'Asia/Tehran', 'Asia/Kuwait', 'Asia/Qatar', 'Asia/Yerevan'].includes(tz.value)),
  'Asia': timezones.filter(tz => tz.value.startsWith('Asia/') && !['Dubai', 'Riyadh', 'Jerusalem', 'Tehran', 'Kuwait', 'Qatar', 'Yerevan'].some(city => tz.value.includes(city))),
  'Australia & Pacific': timezones.filter(tz => tz.value.startsWith('Australia/') || tz.value.startsWith('Pacific/')),
  'Africa': timezones.filter(tz => tz.value.startsWith('Africa/')),
};

// Get timezone by value
export function getTimezone(value: string): TimezoneOption | undefined {
  return timezones.find(tz => tz.value === value);
}

// Get formatted label with offset
export function getTimezoneLabel(value: string): string {
  const tz = getTimezone(value);
  return tz ? `(UTC${tz.offset}) ${tz.label}` : value;
}
