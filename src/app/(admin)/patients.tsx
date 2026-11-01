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
  TextInput,
  View,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';

export default function PatientManagementScreen() {
  const router = useRouter();
  const users = useAuthStore((state) => state.users);
  const isLoadingUsers = useAuthStore((state) => state.isLoadingUsers);
  const fetchUsers = useAuthStore((state) => state.fetchUsers);
  const deleteUser = useAuthStore((state) => state.deleteUser);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  const patients = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter(
      (user) =>
        user.role === 'patient' &&
        (!query ||
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query))
    );
  }, [users, search]);

  const handleDeletePatient = (id: string, name: string) => {
    Alert.alert(
      'Delete Patient',
      `Are you sure you want to permanently delete patient "${name}"? This will remove their account and data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(id);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete patient account.');
            }
          },
        },
      ]
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
          <Text style={styles.title}>Patient Management</Text>
          <Text style={styles.subtitle}>View registered patient accounts</Text>
        </View>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryIcon}>
          <Ionicons name="people-outline" size={25} color="#059669" />
        </View>
        <View>
          <Text style={styles.summaryNumber}>{patients.length}</Text>
          <Text style={styles.summaryLabel}>Patients found</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#64748B" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or email..."
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color="#94A3B8" />
          </Pressable>
        )}
      </View>

      <FlatList
        data={patients}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0F766E']} />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Ionicons name="person-outline" size={24} color="#059669" />
            </View>

            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>
                {item.name || 'Unnamed Patient'}
              </Text>
              <Text style={styles.email}>{item.email}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>REGISTERED</Text>
              </View>
            </View>

            <Pressable
              style={styles.deleteButton}
              onPress={() => handleDeletePatient(item.id, item.name || item.email)}
              accessibilityLabel="Delete patient"
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          isLoadingUsers && patients.length === 0 ? (
            <View style={[styles.empty, { paddingVertical: 40 }]}>
              <ActivityIndicator size="large" color="#0F766E" />
              <Text style={[styles.emptyTitle, { marginTop: 12 }]}>Loading patients...</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={44} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No patients found</Text>
              <Text style={styles.emptySubtitle}>
                Registered patient accounts will appear here.
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
    gap: 12,
    padding: 18,
    paddingTop: 28,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 4 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    margin: 16,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryNumber: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  summaryLabel: { fontSize: 13, color: '#64748B', marginTop: 3 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 13,
  },
  searchInput: { flex: 1, paddingVertical: 13, color: '#0F172A' },
  list: { paddingHorizontal: 16, paddingBottom: 30, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 16,
    marginBottom: 12,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  email: { fontSize: 13, color: '#64748B', marginTop: 4 },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#D1FAE5',
  },
  statusText: { fontSize: 10, fontWeight: '800', color: '#047857' },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
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
