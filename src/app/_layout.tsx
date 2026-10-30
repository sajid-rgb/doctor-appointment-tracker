import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setupNotificationChannels } from '../utils/notifications';

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  useEffect(() => {
    setupNotificationChannels();
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(doctor)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="appointments/book" />
      </Stack>
    </SafeAreaProvider>
  );
}

