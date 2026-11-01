import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiSyncIndicator } from '../../components/ApiSyncIndicator';
import { DoctorAvatar } from '../../components/DoctorAvatar';
import { useDoctorStore } from '../../store/doctorStore';

export default function AdminDoctorsScreen() {
  const doctors = useDoctorStore((state) => state.doctors);
  const isLoading = useDoctorStore((state) => state.isLoading);
  const fetchDoctors = useDoctorStore((state) => state.fetchDoctors);
  const updateStatus = useDoctorStore((state) => state.updateApprovalStatus);
  const deleteDoctor = useDoctorStore((state) => state.deleteDoctor);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDoctors();
    setRefreshing(false);
  };

  const pendingDoctors = useMemo(() => {
    const query = search.trim().toLowerCase();
    return doctors.filter(
      (doctor) =>
        doctor.approvalStatus === 'pending' &&
        (!query ||
          doctor.name.toLowerCase().includes(query) ||
          doctor.specialty.toLowerCase().includes(query) ||
          doctor.email.toLowerCase().includes(query) ||
          doctor.qualification?.toLowerCase().includes(query) ||
          doctor.hospital?.toLowerCase().includes(query))
    );
  }, [doctors, search]);

  const reviewDoctor = (id: string, status: 'approved' | 'rejected') => {
    Alert.alert(
      status === 'approved' ? 'Approve doctor?' : 'Reject doctor?',
      `Are you sure you want to ${status === 'approved' ? 'approve' : 'reject'} this doctor profile?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => updateStatus(id, status),
        },
      ]
    );
  };

  const deleteDoctorAction = (id: string, name: string) => {
    Alert.alert(
      'Delete Doctor',
      `Are you sure you want to permanently delete Dr. ${name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoctor(id);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete doctor');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Doctor Approval</Text>
      <Text style={styles.subtitle}>
        {pendingDoctors.length} doctor(s) awaiting review
      </Text>
      <ApiSyncIndicator
        isSyncing={isLoading && !refreshing}
        label="Syncing doctor applications..."
      />

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#64748B" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search pending doctors by name, specialty..."
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

      <FlatList
        data={pendingDoctors}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0F766E']} />
        }
        ListEmptyComponent={
          isLoading && pendingDoctors.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#0F766E" />
              <Text style={[styles.empty, { marginTop: 12 }]}>Loading doctor applications...</Text>
            </View>
          ) : (
            <Text style={styles.empty}>No pending doctor registrations.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <DoctorAvatar
                image={item.image}
                name={item.name}
                size={46}
                borderRadius={14}
              />
              <View style={styles.headerInfo}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.specialty}>{item.specialty}</Text>
              </View>
            </View>

            <Text style={styles.detail}>{item.email}</Text>
            <Text style={styles.detail}>
              Qualification: {item.qualification || 'Not provided'}
            </Text>
            <Text style={styles.detail}>
              Experience: {item.experience} years
            </Text>
            <Text style={styles.detail}>Fee: ৳{item.fee}</Text>

            <View style={styles.actions}>
              <Pressable
                style={[styles.button, styles.approve]}
                onPress={() => reviewDoctor(item.id, 'approved')}
              >
                <Text style={styles.buttonText}>Approve</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.reject]}
                onPress={() => reviewDoctor(item.id, 'rejected')}
              >
                <Text style={styles.buttonText}>Reject</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.delete]}
                onPress={() => deleteDoctorAction(item.id, item.name)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC', padding: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#0F172A' },
  subtitle: { color: '#64748B', marginTop: 6 },
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
    marginBottom: 4,
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerInfo: {
    flex: 1,
  },
  name: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  specialty: { fontSize: 13, color: '#0F766E', fontWeight: '600', marginTop: 2 },
  detail: { color: '#475569', marginTop: 7 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  approve: { backgroundColor: '#0F766E' },
  reject: { backgroundColor: '#DC2626' },
  delete: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  deleteButtonText: { color: '#DC2626', fontWeight: '700' },
  empty: { color: '#64748B', paddingVertical: 30, textAlign: 'center' },
});
