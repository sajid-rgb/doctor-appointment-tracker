import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { DoctorAvatar } from '../../components/DoctorAvatar';
import { DEFAULT_AVAILABILITY } from '../../constants/availability';
import { useAppointmentStore } from '../../store/appointmentStore';
import { useAuthStore } from '../../store/authStore';
import { type DoctorProfile, useDoctorStore } from '../../store/doctorStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';

export default function DoctorProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const updateUserProfile = useAuthStore((state) => state.updateUserProfile);
  const logout = useAuthStore((state) => state.logout);
  const subscription = useSubscriptionStore((state) => state.subscription);
  const doctors = useDoctorStore((state) => state.doctors);
  const isLoading = useDoctorStore((state) => state.isLoading);
  const fetchDoctors = useDoctorStore((state) => state.fetchDoctors);
  const fetchDoctorById = useDoctorStore((state) => state.fetchDoctorById);
  const registerDoctor = useDoctorStore((state) => state.registerDoctor);
  const updateDoctorProfile = useDoctorStore(
    (state) => state.updateDoctorProfile
  );
  const appointments = useAppointmentStore((state) => state.appointments);

  const [refreshing, setRefreshing] = useState(false);

  const matchedDoctor = useMemo(
    () =>
      doctors.find(
        (item) =>
          item.id === user?.id ||
          (user?.email &&
            item.email?.toLowerCase() === user.email.toLowerCase())
      ),
    [doctors, user?.id, user?.email]
  );

  const fallbackDoctor: DoctorProfile | null = useMemo(() => {
    if (user?.role === 'doctor' && user.id) {
      return {
        id: user.id,
        name: user.name || 'Doctor',
        email: user.email,
        phone: user.phone,
        image: user.image,
        specialty: 'General Physician',
        qualification: 'MBBS',
        experience: 1,
        fee: 500,
        bio: '',
        approvalStatus: 'approved',
        createdAt: new Date().toISOString(),
        availability: DEFAULT_AVAILABILITY,
      };
    }
    return null;
  }, [user]);

  const doctor: DoctorProfile = (matchedDoctor || fallbackDoctor) as DoctorProfile;

  // Auto-fetch if doctor is not in store
  useEffect(() => {
    let isMounted = true;
    if (!matchedDoctor && user?.id) {
      fetchDoctorById(user.id).then((found) => {
        if (!found && isMounted) {
          fetchDoctors();
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [matchedDoctor, user?.id, fetchDoctorById, fetchDoctors]);

  // If no doctor doc in Firestore, seed fallback doctor
  useEffect(() => {
    if (!matchedDoctor && fallbackDoctor && !isLoading && user?.role === 'doctor') {
      registerDoctor(fallbackDoctor).catch(() => {});
    }
  }, [matchedDoctor, fallbackDoctor, isLoading, user?.role, registerDoctor]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (user?.id) {
      await fetchDoctorById(user.id);
    }
    await fetchDoctors();
    setRefreshing(false);
  };

  const [isEditing, setIsEditing] = useState(false);

  // Form State
  const [name, setName] = useState(doctor?.name || user?.name || '');
  const [phone, setPhone] = useState(doctor?.phone || user?.phone || '');
  const [specialty, setSpecialty] = useState(doctor?.specialty || '');
  const [qualification, setQualification] = useState(
    doctor?.qualification || ''
  );
  const [experience, setExperience] = useState(
    doctor?.experience ? String(doctor.experience) : ''
  );
  const [fee, setFee] = useState(doctor?.fee ? String(doctor.fee) : '');
  const [hospital, setHospital] = useState(doctor?.hospital || '');
  const [bio, setBio] = useState(doctor?.bio || '');
  const [imageUri, setImageUri] = useState<string | undefined>(doctor?.image);

  // Synchronize local form state with store doctor profile whenever it changes
  useEffect(() => {
    if (doctor && !isEditing) {
      setName(doctor.name || user?.name || '');
      setPhone(doctor.phone || user?.phone || '');
      setSpecialty(doctor.specialty || '');
      setQualification(doctor.qualification || '');
      setExperience(doctor.experience ? String(doctor.experience) : '');
      setFee(doctor.fee ? String(doctor.fee) : '');
      setHospital(doctor.hospital || '');
      setBio(doctor.bio || '');
      setImageUri(doctor.image);
    }
  }, [doctor, isEditing, user?.name, user?.phone]);

  const myAppointments = useMemo(
    () => appointments.filter((a) => a.doctorId === user?.id),
    [appointments, user?.id]
  );

  const completedCount = useMemo(
    () => myAppointments.filter((a) => a.status === 'completed').length,
    [myAppointments]
  );

  const activeCount = useMemo(
    () =>
      myAppointments.filter(
        (a) => a.status === 'confirmed' || a.status === 'pending'
      ).length,
    [myAppointments]
  );

  const savePhoto = (uri?: string) => {
    setImageUri(uri);
    const targetId = doctor?.id || user?.id;
    if (targetId) {
      updateDoctorProfile(targetId, { image: uri });
      updateUserProfile({ image: uri });
    }
  };

  const handlePickFromLibrary = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Needed',
          'Photo library access is needed to upload a profile photo.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        savePhoto(result.assets[0].uri);
        Alert.alert(
          'Photo Updated',
          'Your profile photo has been successfully updated.'
        );
      }
    } catch {
      Alert.alert('Error', 'Unable to select image. Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Needed',
          'Camera access is needed to take a profile photo.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        savePhoto(result.assets[0].uri);
        Alert.alert(
          'Photo Updated',
          'Your profile photo has been successfully updated.'
        );
      }
    } catch {
      Alert.alert('Error', 'Unable to capture photo. Please try again.');
    }
  };

  const handleRemovePhoto = () => {
    savePhoto(undefined);
    Alert.alert(
      'Photo Removed',
      'Your profile will now display the doctor medical icon.'
    );
  };

  const showPhotoOptions = () => {
    const currentPhoto = imageUri || doctor?.image;
    const buttons: {
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }[] = [
      { text: 'Choose from Library', onPress: handlePickFromLibrary },
    ];

    if (Platform.OS !== 'web') {
      buttons.unshift({ text: 'Take Photo', onPress: handleTakePhoto });
    }

    if (currentPhoto) {
      buttons.push({
        text: 'Remove Photo (Use Doctor Icon)',
        style: 'destructive',
        onPress: handleRemovePhoto,
      });
    }

    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(
      'Doctor Profile Photo',
      'Add or update your photo. If no photo is selected, the doctor medical icon will be displayed.',
      buttons
    );
  };

  if (!user || user.role !== 'doctor') {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={48} color="#94A3B8" />
        <Text style={styles.centerText}>Doctor access required.</Text>
      </View>
    );
  }

  if (isLoading && !doctor?.id) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.centerText}>Loading doctor profile...</Text>
      </View>
    );
  }

  if (!doctor || !doctor.id) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
        <Text style={styles.centerText}>Doctor profile record not found.</Text>
      </View>
    );
  }

  const handleStartEdit = () => {
    setName(doctor.name || user.name || '');
    setPhone(doctor.phone || user.phone || '');
    setSpecialty(doctor.specialty || '');
    setQualification(doctor.qualification || '');
    setExperience(doctor.experience ? String(doctor.experience) : '');
    setFee(doctor.fee ? String(doctor.fee) : '');
    setHospital(doctor.hospital || '');
    setBio(doctor.bio || '');
    setImageUri(doctor.image);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveProfile = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name Required', 'Please enter your professional name.');
      return;
    }

    if (!specialty.trim()) {
      Alert.alert('Specialty Required', 'Please enter your medical specialty.');
      return;
    }

    const expNum = parseInt(experience.trim(), 10);
    if (experience.trim() && (Number.isNaN(expNum) || expNum < 0 || expNum > 70)) {
      Alert.alert(
        'Invalid Experience',
        'Please enter a valid number of years of experience.'
      );
      return;
    }

    const feeNum = parseInt(fee.trim(), 10);
    if (!fee.trim() || Number.isNaN(feeNum) || feeNum <= 0) {
      Alert.alert(
        'Consultation Fee Required',
        'Please enter a valid consultation fee.'
      );
      return;
    }

    // Update in doctorStore
    const targetId = doctor?.id || user.id;
    updateDoctorProfile(targetId, {
      name: trimmedName,
      phone: phone.trim() || undefined,
      image: imageUri,
      specialty: specialty.trim(),
      qualification: qualification.trim(),
      experience: Number.isNaN(expNum) ? 0 : expNum,
      fee: feeNum,
      hospital: hospital.trim() || undefined,
      bio: bio.trim(),
    });

    // Keep auth user in sync
    updateUserProfile({
      name: trimmedName,
      phone: phone.trim() || undefined,
      image: imageUri,
    });

    setIsEditing(false);
    Alert.alert(
      'Profile Updated',
      'Your doctor profile details have been saved successfully and are live.'
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

  const statusColor =
    doctor.approvalStatus === 'approved'
      ? '#059669'
      : doctor.approvalStatus === 'rejected'
        ? '#DC2626'
        : '#D97706';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={styles.screen}
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
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              style={styles.avatarButton}
              activeOpacity={0.8}
              onPress={showPhotoOptions}
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
            >
              <DoctorAvatar
                image={doctor.image}
                name={doctor.name}
                size={88}
                borderRadius={44}
              />
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={15} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.avatarActionTextBtn}
              onPress={showPhotoOptions}
              activeOpacity={0.7}
            >
              <Ionicons
                name={doctor.image ? 'camera-outline' : 'add-circle-outline'}
                size={14}
                color="#0F766E"
              />
              <Text style={styles.avatarActionText}>
                {doctor.image ? 'Change Photo' : 'Upload Photo (or Use Icon)'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.doctorName}>{doctor.name}</Text>
          <Text style={styles.specialtyText}>{doctor.specialty}</Text>
          <Text style={styles.doctorEmail}>{doctor.email}</Text>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${statusColor}15`, borderColor: `${statusColor}40` },
            ]}
          >
            <Ionicons
              name={
                doctor.approvalStatus === 'approved'
                  ? 'checkmark-circle'
                  : 'time-outline'
              }
              size={14}
              color={statusColor}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {doctor.approvalStatus.toUpperCase()} DOCTOR
            </Text>
          </View>
        </View>

        {/* Doctor Practice Subscription Card */}
        {subscription?.status === 'active' &&
        (subscription.tier === 'doctor_pro' ||
          subscription.tier === 'doctor_elite') ? (
          <View style={styles.practiceSubCard}>
            <View style={styles.practiceHeader}>
              <View style={styles.proShieldIcon}>
                <Ionicons name="shield-checkmark" size={18} color="#0F766E" />
              </View>
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Text style={styles.practiceTierTitle}>
                    {subscription.tier === 'doctor_elite'
                      ? 'Doctor Clinic Elite'
                      : 'Doctor Pro Practice'}
                  </Text>
                  <View style={styles.proActiveBadge}>
                    <Text style={styles.proActiveBadgeText}>VERIFIED PRO</Text>
                  </View>
                </View>
                <Text style={styles.practiceSubDesc}>
                  Featured search placement • Unlimited patient bookings • 0% commission
                </Text>
              </View>
            </View>

            <View style={styles.practiceDivider} />

            <View style={styles.practiceFooter}>
              <Text style={styles.practiceRenewalText}>
                Renews{' '}
                {new Date(subscription.renewalDate).toLocaleDateString(
                  'en-GB',
                  {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }
                )}
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.managePracticeBtn}
                onPress={() =>
                  router.push({ pathname: '/subscribe', params: { role: 'doctor' } })
                }
              >
                <Text style={styles.managePracticeBtnText}>Manage Plan</Text>
                <Ionicons name="chevron-forward" size={14} color="#0F766E" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.upgradePracticeBanner}
            onPress={() =>
              router.push({ pathname: '/subscribe', params: { role: 'doctor' } })
            }
          >
            <View style={{ flex: 1 }}>
              <View style={styles.upgradeBadgeSmall}>
                <Ionicons name="sparkles" size={12} color="#FFFFFF" />
                <Text style={styles.upgradeBadgeText}>DOCTOR PRO PRACTICE</Text>
              </View>
              <Text style={styles.upgradeBannerHeading}>
                Get Featured & Unlock Unlimited Bookings
              </Text>
              <Text style={styles.upgradeBannerSubtitle}>
                Upgrade to Pro Practice for verified search badge, 0% commission, and direct WhatsApp slips.
              </Text>
            </View>

            <View style={styles.upgradeBannerAction}>
              <Text style={styles.upgradeBannerActionText}>Upgrade</Text>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{myAppointments.length}</Text>
            <Text style={styles.statLabel}>Total Bookings</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#0F766E' }]}>
              {activeCount}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#059669' }]}>
              ৳{doctor.fee}
            </Text>
            <Text style={styles.statLabel}>Fee / Visit</Text>
          </View>
        </View>

        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>
                {isEditing ? 'Edit Doctor Profile' : 'Professional Information'}
              </Text>
              <Text style={styles.cardSubtitle}>
                {isEditing
                  ? 'Update your qualifications, fees and bio'
                  : 'Displayed to patients during appointment bookings'}
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
              {/* Doctor Avatar Picker in Edit Form */}
              <View style={styles.photoEditSection}>
                <DoctorAvatar
                  image={imageUri || doctor.image}
                  name={name || doctor.name}
                  size={64}
                  borderRadius={32}
                />
                <View style={styles.photoEditInfo}>
                  <Text style={styles.photoEditTitle}>
                    {imageUri ? 'Doctor Photo Set' : 'Doctor Medical Icon'}
                  </Text>
                  <Text style={styles.photoEditSubtitle}>
                    {imageUri
                      ? 'Photo is displayed across search & bookings'
                      : 'Standard doctor icon is used when no photo is uploaded'}
                  </Text>
                  <View style={styles.photoEditButtons}>
                    <TouchableOpacity
                      style={styles.photoBtnSmall}
                      onPress={showPhotoOptions}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera-outline" size={13} color="#0F766E" />
                      <Text style={styles.photoBtnSmallText}>
                        {imageUri ? 'Change Photo' : 'Add Photo'}
                      </Text>
                    </TouchableOpacity>
                    {Boolean(imageUri) && (
                      <TouchableOpacity
                        style={styles.photoRemoveBtnSmall}
                        onPress={handleRemovePhoto}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="trash-outline" size={13} color="#DC2626" />
                        <Text style={styles.photoRemoveBtnSmallText}>Use Icon</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Doctor Full Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter doctor's full name"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Account Email</Text>
                <View style={styles.readOnlyBox}>
                  <Ionicons name="lock-closed" size={14} color="#64748B" />
                  <Text style={styles.readOnlyText}>{doctor.email}</Text>
                </View>
                <Text style={styles.readOnlyHint}>
                  Email is locked to your login credentials.
                </Text>
              </View>

              <View style={styles.rowTwoCols}>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.fieldLabel}>Specialty *</Text>
                  <TextInput
                    style={styles.input}
                    value={specialty}
                    onChangeText={setSpecialty}
                    placeholder="Enter medical specialty"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Experience (Yrs)</Text>
                  <TextInput
                    style={styles.input}
                    value={experience}
                    onChangeText={setExperience}
                    placeholder="Years in practice"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.rowTwoCols}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Consultation Fee (৳) *</Text>
                  <TextInput
                    style={styles.input}
                    value={fee}
                    onChangeText={setFee}
                    placeholder="Fee amount"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                </View>

                <View style={{ flex: 1.2 }}>
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
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Medical Qualification</Text>
                <TextInput
                  style={styles.input}
                  value={qualification}
                  onChangeText={setQualification}
                  placeholder="Degrees and certifications"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Affiliated Hospital / Clinic</Text>
                <TextInput
                  style={styles.input}
                  value={hospital}
                  onChangeText={setHospital}
                  placeholder="Hospital or clinic name"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>About / Professional Bio</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Describe your background, areas of clinical expertise, patient care philosophy..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
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
                  <Text style={styles.saveBtnText}>Save Profile</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ================= VIEW MODE ================= */
            <View style={styles.infoList}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Doctor Name</Text>
                <Text style={styles.infoValue}>{doctor.name}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Specialty</Text>
                <Text style={styles.infoValue}>{doctor.specialty}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Qualification</Text>
                <Text style={styles.infoValue}>
                  {doctor.qualification || 'Not provided'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Experience</Text>
                <Text style={styles.infoValue}>
                  {doctor.experience} years of clinical practice
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Consultation Fee</Text>
                <Text style={[styles.infoValue, { color: '#0F766E', fontWeight: '800' }]}>
                  ৳{doctor.fee}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Contact Phone</Text>
                <Text style={styles.infoValue}>
                  {doctor.phone || 'Not provided'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Profile Display</Text>
                <View style={styles.photoStatusRow}>
                  <DoctorAvatar image={doctor.image} name={doctor.name} size={30} />
                  <Text style={styles.photoStatusText}>
                    {doctor.image ? 'Custom Photo Active' : 'Doctor Medical Icon (Standard)'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Hospital / Clinic</Text>
                <Text style={styles.infoValue}>
                  {doctor.hospital || 'CarePoint Medical Center'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>About / Bio</Text>
                <Text style={[styles.infoValue, { lineHeight: 21 }]}>
                  {doctor.bio || 'No biography written yet.'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Notices */}
        {doctor.approvalStatus === 'pending' && (
          <View style={styles.noticeWarning}>
            <Ionicons name="information-circle" size={20} color="#D97706" />
            <Text style={styles.noticeWarningText}>
              Your profile is currently awaiting admin verification. Patients will
              be able to book appointments as soon as it is approved.
            </Text>
          </View>
        )}

        {/* Quick Navigations */}
        <View style={styles.quickNavCard}>
          <TouchableOpacity
            style={styles.navRow}
            activeOpacity={0.7}
            onPress={() => router.push('/(doctor)/availability')}
          >
            <View style={styles.navIconBox}>
              <Ionicons name="time-outline" size={18} color="#0F766E" />
            </View>
            <Text style={styles.navText}>Manage Availability Schedule</Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.navDivider} />

          <TouchableOpacity
            style={styles.navRow}
            activeOpacity={0.7}
            onPress={() => router.push('/(doctor)/appointments')}
          >
            <View style={styles.navIconBox}>
              <Ionicons name="calendar-outline" size={18} color="#0F766E" />
            </View>
            <Text style={styles.navText}>Review Patient Appointments</Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Log Out */}
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
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarButton: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  avatarActionTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F0FDFA',
  },
  avatarActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
  },
  photoEditSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  photoEditInfo: {
    flex: 1,
    gap: 3,
  },
  photoEditTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  photoEditSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  photoEditButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  photoBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  photoBtnSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  photoRemoveBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  photoRemoveBtnSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  photoStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  photoStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
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
  doctorName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  specialtyText: {
    fontSize: 14,
    color: '#0F766E',
    fontWeight: '700',
    marginTop: 2,
  },
  doctorEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  statusText: {
    fontWeight: '800',
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
    fontSize: 19,
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
    minHeight: 80,
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
  noticeWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  noticeWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
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
  practiceSubCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  practiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  proShieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceTierTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  proActiveBadge: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proActiveBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  practiceSubDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  practiceDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  practiceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  practiceRenewalText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  managePracticeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  managePracticeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
  },
  upgradePracticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F766E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  upgradeBadgeSmall: {
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
  upgradeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  upgradeBannerHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 18,
  },
  upgradeBannerSubtitle: {
    fontSize: 11,
    color: '#CCFBF1',
    marginTop: 4,
    lineHeight: 15,
  },
  upgradeBannerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  upgradeBannerActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
