import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    const message = login(email, password);

    if (message) {
      setError(message);
      return;
    }

    const loggedInUser = useAuthStore.getState().user;

    if (loggedInUser?.role === 'admin') {
      router.replace('/dashboard');
    } else if (loggedInUser?.role === 'doctor') {
      router.replace('/(doctor)');
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>C</Text>
        </View>

        <Text style={styles.title}>Welcome to CarePoint</Text>
        <Text style={styles.subtitle}>Sign in to manage your healthcare.</Text>

        <Text style={styles.label}>Email address</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
          autoCapitalize="none"
          style={styles.input}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Login</Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/signup" style={styles.link}>
            Sign Up
          </Link>
        </View>

        <Text style={styles.demoNote}>Admin demo: admin@admin.com</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoText: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { color: '#64748B', marginTop: 8, marginBottom: 28 },
  label: { color: '#334155', fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 18,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#0F766E',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  error: { color: '#DC2626', marginBottom: 12 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: { color: '#64748B' },
  link: { color: '#0F766E', fontWeight: '700' },
  demoNote: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 12,
    marginTop: 24,
  },
});
