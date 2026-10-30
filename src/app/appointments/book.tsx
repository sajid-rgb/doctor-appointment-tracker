import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import * as DocumentPicker from 'expo-document-picker';
import {
  type AvailabilitySettings,
  DEFAULT_AVAILABILITY,
  DOCTOR_AVAILABILITY_STORAGE_KEY,
  getDoctorAvailabilityKey,
  getWeekdayName,
  isSlotInPast,
} from '../../constants/availability';
import {
  type UploadedPrescriptionFile,
  generateUniqueSerialNumber,
  useAppointmentStore,
} from '../../store/appointmentStore';
import { useAuthStore } from '../../store/authStore';
import { useDoctorStore } from '../../store/doctorStore';
import { sendWhatsAppNotification } from '../../utils/whatsapp';

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;
const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDate(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);

  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function BookAppointmentScreen() {
  const router = useRouter();

  const { doctorId } = useLocalSearchParams<{
    doctorId: string;
  }>();

  const user = useAuthStore((state) => state.user);
  const updateUserProfile = useAuthStore((state) => state.updateUserProfile);
  const doctors = useDoctorStore((state) => state.doctors);
  const updateDoctorAvailability = useDoctorStore(
    (state) => state.updateDoctorAvailability
  );
  const appointments = useAppointmentStore((state) => state.appointments);
  const addAppointment = useAppointmentStore((state) => state.addAppointment);

  const doctor = doctors.find((item) => item.id === doctorId);

  const [availability, setAvailability] = useState<AvailabilitySettings>(
    () => doctor?.availability ?? DEFAULT_AVAILABILITY
  );
  const [loadingAvailability, setLoadingAvailability] = useState(
    !doctor?.availability
  );

  // Load availability dynamically from doctorStore or AsyncStorage
  useEffect(() => {
    let mounted = true;

    async function loadDoctorAvailability() {
      if (doctor?.availability) {
        setAvailability(doctor.availability);
        setLoadingAvailability(false);
        return;
      }

      try {
        const doctorKey = getDoctorAvailabilityKey(doctorId);
        let stored = await AsyncStorage.getItem(doctorKey);

        if (!stored) {
          stored = await AsyncStorage.getItem(DOCTOR_AVAILABILITY_STORAGE_KEY);
        }

        if (stored && mounted) {
          const parsed = JSON.parse(stored) as AvailabilitySettings;
          if (
            typeof parsed.acceptingAppointments === 'boolean' &&
            Array.isArray(parsed.schedule)
          ) {
            setAvailability(parsed);
            if (doctorId) {
              updateDoctorAvailability(doctorId, parsed);
            }
          }
        }
      } catch (err) {
        console.warn('Could not load doctor availability:', err);
      } finally {
        if (mounted) {
          setLoadingAvailability(false);
        }
      }
    }

    loadDoctorAvailability();

    return () => {
      mounted = false;
    };
  }, [doctorId, doctor?.availability, updateDoctorAvailability]);

  // Next 14 days for appointment scheduling
  const dateOptions = useMemo(() => {
    const dates: {
      value: string;
      day: string;
      date: string;
      dayOfWeek: string;
      isAvailable: boolean;
    }[] = [];

    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() + i);

      const iso = toISODate(date);
      const dayOfWeek = getWeekdayName(iso);
      const daySchedule = availability.schedule.find(
        (s) => s.day.toLowerCase() === dayOfWeek.toLowerCase()
      );

      const activeFutureSlots = (daySchedule?.slots ?? []).filter(
        (slot) => !isSlotInPast(iso, slot)
      );

      const isAvailable = Boolean(
        availability.acceptingAppointments &&
          daySchedule?.enabled &&
          activeFutureSlots.length > 0
      );

      dates.push({
        value: iso,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: String(date.getDate()),
        dayOfWeek,
        isAvailable,
      });
    }

    return dates;
  }, [availability]);

  // Select initial date: first available date or today
  const [selectedDate, setSelectedDate] = useState(() => {
    const firstAvailable = dateOptions.find((d) => d.isAvailable);
    return firstAvailable?.value ?? dateOptions[0]?.value ?? toISODate(new Date());
  });

  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);

  // Patient Intake Form States
  const [patientAge, setPatientAge] = useState(() =>
    user?.age ? String(user.age) : ''
  );
  const [patientGender, setPatientGender] = useState<'Male' | 'Female' | 'Other'>(
    () => (user?.gender as 'Male' | 'Female' | 'Other') || 'Male'
  );
  const [patientPhone, setPatientPhone] = useState(() => user?.phone ?? '');
  const [bloodGroup, setBloodGroup] = useState(() => user?.bloodGroup ?? '');
  const [condition, setCondition] = useState('');
  const [previousDocuments, setPreviousDocuments] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [prescriptionFiles, setPrescriptionFiles] = useState<
    UploadedPrescriptionFile[]
  >([]);
  const [isPickingFile, setIsPickingFile] = useState(false);

  const handlePickDocument = async () => {
    try {
      setIsPickingFile(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const added: UploadedPrescriptionFile[] = result.assets.map((asset) => ({
          name: asset.name,
          uri: asset.uri,
          size: asset.size,
          mimeType: asset.mimeType,
        }));
        setPrescriptionFiles((prev) => [...prev, ...added]);
      }
    } catch (err) {
      console.warn('Document picker error:', err);
      Alert.alert('Upload Error', 'Could not open file selector. Please try again.');
    } finally {
      setIsPickingFile(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    setPrescriptionFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Dynamic slots for selected date based on availability schedule
  const selectedDayOfWeek = useMemo(
    () => getWeekdayName(selectedDate),
    [selectedDate]
  );

  const estimatedSerialNumber = useMemo(() => {
    if (!doctorId || !selectedDate) return 'SL-01';
    return generateUniqueSerialNumber(doctorId, selectedDate, appointments);
  }, [doctorId, selectedDate, appointments]);

  const selectedDaySchedule = useMemo(() => {
    return availability.schedule.find(
      (s) => s.day.toLowerCase() === selectedDayOfWeek.toLowerCase()
    );
  }, [availability, selectedDayOfWeek]);

  // Filter out any slot that has already passed for the selected date
  const dynamicSlots = useMemo(() => {
    if (!availability.acceptingAppointments || !selectedDaySchedule?.enabled) {
      return [];
    }
    const rawSlots = selectedDaySchedule.slots ?? [];
    return rawSlots.filter((slot) => !isSlotInPast(selectedDate, slot));
  }, [availability.acceptingAppointments, selectedDaySchedule, selectedDate]);

  const isDayEnabled = Boolean(
    availability.acceptingAppointments &&
      selectedDaySchedule?.enabled &&
      dynamicSlots.length > 0
  );

  // Reset selected time if it becomes invalid on date switch
  useEffect(() => {
    if (selectedTime) {
      const isSlotValid = dynamicSlots.includes(selectedTime);
      const isBooked = appointments.some(
        (a) =>
          a.doctorId === doctorId &&
          a.date === selectedDate &&
          a.time === selectedTime &&
          a.status !== 'cancelled'
      );

      if (!isSlotValid || isBooked) {
        setSelectedTime(null);
      }
    }
  }, [selectedDate, dynamicSlots, selectedTime, appointments, doctorId]);

  const isSelectedTimeBooked = useMemo(() => {
    if (!selectedTime) return false;
    return appointments.some(
      (appointment) =>
        appointment.doctorId === doctorId &&
        appointment.date === selectedDate &&
        appointment.time === selectedTime &&
        appointment.status !== 'cancelled'
    );
  }, [appointments, doctorId, selectedDate, selectedTime]);

  if (!doctor || doctor.approvalStatus !== 'approved') {
    return (
      <View style={styles.unavailable}>
        <Ionicons name="alert-circle-outline" size={52} color="#DC2626" />
        <Text style={styles.unavailableTitle}>Doctor unavailable</Text>
        <Text style={styles.muted}>
          This doctor does not exist or is not approved for bookings.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const handleBooking = () => {
    if (!user || user.role !== 'patient') {
      Alert.alert(
        'Patient account required',
        'Please log in with a patient account to book an appointment.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/login'),
          },
        ]
      );
      return;
    }

    if (!availability.acceptingAppointments) {
      Alert.alert(
        'Not accepting appointments',
        'This doctor is currently not accepting new appointments.'
      );
      return;
    }

    if (!selectedDate || !selectedTime) {
      Alert.alert(
        'Select date and time',
        'Please choose an appointment date and time slot first.'
      );
      return;
    }

    if (isSelectedTimeBooked) {
      Alert.alert(
        'Time slot unavailable',
        'This doctor already has an appointment for the selected slot.'
      );
      return;
    }

    if (isSlotInPast(selectedDate, selectedTime)) {
      Alert.alert(
        'Time slot passed',
        'The selected appointment time has already passed. Please select an upcoming time slot.'
      );
      return;
    }

    const ageNum = parseInt(patientAge.trim(), 10);
    if (
      !patientAge.trim() ||
      Number.isNaN(ageNum) ||
      ageNum <= 0 ||
      ageNum > 130
    ) {
      Alert.alert('Age required', 'Please enter a valid patient age (1-130).');
      return;
    }

    if (!patientPhone.trim()) {
      Alert.alert(
        'Contact phone required',
        'Please provide a contact phone number so the clinic can reach you.'
      );
      return;
    }

    if (!bloodGroup.trim()) {
      Alert.alert(
        'Blood group required',
        'Please select the patient blood group.'
      );
      return;
    }

    if (!condition.trim()) {
      Alert.alert(
        'Medical condition required',
        'Please provide a brief description of your symptoms or reason for visit.'
      );
      return;
    }

    setIsBooking(true);

    try {
      const created = addAppointment({
        patientId: user.id,
        patientName: user.name,
        patientAge: ageNum,
        patientGender,
        patientPhone: patientPhone.trim(),
        bloodGroup: bloodGroup.trim(),
        condition: condition.trim(),
        previousDocuments:
          previousDocuments.trim() || 'No previous documents provided',
        prescriptionFiles:
          prescriptionFiles.length > 0 ? prescriptionFiles : undefined,
        additionalNotes: additionalNotes.trim() || undefined,
        doctorId: doctor.id,
        doctorName: doctor.name,
        specialty: doctor.specialty,
        fee: doctor.fee,
        date: selectedDate,
        time: selectedTime,
      });

      // Update patient profile for future bookings
      updateUserProfile({
        age: ageNum,
        gender: patientGender,
        phone: patientPhone.trim(),
        bloodGroup: bloodGroup.trim(),
      });

      Alert.alert(
        '🎉 Booking Confirmed!',
        `Your appointment is confirmed!\n\n🎟️ Serial Number: ${created.serialNumber}\n👨‍⚕️ Doctor: ${doctor.name}\n📅 Date: ${selectedDate} (${selectedTime})\n\nSend confirmation slip to WhatsApp?`,
        [
          {
            text: 'View Appointments',
            style: 'cancel',
            onPress: () => router.replace('/(tabs)/appointments'),
          },
          {
            text: 'Send to WhatsApp',
            onPress: async () => {
              await sendWhatsAppNotification({
                phone: patientPhone.trim(),
                serialNumber: created.serialNumber,
                patientName: user.name,
                doctorName: doctor.name,
                specialty: doctor.specialty,
                date: selectedDate,
                time: selectedTime,
                fee: doctor.fee,
              });
              router.replace('/(tabs)/appointments');
            },
          },
        ]
      );
    } catch {
      Alert.alert('Booking failed', 'Something went wrong. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#0F172A" />
        <Text style={styles.backText}>Back to doctors</Text>
      </Pressable>

      <Text style={styles.title}>Book Appointment</Text>
      <Text style={styles.subtitle}>
        Choose a convenient date and time based on the doctor's live
        availability.
      </Text>

      {/* Doctor Card */}
      <View style={styles.doctorCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={34} color="#0F766E" />
        </View>

        <View style={styles.doctorInfo}>
          <Text style={styles.doctorName}>{doctor.name}</Text>
          <Text style={styles.specialty}>{doctor.specialty}</Text>
          <Text style={styles.qualification}>{doctor.qualification}</Text>
          <Text style={styles.experience}>
            {doctor.experience} years experience
          </Text>
        </View>

        <View style={styles.feeContainer}>
          <Text style={styles.feeLabel}>Fee</Text>
          <Text style={styles.fee}>৳{doctor.fee}</Text>
        </View>
      </View>

      {/* Accepting status alert */}
      {!availability.acceptingAppointments && (
        <View style={styles.closedBanner}>
          <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
          <View style={{ flex: 1 }}>
            <Text style={styles.closedBannerTitle}>Not Accepting Bookings</Text>
            <Text style={styles.closedBannerSubtitle}>
              {doctor.name} has temporarily turned off new appointment bookings.
            </Text>
          </View>
        </View>
      )}

      {loadingAvailability ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#0F766E" />
          <Text style={styles.loadingText}>Loading doctor availability...</Text>
        </View>
      ) : (
        <>
          {/* Select Date */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Select Date</Text>
            <Text style={styles.dayBadge}>{selectedDayOfWeek}</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateList}
          >
            {dateOptions.map((item) => {
              const selected = selectedDate === item.value;

              return (
                <Pressable
                  key={item.value}
                  onPress={() => setSelectedDate(item.value)}
                  style={[
                    styles.dateCard,
                    selected && styles.selectedDateCard,
                    !item.isAvailable && styles.offDateCard,
                  ]}
                >
                  <Text
                    style={[
                      styles.dateDay,
                      selected && styles.selectedText,
                      !item.isAvailable && !selected && styles.offText,
                    ]}
                  >
                    {item.day}
                  </Text>
                  <Text
                    style={[
                      styles.dateNumber,
                      selected && styles.selectedText,
                      !item.isAvailable && !selected && styles.offText,
                    ]}
                  >
                    {item.date}
                  </Text>
                  <Text
                    style={[
                      styles.availabilityDotText,
                      selected && styles.selectedText,
                      !item.isAvailable && !selected && styles.offStatusText,
                    ]}
                  >
                    {item.isAvailable ? 'Open' : 'Off'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.selectedDateText}>{formatDate(selectedDate)}</Text>

          {/* Select Time (Dynamic from doctor's availability schedule) */}
          <Text style={styles.sectionTitle}>Select Time Slot</Text>

          {dynamicSlots.length === 0 ? (
            <View style={styles.noSlotsBox}>
              <Ionicons name="calendar-outline" size={32} color="#94A3B8" />
              <Text style={styles.noSlotsTitle}>No slots available</Text>
              <Text style={styles.noSlotsSubtitle}>
                {!availability.acceptingAppointments
                  ? 'Doctor is not accepting appointments at this time.'
                  : !selectedDaySchedule?.enabled
                    ? `${doctor.name} is not taking consultations on ${selectedDayOfWeek}s. Please pick another day.`
                    : 'No more upcoming appointment slots available for today. All earlier slots have passed. Please pick an upcoming date.'}
              </Text>
            </View>
          ) : (
            <View style={styles.timeGrid}>
              {dynamicSlots.map((time) => {
                const selected = selectedTime === time;
                const isBooked = appointments.some(
                  (a) =>
                    a.doctorId === doctorId &&
                    a.date === selectedDate &&
                    a.time === time &&
                    a.status !== 'cancelled'
                );

                return (
                  <Pressable
                    key={time}
                    disabled={isBooked}
                    onPress={() => setSelectedTime(time)}
                    style={[
                      styles.timeSlot,
                      selected && styles.selectedTimeSlot,
                      isBooked && styles.bookedTimeSlot,
                    ]}
                  >
                    <Ionicons
                      name={
                        isBooked
                          ? 'close-circle-outline'
                          : selected
                            ? 'checkmark-circle'
                            : 'time-outline'
                      }
                      size={16}
                      color={
                        isBooked
                          ? '#94A3B8'
                          : selected
                            ? '#FFFFFF'
                            : '#475569'
                      }
                    />
                    <Text
                      style={[
                        styles.timeText,
                        selected && styles.selectedText,
                        isBooked && styles.bookedTimeText,
                      ]}
                    >
                      {time}
                    </Text>
                    {isBooked && (
                      <View style={styles.bookedBadge}>
                        <Text style={styles.bookedBadgeText}>Booked</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {isSelectedTimeBooked && (
            <Text style={styles.warning}>
              This slot already has a booking in local storage. Please select
              another time.
            </Text>
          )}

          {/* Patient & Medical Intake Form */}
          <View style={styles.formSection}>
            <View style={styles.formHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Patient Information</Text>
                <Text style={styles.formSubtitle}>
                  Fill in your details for the consulting doctor to review.
                </Text>
              </View>
              <View style={styles.patientBadge}>
                <Ionicons name="medical" size={15} color="#0F766E" />
                <Text style={styles.patientBadgeText}>Intake</Text>
              </View>
            </View>

            {/* Read-Only Field: Name */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Patient Full Name</Text>
                <View style={styles.readOnlyTag}>
                  <Ionicons name="lock-closed" size={11} color="#0F766E" />
                  <Text style={styles.readOnlyTagText}>Read-only (Profile)</Text>
                </View>
              </View>
              <View style={styles.readOnlyInput}>
                <Ionicons name="person-outline" size={18} color="#64748B" />
                <Text style={styles.readOnlyText}>{user?.name || 'Patient'}</Text>
              </View>
            </View>

            {/* Read-Only Field: Email */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Account Email</Text>
                <View style={styles.readOnlyTag}>
                  <Ionicons name="lock-closed" size={11} color="#0F766E" />
                  <Text style={styles.readOnlyTagText}>Read-only (Profile)</Text>
                </View>
              </View>
              <View style={styles.readOnlyInput}>
                <Ionicons name="mail-outline" size={18} color="#64748B" />
                <Text style={styles.readOnlyText}>{user?.email || 'N/A'}</Text>
              </View>
            </View>

            {/* Age & Gender Row */}
            <View style={styles.rowTwoCols}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>Age *</Text>
                  {user?.age ? (
                    <View style={styles.readOnlyTag}>
                      <Ionicons name="lock-closed" size={10} color="#0F766E" />
                      <Text style={styles.readOnlyTagText}>Profile</Text>
                    </View>
                  ) : null}
                </View>
                <TextInput
                  style={[
                    styles.input,
                    Boolean(user?.age) && styles.readOnlyInputStyle,
                  ]}
                  value={patientAge}
                  onChangeText={setPatientAge}
                  placeholder="e.g. 28"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  editable={!user?.age}
                />
              </View>

              <View style={{ flex: 1.4 }}>
                <Text style={styles.fieldLabel}>Gender *</Text>
                <View style={styles.genderRow}>
                  {GENDER_OPTIONS.map((g) => {
                    const isSelected = patientGender === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        activeOpacity={0.8}
                        onPress={() => setPatientGender(g)}
                        style={[
                          styles.genderChip,
                          isSelected && styles.genderChipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.genderChipText,
                            isSelected && styles.genderChipTextSelected,
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

            {/* Contact Phone */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Phone Number *</Text>
                {user?.phone ? (
                  <View style={styles.readOnlyTag}>
                    <Ionicons name="lock-closed" size={10} color="#0F766E" />
                    <Text style={styles.readOnlyTagText}>Profile</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.inputWithIcon}>
                <Ionicons name="call-outline" size={18} color="#64748B" />
                <TextInput
                  style={[
                    styles.inputInner,
                    Boolean(user?.phone) && styles.readOnlyInputStyle,
                  ]}
                  value={patientPhone}
                  onChangeText={setPatientPhone}
                  placeholder="e.g. 01700000000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  editable={!user?.phone}
                />
              </View>
            </View>

            {/* Blood Group */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Blood Group *</Text>
                {user?.bloodGroup ? (
                  <View style={styles.readOnlyTag}>
                    <Ionicons name="lock-closed" size={10} color="#0F766E" />
                    <Text style={styles.readOnlyTagText}>Profile</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.bloodGroupGrid}>
                {BLOOD_GROUPS.map((bg) => {
                  const isSelected = bloodGroup === bg;
                  return (
                    <TouchableOpacity
                      key={bg}
                      activeOpacity={0.8}
                      disabled={Boolean(user?.bloodGroup)}
                      onPress={() => setBloodGroup(bg)}
                      style={[
                        styles.bloodChip,
                        isSelected && styles.bloodChipSelected,
                        Boolean(user?.bloodGroup) &&
                          !isSelected && { opacity: 0.5 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.bloodChipText,
                          isSelected && styles.bloodChipTextSelected,
                        ]}
                      >
                        {bg}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Medical Condition */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Current Medical Condition & Symptoms *
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={condition}
                onChangeText={setCondition}
                placeholder="Explain what symptoms or illness you are experiencing, how long you've had them, etc."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Previous Prescriptions & Documents */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>
                  Prescription & Medical Records
                </Text>
                <Text style={styles.fieldOptional}>Optional</Text>
              </View>

              <Text style={styles.fieldHint}>
                Upload photos of your previous doctor prescriptions, hospital discharge sheets, or lab test PDFs.
              </Text>

              {/* Upload Action Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePickDocument}
                disabled={isPickingFile}
                style={styles.uploadButton}
              >
                {isPickingFile ? (
                  <ActivityIndicator size="small" color="#0F766E" />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={20} color="#0F766E" />
                )}
                <Text style={styles.uploadButtonText}>
                  {isPickingFile ? 'Opening files...' : 'Upload Prescription / Document'}
                </Text>
              </TouchableOpacity>

              {/* Attached Files List */}
              {prescriptionFiles.length > 0 && (
                <View style={styles.filesList}>
                  {prescriptionFiles.map((file, idx) => {
                    const isImg =
                      file.mimeType?.startsWith('image/') ||
                      /\.(jpg|jpeg|png|webp)$/i.test(file.name);

                    return (
                      <View key={`${file.name}-${idx}`} style={styles.fileItem}>
                        <View style={styles.fileIconBox}>
                          <Ionicons
                            name={isImg ? 'image-outline' : 'document-text-outline'}
                            size={18}
                            color="#0F766E"
                          />
                        </View>
                        <View style={styles.fileInfo}>
                          <Text style={styles.fileName} numberOfLines={1}>
                            {file.name}
                          </Text>
                          <Text style={styles.fileMeta}>
                            {isImg ? 'Image' : 'Document'}
                            {file.size ? ` • ${formatFileSize(file.size)}` : ''}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRemoveFile(idx)}
                          style={styles.fileDeleteButton}
                        >
                          <Ionicons name="trash-outline" size={17} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Prescription / History notes */}
              <TextInput
                style={[styles.input, styles.textArea, { marginTop: 10 }]}
                value={previousDocuments}
                onChangeText={setPreviousDocuments}
                placeholder="Write any additional details about past prescriptions, surgeries, or doctor advice..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />

              <View style={styles.quickPresetsRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    setPreviousDocuments((prev) =>
                      prev
                        ? `${prev}, No prior history`
                        : 'No prior medical history'
                    )
                  }
                  style={styles.presetChip}
                >
                  <Text style={styles.presetChipText}>+ No prior records</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    setPreviousDocuments((prev) =>
                      prev
                        ? `${prev}, Carrying recent lab reports`
                        : 'Carrying recent lab reports'
                    )
                  }
                  style={styles.presetChip}
                >
                  <Text style={styles.presetChipText}>
                    + Carrying lab reports
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Additional Notes */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Known Allergies or Regular Medications (Optional)
              </Text>
              <TextInput
                style={styles.input}
                value={additionalNotes}
                onChangeText={setAdditionalNotes}
                placeholder="e.g. Penicillin allergy, taking insulin or BP pills..."
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Booking Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Booking Summary</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Doctor</Text>
              <Text style={styles.summaryValue}>{doctor.name}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Specialty</Text>
              <Text style={styles.summaryValue}>{doctor.specialty}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date & Time</Text>
              <Text style={styles.summaryValue}>
                {formatDate(selectedDate)} at {selectedTime ?? 'Not selected'}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Expected Serial</Text>
              <View style={styles.serialBadge}>
                <Text style={styles.serialBadgeText}>
                  {estimatedSerialNumber}
                </Text>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Patient</Text>
              <Text style={styles.summaryValue}>
                {user?.name || 'Patient'}
                {patientAge ? ` (${patientAge} yrs, ${patientGender})` : ''}
              </Text>
            </View>

            {bloodGroup ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Blood Group</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: '#DC2626', fontWeight: '800' },
                  ]}
                >
                  {bloodGroup}
                </Text>
              </View>
            ) : null}

            {condition ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Condition</Text>
                <Text
                  style={[styles.summaryValue, { color: '#0F766E' }]}
                  numberOfLines={1}
                >
                  {condition}
                </Text>
              </View>
            ) : null}

            {prescriptionFiles.length > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Attached Prescriptions</Text>
                <Text style={[styles.summaryValue, { color: '#0F766E' }]}>
                  {prescriptionFiles.length} file{prescriptionFiles.length > 1 ? 's' : ''}
                </Text>
              </View>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Consultation Fee</Text>
              <Text style={styles.totalFee}>৳{doctor.fee}</Text>
            </View>
          </View>

          <Pressable
            style={[
              styles.primaryButton,
              (!selectedTime ||
                isSelectedTimeBooked ||
                isBooking ||
                !availability.acceptingAppointments ||
                !isDayEnabled ||
                !patientAge.trim() ||
                !patientPhone.trim() ||
                !bloodGroup.trim() ||
                !condition.trim()) &&
                styles.disabledButton,
            ]}
            disabled={
              !selectedTime ||
              isSelectedTimeBooked ||
              isBooking ||
              !availability.acceptingAppointments ||
              !isDayEnabled
            }
            onPress={handleBooking}
          >
            <Text style={styles.primaryButtonText}>
              {isBooking ? 'Submitting...' : 'Confirm Appointment'}
            </Text>
            {!isBooking && (
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            )}
          </Pressable>

          <Text style={styles.disclaimer}>
            This appointment request uses the doctor's live availability
            schedule and is saved locally on this device.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 22,
  },
  backText: {
    color: '#334155',
    fontWeight: '600',
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    color: '#64748B',
    marginTop: 7,
    lineHeight: 21,
  },
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 22,
    gap: 12,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CCFBF1',
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  specialty: {
    color: '#0F766E',
    fontWeight: '600',
    marginTop: 4,
  },
  qualification: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 5,
  },
  experience: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 3,
  },
  feeContainer: {
    alignItems: 'flex-end',
  },
  feeLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  fee: {
    color: '#0F766E',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  dayBadge: {
    backgroundColor: '#CCFBF1',
    color: '#0F766E',
    fontWeight: '700',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dateList: {
    gap: 10,
    paddingBottom: 5,
  },
  dateCard: {
    width: 66,
    height: 86,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  selectedDateCard: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  offDateCard: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    opacity: 0.75,
  },
  dateDay: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  dateNumber: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 3,
  },
  availabilityDotText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F766E',
    marginTop: 4,
  },
  offStatusText: {
    color: '#94A3B8',
  },
  selectedText: {
    color: '#FFFFFF',
  },
  offText: {
    color: '#94A3B8',
  },
  selectedDateText: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 10,
    fontWeight: '600',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  timeSlot: {
    width: '48%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
  },
  selectedTimeSlot: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  bookedTimeSlot: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    opacity: 0.6,
  },
  timeText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  bookedTimeText: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  bookedBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bookedBadgeText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
  noSlotsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noSlotsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  noSlotsSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 14,
    borderRadius: 14,
    marginTop: 18,
  },
  closedBannerTitle: {
    color: '#991B1B',
    fontWeight: '700',
    fontSize: 14,
  },
  closedBannerSubtitle: {
    color: '#B91C1C',
    fontSize: 12,
    marginTop: 2,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 30,
  },
  loadingText: {
    color: '#0F766E',
    fontWeight: '600',
    fontSize: 14,
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginTop: 28,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  formSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 3,
  },
  patientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  patientBadgeText: {
    color: '#0F766E',
    fontWeight: '800',
    fontSize: 11,
  },
  fieldGroup: {
    marginTop: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  readOnlyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  readOnlyTagText: {
    color: '#0F766E',
    fontSize: 10,
    fontWeight: '700',
  },
  readOnlyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  readOnlyText: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '700',
  },
  readOnlyInputStyle: {
    backgroundColor: '#F1F5F9',
    color: '#475569',
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputInner: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 74,
    paddingTop: 10,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 6,
  },
  genderChip: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  genderChipSelected: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  genderChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  genderChipTextSelected: {
    color: '#FFFFFF',
  },
  bloodGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bloodChip: {
    width: '22.8%',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  bloodChipSelected: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  bloodChipText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
  },
  bloodChipTextSelected: {
    color: '#FFFFFF',
  },
  quickPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  presetChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  warning: {
    color: '#B91C1C',
    marginTop: 12,
    lineHeight: 19,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginTop: 28,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
    marginVertical: 7,
  },
  summaryLabel: {
    color: '#64748B',
    flexShrink: 0,
  },
  summaryValue: {
    color: '#0F172A',
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  totalLabel: {
    color: '#0F172A',
    fontWeight: '700',
  },
  totalFee: {
    color: '#0F766E',
    fontSize: 19,
    fontWeight: '800',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0F766E',
    padding: 16,
    borderRadius: 14,
    marginTop: 22,
  },
  disabledButton: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  disclaimer: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 14,
  },
  unavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
    gap: 14,
  },
  unavailableTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
  },
  muted: {
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
  },
  fieldOptional: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  fieldHint: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginVertical: 6,
  },
  uploadButtonText: {
    color: '#0F766E',
    fontWeight: '700',
    fontSize: 13,
  },
  filesList: {
    marginTop: 8,
    gap: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  fileIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  fileMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  fileDeleteButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  serialBadge: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  serialBadgeText: {
    color: '#0F766E',
    fontWeight: '800',
    fontSize: 13,
  },
});
