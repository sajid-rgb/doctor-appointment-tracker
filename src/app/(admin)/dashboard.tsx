import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiSyncIndicator } from '../../components/ApiSyncIndicator';
import { NotificationBell } from '../../components/NotificationBell';
import { useAppointmentStore } from '../../store/appointmentStore';
import { useAuthStore } from '../../store/authStore';
import { useDoctorStore } from '../../store/doctorStore';

export default function AdminDashboard() {
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const users = useAuthStore((state) => state.users);
  const isLoadingUsers = useAuthStore((state) => state.isLoadingUsers);
  const fetchUsers = useAuthStore((state) => state.fetchUsers);
  const doctors = useDoctorStore((state) => state.doctors);
  const isLoadingDoctors = useDoctorStore((state) => state.isLoading);
  const fetchDoctors = useDoctorStore((state) => state.fetchDoctors);
  const appointments = useAppointmentStore((state) => state.appointments);
  const isLoadingAppointments = useAppointmentStore((state) => state.isLoading);
  const fetchAppointments = useAppointmentStore(
    (state) => state.fetchAppointments
  );

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDoctors();
    fetchUsers();
    fetchAppointments();
  }, [fetchDoctors, fetchUsers, fetchAppointments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDoctors(), fetchUsers(), fetchAppointments()]);
    setRefreshing(false);
  };

  const patientsCount = users.filter((item) => item.role === 'patient').length;

  const pendingDoctors = doctors.filter(
    (doctor) => doctor.approvalStatus === 'pending'
  ).length;

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const stats = [
    {
      title: 'Total Doctors',
      value: doctors.length,
      icon: 'medkit-outline' as const,
      color: '#2563EB',
      background: '#DBEAFE',
    },
    {
      title: 'Pending Approvals',
      value: pendingDoctors,
      icon: 'time-outline' as const,
      color: '#D97706',
      background: '#FEF3C7',
    },
    {
      title: 'Total Patients',
      value: patientsCount,
      icon: 'people-outline' as const,
      color: '#059669',
      background: '#D1FAE5',
    },
    {
      title: 'Appointments',
      value: appointments.length,
      icon: 'calendar-outline' as const,
      color: '#7C3AED',
      background: '#EDE9FE',
    },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0F766E']}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>CarePoint</Text>
            <Text style={styles.headerSubtitle}>Admin Panel</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <NotificationBell color="#0F766E" />
            <Pressable style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={19} color="#DC2626" />
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
        </View>

        <ApiSyncIndicator
          isSyncing={(isLoadingUsers || isLoadingDoctors || isLoadingAppointments) && !refreshing}
          label="Syncing admin statistics..."
        />

        <View style={styles.welcome}>
          <Text style={styles.welcomeTitle}>Dashboard Overview</Text>
          <Text style={styles.welcomeSubtitle}>
            Welcome back, {user?.name || 'Admin'}!{'\n'}Here is your clinic
            management summary.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Platform Summary</Text>

        <View style={styles.statsGrid}>
          {stats.map((item) => (
            <View key={item.title} style={styles.statCard}>
              <View
                style={[styles.iconBox, { backgroundColor: item.background }]}
              >
                <Ionicons name={item.icon} size={23} color={item.color} />
              </View>

              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statTitle}>{item.title}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Management</Text>

        <Pressable
          style={styles.menuCard}
          onPress={() => router.push('/review')}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="medkit-outline" size={23} color="#D97706" />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Doctor Management</Text>
            <Text style={styles.menuDescription}>
              Review doctor registrations and approve or reject profiles.
            </Text>
            {pendingDoctors > 0 && (
              <Text style={styles.pendingText}>
                {pendingDoctors} pending approval
                {pendingDoctors === 1 ? '' : 's'}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={21} color="#94A3B8" />
        </Pressable>

        <Pressable
          style={styles.menuCard}
          onPress={() => router.push('/patients')}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="people-outline" size={23} color="#059669" />
          </View>

          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Patient Management</Text>
            <Text style={styles.menuDescription}>
              View and search registered patient accounts.
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={21} color="#94A3B8" />
        </Pressable>

        <Pressable
          style={styles.menuCard}
          onPress={() => router.push('/appointments')}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#EDE9FE' }]}>
            <Ionicons name="calendar-outline" size={23} color="#7C3AED" />
          </View>

          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Appointment Management</Text>
            <Text style={styles.menuDescription}>
              View bookings, update appointment status, and manage schedules.
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={21} color="#94A3B8" />
        </Pressable>

        <Text style={styles.footer}>CarePoint Healthcare System</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingTop: 28,
    paddingBottom: 40,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  brand: {
    fontSize: 25,
    fontWeight: '800',
    color: '#0F766E',
  },
  headerSubtitle: {
    color: '#64748B',
    marginTop: 3,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
  },
  logoutText: {
    color: '#DC2626',
    fontWeight: '700',
  },
  welcome: {
    backgroundColor: '#0F766E',
    borderRadius: 18,
    padding: 22,
    marginBottom: 28,
  },
  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
  },
  welcomeSubtitle: {
    color: '#D1FAE5',
    lineHeight: 22,
    marginTop: 9,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 135,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  statValue: {
    fontSize: 27,
    fontWeight: '800',
    color: '#0F172A',
  },
  statTitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 5,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    gap: 12,
  },
  menuIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  menuDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 5,
  },
  pendingText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  footer: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
});
