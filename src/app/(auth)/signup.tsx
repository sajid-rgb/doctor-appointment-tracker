import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DoctorAvatar } from '../../components/DoctorAvatar';
import { useAuthStore, type UserRole } from '../../store/authStore';
import { useDoctorStore } from '../../store/doctorStore';

const SPECIALTIES = [
  'Cardiologist',
  'Dermatologist',
  'Dentist',
  'Neurologist',
  'General Physician',
  'Pediatrician',
];

export default function SignupScreen() {
  const router = useRouter();

  const signUp = useAuthStore((state) => state.signUp);
  const registerDoctor = useDoctorStore((state) => state.registerDoctor);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');

  const [specialty, setSpecialty] = useState(SPECIALTIES[0]);
  const [qualification, setQualification] = useState('');
  const [experience, setExperience] = useState('0');
  const [fee, setFee] = useState('500');
  const [bio, setBio] = useState('');
  const [doctorImage, setDoctorImage] = useState<string | undefined>(undefined);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePickDoctorPhoto = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Needed',
          'Photo library access is required to select a profile photo.'
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
        setDoctorImage(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Unable to select image. Please try again.');
    }
  };

  const handleSignup = async () => {
    if (loading) return;

    setError('');

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      setError('Please complete all required fields.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (role === 'doctor') {
      if (!qualification.trim()) {
        setError('Please enter your qualification.');
        return;
      }

      if (
        experience.trim() === '' ||
        !Number.isFinite(Number(experience)) ||
        Number(experience) < 0
      ) {
        setError('Please enter valid years of experience.');
        return;
      }

      if (
        fee.trim() === '' ||
        !Number.isFinite(Number(fee)) ||
        Number(fee) < 0
      ) {
        setError('Please enter a valid consultation fee.');
        return;
      }
    }

    setLoading(true);

    try {
      const signupError = await signUp(cleanName, cleanEmail, password, role);

      if (signupError) {
        setError(signupError);
        Alert.alert('Sign Up Failed', signupError);
        return;
      }

      if (role === 'doctor') {
        const createdUser = useAuthStore.getState().user;

        if (createdUser) {
          try {
            await registerDoctor({
              id: createdUser.id,
              name: createdUser.name,
              email: createdUser.email,
              image: doctorImage,
              specialty,
              qualification: qualification.trim(),
              experience: Number(experience),
              fee: Number(fee),
              bio: bio.trim(),
            });
          } catch (docErr) {
            console.warn('Doctor registration warning:', docErr);
          }

          if (doctorImage) {
            useAuthStore.getState().updateUserProfile({ image: doctorImage });
          }
        }
      }

      // Direct redirection based on role
      if (role === 'doctor') {
        router.replace('/(doctor)');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      const msg = err?.message || 'Something went wrong. Please try again.';
      setError(msg);
      Alert.alert('Sign Up Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandIcon}>
          <Ionicons name="medkit" size={32} color="#FFFFFF" />
        </View>

        <Text style={styles.brand}>CarePoint</Text>
        <Text style={styles.heading}>Create your account</Text>
        <Text style={styles.subtitle}>
          Join CarePoint to manage healthcare appointments.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>I want to join as</Text>

          <View style={styles.roleContainer}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRole('patient')}
              style={[
                styles.roleCard,
                role === 'patient' && styles.selectedRoleCard,
              ]}
            >
              <Ionicons
                name="person-outline"
                size={24}
                color={role === 'patient' ? '#0F766E' : '#64748B'}
              />
              <Text
                style={[
                  styles.roleTitle,
                  role === 'patient' && styles.selectedRoleText,
                ]}
              >
                Patient
              </Text>
              <Text style={styles.roleDescription}>Book appointments</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setRole('doctor')}
              style={[
                styles.roleCard,
                role === 'doctor' && styles.selectedRoleCard,
              ]}
            >
              <Ionicons
                name="medical-outline"
                size={24}
                color={role === 'doctor' ? '#0F766E' : '#64748B'}
              />
              <Text
                style={[
                  styles.roleTitle,
                  role === 'doctor' && styles.selectedRoleText,
                ]}
              >
                Doctor
              </Text>
              <Text style={styles.roleDescription}>Manage consultations</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Full name *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter your full name"
            autoCapitalize="words"
            autoCorrect={false}
            style={styles.input}
            editable={!loading}
          />

          <Text style={styles.label}>Email address *</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            editable={!loading}
          />

          <Text style={styles.label}>Password *</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={styles.passwordInput}
              editable={!loading}
            />
            <Pressable
              onPress={() => setShowPassword((value) => !value)}
              accessibilityLabel={
                showPassword ? 'Hide password' : 'Show password'
              }
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={21}
                color="#64748B"
              />
            </Pressable>
          </View>

          <Text style={styles.label}>Confirm password *</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter your password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            style={styles.input}
            editable={!loading}
          />

          {role === 'doctor' && (
            <View style={styles.doctorSection}>
              <View style={styles.sectionHeading}>
                <Ionicons name="medkit-outline" size={22} color="#0F766E" />
                <Text style={styles.sectionTitle}>Professional profile</Text>
              </View>

              <Text style={styles.helperText}>
                Your profile will remain pending until it is reviewed by an
                administrator.
              </Text>

              {/* Doctor Avatar Picker (Photo or Medical Icon) */}
              <View style={styles.photoPickerBox}>
                <DoctorAvatar
                  image={doctorImage}
                  name={name}
                  size={64}
                  borderRadius={32}
                />
                <View style={styles.photoPickerInfo}>
                  <Text style={styles.photoPickerTitle}>
                    {doctorImage ? 'Profile Photo Selected' : 'Doctor Photo (Optional)'}
                  </Text>
                  <Text style={styles.photoPickerSubtitle}>
                    {doctorImage
                      ? 'Custom photo will be shown to patients'
                      : 'Upload a picture, or leave empty to use standard doctor icon'}
                  </Text>
                  <View style={styles.photoPickerActions}>
                    <Pressable
                      style={styles.photoPickerBtn}
                      onPress={handlePickDoctorPhoto}
                    >
                      <Ionicons name="camera-outline" size={13} color="#0F766E" />
                      <Text style={styles.photoPickerBtnText}>
                        {doctorImage ? 'Change Photo' : 'Select Photo'}
                      </Text>
                    </Pressable>
                    {Boolean(doctorImage) && (
                      <Pressable
                        style={styles.photoPickerRemoveBtn}
                        onPress={() => setDoctorImage(undefined)}
                      >
                        <Ionicons name="close-circle-outline" size={13} color="#DC2626" />
                        <Text style={styles.photoPickerRemoveBtnText}>Use Icon</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>

              <Text style={styles.label}>Medical specialty *</Text>
              <View style={styles.specialtyContainer}>
                {SPECIALTIES.map((item) => {
                  const selected = specialty === item;

                  return (
                    <Pressable
                      key={item}
                      onPress={() => setSpecialty(item)}
                      style={[
                        styles.specialtyChip,
                        selected && styles.selectedSpecialtyChip,
                      ]}
                    >
                      <Text
                        style={[
                          styles.specialtyText,
                          selected && styles.selectedSpecialtyText,
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Qualification *</Text>
              <TextInput
                value={qualification}
                onChangeText={setQualification}
                placeholder="e.g. MBBS, FCPS"
                style={styles.input}
                editable={!loading}
              />

              <Text style={styles.label}>Years of experience *</Text>
              <TextInput
                value={experience}
                onChangeText={setExperience}
                placeholder="e.g. 5"
                keyboardType="number-pad"
                style={styles.input}
                editable={!loading}
              />

              <Text style={styles.label}>Consultation fee (BDT) *</Text>
              <TextInput
                value={fee}
                onChangeText={setFee}
                placeholder="e.g. 500"
                keyboardType="number-pad"
                style={styles.input}
                editable={!loading}
              />

              <Text style={styles.label}>About you</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Briefly describe your practice"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={[styles.input, styles.bioInput]}
                editable={!loading}
              />
            </View>
          )}

          {error !== '' && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            onPress={handleSignup}
            disabled={loading}
            style={[styles.submitButton, loading && styles.disabledButton]}
          >
            <Text style={styles.submitText}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Text>
            {!loading && (
              <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
            )}
          </Pressable>

          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>Already have an account?</Text>
            <Pressable onPress={() => router.replace('/login')}>
              <Text style={styles.loginLink}> Sign in</Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>
            CarePoint · Your health, our priority
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 42,
    paddingBottom: 36,
  },
  brandIcon: {
    width: 62,
    height: 62,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F766E',
    borderRadius: 20,
  },
  brand: {
    color: '#0F766E',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 12,
  },
  heading: {
    fontSize: 25,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 22,
  },
  subtitle: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
  form: {
    marginTop: 28,
  },
  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 16,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  roleCard: {
    flex: 1,
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    gap: 7,
  },
  selectedRoleCard: {
    borderColor: '#0F766E',
    backgroundColor: '#F0FDFA',
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
  },
  selectedRoleText: {
    color: '#0F766E',
  },
  roleDescription: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: '#0F172A',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 14,
    color: '#0F172A',
  },
  doctorSection: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  sectionTitle: {
    color: '#115E59',
    fontSize: 17,
    fontWeight: '800',
  },
  helperText: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 10,
  },
  specialtyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specialtyChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  selectedSpecialtyChip: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0F766E',
  },
  specialtyText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  selectedSpecialtyText: {
    color: '#0F766E',
  },
  bioInput: {
    minHeight: 100,
    paddingTop: 13,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginTop: 18,
  },
  errorText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 19,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0F766E',
    paddingVertical: 16,
    borderRadius: 13,
    marginTop: 24,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  loginPrompt: {
    color: '#64748B',
    fontSize: 13,
  },
  loginLink: {
    color: '#0F766E',
    fontWeight: '800',
    fontSize: 13,
  },
  footer: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 28,
  },
  photoPickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 12,
    marginBottom: 6,
  },
  photoPickerInfo: {
    flex: 1,
    gap: 3,
  },
  photoPickerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  photoPickerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  photoPickerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  photoPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  photoPickerBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  photoPickerRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  photoPickerRemoveBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
});
