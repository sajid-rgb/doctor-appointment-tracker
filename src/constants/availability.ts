export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const TIME_SLOTS = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
  '06:00 PM',
  '07:00 PM',
];

export type DayAvailability = {
  day: string;
  enabled: boolean;
  slots: string[];
};

export type AvailabilitySettings = {
  acceptingAppointments: boolean;
  schedule: DayAvailability[];
};

export const DEFAULT_AVAILABILITY: AvailabilitySettings = {
  acceptingAppointments: true,
  schedule: DAYS_OF_WEEK.map((day) => ({
    day,
    enabled: !['Friday', 'Sunday'].includes(day),
    slots: ['10:00 AM', '11:00 AM', '03:00 PM', '04:00 PM'],
  })),
};

export const DOCTOR_AVAILABILITY_STORAGE_KEY = 'carepoint-doctor-availability';

export function getDoctorAvailabilityKey(doctorId?: string): string {
  return doctorId
    ? `carepoint-doctor-availability-${doctorId}`
    : DOCTOR_AVAILABILITY_STORAGE_KEY;
}

export function getWeekdayName(dateString: string): string {
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

export function isSlotInPast(dateISO: string, timeSlot: string): boolean {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayISO = `${year}-${month}-${day}`;

  if (dateISO < todayISO) {
    return true;
  }
  if (dateISO > todayISO) {
    return false;
  }

  // Same day: check if slot time has already passed
  const match = timeSlot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return false;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();

  if (period === 'PM' && hour < 12) {
    hour += 12;
  } else if (period === 'AM' && hour === 12) {
    hour = 0;
  }

  const slotDate = new Date();
  slotDate.setHours(hour, minute, 0, 0);

  return slotDate.getTime() <= now.getTime();
}

