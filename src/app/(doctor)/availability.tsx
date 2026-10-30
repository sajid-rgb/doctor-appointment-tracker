import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  type AvailabilitySettings,
  DEFAULT_AVAILABILITY,
  DOCTOR_AVAILABILITY_STORAGE_KEY,
  getDoctorAvailabilityKey,
  TIME_SLOTS,
} from '../../constants/availability';
import { useAuthStore } from '../../store/authStore';
import { useDoctorStore } from '../../store/doctorStore';

const TEAL = '#0F766E';

export default function DoctorAvailabilityScreen() {
  const user = useAuthStore((state) => state.user);
  const doctors = useDoctorStore((state) => state.doctors);
  const updateDoctorAvailability = useDoctorStore(
    (state) => state.updateDoctorAvailability
  );

  const currentDoctor = doctors.find((d) => d.id === user?.id);

  const [settings, setSettings] = useState<AvailabilitySettings>(
    () => currentDoctor?.availability ?? DEFAULT_AVAILABILITY
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      try {
        if (currentDoctor?.availability) {
          if (mounted) {
            setSettings(currentDoctor.availability);
            setLoading(false);
          }
          return;
        }

        const doctorKey = getDoctorAvailabilityKey(user?.id);
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
            setSettings(parsed);
            if (user?.id) {
              updateDoctorAvailability(user.id, parsed);
            }
          }
        }
      } catch {
        Alert.alert(
          'Could not load availability',
          'Default availability settings will be shown.'
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      mounted = false;
    };
  }, [user?.id, currentDoctor?.availability, updateDoctorAvailability]);

  const updateSettings = (
    updater: (current: AvailabilitySettings) => AvailabilitySettings
  ) => {
    setSettings((current) => updater(current));
    setSaved(false);
  };

  const toggleDay = (day: string, enabled: boolean) => {
    updateSettings((current) => ({
      ...current,
      schedule: current.schedule.map((item) =>
        item.day === day ? { ...item, enabled } : item
      ),
    }));
  };

  const toggleTimeSlot = (day: string, slot: string) => {
    updateSettings((current) => ({
      ...current,
      schedule: current.schedule.map((item) => {
        if (item.day !== day) {
          return item;
        }

        const exists = item.slots.includes(slot);

        return {
          ...item,
          slots: exists
            ? item.slots.filter((time) => time !== slot)
            : [...item.slots, slot].sort(
                (a, b) => TIME_SLOTS.indexOf(a) - TIME_SLOTS.indexOf(b)
              ),
        };
      }),
    }));
  };

  const saveAvailability = async () => {
    setSaving(true);

    try {
      const json = JSON.stringify(settings);

      // Save to doctor-specific key and generic key
      if (user?.id) {
        await AsyncStorage.setItem(getDoctorAvailabilityKey(user.id), json);
        updateDoctorAvailability(user.id, settings);
      }
      await AsyncStorage.setItem(DOCTOR_AVAILABILITY_STORAGE_KEY, json);

      setSaved(true);
      Alert.alert(
        'Availability saved',
        'Your weekly availability has been saved and will be reflected for patient bookings.'
      );
    } catch {
      Alert.alert(
        'Save failed',
        'Could not save your availability. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const enabledDays = settings.schedule.filter(
    (day) => day.enabled && day.slots.length > 0
  ).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={TEAL} />
        <Text style={styles.loadingText}>Loading availability...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="calendar" size={27} color={TEAL} />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.title}>My Availability</Text>
            <Text style={styles.subtitle}>
              Manage your consultation days and time slots.
            </Text>
          </View>
        </View>

        {/* Booking availability */}
        <View style={styles.bookingCard}>
          <View style={styles.bookingText}>
            <Text style={styles.bookingTitle}>Accept appointments</Text>
            <Text style={styles.bookingSubtitle}>
              {settings.acceptingAppointments
                ? 'Patients can view your availability.'
                : 'New appointments are turned off.'}
            </Text>
          </View>

          <Switch
            value={settings.acceptingAppointments}
            onValueChange={(value) =>
              updateSettings((current) => ({
                ...current,
                acceptingAppointments: value,
              }))
            }
            trackColor={{
              false: '#CBD5E1',
              true: '#99F6E4',
            }}
            thumbColor={settings.acceptingAppointments ? TEAL : '#F8FAFC'}
          />
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="time-outline" size={24} color={TEAL} />
          </View>

          <View style={styles.summaryText}>
            <Text style={styles.summaryNumber}>
              {enabledDays} days per week
            </Text>
            <Text style={styles.summaryCaption}>
              Days with at least one available time slot
            </Text>
          </View>
        </View>

        {/* Weekly schedule */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Weekly schedule</Text>
          <Text style={styles.sectionHint}>Select your hours</Text>
        </View>

        {settings.schedule.map((item) => (
          <View key={item.day} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <View style={styles.dayTitleContainer}>
                <Text style={styles.dayName}>{item.day}</Text>
                <Text
                  style={[
                    styles.dayStatus,
                    item.enabled && item.slots.length > 0
                      ? styles.activeStatus
                      : styles.inactiveStatus,
                  ]}
                >
                  {item.enabled && item.slots.length > 0
                    ? `${item.slots.length} time slots`
                    : 'Unavailable'}
                </Text>
              </View>

              <Switch
                value={item.enabled}
                onValueChange={(value) => toggleDay(item.day, value)}
                trackColor={{
                  false: '#CBD5E1',
                  true: '#99F6E4',
                }}
                thumbColor={item.enabled ? TEAL : '#F8FAFC'}
              />
            </View>

            {item.enabled ? (
              <>
                <View style={styles.slotDivider} />

                <Text style={styles.slotLabel}>
                  Available consultation times
                </Text>

                <View style={styles.slotsContainer}>
                  {TIME_SLOTS.map((slot) => {
                    const selected = item.slots.includes(slot);

                    return (
                      <TouchableOpacity
                        key={slot}
                        activeOpacity={0.75}
                        onPress={() => toggleTimeSlot(item.day, slot)}
                        style={[
                          styles.timeSlot,
                          selected && styles.selectedTimeSlot,
                        ]}
                      >
                        {selected && (
                          <Ionicons
                            name="checkmark"
                            size={14}
                            color="#FFFFFF"
                          />
                        )}

                        <Text
                          style={[
                            styles.timeSlotText,
                            selected && styles.selectedTimeSlotText,
                          ]}
                        >
                          {slot}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.helperText}>
                  Tap a time to add or remove it.
                </Text>
              </>
            ) : (
              <View style={styles.unavailableRow}>
                <Ionicons name="moon-outline" size={18} color="#94A3B8" />
                <Text style={styles.unavailableText}>
                  You are not available on this day.
                </Text>
              </View>
            )}
          </View>
        ))}

        {/* Information */}
        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={21}
            color="#2563EB"
          />
          <Text style={styles.infoText}>
            These settings are saved locally on this device. A backend
            connection is needed to share your availability with patients across
            devices.
          </Text>
        </View>
      </ScrollView>

      {/* Save button */}
      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={saveAvailability}
          disabled={saving || saved}
          style={[
            styles.saveButton,
            (saving || saved) && styles.disabledSaveButton,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Ionicons
              name={saved ? 'checkmark-circle' : 'save-outline'}
              size={20}
              color="#FFFFFF"
            />
          )}

          <Text style={styles.saveButtonText}>
            {saving
              ? 'Saving...'
              : saved
                ? 'Availability Saved'
                : 'Save Availability'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#64748B',
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  bookingText: {
    flex: 1,
    paddingRight: 10,
  },
  bookingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  bookingSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
    marginTop: 5,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 16,
    padding: 15,
    marginBottom: 26,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    flex: 1,
    marginLeft: 13,
  },
  summaryNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#134E4A',
  },
  summaryCaption: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionHint: {
    color: '#64748B',
    fontSize: 11,
  },
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 15,
    marginBottom: 13,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayTitleContainer: {
    flex: 1,
  },
  dayName: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  dayStatus: {
    fontSize: 12,
    marginTop: 4,
  },
  activeStatus: {
    color: TEAL,
  },
  inactiveStatus: {
    color: '#94A3B8',
  },
  slotDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  slotLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 11,
  },
  slotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlot: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectedTimeSlot: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  timeSlotText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  selectedTimeSlotText: {
    color: '#FFFFFF',
  },
  helperText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 11,
  },
  unavailableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 6,
  },
  unavailableText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 13,
    marginTop: 8,
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    color: '#1E40AF',
    fontSize: 12,
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: TEAL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  disabledSaveButton: {
    opacity: 0.75,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
