import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Appointment,
  AppointmentStatus,
  generateUniqueSerialNumber,
  isSerialNumberTaken,
  useAppointmentStore,
} from '../../store/appointmentStore';
import { notifyPatientAppointmentStatus } from '../../utils/notifications';
import { sendWhatsAppNotification } from '../../utils/whatsapp';

type Filter = 'all' | AppointmentStatus;

const FILTERS: Filter[] = [
  'all',
  'pending',
  'confirmed',
  'completed',
  'rejected',
  'cancelled',
];

const STATUS_ACTIONS: {
  label: string;
  status: AppointmentStatus;
}[] = [
  { label: 'Confirm', status: 'confirmed' },
  { label: 'Complete', status: 'completed' },
  { label: 'Reject', status: 'rejected' },
];

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminAppointmentsScreen() {
  const router = useRouter();
  const appointments = useAppointmentStore((state) => state.appointments);
  const updateStatus = useAppointmentStore(
    (state) => state.updateAppointmentStatus
  );
  const updateAppointmentSerial = useAppointmentStore(
    (state) => state.updateAppointmentSerial
  );
  const deleteAppointment = useAppointmentStore(
    (state) => state.deleteAppointment
  );

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  // Serial Management Modal State
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const [serialInput, setSerialInput] = useState('');
  const [serialError, setSerialError] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return appointments.filter((item) => {
      const matchesStatus = filter === 'all' || item.status === filter;
      if (!matchesStatus) return false;

      if (!query) return true;

      return (
        item.patientName?.toLowerCase().includes(query) ||
        item.doctorName?.toLowerCase().includes(query) ||
        item.serialNumber?.toLowerCase().includes(query) ||
        item.patientPhone?.toLowerCase().includes(query) ||
        item.specialty?.toLowerCase().includes(query) ||
        item.date?.toLowerCase().includes(query) ||
        item.time?.toLowerCase().includes(query) ||
        item.bloodGroup?.toLowerCase().includes(query) ||
        item.condition?.toLowerCase().includes(query) ||
        item.additionalNotes?.toLowerCase().includes(query)
      );
    });
  }, [appointments, filter, search]);

  const notifyViaWhatsApp = (appointment: Appointment) => {
    sendWhatsAppNotification({
      phone: appointment.patientPhone,
      serialNumber: appointment.serialNumber || 'SL-01',
      patientName: appointment.patientName || 'Patient',
      doctorName: appointment.doctorName,
      specialty: appointment.specialty,
      date: appointment.date,
      time: appointment.time,
      fee: appointment.fee,
    });
  };

  const changeStatus = (appointment: Appointment, status: AppointmentStatus) => {
    Alert.alert(
      'Update appointment',
      `Change appointment for ${appointment.patientName || 'Patient'} to ${status}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            updateStatus(appointment.id, status);

            // Notify the patient after confirmation or status update
            notifyPatientAppointmentStatus(appointment, status).catch((err) => {
              console.warn('Failed to notify patient of status change:', err);
            });

            if (status === 'confirmed') {
              Alert.alert(
                'Appointment Confirmed',
                `Serial ${appointment.serialNumber || 'SL-01'} confirmed. Send WhatsApp slip to patient?`,
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
      ]
    );
  };

  const handleDeleteAppointment = (appointment: Appointment) => {
    Alert.alert(
      'Delete Appointment',
      `Are you sure you want to permanently delete the appointment for "${appointment.patientName || 'Patient'}" with ${appointment.doctorName} (Serial: ${appointment.serialNumber || 'SL-01'})? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAppointment(appointment.id);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete appointment');
            }
          },
        },
      ]
    );
  };

  const handleOpenSerialManager = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setSerialInput(appointment.serialNumber || '');
    setSerialError('');
  };

  const handleAutoAssignSerial = () => {
    if (!editingAppointment) return;
    const autoSerial = generateUniqueSerialNumber(
      editingAppointment.doctorId,
      editingAppointment.date,
      appointments
    );
    setSerialInput(autoSerial);
    setSerialError('');
  };

  const handleSaveSerial = () => {
    if (!editingAppointment) return;

    const trimmed = serialInput.trim().toUpperCase();
    if (!trimmed) {
      setSerialError('Serial number cannot be blank.');
      return;
    }

    const taken = isSerialNumberTaken(
      trimmed,
      editingAppointment.id,
      editingAppointment.doctorId,
      editingAppointment.date,
      appointments
    );

    if (taken) {
      setSerialError(
        `Serial "${trimmed}" is already assigned to another patient on ${editingAppointment.date} for this doctor. Please assign a non-overlapping serial.`
      );
      return;
    }

    updateAppointmentSerial(editingAppointment.id, trimmed);
    setEditingAppointment(null);
    Alert.alert(
      'Serial Updated',
      `Appointment serial number updated to ${trimmed}.`
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/dashboard')}
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </Pressable>

        <View style={styles.headerInfo}>
          <Text style={styles.title}>Appointments</Text>
          <Text style={styles.subtitle}>
            Manage patient bookings, unique serials, and documents
          </Text>
        </View>
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryNumber}>{appointments.length}</Text>
        <Text style={styles.summaryLabel}>Total appointments</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#64748B" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search patient, doctor, serial, phone..."
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

      {/* Visible Horizontal Filter Chips Bar */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((item) => {
            const isSelected = filter === item;
            const count =
              item === 'all'
                ? appointments.length
                : appointments.filter((a) => a.status === item).length;

            return (
              <Pressable
                key={item}
                onPress={() => setFilter(item)}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextSelected,
                  ]}
                >
                  {item === 'all'
                    ? 'All'
                    : item.charAt(0).toUpperCase() + item.slice(1)}
                </Text>
                <View
                  style={[
                    styles.filterCountBadge,
                    isSelected && styles.filterCountBadgeSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterCountText,
                      isSelected && styles.filterCountTextSelected,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {/* Header: Doctor Info & Status Badge */}
            <View style={styles.cardHeader}>
              <View style={styles.iconBox}>
                <Ionicons name="calendar-outline" size={22} color="#0F766E" />
              </View>
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.doctorName}>{item.doctorName}</Text>
                <Text style={styles.specialty}>{item.specialty}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  item.status === 'confirmed' && styles.confirmed,
                  item.status === 'completed' && styles.completed,
                  item.status === 'rejected' && styles.rejected,
                  item.status === 'cancelled' && styles.cancelled,
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

            {/* Serial Number & Manage Serial Action */}
            <View style={styles.serialManagerRow}>
              <View style={styles.serialBadge}>
                <Ionicons name="receipt-outline" size={13} color="#0F766E" />
                <Text style={styles.serialBadgeText}>
                  Serial: {item.serialNumber || 'SL-01'}
                </Text>
              </View>

              <View style={styles.serialActionsGroup}>
                <TouchableOpacity
                  style={styles.manageSerialButton}
                  activeOpacity={0.7}
                  onPress={() => handleOpenSerialManager(item)}
                >
                  <Ionicons name="create-outline" size={14} color="#0F766E" />
                  <Text style={styles.manageSerialText}>Manage Serial</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteAppointmentButton}
                  activeOpacity={0.7}
                  onPress={() => handleDeleteAppointment(item)}
                >
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  <Text style={styles.deleteAppointmentText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Patient Name Banner */}
            <View style={styles.patientBanner}>
              <Ionicons name="person-circle-outline" size={18} color="#0F766E" />
              <Text style={styles.patientBannerText}>
                {item.patientName || 'Patient'}
              </Text>
            </View>

            {/* Patient Vitals & Demographics Chips */}
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

            {/* Schedule & Fee Chips */}
            <View style={styles.scheduleRow}>
              <View style={styles.scheduleChip}>
                <Ionicons name="calendar-outline" size={13} color="#0F766E" />
                <Text style={styles.scheduleText}>{item.date}</Text>
              </View>
              <View style={styles.scheduleChip}>
                <Ionicons name="time-outline" size={13} color="#0F766E" />
                <Text style={styles.scheduleText}>{item.time}</Text>
              </View>
              <View style={styles.feeChip}>
                <Text style={styles.feeChipText}>৳{item.fee}</Text>
              </View>
            </View>

            {/* Medical Intake Details Box */}
            {(item.condition || item.previousDocuments || (item.prescriptionFiles && item.prescriptionFiles.length > 0)) ? (
              <View style={styles.medicalBox}>
                <View style={styles.medicalHeader}>
                  <Ionicons name="medkit-outline" size={14} color="#0F766E" />
                  <Text style={styles.medicalTitle}>Patient Intake Details</Text>
                </View>

                {item.condition ? (
                  <Text style={styles.medicalText}>
                    <Text style={styles.medicalBold}>Condition: </Text>
                    {item.condition}
                  </Text>
                ) : null}

                {item.previousDocuments ? (
                  <Text style={styles.medicalText}>
                    <Text style={styles.medicalBold}>Medical History: </Text>
                    {item.previousDocuments}
                  </Text>
                ) : null}

                {/* Attached Prescription Files */}
                {item.prescriptionFiles && item.prescriptionFiles.length > 0 ? (
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.medicalBold}>
                      Attached Prescriptions ({item.prescriptionFiles.length}):
                    </Text>
                    <View style={styles.adminFilesList}>
                      {item.prescriptionFiles.map((file, idx) => (
                        <TouchableOpacity
                          key={`${file.name}-${idx}`}
                          activeOpacity={0.7}
                          onPress={() =>
                            Linking.openURL(file.uri).catch(() =>
                              Alert.alert('File', `${file.name}\n${file.uri}`)
                            )
                          }
                          style={styles.adminFileChip}
                        >
                          <Ionicons
                            name="document-attach-outline"
                            size={13}
                            color="#0F766E"
                          />
                          <Text style={styles.adminFileName} numberOfLines={1}>
                            {file.name}
                          </Text>
                          {file.size ? (
                            <Text style={styles.adminFileSize}>
                              {formatFileSize(file.size)}
                            </Text>
                          ) : null}
                          <Ionicons
                            name="open-outline"
                            size={12}
                            color="#64748B"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* WhatsApp notification action */}
            <TouchableOpacity
              style={styles.whatsappButton}
              activeOpacity={0.8}
              onPress={() => notifyViaWhatsApp(item)}
            >
              <Ionicons name="logo-whatsapp" size={15} color="#15803D" />
              <Text style={styles.whatsappButtonText}>
                Send WhatsApp Slip (Serial: {item.serialNumber || 'SL-01'})
              </Text>
            </TouchableOpacity>

            {(item.status === 'pending' || item.status === 'confirmed') && (
              <View style={styles.actions}>
                {STATUS_ACTIONS.filter((action) =>
                  item.status === 'pending'
                    ? action.status !== 'completed'
                    : action.status !== 'confirmed'
                ).map((action) => (
                  <Pressable
                    key={action.status}
                    style={[
                      styles.actionButton,
                      action.status === 'rejected'
                        ? styles.rejectButton
                        : action.status === 'completed'
                          ? styles.completeButton
                          : styles.confirmButton,
                    ]}
                    onPress={() => changeStatus(item, action.status)}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        action.status === 'rejected' && styles.rejectText,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-clear-outline" size={44} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No appointments found</Text>
            <Text style={styles.emptySubtitle}>
              Bookings matching this filter will appear here.
            </Text>
          </View>
        }
      />

      {/* Admin Serial Management Modal */}
      {editingAppointment && (
        <Modal
          visible={Boolean(editingAppointment)}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingAppointment(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="receipt-outline" size={22} color="#0F766E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Manage Serial Number</Text>
                  <Text style={styles.modalSubtitle}>
                    {editingAppointment.doctorName} • {editingAppointment.date}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setEditingAppointment(null)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalPatient}>
                Patient: {editingAppointment.patientName || 'Patient'}
              </Text>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Serial Number</Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    Boolean(serialError) && styles.modalInputError,
                  ]}
                  value={serialInput}
                  onChangeText={(val) => {
                    setSerialInput(val);
                    if (serialError) setSerialError('');
                  }}
                  placeholder="Enter serial number (SL-01)"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                />
              </View>

              {Boolean(serialError) && (
                <View style={styles.errorBox}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={16}
                    color="#DC2626"
                  />
                  <Text style={styles.errorText}>{serialError}</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.autoAssignButton}
                activeOpacity={0.8}
                onPress={handleAutoAssignSerial}
              >
                <Ionicons name="sparkles-outline" size={15} color="#0F766E" />
                <Text style={styles.autoAssignText}>
                  Auto-Assign Next Unused Serial
                </Text>
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEditingAppointment(null)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSaveSerial}
                >
                  <Text style={styles.modalSaveText}>Save Serial</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subtitle: { color: '#64748B', fontSize: 12, marginTop: 2 },
  summary: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    marginHorizontal: 16,
    height: 48,
    marginBottom: 10,
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
  summaryNumber: { fontSize: 26, fontWeight: '800', color: '#0F766E' },
  summaryLabel: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
    marginBottom: 8,
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipSelected: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  filterChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
  },
  filterCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  filterCountBadgeSelected: {
    backgroundColor: '#115E59',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  filterCountTextSelected: {
    color: '#CCFBF1',
  },
  list: { paddingHorizontal: 16, paddingBottom: 30, flexGrow: 1 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderInfo: { flex: 1 },
  doctorName: { fontWeight: '800', fontSize: 15, color: '#0F172A' },
  specialty: { fontSize: 12, color: '#64748B', marginTop: 3 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  confirmed: { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE' },
  completed: { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' },
  rejected: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  cancelled: { backgroundColor: '#E2E8F0', borderColor: '#CBD5E1' },
  statusText: { fontSize: 10, fontWeight: '800', color: '#92400E' },
  confirmedText: { color: '#1E40AF' },
  completedText: { color: '#065F46' },
  rejectedText: { color: '#DC2626' },
  cancelledText: { color: '#64748B' },
  serialManagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  serialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#CCFBF1',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  serialBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F766E',
  },
  manageSerialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  manageSerialText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  serialActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteAppointmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  deleteAppointmentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  patientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  patientBannerText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  vitalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  vitalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  vitalChipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  bloodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  bloodChipText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '800',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  scheduleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  scheduleText: {
    fontSize: 11,
    color: '#0F766E',
    fontWeight: '700',
  },
  feeChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  feeChipText: {
    fontSize: 11,
    color: '#0F766E',
    fontWeight: '800',
  },
  medicalBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginTop: 10,
    gap: 4,
  },
  medicalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  medicalTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  medicalText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  medicalBold: {
    fontWeight: '700',
    color: '#1E293B',
  },
  adminFilesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
  },
  adminFileChip: {
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
  adminFileName: {
    fontSize: 11,
    color: '#0F766E',
    fontWeight: '600',
    maxWidth: 140,
  },
  adminFileSize: {
    fontSize: 10,
    color: '#94A3B8',
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 10,
  },
  whatsappButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#0F766E',
  },
  confirmButton: { backgroundColor: '#0F766E' },
  completeButton: { backgroundColor: '#059669' },
  rejectButton: {
    backgroundColor: '#FFF7F7',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  actionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  rejectText: { color: '#DC2626' },
  empty: { alignItems: 'center', paddingTop: 55, paddingHorizontal: 20 },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    textAlign: 'center',
    color: '#64748B',
    marginTop: 6,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  modalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalPatient: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalField: {
    marginBottom: 10,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalInputError: {
    borderColor: '#EF4444',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 16,
  },
  autoAssignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 9,
    paddingVertical: 9,
    marginBottom: 16,
  },
  autoAssignText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#0F766E',
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
