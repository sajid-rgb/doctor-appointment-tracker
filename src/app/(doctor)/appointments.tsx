import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {
  Appointment,
  AppointmentStatus,
} from '../../store/appointmentStore';
import { useAppointmentStore } from '../../store/appointmentStore';
import { useAuthStore } from '../../store/authStore';
import { useDoctorStore } from '../../store/doctorStore';
import { useNotificationStore } from '../../store/notificationStore';
import { notifyPatientAppointmentStatus } from '../../utils/notifications';
import { sendWhatsAppNotification } from '../../utils/whatsapp';

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DoctorAppointmentsScreen() {
  const user = useAuthStore((state) => state.user);
  const appointments = useAppointmentStore((state) => state.appointments);
  const isLoading = useAppointmentStore((state) => state.isLoading);
  const fetchAppointments = useAppointmentStore(
    (state) => state.fetchAppointments
  );
  const updateStatus = useAppointmentStore(
    (state) => state.updateAppointmentStatus
  );
  const doctors = useDoctorStore((state) => state.doctors);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments();
    setRefreshing(false);
  };

  const currentDoctor = doctors.find(
    (d) =>
      d.id === user?.id ||
      (user?.email && d.email.toLowerCase() === user.email.toLowerCase())
  );

  const myAppointments = useMemo(() => {
    const doctorIds = new Set([user?.id, currentDoctor?.id].filter(Boolean));
    const query = search.trim().toLowerCase();

    return appointments
      .filter((appointment) => {
        const matchesDoctor = doctorIds.has(appointment.doctorId);
        if (!matchesDoctor) return false;

        if (!query) return true;

        return (
          appointment.patientName?.toLowerCase().includes(query) ||
          appointment.serialNumber?.toLowerCase().includes(query) ||
          appointment.patientPhone?.toLowerCase().includes(query) ||
          appointment.date?.toLowerCase().includes(query) ||
          appointment.time?.toLowerCase().includes(query) ||
          appointment.status?.toLowerCase().includes(query) ||
          appointment.bloodGroup?.toLowerCase().includes(query) ||
          appointment.condition?.toLowerCase().includes(query) ||
          appointment.additionalNotes?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) =>
        `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
      );
  }, [appointments, user?.id, currentDoctor?.id, search]);

  const notifyViaWhatsApp = (appointment: Appointment) => {
    sendWhatsAppNotification({
      phone: appointment.patientPhone,
      serialNumber: appointment.serialNumber,
      patientName: appointment.patientName || 'Patient',
      doctorName: appointment.doctorName,
      specialty: appointment.specialty,
      date: appointment.date,
      time: appointment.time,
      fee: appointment.fee,
    });
  };

  const changeStatus = (
    appointment: Appointment,
    status: AppointmentStatus
  ) => {
    const labels: Record<string, string> = {
      confirmed: `Confirm appointment for Serial ${appointment.serialNumber}?`,
      rejected: 'Reject this appointment?',
      completed: 'Mark this appointment as completed?',
    };

    Alert.alert('Update appointment', labels[status] ?? 'Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () => {
          updateStatus(appointment.id, status);

          // Notify the patient after confirmation or status update from doctor
          notifyPatientAppointmentStatus(appointment, status).catch((err) => {
            console.warn('Failed to notify patient of status change:', err);
          });

          if (status === 'confirmed') {
            Alert.alert(
              'Appointment Confirmed!',
              `Appointment for ${appointment.patientName || 'Patient'} is confirmed with Serial ${appointment.serialNumber}.\n\nSend WhatsApp confirmation slip now?`,
              [
                { text: 'Later', style: 'cancel' },
                {
                  text: 'Send WhatsApp',
                  onPress: () => notifyViaWhatsApp(appointment),
                },
              ]
            );
          }
        },
      },
    ]);
  };

  if (!user || user.role !== 'doctor') {
    return (
      <View style={styles.center}>
        <Text>Doctor access required.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={myAppointments}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0F766E']} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Appointments</Text>
          <Text style={styles.subtitle}>
            Review patient bookings and their medical intake records.
          </Text>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color="#64748B" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search patient, serial, phone, date..."
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
        </View>
      }
      ListEmptyComponent={
        isLoading && myAppointments.length === 0 ? (
          <View style={[styles.empty, { paddingVertical: 40 }]}>
            <ActivityIndicator size="large" color="#0F766E" />
            <Text style={[styles.emptyTitle, { marginTop: 12 }]}>Loading appointments...</Text>
          </View>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={42} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No appointments yet</Text>
            <Text style={styles.subtitle}>
              Patient bookings for this doctor will appear here.
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color="#0F766E" />
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.patientNameRow}>
                <Text style={styles.patient}>
                  {item.patientName || 'Patient Appointment'}
                </Text>
                <View style={styles.serialBadge}>
                  <Text style={styles.serialBadgeText}>
                    {item.serialNumber || 'SL-01'}
                  </Text>
                </View>
              </View>
              <Text style={styles.specialty}>{item.specialty}</Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                item.status === 'confirmed' && styles.confirmedBadge,
                item.status === 'completed' && styles.completedBadge,
                item.status === 'rejected' && styles.rejectedBadge,
                item.status === 'cancelled' && styles.cancelledBadge,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  item.status === 'confirmed' && styles.confirmedText,
                  item.status === 'completed' && styles.completedText,
                  item.status === 'rejected' && styles.rejectedText,
                  item.status === 'cancelled' && styles.cancelledText,
                ]}
              >
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Patient Quick Vitals / Demographic Chips */}
          <View style={styles.vitalsRow}>
            {item.patientAge ? (
              <View style={styles.vitalChip}>
                <Ionicons name="calendar-outline" size={13} color="#475569" />
                <Text style={styles.vitalChipText}>
                  {item.patientAge} yrs
                  {item.patientGender ? ` • ${item.patientGender}` : ''}
                </Text>
              </View>
            ) : null}

            {item.bloodGroup ? (
              <View style={styles.bloodChip}>
                <Ionicons name="water" size={13} color="#DC2626" />
                <Text style={styles.bloodChipText}>{item.bloodGroup}</Text>
              </View>
            ) : null}

            {item.patientPhone ? (
              <View style={styles.vitalChip}>
                <Ionicons name="call-outline" size={13} color="#475569" />
                <Text style={styles.vitalChipText}>{item.patientPhone}</Text>
              </View>
            ) : null}
          </View>

          {/* Patient Medical Details Box */}
          <View style={styles.medicalBox}>
            <View style={styles.medicalHeader}>
              <Ionicons name="medkit-outline" size={15} color="#0F766E" />
              <Text style={styles.medicalTitle}>Patient Intake Details</Text>
            </View>

            <View style={styles.intakeField}>
              <Text style={styles.intakeLabel}>Condition / Symptoms:</Text>
              <Text style={styles.intakeValue}>
                {item.condition || 'Not specified by patient'}
              </Text>
            </View>

            {item.previousDocuments ? (
              <View style={styles.intakeField}>
                <Text style={styles.intakeLabel}>
                  Medical History & Notes:
                </Text>
                <Text style={styles.intakeValue}>{item.previousDocuments}</Text>
              </View>
            ) : null}

            {/* Attached Prescription Documents */}
            {item.prescriptionFiles && item.prescriptionFiles.length > 0 ? (
              <View style={styles.intakeField}>
                <Text style={styles.intakeLabel}>
                  Attached Prescriptions ({item.prescriptionFiles.length}):
                </Text>
                <View style={styles.fileChipsRow}>
                  {item.prescriptionFiles.map((file, idx) => (
                    <TouchableOpacity
                      key={`${file.name}-${idx}`}
                      activeOpacity={0.7}
                      onPress={() =>
                        Linking.openURL(file.uri).catch(() =>
                          Alert.alert('Preview', `File: ${file.name}\n${file.uri}`)
                        )
                      }
                      style={styles.fileChip}
                    >
                      <Ionicons
                        name="document-attach-outline"
                        size={14}
                        color="#0F766E"
                      />
                      <Text style={styles.fileChipText} numberOfLines={1}>
                        {file.name}
                      </Text>
                      {file.size ? (
                        <Text style={styles.fileChipSize}>
                          {formatFileSize(file.size)}
                        </Text>
                      ) : null}
                      <Ionicons name="open-outline" size={12} color="#0F766E" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            {item.additionalNotes ? (
              <View style={styles.intakeField}>
                <Text style={styles.intakeLabel}>Allergies / Notes:</Text>
                <Text style={styles.intakeValue}>{item.additionalNotes}</Text>
              </View>
            ) : null}
          </View>

          {/* Schedule & Fee Details */}
          <View style={styles.scheduleRow}>
            <View style={styles.scheduleItem}>
              <Ionicons name="calendar-outline" size={15} color="#64748B" />
              <Text style={styles.scheduleText}>{item.date}</Text>
            </View>

            <View style={styles.scheduleItem}>
              <Ionicons name="time-outline" size={15} color="#64748B" />
              <Text style={styles.scheduleText}>{item.time}</Text>
            </View>

            <View style={styles.scheduleItem}>
              <Text style={styles.feeText}>৳{item.fee}</Text>
            </View>
          </View>

          {/* Direct WhatsApp Confirmation Button */}
          <TouchableOpacity
            style={styles.whatsappSlipButton}
            activeOpacity={0.8}
            onPress={() => notifyViaWhatsApp(item)}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#15803D" />
            <Text style={styles.whatsappSlipText}>
              Send WhatsApp Slip (Serial: {item.serialNumber})
            </Text>
          </TouchableOpacity>

          {item.status === 'pending' && (
            <View style={styles.actions}>
              <Pressable
                style={[styles.button, styles.confirmButton]}
                onPress={() => changeStatus(item, 'confirmed')}
              >
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                <Text style={styles.buttonText}>Confirm</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.rejectButton]}
                onPress={() => changeStatus(item, 'rejected')}
              >
                <Ionicons name="close-circle" size={16} color="#FFFFFF" />
                <Text style={styles.buttonText}>Reject</Text>
              </Pressable>
            </View>
          )}

          {item.status === 'confirmed' && (
            <Pressable
              style={[styles.button, styles.completeButton]}
              onPress={() => changeStatus(item, 'completed')}
            >
              <Ionicons name="checkmark-done" size={17} color="#FFFFFF" />
              <Text style={styles.buttonText}>Mark as Completed</Text>
            </Pressable>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  list: { padding: 20, paddingBottom: 32, flexGrow: 1 },
  header: { marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#0F172A' },
  subtitle: { color: '#64748B', marginTop: 6, lineHeight: 20 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 48,
    marginTop: 14,
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  patient: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  specialty: { color: '#64748B', marginTop: 2, fontSize: 13 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FEF3C7',
  },
  confirmedBadge: { backgroundColor: '#DCFCE7' },
  completedBadge: { backgroundColor: '#DBEAFE' },
  rejectedBadge: { backgroundColor: '#FEE2E2' },
  cancelledBadge: { backgroundColor: '#F1F5F9' },
  statusText: { fontSize: 11, fontWeight: '800', color: '#92400E' },
  confirmedText: { color: '#166534' },
  completedText: { color: '#1E40AF' },
  rejectedText: { color: '#991B1B' },
  cancelledText: { color: '#475569' },
  vitalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  vitalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  vitalChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  bloodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bloodChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  medicalBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
  },
  medicalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  medicalTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F766E',
    textTransform: 'uppercase',
  },
  intakeField: {
    marginTop: 6,
  },
  intakeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  intakeValue: {
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 18,
    marginTop: 2,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  scheduleText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  feeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F766E',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  button: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  confirmButton: { flex: 1, backgroundColor: '#0F766E' },
  rejectButton: { flex: 1, backgroundColor: '#DC2626' },
  completeButton: { backgroundColor: '#2563EB' },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  empty: {
    flex: 1,
    minHeight: 220,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  patientNameRow: {
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
  fileChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: '100%',
  },
  fileChipText: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: '600',
    maxWidth: 160,
  },
  fileChipSize: {
    fontSize: 10,
    color: '#64748B',
  },
  whatsappSlipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  whatsappSlipText: {
    color: '#15803D',
    fontWeight: '700',
    fontSize: 12,
  },
});
