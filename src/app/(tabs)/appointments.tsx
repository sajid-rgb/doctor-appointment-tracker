import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';

import {
  useAppointmentStore,
  type Appointment,
  type AppointmentStatus,
} from '../../store/appointmentStore';
import { DoctorAvatar } from '../../components/DoctorAvatar';
import { ApiSyncIndicator } from '../../components/ApiSyncIndicator';
import { useDoctorStore } from '../../store/doctorStore';
import { useNotificationStore } from '../../store/notificationStore';
import { sendWhatsAppNotification } from '../../utils/whatsapp';

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type StatusFilter = 'all' | AppointmentStatus;
type DateFilter = 'all' | 'today' | 'next7' | 'past' | 'custom';

const STATUS_OPTIONS: StatusFilter[] = [
  'all',
  'pending',
  'confirmed',
  'rejected',
  'completed',
  'cancelled',
];

const DATE_OPTIONS: { label: string; value: DateFilter }[] = [
  { label: 'All dates', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Next 7 days', value: 'next7' },
  { label: 'Past', value: 'past' },
];

const STATUS_COLORS: Record<
  AppointmentStatus,
  { background: string; text: string }
> = {
  pending: { background: '#FEF3C7', text: '#92400E' },
  confirmed: { background: '#D1FAE5', text: '#065F46' },
  rejected: { background: '#FEE2E2', text: '#991B1B' },
  completed: { background: '#DBEAFE', text: '#1D4ED8' },
  cancelled: { background: '#F1F5F9', text: '#475569' },
};

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseAppointmentDate(value: string): string | null {
  // Preferred format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00`);

    return Number.isNaN(parsed.getTime()) ? null : value;
  }

  // Compatibility with older dates such as "28 Oct"
  const match = value.match(/^(\d{1,2})\s+([a-zA-Z]{3,})$/);

  if (match) {
    const day = Number(match[1]);
    const monthText = match[2].slice(0, 3).toLowerCase();

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

    const month = months.indexOf(monthText);

    if (month < 0 || day < 1 || day > 31) {
      return null;
    }

    const now = new Date();
    let year = now.getFullYear();
    let parsed = new Date(year, month, day, 12);

    if (parsed.getMonth() !== month || parsed.getDate() !== day) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsed.setHours(0, 0, 0, 0);

    // Choose the nearest year for legacy date strings.
    const difference = parsed.getTime() - today.getTime();

    const oneYear = 365 * 24 * 60 * 60 * 1000;

    if (difference < -oneYear / 2) {
      year += 1;
      parsed = new Date(year, month, day, 12);
    } else if (difference > oneYear / 2) {
      year -= 1;
      parsed = new Date(year, month, day, 12);
    }

    return toISODate(parsed);
  }

  // Fallback for other parseable date strings.
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return toISODate(parsed);
}

function formatDate(value: string) {
  const iso = parseAppointmentDate(value);

  if (!iso) {
    return value;
  }

  const date = new Date(`${iso}T12:00:00`);

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const colors = STATUS_COLORS[status];

  return (
    <View style={[styles.statusBadge, { backgroundColor: colors.background }]}>
      <Text style={[styles.statusText, { color: colors.text }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

export default function PatientAppointmentsScreen() {
  const appointments = useAppointmentStore((state) => state.appointments);
  const isLoading = useAppointmentStore((state) => state.isLoading);
  const fetchAppointments = useAppointmentStore(
    (state) => state.fetchAppointments
  );
  const doctors = useDoctorStore((state) => state.doctors);
  const fetchDoctors = useDoctorStore((state) => state.fetchDoctors);

  const cancelAppointment = useAppointmentStore(
    (state) => state.cancelAppointment
  );

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAppointments();
    fetchDoctors();
  }, [fetchAppointments, fetchDoctors]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAppointments(), fetchDoctors()]);
    setRefreshing(false);
  };

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [calendarVisible, setCalendarVisible] = useState(false);

  const todayISO = toISODate(new Date());

  const nextWeekISO = toISODate(
    new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate() + 7
    )
  );

  const filteredAppointments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return appointments
      .filter((appointment) => {
        const matchesStatus =
          statusFilter === 'all' || appointment.status === statusFilter;

        const appointmentISO = parseAppointmentDate(appointment.date);

        let matchesDate = true;

        if (dateFilter === 'today') {
          matchesDate = appointmentISO === todayISO;
        } else if (dateFilter === 'next7') {
          matchesDate =
            !!appointmentISO &&
            appointmentISO >= todayISO &&
            appointmentISO <= nextWeekISO;
        } else if (dateFilter === 'past') {
          matchesDate = !!appointmentISO && appointmentISO < todayISO;
        } else if (dateFilter === 'custom') {
          matchesDate = !!selectedDate && appointmentISO === selectedDate;
        }

        const matchesSearch =
          !query ||
          appointment.doctorName?.toLowerCase().includes(query) ||
          appointment.specialty?.toLowerCase().includes(query) ||
          appointment.serialNumber?.toLowerCase().includes(query) ||
          appointment.date?.toLowerCase().includes(query) ||
          appointment.time?.toLowerCase().includes(query) ||
          appointment.condition?.toLowerCase().includes(query) ||
          appointment.additionalNotes?.toLowerCase().includes(query);

        return matchesStatus && matchesDate && matchesSearch;
      })
      .sort((a, b) => {
        const dateA = parseAppointmentDate(a.date) ?? '';
        const dateB = parseAppointmentDate(b.date) ?? '';

        return `${dateA} ${a.time}`.localeCompare(`${dateB} ${b.time}`);
      });
  }, [
    appointments,
    statusFilter,
    dateFilter,
    selectedDate,
    search,
    todayISO,
    nextWeekISO,
  ]);

  const handleCancel = (appointment: Appointment) => {
    Alert.alert(
      'Cancel appointment',
      `Are you sure you want to cancel your appointment with ${appointment.doctorName}?`,
      [
        {
          text: 'Keep appointment',
          style: 'cancel',
        },
        {
          text: 'Cancel appointment',
          style: 'destructive',
          onPress: () => {
            cancelAppointment(appointment.id);

            // Specifically notify the doctor of this appointment
            if (appointment.doctorId) {
              useNotificationStore.getState().addNotification({
                recipientId: appointment.doctorId,
                recipientRole: 'doctor',
                title: 'Appointment Cancelled 🚫',
                message: `Patient ${appointment.patientName || 'Patient'} cancelled consultation for ${appointment.date} at ${appointment.time}. Serial: ${appointment.serialNumber}.`,
                type: 'appointment_cancelled',
                appointmentId: appointment.id,
                doctorName: appointment.doctorName,
                patientName: appointment.patientName,
                date: appointment.date,
                time: appointment.time,
                serialNumber: appointment.serialNumber,
              });
            }

            // Specifically notify the patient of this appointment
            if (appointment.patientId) {
              useNotificationStore.getState().addNotification({
                recipientId: appointment.patientId,
                recipientRole: 'patient',
                title: 'Appointment Cancelled 🚫',
                message: `Your appointment with Dr. ${appointment.doctorName} on ${appointment.date} at ${appointment.time} (Serial: ${appointment.serialNumber}) was cancelled.`,
                type: 'appointment_cancelled',
                appointmentId: appointment.id,
                doctorName: appointment.doctorName,
                patientName: appointment.patientName,
                date: appointment.date,
                time: appointment.time,
                serialNumber: appointment.serialNumber,
              });
            }
          },
        },
      ]
    );
  };

  const renderAppointment = ({ item }: { item: Appointment }) => {
    const canCancel = item.status === 'pending' || item.status === 'confirmed';
    const doctor = doctors.find(
      (d) => d.id === item.doctorId || d.name === item.doctorName
    );

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <DoctorAvatar
            image={doctor?.image}
            name={item.doctorName}
            size={46}
            borderRadius={14}
          />

          <View style={styles.doctorInfo}>
            <View style={styles.doctorNameRow}>
              <Text style={styles.doctorName}>{item.doctorName}</Text>
              <View style={styles.serialBadge}>
                <Text style={styles.serialBadgeText}>
                  {item.serialNumber || 'SL-01'}
                </Text>
              </View>
            </View>
            <Text style={styles.specialty}>{item.specialty}</Text>
          </View>

          <StatusBadge status={item.status} />
        </View>

        {/* Patient vitals & blood group chips */}
        {(item.patientAge || item.bloodGroup || item.patientPhone) ? (
          <View style={styles.vitalsRow}>
            {item.patientAge ? (
              <View style={styles.vitalChip}>
                <Ionicons name="calendar-outline" size={12} color="#475569" />
                <Text style={styles.vitalChipText}>
                  {item.patientAge} yrs{item.patientGender ? ` • ${item.patientGender}` : ''}
                </Text>
              </View>
            ) : null}

            {item.bloodGroup ? (
              <View style={styles.bloodChip}>
                <Ionicons name="water" size={12} color="#DC2626" />
                <Text style={styles.bloodChipText}>{item.bloodGroup}</Text>
              </View>
            ) : null}

            {item.patientPhone ? (
              <View style={styles.vitalChip}>
                <Ionicons name="call-outline" size={12} color="#475569" />
                <Text style={styles.vitalChipText}>{item.patientPhone}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Medical details submitted */}
        {(item.condition || item.previousDocuments || (item.prescriptionFiles && item.prescriptionFiles.length > 0)) ? (
          <View style={styles.medicalBox}>
            <View style={styles.medicalHeader}>
              <Ionicons name="medkit-outline" size={14} color="#0F766E" />
              <Text style={styles.medicalTitle}>Submitted Medical Intake</Text>
            </View>

            {item.condition ? (
              <Text style={styles.medicalText}>
                <Text style={styles.medicalBold}>Condition: </Text>
                {item.condition}
              </Text>
            ) : null}

            {item.previousDocuments ? (
              <Text style={[styles.medicalText, { marginTop: 4 }]}>
                <Text style={styles.medicalBold}>Documents: </Text>
                {item.previousDocuments}
              </Text>
            ) : null}

            {item.prescriptionFiles && item.prescriptionFiles.length > 0 ? (
              <View style={{ marginTop: 6 }}>
                <Text style={styles.medicalBold}>
                  Attached Prescriptions ({item.prescriptionFiles.length}):
                </Text>
                <View style={styles.patientFilesList}>
                  {item.prescriptionFiles.map((f, i) => (
                    <TouchableOpacity
                      key={`${f.name}-${i}`}
                      activeOpacity={0.7}
                      onPress={() =>
                        Linking.openURL(f.uri).catch(() =>
                          Alert.alert('File', f.name)
                        )
                      }
                      style={styles.patientFileChip}
                    >
                      <Ionicons
                        name="document-attach-outline"
                        size={13}
                        color="#0F766E"
                      />
                      <Text style={styles.patientFileName} numberOfLines={1}>
                        {f.name}
                      </Text>
                      {f.size ? (
                        <Text style={styles.patientFileSize}>
                          {formatFileSize(f.size)}
                        </Text>
                      ) : null}
                      <Ionicons name="open-outline" size={11} color="#64748B" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={18} color="#64748B" />
          <Text style={styles.detailText}>{formatDate(item.date)}</Text>

          <Ionicons name="time-outline" size={18} color="#64748B" />
          <Text style={styles.detailText}>{item.time}</Text>
        </View>

        <View style={styles.bottomRow}>
          <View>
            <Text style={styles.feeLabel}>Consultation fee</Text>
            <Text style={styles.fee}>৳{item.fee}</Text>
          </View>

          <View style={styles.bottomActionsRow}>
            <TouchableOpacity
              style={styles.whatsappSlipButton}
              activeOpacity={0.8}
              onPress={() =>
                sendWhatsAppNotification({
                  phone: item.patientPhone,
                  serialNumber: item.serialNumber || 'SL-01',
                  patientName: item.patientName || 'Patient',
                  doctorName: item.doctorName,
                  specialty: item.specialty,
                  date: item.date,
                  time: item.time,
                  fee: item.fee,
                })
              }
            >
              <Ionicons name="logo-whatsapp" size={15} color="#15803D" />
              <Text style={styles.whatsappSlipText}>WhatsApp Slip</Text>
            </TouchableOpacity>

            {canCancel && (
              <Pressable
                accessibilityRole="button"
                onPress={() => handleCancel(item)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>My Appointments</Text>
        <Text style={styles.subtitle}>
          Track and manage your doctor visits.
        </Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#64748B" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search doctor, serial, date, specialty..."
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </Pressable>
        )}
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Status</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {STATUS_OPTIONS.map((status) => {
            const selected = statusFilter === status;

            return (
              <Pressable
                key={status}
                onPress={() => setStatusFilter(status)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  {status === 'all'
                    ? 'All'
                    : status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.filterLabel}>Date</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {DATE_OPTIONS.map((option) => {
            const selected = dateFilter === option.value;

            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setDateFilter(option.value);

                  if (option.value !== 'custom') {
                    setSelectedDate(null);
                    setCalendarVisible(false);
                  }
                }}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => {
              setDateFilter('custom');
              setCalendarVisible((visible) => !visible);
            }}
            style={[
              styles.chip,
              dateFilter === 'custom' && styles.chipSelected,
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={15}
              color={dateFilter === 'custom' ? '#FFFFFF' : '#475569'}
            />
            <Text
              style={[
                styles.chipText,
                dateFilter === 'custom' && styles.chipTextSelected,
              ]}
            >
              {selectedDate ?? 'Choose date'}
            </Text>
          </Pressable>
        </ScrollView>

        {calendarVisible && (
          <View style={styles.calendarContainer}>
            <Calendar
              onDayPress={(day: DateData) => {
                setSelectedDate(day.dateString);
                setDateFilter('custom');
                setCalendarVisible(false);
              }}
              markedDates={
                selectedDate
                  ? {
                      [selectedDate]: {
                        selected: true,
                        selectedColor: '#0F766E',
                      },
                    }
                  : {}
              }
              theme={{
                todayTextColor: '#0F766E',
                arrowColor: '#0F766E',
              }}
            />
          </View>
        )}
      </View>

      <ApiSyncIndicator
        isSyncing={isLoading && !refreshing}
        label="Syncing appointments..."
      />

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>Your visits</Text>
        <Text style={styles.resultsCount}>
          {filteredAppointments.length} found
        </Text>
      </View>

      <FlatList
        data={filteredAppointments}
        keyExtractor={(item) => item.id}
        renderItem={renderAppointment}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0F766E']} />
        }
        ListEmptyComponent={
          isLoading && filteredAppointments.length === 0 ? (
            <View style={[styles.emptyState, { paddingVertical: 40 }]}>
              <ActivityIndicator size="large" color="#0F766E" />
              <Text style={[styles.emptyTitle, { marginTop: 12 }]}>Loading visits...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={32} color="#0F766E" />
              </View>
              <Text style={styles.emptyTitle}>No appointments found</Text>
              <Text style={styles.emptyDescription}>
                Try changing your filters or book an appointment with a doctor.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    marginHorizontal: 20,
    height: 48,
    marginTop: 10,
    marginBottom: 8,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  filterSection: {
    paddingBottom: 12,
  },
  filterLabel: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 10,
    fontWeight: '700',
    color: '#334155',
  },
  chipRow: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
  },
  chipSelected: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  chipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  calendarContainer: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  resultsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  resultsCount: {
    color: '#64748B',
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  doctorIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  specialty: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailText: {
    color: '#475569',
    fontSize: 12,
    marginRight: 8,
  },
  bottomRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  fee: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F766E',
    marginTop: 3,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF7F7',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    minHeight: 250,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyDescription: {
    textAlign: 'center',
    color: '#64748B',
    lineHeight: 20,
    marginTop: 8,
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
  medicalBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  medicalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  medicalTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  medicalBold: {
    fontWeight: '700',
    color: '#1E293B',
    fontSize: 12,
  },
  medicalText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  doctorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  serialBadge: {
    backgroundColor: '#CCFBF1',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  serialBadgeText: {
    color: '#0F766E',
    fontWeight: '800',
    fontSize: 11,
  },
  patientFilesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
  },
  patientFileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: '100%',
  },
  patientFileName: {
    fontSize: 11,
    color: '#0F766E',
    fontWeight: '600',
    maxWidth: 130,
  },
  patientFileSize: {
    fontSize: 10,
    color: '#94A3B8',
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  whatsappSlipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  whatsappSlipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
});
