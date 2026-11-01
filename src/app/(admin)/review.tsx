import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DoctorAvatar } from '../../components/DoctorAvatar';
import { DoctorApprovalStatus, useDoctorStore } from '../../store/doctorStore';

type FilterType = 'all' | DoctorApprovalStatus;

export default function DoctorReviewScreen() {
  const router = useRouter();
  const doctors = useDoctorStore((state) => state.doctors);
  const isLoading = useDoctorStore((state) => state.isLoading);
  const fetchDoctors = useDoctorStore((state) => state.fetchDoctors);
  const updateApprovalStatus = useDoctorStore(
    (state) => state.updateApprovalStatus
  );
  const deleteDoctor = useDoctorStore((state) => state.deleteDoctor);

  const [filter, setFilter] = useState<FilterType>('pending');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDoctors();
    setRefreshing(false);
  };

  const filteredDoctors = useMemo(
    () =>
      filter === 'all'
        ? doctors
        : doctors.filter((doctor) => doctor.approvalStatus === filter),
    [doctors, filter]
  );

  const changeStatus = (
    doctorId: string,
    status: DoctorApprovalStatus,
    doctorName: string
  ) => {
    const action = status === 'approved' ? 'approve' : 'reject';

    Alert.alert(
      `${status === 'approved' ? 'Approve' : 'Reject'} Doctor`,
      `Are you sure you want to ${action} ${doctorName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status === 'approved' ? 'Approve' : 'Reject',
          style: status === 'rejected' ? 'destructive' : 'default',
          onPress: () => updateApprovalStatus(doctorId, status),
        },
      ]
    );
  };

  const handleDeleteDoctor = (doctorId: string, doctorName: string) => {
    Alert.alert(
      'Delete Doctor',
      `Are you sure you want to permanently delete Dr. ${doctorName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoctor(doctorId);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete doctor');
            }
          },
        },
      ]
    );
  };

  const renderDoctor = ({ item }: { item: (typeof doctors)[number] }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <DoctorAvatar
          image={item.image}
          name={item.name}
          size={48}
          borderRadius={14}
        />
        <View style={styles.doctorInfo}>
          <Text style={styles.doctorName}>{item.name}</Text>
          <Text style={styles.specialty}>{item.specialty}</Text>
          <Text style={styles.email}>{item.email}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <Text style={styles.detailText}>
          Qualification: {item.qualification || 'Not provided'}
        </Text>
        <Text style={styles.detailText}>
          Experience: {item.experience} years
        </Text>
        <Text style={styles.detailText}>Consultation fee: ৳{item.fee}</Text>
        <Text style={styles.detailText}>
          Bio: {item.bio || 'No bio provided'}
        </Text>
      </View>

      <View
        style={[
          styles.statusBadge,
          item.approvalStatus === 'approved' && styles.approvedBadge,
          item.approvalStatus === 'rejected' && styles.rejectedBadge,
        ]}
      >
        <Text
          style={[
            styles.statusText,
            item.approvalStatus === 'approved' && styles.approvedText,
            item.approvalStatus === 'rejected' && styles.rejectedText,
          ]}
        >
          {item.approvalStatus.toUpperCase()}
        </Text>
      </View>

      {item.approvalStatus !== 'approved' && (
        <Pressable
          style={styles.approveButton}
          onPress={() => changeStatus(item.id, 'approved', item.name)}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>Approve Doctor</Text>
        </Pressable>
      )}

      {item.approvalStatus !== 'rejected' && (
        <Pressable
          style={styles.rejectButton}
          onPress={() => changeStatus(item.id, 'rejected', item.name)}
        >
          <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
          <Text style={styles.rejectButtonText}>Reject Doctor</Text>
        </Pressable>
      )}

      <Pressable
        style={styles.deleteButton}
        onPress={() => handleDeleteDoctor(item.id, item.name)}
      >
        <Ionicons name="trash-outline" size={17} color="#EF4444" />
        <Text style={styles.deleteButtonText}>Delete Doctor</Text>
      </Pressable>
    </View>
  );

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
          <Text style={styles.title}>Doctor Management</Text>
          <Text style={styles.subtitle}>
            Review and manage doctor registrations
          </Text>
        </View>
      </View>

      <View style={styles.filters}>
        {(['pending', 'approved', 'rejected', 'all'] as FilterType[]).map(
          (item) => (
            <Pressable
              key={item}
              style={[
                styles.filterButton,
                filter === item && styles.activeFilter,
              ]}
              onPress={() => setFilter(item)}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === item && styles.activeFilterText,
                ]}
              >
                {item === 'all'
                  ? 'All'
                  : item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </Pressable>
          )
        )}
      </View>

      <FlatList
        data={filteredDoctors}
        keyExtractor={(item) => item.id}
        renderItem={renderDoctor}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0F766E']} />
        }
        ListEmptyComponent={
          isLoading && filteredDoctors.length === 0 ? (
            <View style={[styles.empty, { paddingVertical: 40 }]}>
              <ActivityIndicator size="large" color="#0F766E" />
              <Text style={[styles.emptyTitle, { marginTop: 12 }]}>Loading doctors...</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={44} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No doctors found</Text>
              <Text style={styles.emptySubtitle}>
                There are no doctors in this category yet.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    paddingTop: 28,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  headerInfo: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 4 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
  },
  filterButton: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  activeFilter: { backgroundColor: '#0F766E' },
  filterText: { color: '#475569', fontWeight: '600', fontSize: 13 },
  activeFilterText: { color: '#FFFFFF' },
  list: { padding: 16, paddingTop: 0, flexGrow: 1 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorInfo: { flex: 1 },
  doctorName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  specialty: { fontSize: 13, color: '#0F766E', marginTop: 3 },
  email: { fontSize: 12, color: '#64748B', marginTop: 3 },
  details: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    gap: 7,
  },
  detailText: { color: '#475569', fontSize: 13, lineHeight: 19 },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FEF3C7',
  },
  approvedBadge: { backgroundColor: '#D1FAE5' },
  rejectedBadge: { backgroundColor: '#FEE2E2' },
  statusText: { color: '#92400E', fontSize: 11, fontWeight: '800' },
  approvedText: { color: '#047857' },
  rejectedText: { color: '#B91C1C' },
  approveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 13,
    backgroundColor: '#0F766E',
    borderRadius: 10,
    marginTop: 14,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  rejectButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF7F7',
    borderRadius: 10,
    marginTop: 9,
  },
  rejectButtonText: { color: '#DC2626', fontWeight: '700' },
  deleteButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    marginTop: 9,
  },
  deleteButtonText: { color: '#DC2626', fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 65, paddingHorizontal: 20 },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
});
