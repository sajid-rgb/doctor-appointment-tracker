import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DoctorAvatar } from '../../components/DoctorAvatar';
import { useAppointmentStore } from '../../store/appointmentStore';
import { useAuthStore } from '../../store/authStore';
import { useDoctorStore } from '../../store/doctorStore';

const TEAL = '#0F766E';

function parseDate(value: string): Date | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]) - 1;
    const day = Number(iso[3]);

    const date = new Date(year, month, day);

    // Reject invalid dates, such as 2026-02-31.
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  // Support legacy dates such as "5 Nov".
  const short = /^(\d{1,2})\s+([A-Za-z]+)$/.exec(value);

  if (short) {
    const months = [
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'jul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec',
    ];

    const month = months.indexOf(short[2].slice(0, 3).toLowerCase());
    const day = Number(short[1]);

    if (month < 0 || day < 1 || day > 31) {
      return null;
    }

    const today = new Date();
    const year = today.getFullYear();
    const date = new Date(year, month, day);

    if (date.getMonth() !== month || date.getDate() !== day) {
      return null;
    }

    // Handle legacy dates near a year boundary.
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    if (date.getTime() < todayStart.getTime() - 180 * 86400000) {
      date.setFullYear(year + 1);
    }

    return date;
  }

  return null;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function displayDate(value: string) {
  const date = parseDate(value);

  return date
    ? date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : value;
}

function getAppointmentTimestamp(date: string, time: string) {
  const parsedDate = parseDate(date);

  if (!parsedDate) {
    return Number.MAX_SAFE_INTEGER;
  }

  const timeMatch = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(time);

  if (timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const period = timeMatch[3]?.toUpperCase();

    if (period === 'PM' && hours < 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    parsedDate.setHours(hours, minutes, 0, 0);
  }

  return parsedDate.getTime();
}

export default function DoctorDashboard() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const appointments = useAppointmentStore((state) => state.appointments);
  const doctors = useDoctorStore((state) => state.doctors);
  const currentDoctor = doctors.find(
    (d) =>
      d.id === user?.id ||
      (user?.email && d.email.toLowerCase() === user.email.toLowerCase())
  );

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  // Only show appointments belonging to the logged-in doctor.
  // Pending and confirmed appointments are considered active.
  const doctorAppointments = useMemo(() => {
    if (!user?.id) {
      return [];
    }

    const doctorIds = new Set([user.id, currentDoctor?.id].filter(Boolean));

    return appointments
      .filter((item) => {
        const appointmentDate = parseDate(item.date);

        return (
          doctorIds.has(item.doctorId) &&
          (item.status === 'pending' || item.status === 'confirmed') &&
          appointmentDate !== null &&
          appointmentDate >= todayStart
        );
      })
      .sort(
        (a, b) =>
          getAppointmentTimestamp(a.date, a.time) -
          getAppointmentTimestamp(b.date, b.time)
      );
  }, [appointments, user?.id, currentDoctor?.id, todayStart.getTime()]);

  const todayAppointments = useMemo(
    () =>
      doctorAppointments.filter((item) => {
        const date = parseDate(item.date);

        return date ? isSameDay(date, today) : false;
      }),
    [doctorAppointments, today.getFullYear(), today.getMonth(), today.getDate()]
  );

  const completedAppointments = useMemo(
    () =>
      appointments.filter(
        (item) => item.doctorId === user?.id && item.status === 'completed'
      ),
    [appointments, user?.id]
  );

  const cancelledCount = useMemo(
    () =>
      appointments.filter(
        (item) => item.doctorId === user?.id && item.status === 'cancelled'
      ).length,
    [appointments, user?.id]
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>
            Welcome back{user?.name ? ',' : ''}
          </Text>

          <Text style={styles.title}>{user?.name || 'Doctor'}</Text>

          <Text style={styles.subtitle}>
            Here is your appointment overview.
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(doctor)/profile')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Open doctor profile"
        >
          <DoctorAvatar
            image={currentDoctor?.image || user?.image}
            name={user?.name}
            size={52}
            borderRadius={18}
          />
        </TouchableOpacity>
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: '#CCFBF1' }]}>
            <Ionicons name="calendar" size={21} color={TEAL} />
          </View>

          <Text style={styles.summaryNumber}>{todayAppointments.length}</Text>

          <Text style={styles.summaryLabel}>Today</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: '#DBEAFE' }]}>
            <Ionicons name="time" size={21} color="#2563EB" />
          </View>

          <Text style={styles.summaryNumber}>{doctorAppointments.length}</Text>

          <Text style={styles.summaryLabel}>Upcoming</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="close-circle" size={21} color="#DC2626" />
          </View>

          <Text style={styles.summaryNumber}>{cancelledCount}</Text>

          <Text style={styles.summaryLabel}>Cancelled</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="checkmark-circle" size={21} color="#059669" />
          </View>

          <Text style={styles.summaryNumber}>
            {completedAppointments.length}
          </Text>

          <Text style={styles.summaryLabel}>Completed</Text>
        </View>
      </View>

      {/* Today's appointments */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Today's Appointments</Text>

        <Text style={styles.sectionCount}>
          {todayAppointments.length} total
        </Text>
      </View>

      {todayAppointments.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={34} color={TEAL} />
          </View>

          <Text style={styles.emptyTitle}>No appointments today</Text>

          <Text style={styles.emptyText}>
            Appointments booked for today will appear here.
          </Text>
        </View>
      ) : (
        todayAppointments.map((appointment) => (
          <View key={appointment.id} style={styles.appointmentCard}>
            <View style={styles.patientRow}>
              <View style={styles.patientAvatar}>
                <Ionicons name="person" size={21} color={TEAL} />
              </View>

              <View style={styles.patientInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.patientName}>
                    {appointment.patientName || 'Patient'}
                  </Text>
                  <View style={styles.serialBadge}>
                    <Text style={styles.serialBadgeText}>
                      {appointment.serialNumber || 'SL-01'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.specialty}>{appointment.specialty}</Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  appointment.status === 'confirmed' && styles.confirmedBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    appointment.status === 'confirmed' && styles.confirmedText,
                  ]}
                >
                  {appointment.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                </Text>
              </View>
            </View>

            {/* Patient Demographic & Blood Group row */}
            {(appointment.patientAge || appointment.bloodGroup || appointment.patientPhone) ? (
              <View style={styles.vitalsRow}>
                {appointment.patientAge ? (
                  <View style={styles.vitalChip}>
                    <Ionicons name="calendar-outline" size={12} color="#475569" />
                    <Text style={styles.vitalChipText}>
                      {appointment.patientAge} yrs{appointment.patientGender ? ` • ${appointment.patientGender}` : ''}
                    </Text>
                  </View>
                ) : null}

                {appointment.bloodGroup ? (
                  <View style={styles.bloodChip}>
                    <Ionicons name="water" size={12} color="#DC2626" />
                    <Text style={styles.bloodChipText}>{appointment.bloodGroup}</Text>
                  </View>
                ) : null}

                {appointment.patientPhone ? (
                  <View style={styles.vitalChip}>
                    <Ionicons name="call-outline" size={12} color="#475569" />
                    <Text style={styles.vitalChipText}>{appointment.patientPhone}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Condition preview */}
            {appointment.condition ? (
              <View style={styles.conditionPreview}>
                <Ionicons name="medkit-outline" size={14} color="#0F766E" />
                <Text style={styles.conditionText} numberOfLines={2}>
                  <Text style={styles.conditionBold}>Condition: </Text>
                  {appointment.condition}
                </Text>
              </View>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.detailsRow}>
              <Ionicons name="calendar-outline" size={16} color="#64748B" />

              <Text style={styles.detailText}>
                {displayDate(appointment.date)}
              </Text>

              <Ionicons name="time-outline" size={16} color="#64748B" />

              <Text style={styles.detailText}>{appointment.time}</Text>
            </View>

            <Text style={styles.fee}>
              Consultation fee: ৳{appointment.fee.toLocaleString()}
            </Text>
          </View>
        ))
      )}

      {/* Upcoming schedule */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Upcoming Schedule</Text>
      </View>

      {doctorAppointments.length === 0 ? (
        <View style={styles.noUpcomingCard}>
          <Ionicons name="calendar-outline" size={24} color="#94A3B8" />

          <Text style={styles.noUpcoming}>No upcoming appointments.</Text>
        </View>
      ) : (
        doctorAppointments.slice(0, 5).map((appointment) => (
          <View key={appointment.id} style={styles.scheduleRow}>
            <View style={styles.scheduleDate}>
              <Ionicons name="calendar-outline" size={20} color={TEAL} />
            </View>

            <View style={styles.scheduleInfo}>
              <Text style={styles.scheduleName}>
                {appointment.patientName || 'Patient'}
              </Text>

              <Text style={styles.scheduleSpecialty}>
                {appointment.specialty}
              </Text>

              <Text style={styles.scheduleDateText}>
                {displayDate(appointment.date)} · {appointment.time}
              </Text>
            </View>

            <View
              style={[
                styles.smallStatusBadge,
                appointment.status === 'confirmed' && styles.confirmedBadge,
              ]}
            >
              <Text
                style={[
                  styles.smallStatusText,
                  appointment.status === 'confirmed' && styles.confirmedText,
                ]}
              >
                {appointment.status === 'confirmed' ? 'Confirmed' : 'Pending'}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  content: {
    padding: 20,
    paddingTop: 24,
    paddingBottom: 36,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },

  headerText: {
    flex: 1,
    paddingRight: 12,
  },

  greeting: {
    color: '#64748B',
    fontSize: 14,
  },

  title: {
    color: '#0F172A',
    fontSize: 23,
    fontWeight: '800',
    marginTop: 4,
  },

  subtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 6,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },

  summaryCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  summaryNumber: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0F172A',
  },

  summaryLabel: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4,
  },

  sectionTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '700',
  },

  sectionCount: {
    color: TEAL,
    fontSize: 13,
    fontWeight: '700',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 26,
  },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  emptyTitle: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },

  emptyText: {
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },

  appointmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  patientAvatar: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  patientInfo: {
    flex: 1,
    marginLeft: 11,
    marginRight: 8,
  },

  patientName: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
  },

  specialty: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },

  statusBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  statusText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '700',
  },

  confirmedBadge: {
    backgroundColor: '#D1FAE5',
  },

  confirmedText: {
    color: '#047857',
  },

  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },

  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },

  detailText: {
    color: '#475569',
    fontSize: 12,
    marginRight: 9,
  },

  fee: {
    color: TEAL,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 14,
  },

  noUpcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  noUpcoming: {
    flex: 1,
    color: '#64748B',
    fontSize: 13,
  },

  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  scheduleDate: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scheduleInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  scheduleName: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },

  scheduleSpecialty: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 3,
  },

  scheduleDateText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 5,
  },

  smallStatusBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  smallStatusText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: '700',
  },

  vitalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },

  vitalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  vitalChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },

  bloodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  bloodChipText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
  },

  conditionPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F0FDFA',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },

  conditionBold: {
    fontWeight: '700',
    color: '#0F766E',
    fontSize: 12,
  },

  conditionText: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
  },
  serialBadge: {
    backgroundColor: '#CCFBF1',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  serialBadgeText: {
    color: '#0F766E',
    fontWeight: '800',
    fontSize: 10,
  },
});
