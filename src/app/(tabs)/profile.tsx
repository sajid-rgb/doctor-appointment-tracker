import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppointmentStore } from '../../store/appointmentStore';
import { useAuthStore } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;
const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;

export default function PatientProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const updateUserProfile = useAuthStore((state) => state.updateUserProfile);
  const logout = useAuthStore((state) => state.logout);
  const appointments = useAppointmentStore((state) => state.appointments);
  const subscription = useSubscriptionStore((state) => state.subscription);

  const [isEditing, setIsEditing] = useState(false);

  // Editable Form State
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [gender, setGender] = useState(user?.gender || 'Male');
  const [bloodGroup, setBloodGroup] = useState(user?.bloodGroup || '');
  const [address, setAddress] = useState(user?.address || '');
  const [emergencyContact, setEmergencyContact] = useState(
    user?.emergencyContact || ''
  );
  const [medicalHistory, setMedicalHistory] = useState(
    user?.medicalHistory || ''
  );

  const myAppointments = useMemo(
    () => appointments.filter((a) => a.patientId === user?.id),
    [appointments, user?.id]
  );

  const upcomingCount = useMemo(
    () =>
      myAppointments.filter(
        (a) => a.status === 'confirmed' || a.status === 'pending'
      ).length,
    [myAppointments]
  );

  const completedCount = useMemo(
    () => myAppointments.filter((a) => a.status === 'completed').length,
    [myAppointments]
  );

  if (!user || user.role !== 'patient') {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={48} color="#94A3B8" />
        <Text style={styles.centerText}>Patient account required.</Text>
      </View>
    );
  }

  const handleStartEdit = () => {
    setName(user.name || '');
    setPhone(user.phone || '');
    setAge(user.age ? String(user.age) : '');
    setGender(user.gender || 'Male');
    setBloodGroup(user.bloodGroup || '');
    setAddress(user.address || '');
    setEmergencyContact(user.emergencyContact || '');
    setMedicalHistory(user.medicalHistory || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveProfile = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name Required', 'Please enter your full name.');
      return;
    }

    let parsedAge: number | undefined;
    if (age.trim()) {
      const num = parseInt(age.trim(), 10);
      if (Number.isNaN(num) || num < 1 || num > 130) {
        Alert.alert('Invalid Age', 'Please enter a valid age between 1 and 130.');
        return;
      }
      parsedAge = num;
    }

    updateUserProfile({
      name: trimmedName,
      phone: phone.trim() || undefined,
      age: parsedAge,
      gender,
      bloodGroup: bloodGroup || undefined,
      address: address.trim() || undefined,
      emergencyContact: emergencyContact.trim() || undefined,
      medicalHistory: medicalHistory.trim() || undefined,
    });

    setIsEditing(false);
    Alert.alert(
      'Profile Updated',
      'Your profile details have been saved successfully. They will auto-fill your future appointment bookings.'
    );
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Profile Card */}
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>

          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={13} color="#0F766E" />
            <Text style={styles.roleBadgeText}>Patient Profile</Text>
          </View>
        </View>

        {/* CarePoint Membership Status Card */}
        {subscription?.status === 'active' ? (
          <View style={styles.membershipActiveCard}>
            <View style={styles.membershipHeader}>
              <View style={styles.membershipIconBox}>
                <Ionicons name="sparkles" size={18} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Text style={styles.membershipTierTitle}>
                    {subscription.tier === 'vip'
                      ? 'CarePoint VIP Pass'
                      : 'CarePoint Plus Member'}
                  </Text>
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>Active</Text>
                  </View>
                </View>
                <Text style={styles.membershipSubtext}>
                  {subscription.tier === 'vip'
                    ? '30% off all consultations • Free specialist visits'
                    : '20% off all consultations • Priority clinic booking'}
                </Text>
              </View>
            </View>

            <View style={styles.membershipDivider} />

            <View style={styles.membershipFooter}>
              <Text style={styles.membershipRenewal}>
                Renews{' '}
                {new Date(subscription.renewalDate).toLocaleDateString(
                  'en-GB',
                  { day: 'numeric', month: 'short', year: 'numeric' }
                )}
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.managePlanBtn}
                onPress={() =>
                  router.push({ pathname: '/subscribe', params: { role: 'patient' } })
                }
              >
                <Text style={styles.managePlanBtnText}>Manage Plan</Text>
                <Ionicons name="chevron-forward" size={14} color="#0F766E" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.membershipPromoBanner}
            onPress={() =>
              router.push({ pathname: '/subscribe', params: { role: 'patient' } })
            }
          >
            <View style={styles.promoBannerLeft}>
              <View style={styles.promoBadgeSmall}>
                <Ionicons name="sparkles" size={12} color="#FFFFFF" />
                <Text style={styles.promoBadgeText}>CarePoint Plus</Text>
              </View>
              <Text style={styles.promoBannerHeading}>
                Save 20% on every doctor appointment
              </Text>
              <Text style={styles.promoBannerSubtitle}>
                Starting at only ৳999/mo. Priority slots & instant booking.
              </Text>
            </View>

            <View style={styles.promoBannerAction}>
              <Text style={styles.promoBannerActionText}>Explore</Text>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{myAppointments.length}</Text>
            <Text style={styles.statLabel}>Total Visits</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#0F766E' }]}>
              {upcomingCount}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#059669' }]}>
              {completedCount}
            </Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        {/* Profile Details or Edit Form */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>
                {isEditing ? 'Edit Profile' : 'Personal Information'}
              </Text>
              <Text style={styles.cardSubtitle}>
                {isEditing
                  ? 'Update your health and contact information'
                  : 'Your information for clinic bookings and doctors'}
              </Text>
            </View>

            {!isEditing && (
              <TouchableOpacity
                style={styles.editBtn}
                activeOpacity={0.8}
                onPress={handleStartEdit}
              >
                <Ionicons name="create-outline" size={15} color="#FFFFFF" />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditing ? (
            /* ================= EDIT MODE ================= */
            <View style={styles.form}>
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your full name"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <View style={styles.readOnlyBox}>
                  <Ionicons name="lock-closed" size={14} color="#64748B" />
                  <Text style={styles.readOnlyText}>{user.email}</Text>
                </View>
                <Text style={styles.readOnlyHint}>
                  Email is your login identifier and cannot be changed.
                </Text>
              </View>

              <View style={styles.rowTwoCols}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Age</Text>
                  <TextInput
                    style={styles.input}
                    value={age}
                    onChangeText={setAge}
                    placeholder="Enter age"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                </View>

                <View style={{ flex: 1.4 }}>
                  <Text style={styles.fieldLabel}>Gender</Text>
                  <View style={styles.chipsRow}>
                    {GENDER_OPTIONS.map((g) => {
                      const sel = gender === g;
                      return (
                        <TouchableOpacity
                          key={g}
                          style={[styles.chip, sel && styles.chipSelected]}
                          onPress={() => setGender(g)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              sel && styles.chipTextSelected,
                            ]}
                          >
                            {g}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Contact Phone</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Contact phone number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Blood Group</Text>
                <View style={styles.bloodGrid}>
                  {BLOOD_GROUPS.map((bg) => {
                    const sel = bloodGroup === bg;
                    return (
                      <TouchableOpacity
                        key={bg}
                        style={[
                          styles.bloodChip,
                          sel && styles.bloodChipSelected,
                        ]}
                        onPress={() => setBloodGroup(bg)}
                      >
                        <Text
                          style={[
                            styles.bloodChipText,
                            sel && styles.bloodChipTextSelected,
                          ]}
                        >
                          {bg}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Address / Area</Text>
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Residential address"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Emergency Contact Number</Text>
                <TextInput
                  style={styles.input}
                  value={emergencyContact}
                  onChangeText={setEmergencyContact}
                  placeholder="Emergency contact phone number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>
                  Medical History & Chronic Conditions
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={medicalHistory}
                  onChangeText={setMedicalHistory}
                  placeholder="Medical history, allergies, chronic conditions..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleCancelEdit}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveProfile}
                >
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ================= VIEW MODE ================= */
            <View style={styles.infoList}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Full Name</Text>
                <Text style={styles.infoValue}>{user.name}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user.email}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone Number</Text>
                <Text style={styles.infoValue}>
                  {user.phone || 'Not provided'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Age & Gender</Text>
                <Text style={styles.infoValue}>
                  {user.age ? `${user.age} yrs` : 'Age unassigned'} •{' '}
                  {user.gender || 'Not specified'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Blood Group</Text>
                {user.bloodGroup ? (
                  <View style={styles.bloodBadge}>
                    <Ionicons name="water" size={13} color="#DC2626" />
                    <Text style={styles.bloodBadgeText}>{user.bloodGroup}</Text>
                  </View>
                ) : (
                  <Text style={styles.infoValue}>Not set</Text>
                )}
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>
                  {user.address || 'Not provided'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Emergency Contact</Text>
                <Text style={styles.infoValue}>
                  {user.emergencyContact || 'Not provided'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Medical History / Allergies</Text>
                <Text style={styles.infoValue}>
                  {user.medicalHistory || 'None noted'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Quick Navigations */}
        <View style={styles.quickNavCard}>
          <TouchableOpacity
            style={styles.navRow}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/appointments')}
          >
            <View style={styles.navIconBox}>
              <Ionicons name="calendar-outline" size={18} color="#0F766E" />
            </View>
            <Text style={styles.navText}>My Appointments History</Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.navDivider} />

          <TouchableOpacity
            style={styles.navRow}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/doctors')}
          >
            <View style={styles.navIconBox}>
              <Ionicons name="people-outline" size={18} color="#0F766E" />
            </View>
            <Text style={styles.navText}>Find & Book Doctors</Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Log out button */}
        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 18, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    gap: 12,
  },
  centerText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F766E',
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  userEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  roleBadgeText: {
    color: '#0F766E',
    fontWeight: '700',
    fontSize: 11,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0F766E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  infoList: {
    gap: 12,
  },
  infoRow: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    marginTop: 4,
  },
  bloodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  bloodBadgeText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 12,
  },
  form: {
    gap: 14,
  },
  formGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 70,
  },
  readOnlyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readOnlyText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  readOnlyHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipSelected: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  bloodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bloodChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  bloodChipSelected: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  bloodChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  bloodChipTextSelected: {
    color: '#FFFFFF',
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#0F766E',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  quickNavCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 14,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  navIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  navDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF7F7',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
  },
  logoutButtonText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
  },
  membershipActiveCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  membershipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  membershipIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  membershipTierTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  activePill: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F766E',
  },
  membershipSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  membershipDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  membershipFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  membershipRenewal: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  managePlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  managePlanBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
  },
  membershipPromoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F766E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  promoBannerLeft: {
    flex: 1,
  },
  promoBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  promoBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  promoBannerHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 18,
  },
  promoBannerSubtitle: {
    fontSize: 11,
    color: '#CCFBF1',
    marginTop: 4,
    lineHeight: 15,
  },
  promoBannerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  promoBannerActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
