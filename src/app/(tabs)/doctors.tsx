import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DoctorAvatar } from '../../components/DoctorAvatar';
import { useDoctorStore } from '../../store/doctorStore';

export default function DoctorsScreen() {
  const router = useRouter();
  const doctors = useDoctorStore((state) => state.doctors);
  const isLoading = useDoctorStore((state) => state.isLoading);
  const fetchDoctors = useDoctorStore((state) => state.fetchDoctors);

  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDoctors();
    setRefreshing(false);
  };

  const specialties = useMemo(
    () => [
      'All',
      ...new Set(
        doctors
          .filter((doctor) => doctor.approvalStatus === 'approved')
          .map((doctor) => doctor.specialty)
      ),
    ],
    [doctors]
  );

  const filteredDoctors = useMemo(() => {
    const query = search.trim().toLowerCase();

    return doctors.filter((doctor) => {
      const approved = doctor.approvalStatus === 'approved';
      const matchesSpecialty =
        specialty === 'All' || doctor.specialty === specialty;
      const matchesSearch =
        doctor.name.toLowerCase().includes(query) ||
        doctor.specialty.toLowerCase().includes(query);

      return approved && matchesSpecialty && matchesSearch;
    });
  }, [doctors, search, specialty]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Find a Doctor</Text>
      <Text style={styles.subtitle}>
        Browse approved doctors and book a consultation.
      </Text>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#64748B" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search doctors or specialties"
          style={styles.searchInput}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        horizontal
        data={specialties}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        style={styles.specialtyList}
        contentContainerStyle={styles.specialtyContent}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSpecialty(item)}
            style={[styles.chip, specialty === item && styles.selectedChip]}
          >
            <Text
              style={[
                styles.chipText,
                specialty === item && styles.selectedChipText,
              ]}
            >
              {item}
            </Text>
          </Pressable>
        )}
      />

      <FlatList
        data={filteredDoctors}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0F766E']}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color="#0F766E" />
              <Text style={[styles.subtitle, { marginTop: 10 }]}>
                Loading doctors...
              </Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No doctors found</Text>
              <Text style={styles.subtitle}>
                Try another search or specialty.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <DoctorAvatar
              image={item.image}
              name={item.name}
              size={56}
              borderRadius={16}
            />

            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.specialty}>{item.specialty}</Text>
              <Text style={styles.qualification}>{item.qualification}</Text>
              <Text style={styles.experience}>
                {item.experience} years experience
              </Text>

              <View style={styles.bottomRow}>
                <Text style={styles.fee}>৳{item.fee}</Text>
                <Pressable
                  style={styles.bookButton}
                  onPress={() =>
                    router.push({
                      pathname: '/appointments/book',
                      params: {
                        doctorId: item.id,
                        name: item.name,
                        specialty: item.specialty,
                        fee: String(item.fee),
                      },
                    })
                  }
                >
                  <Text style={styles.bookText}>Book Now</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: 20 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    paddingHorizontal: 20,
  },
  subtitle: {
    color: '#64748B',
    marginTop: 6,
    lineHeight: 20,
    paddingHorizontal: 20,
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: { flex: 1, paddingVertical: 13, color: '#0F172A' },
  specialtyList: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 8,
  },
  specialtyContent: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    gap: 8,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  chipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  selectedChip: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  selectedChipText: { color: '#FFFFFF' },
  list: { padding: 20, paddingTop: 8, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CCFBF1',
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  specialty: { color: '#0F766E', marginTop: 4, fontWeight: '600' },
  qualification: { color: '#475569', fontSize: 12, marginTop: 7 },
  experience: { color: '#64748B', fontSize: 12, marginTop: 4 },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 8,
  },
  fee: { fontSize: 17, fontWeight: '800', color: '#0F766E' },
  bookButton: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  bookText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  empty: { alignItems: 'center', paddingTop: 70, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
});
