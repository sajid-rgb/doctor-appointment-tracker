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

export const SLOT_DURATION_MINUTES = 15;
export const MAX_PATIENTS_PER_SLOT = 1;

export const MORNING_SLOTS = [
  '09:00 AM',
  '09:15 AM',
  '09:30 AM',
  '09:45 AM',
  '10:00 AM',
  '10:15 AM',
  '10:30 AM',
  '10:45 AM',
  '11:00 AM',
  '11:15 AM',
  '11:30 AM',
  '11:45 AM',
  '12:00 PM',
  '12:15 PM',
  '12:30 PM',
  '12:45 PM',
  '01:00 PM',
  '01:15 PM',
  '01:30 PM',
  '01:45 PM',
  '02:00 PM',
  '02:15 PM',
  '02:30 PM',
  '02:45 PM',
];

export const EVENING_SLOTS_3PM_10PM = [
  '03:00 PM',
  '03:15 PM',
  '03:30 PM',
  '03:45 PM',
  '04:00 PM',
  '04:15 PM',
  '04:30 PM',
  '04:45 PM',
  '05:00 PM',
  '05:15 PM',
  '05:30 PM',
  '05:45 PM',
  '06:00 PM',
  '06:15 PM',
  '06:30 PM',
  '06:45 PM',
  '07:00 PM',
  '07:15 PM',
  '07:30 PM',
  '07:45 PM',
  '08:00 PM',
  '08:15 PM',
  '08:30 PM',
  '08:45 PM',
  '09:00 PM',
  '09:15 PM',
  '09:30 PM',
  '09:45 PM',
  '10:00 PM',
];

export const TIME_SLOTS = [
  ...MORNING_SLOTS,
  ...EVENING_SLOTS_3PM_10PM,
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
    slots: [
      '03:00 PM',
      '03:15 PM',
      '03:30 PM',
      '03:45 PM',
      '04:00 PM',
      '04:15 PM',
      '04:30 PM',
      '04:45 PM',
      '05:00 PM',
      '05:15 PM',
      '05:30 PM',
      '05:45 PM',
      '06:00 PM',
      '06:15 PM',
      '06:30 PM',
      '06:45 PM',
      '07:00 PM',
      '07:15 PM',
      '07:30 PM',
      '07:45 PM',
      '08:00 PM',
      '08:15 PM',
      '08:30 PM',
      '08:45 PM',
      '09:00 PM',
      '09:15 PM',
      '09:30 PM',
      '09:45 PM',
      '10:00 PM',
    ],
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

export function slotToMinutes(timeSlot: string): number {
  const match = timeSlot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();

  if (period === 'PM' && hour < 12) {
    hour += 12;
  } else if (period === 'AM' && hour === 12) {
    hour = 0;
  }

  return hour * 60 + minute;
}

export function sortTimeSlots(slots: string[]): string[] {
  return [...slots].sort((a, b) => slotToMinutes(a) - slotToMinutes(b));
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
  const slotMinutes = slotToMinutes(timeSlot);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return slotMinutes <= nowMinutes;
}

export function parseAppointmentDateTime(
  dateISO: string,
  timeSlot: string
): Date | null {
  const match = timeSlot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();

  if (period === 'PM' && hour < 12) {
    hour += 12;
  } else if (period === 'AM' && hour === 12) {
    hour = 0;
  }

  const parts = dateISO.split('-');
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const date = new Date(year, month, day, hour, minute, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getPatientReminderDate(
  dateISO: string,
  timeSlot: string,
  minutesBefore = 10
): Date | null {
  const appointmentDate = parseAppointmentDateTime(dateISO, timeSlot);
  if (!appointmentDate) return null;

  return new Date(appointmentDate.getTime() - minutesBefore * 60 * 1000);
}

export function normalizeTimeString(input: string): string | null {
  if (!input) return null;
  const clean = input.trim();
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  let period = match[3]?.toUpperCase();

  if (hour < 1 || hour > 12) return null;
  if (minute < 0 || minute > 59) return null;

  if (!period) {
    period = hour >= 8 && hour <= 11 ? 'AM' : 'PM';
  }

  const formattedHour = String(hour).padStart(2, '0');
  const formattedMinute = String(minute).padStart(2, '0');

  return `${formattedHour}:${formattedMinute} ${period}`;
}

export function generateTimeSlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number = 15
): string[] {
  if (intervalMinutes <= 0) return [];

  const startNormalized = normalizeTimeString(startTime) || startTime;
  const endNormalized = normalizeTimeString(endTime) || endTime;

  const startMinutes = slotToMinutes(startNormalized);
  const endMinutes = slotToMinutes(endNormalized);

  if (startMinutes >= endMinutes) {
    return [];
  }

  const result: string[] = [];
  for (let m = startMinutes; m <= endMinutes; m += intervalMinutes) {
    const hour24 = Math.floor(m / 60) % 24;
    const minute = m % 60;
    const period = hour24 >= 12 ? 'PM' : 'AM';
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;

    const formattedHour = String(hour12).padStart(2, '0');
    const formattedMinute = String(minute).padStart(2, '0');
    result.push(`${formattedHour}:${formattedMinute} ${period}`);
  }

  return result;
}

