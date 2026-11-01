import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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

  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const tomorrowISO = useMemo(() => {
    const d = new Date(Date.now() + 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const todayApprovedCount = useMemo(() => {
    return appointments.filter(
      (a) => a.status === 'confirmed' && a.date === todayISO
    ).length;
  }, [appointments, todayISO]);

  const tomorrowApprovedCount = useMemo(() => {
    return appointments.filter(
      (a) => a.status === 'confirmed' && a.date === tomorrowISO
    ).length;
  }, [appointments, tomorrowISO]);

  const totalApprovedCount = useMemo(() => {
    return appointments.filter((a) => a.status === 'confirmed').length;
  }, [appointments]);

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
      title: 'Approved Visits',
      value: totalApprovedCount,
      icon: 'checkmark-circle-outline' as const,
      color: '#0F766E',
      background: '#CCFBF1',
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

        <Text style={styles.sectionTitle}>Date-Wise Approved Schedule</Text>

        <View style={styles.scheduleWidgetCard}>
          <View style={styles.scheduleWidgetHeader}>
            <View style={styles.scheduleWidgetIcon}>
              <Ionicons name="calendar-sharp" size={20} color="#0F766E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scheduleWidgetTitle}>
                Live Clinical Schedule
              </Text>
              <Text style={styles.scheduleWidgetSubtitle}>
                View all approved doctor visits filtered by date
              </Text>
            </View>
          </View>

          <View style={styles.scheduleGrid}>
            <TouchableOpacity
              style={styles.scheduleCard}
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                  pathname: '/appointments',
                  params: {
                    dateFilter: 'today',
                    status: 'confirmed',
                    approvedOnly: 'true',
                  },
                })
              }
            >
              <View style={styles.scheduleCardTop}>
                <Text style={styles.scheduleCardTag}>TODAY</Text>
                <View style={styles.scheduleCountPill}>
                  <Text style={styles.scheduleCountText}>
                    {todayApprovedCount}
                  </Text>
                </View>
              </View>
              <Text style={styles.scheduleCardTitle}>Today's Schedule</Text>
              <Text style={styles.scheduleCardSub}>
                {todayApprovedCount === 0
                  ? 'No approved visits today'
                  : `${todayApprovedCount} approved visit${todayApprovedCount === 1 ? '' : 's'}`}
              </Text>
              <View style={styles.scheduleActionRow}>
                <Text style={styles.scheduleActionText}>View Today's List</Text>
                <Ionicons name="arrow-forward" size={13} color="#0F766E" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.scheduleCard,
                { borderColor: '#BFDBFE', backgroundColor: '#F0F9FF' },
              ]}
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                  pathname: '/appointments',
                  params: {
                    dateFilter: 'tomorrow',
                    status: 'confirmed',
                    approvedOnly: 'true',
                  },
                })
              }
            >
              <View style={styles.scheduleCardTop}>
                <Text style={[styles.scheduleCardTag, { color: '#1E40AF' }]}>
                  NEXT DAY
                </Text>
                <View
                  style={[
                    styles.scheduleCountPill,
                    { backgroundColor: '#DBEAFE' },
                  ]}
                >
                  <Text
                    style={[
                      styles.scheduleCountText,
                      { color: '#1E40AF' },
                    ]}
                  >
                    {tomorrowApprovedCount}
                  </Text>
                </View>
              </View>
              <Text style={styles.scheduleCardTitle}>Tomorrow's Schedule</Text>
              <Text style={styles.scheduleCardSub}>
                {tomorrowApprovedCount === 0
                  ? 'No approved visits scheduled'
                  : `${tomorrowApprovedCount} approved visit${tomorrowApprovedCount === 1 ? '' : 's'}`}
              </Text>
              <View style={styles.scheduleActionRow}>
                <Text style={[styles.scheduleActionText, { color: '#2563EB' }]}>
                  View Next Day
                </Text>
                <Ionicons name="arrow-forward" size={13} color="#2563EB" />
              </View>
            </TouchableOpacity>
          </View>
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
  scheduleWidgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    marginBottom: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  scheduleWidgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  scheduleWidgetIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleWidgetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F766E',
  },
  scheduleWidgetSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  scheduleGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  scheduleCard: {
    flex: 1,
    backgroundColor: '#F0FDFA',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  scheduleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scheduleCardTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F766E',
    letterSpacing: 0.5,
  },
  scheduleCountPill: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  scheduleCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F766E',
  },
  scheduleCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  scheduleCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
  },
  scheduleActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 'auto',
  },
  scheduleActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
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
