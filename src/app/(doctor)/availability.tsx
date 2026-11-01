import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  type AvailabilitySettings,
  DAYS_OF_WEEK,
  DEFAULT_AVAILABILITY,
  EVENING_SLOTS_3PM_10PM,
  generateTimeSlots,
  MAX_PATIENTS_PER_SLOT,
  MORNING_SLOTS,
  normalizeTimeString,
  SLOT_DURATION_MINUTES,
  slotToMinutes,
  sortTimeSlots,
  TIME_SLOTS,
} from '../../constants/availability';
import { useAuthStore } from '../../store/authStore';
import { useDoctorStore } from '../../store/doctorStore';

const TEAL = '#0F766E';

export default function DoctorAvailabilityScreen() {
  const user = useAuthStore((state) => state.user);
  const doctors = useDoctorStore((state) => state.doctors);
  const fetchDoctorById = useDoctorStore((state) => state.fetchDoctorById);
  const updateDoctorAvailability = useDoctorStore(
    (state) => state.updateDoctorAvailability
  );

  const currentDoctor = doctors.find(
    (d) =>
      d.id === user?.id ||
      (user?.email && d.email?.toLowerCase() === user.email.toLowerCase())
  );

  useEffect(() => {
    if (!currentDoctor && user?.id) {
      fetchDoctorById(user.id);
    }
  }, [currentDoctor, user?.id, fetchDoctorById]);

  const [settings, setSettings] = useState<AvailabilitySettings>(
    () => currentDoctor?.availability ?? DEFAULT_AVAILABILITY
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  // Dynamic Availability Slot Generator state
  const [generatorStartTime, setGeneratorStartTime] = useState('03:00 PM');
  const [generatorEndTime, setGeneratorEndTime] = useState('10:00 PM');
  const [generatorInterval, setGeneratorInterval] = useState('15');
  const [generatorTarget, setGeneratorTarget] = useState<string>('all');
  const [generatorMode, setGeneratorMode] = useState<'replace' | 'append'>('replace');
  const [isGeneratorExpanded, setIsGeneratorExpanded] = useState(true);

  const previewSlots = useMemo(() => {
    const interval = parseInt(generatorInterval, 10) || 15;
    return generateTimeSlots(generatorStartTime, generatorEndTime, interval);
  }, [generatorStartTime, generatorEndTime, generatorInterval]);

  useEffect(() => {
    let mounted = true;

    function loadSettings() {
      if (currentDoctor?.availability && mounted) {
        setSettings(currentDoctor.availability);
      }
      if (mounted) {
        setLoading(false);
      }
    }

    loadSettings();

    return () => {
      mounted = false;
    };
  }, [currentDoctor?.availability]);

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
            : sortTimeSlots([...item.slots, slot]),
        };
      }),
    }));
  };

  const applyEveningSlotsToDay = (day: string) => {
    updateSettings((current) => ({
      ...current,
      schedule: current.schedule.map((item) =>
        item.day === day
          ? { ...item, slots: [...EVENING_SLOTS_3PM_10PM] }
          : item
      ),
    }));
  };

  const applyMorningSlotsToDay = (day: string) => {
    updateSettings((current) => ({
      ...current,
      schedule: current.schedule.map((item) =>
        item.day === day ? { ...item, slots: [...MORNING_SLOTS] } : item
      ),
    }));
  };

  const clearDaySlots = (day: string) => {
    updateSettings((current) => ({
      ...current,
      schedule: current.schedule.map((item) =>
        item.day === day ? { ...item, slots: [] } : item
      ),
    }));
  };

  const applyEveningSlotsToAllActiveDays = () => {
    updateSettings((current) => ({
      ...current,
      schedule: current.schedule.map((item) =>
        item.enabled
          ? { ...item, slots: [...EVENING_SLOTS_3PM_10PM] }
          : item
      ),
    }));
  };

  const handleApplyDynamicSlots = () => {
    const interval = parseInt(generatorInterval, 10);
    if (!interval || interval <= 0) {
      Alert.alert(
        'Invalid Interval',
        'Please enter a valid interval in minutes (e.g. 15).'
      );
      return;
    }

    const startNorm =
      normalizeTimeString(generatorStartTime) || generatorStartTime;
    const endNorm = normalizeTimeString(generatorEndTime) || generatorEndTime;
    const generated = generateTimeSlots(startNorm, endNorm, interval);

    if (generated.length === 0) {
      Alert.alert(
        'Invalid Time Range',
        'Please ensure Start Time is earlier than End Time (e.g. Start: 03:00 PM, End: 10:00 PM).'
      );
      return;
    }

    updateSettings((current) => ({
      ...current,
      schedule: current.schedule.map((item) => {
        const isTarget =
          generatorTarget === 'all'
            ? item.enabled || !['Friday', 'Sunday'].includes(item.day)
            : item.day === generatorTarget;

        if (!isTarget) return item;

        const mergedSlots =
          generatorMode === 'replace'
            ? [...generated]
            : Array.from(new Set([...item.slots, ...generated]));

        return {
          ...item,
          enabled: true,
          slots: sortTimeSlots(mergedSlots),
        };
      }),
    }));

    const targetLabel =
      generatorTarget === 'all' ? 'all active days' : generatorTarget;

    Alert.alert(
      'Slots Generated Successfully! ⚡',
      `Created ${generated.length} consultation slots from ${startNorm} to ${endNorm} (${interval} min each) for ${targetLabel}.\n\nTap "Save Availability" at the bottom to commit changes.`
    );
  };

  const saveAvailability = async () => {
    setSaving(true);

    try {
      if (user?.id) {
        await updateDoctorAvailability(user.id, settings);
      }

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
              {SLOT_DURATION_MINUTES} min per consultation • {MAX_PATIENTS_PER_SLOT} patient per slot
            </Text>
          </View>
        </View>

        {/* Dynamic Availability Slot Generator */}
        <View style={styles.generatorCard}>
          <TouchableOpacity
            style={styles.generatorHeader}
            activeOpacity={0.8}
            onPress={() => setIsGeneratorExpanded((prev) => !prev)}
          >
            <View style={styles.generatorHeaderLeft}>
              <View style={styles.generatorIcon}>
                <Ionicons name="flash" size={20} color="#0F766E" />
              </View>
              <View style={styles.generatorHeaderText}>
                <Text style={styles.generatorTitle}>
                  Dynamic Slot Generator
                </Text>
                <Text style={styles.generatorSubtitle}>
                  Input start, end time & interval to add slots dynamically
                </Text>
              </View>
            </View>
            <Ionicons
              name={isGeneratorExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#0F766E"
            />
          </TouchableOpacity>

          {isGeneratorExpanded && (
            <View style={styles.generatorBody}>
              {/* Quick Presets */}
              <Text style={styles.fieldSectionLabel}>Quick time range presets</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickPresetsScroll}
              >
                <TouchableOpacity
                  style={[
                    styles.quickPresetChip,
                    generatorStartTime === '03:00 PM' &&
                      generatorEndTime === '10:00 PM' &&
                      generatorInterval === '15' &&
                      styles.activeQuickPresetChip,
                  ]}
                  onPress={() => {
                    setGeneratorStartTime('03:00 PM');
                    setGeneratorEndTime('10:00 PM');
                    setGeneratorInterval('15');
                  }}
                >
                  <Ionicons
                    name="sparkles"
                    size={12}
                    color={
                      generatorStartTime === '03:00 PM' &&
                      generatorEndTime === '10:00 PM' &&
                      generatorInterval === '15'
                        ? '#FFFFFF'
                        : '#0F766E'
                    }
                  />
                  <Text
                    style={[
                      styles.quickPresetChipText,
                      generatorStartTime === '03:00 PM' &&
                        generatorEndTime === '10:00 PM' &&
                        generatorInterval === '15' &&
                        styles.activeQuickPresetChipText,
                    ]}
                  >
                    3 PM – 10 PM (15 min)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickPresetChip,
                    generatorStartTime === '09:00 AM' &&
                      generatorEndTime === '01:00 PM' &&
                      generatorInterval === '15' &&
                      styles.activeQuickPresetChip,
                  ]}
                  onPress={() => {
                    setGeneratorStartTime('09:00 AM');
                    setGeneratorEndTime('01:00 PM');
                    setGeneratorInterval('15');
                  }}
                >
                  <Text
                    style={[
                      styles.quickPresetChipText,
                      generatorStartTime === '09:00 AM' &&
                        generatorEndTime === '01:00 PM' &&
                        generatorInterval === '15' &&
                        styles.activeQuickPresetChipText,
                    ]}
                  >
                    9 AM – 1 PM (15m)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickPresetChip,
                    generatorStartTime === '02:00 PM' &&
                      generatorEndTime === '08:00 PM' &&
                      generatorInterval === '20' &&
                      styles.activeQuickPresetChip,
                  ]}
                  onPress={() => {
                    setGeneratorStartTime('02:00 PM');
                    setGeneratorEndTime('08:00 PM');
                    setGeneratorInterval('20');
                  }}
                >
                  <Text
                    style={[
                      styles.quickPresetChipText,
                      generatorStartTime === '02:00 PM' &&
                        generatorEndTime === '08:00 PM' &&
                        generatorInterval === '20' &&
                        styles.activeQuickPresetChipText,
                    ]}
                  >
                    2 PM – 8 PM (20m)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickPresetChip,
                    generatorStartTime === '05:00 PM' &&
                      generatorEndTime === '09:00 PM' &&
                      generatorInterval === '30' &&
                      styles.activeQuickPresetChip,
                  ]}
                  onPress={() => {
                    setGeneratorStartTime('05:00 PM');
                    setGeneratorEndTime('09:00 PM');
                    setGeneratorInterval('30');
                  }}
                >
                  <Text
                    style={[
                      styles.quickPresetChipText,
                      generatorStartTime === '05:00 PM' &&
                        generatorEndTime === '09:00 PM' &&
                        generatorInterval === '30' &&
                        styles.activeQuickPresetChipText,
                    ]}
                  >
                    5 PM – 9 PM (30m)
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Start Time & End Time Inputs */}
              <View style={styles.timeInputsRow}>
                {/* Start Time Column */}
                <View style={styles.timeInputCol}>
                  <Text style={styles.fieldSectionLabel}>Start Time</Text>
                  <View style={styles.inputBox}>
                    <Ionicons name="time-outline" size={17} color="#0F766E" />
                    <TextInput
                      style={styles.textInput}
                      value={generatorStartTime}
                      onChangeText={setGeneratorStartTime}
                      placeholder="03:00 PM or 3Pm"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={styles.miniChipsRow}>
                    {['09:00 AM', '02:00 PM', '03:00 PM', '05:00 PM'].map((t) => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setGeneratorStartTime(t)}
                        style={[
                          styles.miniChip,
                          generatorStartTime === t && styles.activeMiniChip,
                        ]}
                      >
                        <Text
                          style={[
                            styles.miniChipText,
                            generatorStartTime === t && styles.activeMiniChipText,
                          ]}
                        >
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* End Time Column */}
                <View style={styles.timeInputCol}>
                  <Text style={styles.fieldSectionLabel}>End Time</Text>
                  <View style={styles.inputBox}>
                    <Ionicons name="time-outline" size={17} color="#0F766E" />
                    <TextInput
                      style={styles.textInput}
                      value={generatorEndTime}
                      onChangeText={setGeneratorEndTime}
                      placeholder="10:00 PM or 10Pm"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={styles.miniChipsRow}>
                    {['01:00 PM', '06:00 PM', '09:00 PM', '10:00 PM'].map((t) => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setGeneratorEndTime(t)}
                        style={[
                          styles.miniChip,
                          generatorEndTime === t && styles.activeMiniChip,
                        ]}
                      >
                        <Text
                          style={[
                            styles.miniChipText,
                            generatorEndTime === t && styles.activeMiniChipText,
                          ]}
                        >
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Slot Interval */}
              <View style={styles.intervalSection}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.fieldSectionLabel}>
                    Slot Duration (Interval)
                  </Text>
                  <Text style={styles.intervalHint}>1 patient per slot</Text>
                </View>

                <View style={styles.intervalRow}>
                  {[10, 15, 20, 30, 45, 60].map((mins) => {
                    const isSelected = String(generatorInterval) === String(mins);
                    return (
                      <TouchableOpacity
                        key={mins}
                        style={[
                          styles.intervalChip,
                          isSelected && styles.activeIntervalChip,
                        ]}
                        onPress={() => setGeneratorInterval(String(mins))}
                      >
                        <Text
                          style={[
                            styles.intervalChipText,
                            isSelected && styles.activeIntervalChipText,
                          ]}
                        >
                          {mins} min {mins === 15 ? '★' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Target Days */}
              <View style={styles.targetSection}>
                <Text style={styles.fieldSectionLabel}>Target Consultation Days</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.targetDaysScroll}
                >
                  <TouchableOpacity
                    style={[
                      styles.targetDayChip,
                      generatorTarget === 'all' && styles.activeTargetDayChip,
                    ]}
                    onPress={() => setGeneratorTarget('all')}
                  >
                    <Ionicons
                      name="calendar"
                      size={13}
                      color={generatorTarget === 'all' ? '#FFFFFF' : '#0F766E'}
                    />
                    <Text
                      style={[
                        styles.targetDayChipText,
                        generatorTarget === 'all' && styles.activeTargetDayChipText,
                      ]}
                    >
                      All Active Days
                    </Text>
                  </TouchableOpacity>

                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = generatorTarget === day;
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.targetDayChip,
                          isSelected && styles.activeTargetDayChip,
                        ]}
                        onPress={() => setGeneratorTarget(day)}
                      >
                        <Text
                          style={[
                            styles.targetDayChipText,
                            isSelected && styles.activeTargetDayChipText,
                          ]}
                        >
                          {day.substring(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Mode Selection */}
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[
                    styles.modeOption,
                    generatorMode === 'replace' && styles.activeModeOption,
                  ]}
                  onPress={() => setGeneratorMode('replace')}
                >
                  <Ionicons
                    name={
                      generatorMode === 'replace'
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={16}
                    color={generatorMode === 'replace' ? '#0F766E' : '#94A3B8'}
                  />
                  <Text
                    style={[
                      styles.modeOptionText,
                      generatorMode === 'replace' && styles.activeModeOptionText,
                    ]}
                  >
                    Replace existing slots
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeOption,
                    generatorMode === 'append' && styles.activeModeOption,
                  ]}
                  onPress={() => setGeneratorMode('append')}
                >
                  <Ionicons
                    name={
                      generatorMode === 'append'
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={16}
                    color={generatorMode === 'append' ? '#0F766E' : '#94A3B8'}
                  />
                  <Text
                    style={[
                      styles.modeOptionText,
                      generatorMode === 'append' && styles.activeModeOptionText,
                    ]}
                  >
                    Merge with existing slots
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Live Preview Box */}
              <View style={styles.previewBox}>
                <View style={styles.previewHeader}>
                  <Ionicons name="sparkles" size={15} color="#0D9488" />
                  <Text style={styles.previewTitle}>
                    Live Preview: {previewSlots.length} dynamic slots (
                    {generatorInterval} min each)
                  </Text>
                </View>

                {previewSlots.length === 0 ? (
                  <Text style={styles.noPreviewText}>
                    Enter valid Start and End times (e.g. 03:00 PM to 10:00 PM)
                  </Text>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.previewSlotsScroll}
                  >
                    {previewSlots.map((slot) => (
                      <View key={slot} style={styles.previewSlotBadge}>
                        <Text style={styles.previewSlotText}>{slot}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Action Button */}
              <TouchableOpacity
                style={[
                  styles.generateButton,
                  previewSlots.length === 0 && styles.disabledGenerateButton,
                ]}
                activeOpacity={0.85}
                disabled={previewSlots.length === 0}
                onPress={handleApplyDynamicSlots}
              >
                <Ionicons name="flash" size={17} color="#FFFFFF" />
                <Text style={styles.generateButtonText}>
                  Generate & Apply {previewSlots.length} Slots (
                  {generatorTarget === 'all' ? 'All Active Days' : generatorTarget}
                  )
                </Text>
              </TouchableOpacity>
            </View>
          )}
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
                    ? `${item.slots.length} time slots (${SLOT_DURATION_MINUTES} min each)`
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

                {/* Quick actions for this day */}
                <View style={styles.dayActionsRow}>
                  <TouchableOpacity
                    style={[styles.dayActionChip, styles.generatorDayChip]}
                    onPress={() => {
                      setGeneratorTarget(item.day);
                      setIsGeneratorExpanded(true);
                    }}
                  >
                    <Ionicons name="sparkles" size={13} color="#0F766E" />
                    <Text style={styles.dayActionChipText}>
                      Range Generator
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dayActionChip}
                    onPress={() => applyEveningSlotsToDay(item.day)}
                  >
                    <Ionicons name="time" size={13} color="#0F766E" />
                    <Text style={styles.dayActionChipText}>
                      3 PM - 10 PM (15m)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dayActionChip}
                    onPress={() => applyMorningSlotsToDay(item.day)}
                  >
                    <Ionicons name="sunny-outline" size={13} color="#0F766E" />
                    <Text style={styles.dayActionChipText}>
                      Morning (9-12)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dayActionChip, styles.clearDayChip]}
                    onPress={() => clearDaySlots(item.day)}
                  >
                    <Ionicons name="close-circle-outline" size={13} color="#DC2626" />
                    <Text style={[styles.dayActionChipText, styles.clearDayText]}>
                      Clear
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.slotLabel}>
                  Available consultation times ({item.slots.length} active)
                </Text>

                <View style={styles.slotsContainer}>
                  {(() => {
                    const dayAllSlots = Array.from(
                      new Set([...TIME_SLOTS, ...item.slots])
                    ).sort((a, b) => slotToMinutes(a) - slotToMinutes(b));

                    return dayAllSlots.map((slot) => {
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
                    });
                  })()}
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
    marginBottom: 16,
  },
  generatorCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  generatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDFA',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#CCFBF1',
  },
  generatorHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  generatorIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generatorHeaderText: {
    flex: 1,
  },
  generatorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F766E',
  },
  generatorSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  generatorBody: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  fieldSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  quickPresetsScroll: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 4,
  },
  quickPresetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  activeQuickPresetChip: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  quickPresetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  activeQuickPresetChipText: {
    color: '#FFFFFF',
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  timeInputCol: {
    flex: 1,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 42,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    padding: 0,
  },
  miniChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  miniChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  activeMiniChip: {
    backgroundColor: '#CCFBF1',
  },
  miniChipText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  activeMiniChipText: {
    color: '#0F766E',
    fontWeight: '700',
  },
  intervalSection: {
    marginBottom: 16,
  },
  labelWithBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  intervalHint: {
    fontSize: 11,
    color: '#0F766E',
    fontWeight: '600',
  },
  intervalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  intervalChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeIntervalChip: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  intervalChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  activeIntervalChipText: {
    color: '#FFFFFF',
  },
  targetSection: {
    marginBottom: 16,
  },
  targetDaysScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  targetDayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  activeTargetDayChip: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  targetDayChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  activeTargetDayChipText: {
    color: '#FFFFFF',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    paddingVertical: 4,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeModeOption: {},
  modeOptionText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  activeModeOptionText: {
    color: '#0F766E',
    fontWeight: '700',
  },
  previewBox: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
  },
  noPreviewText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  previewSlotsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  previewSlotBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewSlotText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  generateButton: {
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledGenerateButton: {
    opacity: 0.5,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  generatorDayChip: {
    backgroundColor: '#CCFBF1',
    borderColor: '#5EEAD4',
  },
  dayActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  dayActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#CCFBF1',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  dayActionChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  clearDayChip: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  clearDayText: {
    color: '#DC2626',
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
