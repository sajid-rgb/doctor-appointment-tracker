import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ApiSyncIndicator } from '../../components/ApiSyncIndicator';
import { DoctorAvatar } from '../../components/DoctorAvatar';
import { useAppointmentStore } from '../../store/appointmentStore';
import { useAuthStore } from '../../store/authStore';
import { useDoctorStore } from '../../store/doctorStore';

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const appointments = useAppointmentStore((state) => state.appointments);
  const isLoadingAppointments = useAppointmentStore((state) => state.isLoading);
  const fetchAppointments = useAppointmentStore(
    (state) => state.fetchAppointments
  );
  const doctors = useDoctorStore((state) => state.doctors);
  const isLoadingDoctors = useDoctorStore((state) => state.isLoading);
  const fetchDoctors = useDoctorStore((state) => state.fetchDoctors);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDoctors();
    fetchAppointments();
  }, [fetchDoctors, fetchAppointments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDoctors(), fetchAppointments()]);
    setRefreshing(false);
  };

  const myAppointments = useMemo(() => {
    if (user?.role === 'patient') {
      return appointments.filter((a) => a.patientId === user.id);
    }
    return appointments;
  }, [appointments, user]);

  const stats = useMemo(() => {
    const total = myAppointments.length;
    const scheduled = myAppointments.filter(
      (a) => a.status === 'pending' || a.status === 'confirmed'
    ).length;
    const completed = myAppointments.filter(
      (a) => a.status === 'completed'
    ).length;
    const cancelled = myAppointments.filter(
      (a) => a.status === 'cancelled'
    ).length;

    return [
      { label: 'Total', value: String(total), color: '#0F766E' },
      { label: 'Scheduled', value: String(scheduled), color: '#D97706' },
      { label: 'Completed', value: String(completed), color: '#16A34A' },
      { label: 'Cancelled', value: String(cancelled), color: '#DC2626' },
    ];
  }, [myAppointments]);

  const recentAppointments = useMemo(() => {
    return myAppointments.slice(0, 5);
  }, [myAppointments]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
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
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.title}>{user?.name || 'CarePoint'} 👋</Text>
        </View>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.name || 'CP').slice(0, 2).toUpperCase()}
          </Text>
        </View>
      </View>

      <ApiSyncIndicator
        isSyncing={(isLoadingAppointments || isLoadingDoctors) && !refreshing}
        label="Syncing healthcare data..."
      />

      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Your health at a glance</Text>
        <Text style={styles.bannerSubtitle}>
          Manage appointments and book doctors in one place.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Overview</Text>

      <View style={styles.statsGrid}>
        {stats.map((item) => (
          <View key={item.label} style={styles.statCard}>
            <View style={[styles.statDot, { backgroundColor: item.color }]} />
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent appointments</Text>
        {recentAppointments.length > 0 && (
          <Pressable onPress={() => router.push('/(tabs)/appointments')}>
            <Text style={styles.today}>View all</Text>
          </Pressable>
        )}
      </View>

      {recentAppointments.length === 0 ? (
        isLoadingAppointments ? (
          <View style={[styles.emptyContainer, { paddingVertical: 32 }]}>
            <ActivityIndicator size="large" color="#0F766E" />
            <Text style={[styles.emptySubtitle, { marginTop: 10 }]}>
              Loading your appointments...
            </Text>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={38} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No appointments yet</Text>
            <Text style={styles.emptySubtitle}>
              Find an approved doctor and book your consultation.
            </Text>
            <Pressable
              style={styles.bookDoctorBtn}
              onPress={() => router.push('/(tabs)/doctors')}
            >
              <Ionicons name="search" size={16} color="#FFFFFF" />
              <Text style={styles.bookDoctorBtnText}>Find Doctors</Text>
            </Pressable>
          </View>
        )
      ) : (
        recentAppointments.map((item) => {
          const isCompleted = item.status === 'completed';
          const isCancelled = item.status === 'cancelled';
          const doctor = doctors.find(
            (d) => d.id === item.doctorId || d.name === item.doctorName
          );

          return (
            <View key={item.id} style={styles.appointmentCard}>
              <DoctorAvatar
                image={doctor?.image}
                name={item.doctorName}
                size={42}
                borderRadius={13}
              />

              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>{item.doctorName}</Text>
                <Text style={styles.doctorName}>{item.specialty}</Text>
                <Text style={styles.time}>
                  {item.date} • {item.time}
                </Text>
              </View>

              <View
                style={[
                  styles.badge,
                  isCompleted
                    ? styles.completedBadge
                    : isCancelled
                      ? styles.cancelledBadge
                      : styles.scheduledBadge,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    isCompleted
                      ? styles.completedText
                      : isCancelled
                        ? styles.cancelledText
                        : styles.scheduledText,
                  ]}
                >
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>
          );
        })
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
    paddingTop: 56,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
    color: '#64748B',
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F766E',
  },
  banner: {
    backgroundColor: '#0F766E',
    padding: 22,
    borderRadius: 20,
    marginBottom: 28,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  bannerSubtitle: {
    color: '#CCFBF1',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 14,
  },
  today: {
    color: '#0F766E',
    fontWeight: '600',
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 25,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 5,
  },
  appointmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientInitial: {
    color: '#0369A1',
    fontSize: 18,
    fontWeight: '700',
  },
  patientInfo: {
    flex: 1,
    marginLeft: 12,
  },
  patientName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  doctorName: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  time: {
    color: '#0F766E',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  completedBadge: {
    backgroundColor: '#DCFCE7',
  },
  scheduledBadge: {
    backgroundColor: '#FEF3C7',
  },
  cancelledBadge: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  completedText: {
    color: '#166534',
  },
  scheduledText: {
    color: '#92400E',
  },
  cancelledText: {
    color: '#991B1B',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 6,
  },
  bookDoctorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F766E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  bookDoctorBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
