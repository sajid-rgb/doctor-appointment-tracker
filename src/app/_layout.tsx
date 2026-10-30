import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // return (
  //   <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
  //     {/* <AnimatedSplashOverlay />
  //     <AppTabs /> */}
  //     <Stack screenOptions={{ headerShown: false }}>
  //       <Stack.Screen name="(tabs)" />
  //       <Stack.Screen name="appointments/create" />
  //       <Stack.Screen name="appointments/[id]" />
  //       <Stack.Screen name="appointments/edit/[id]" />
  //     </Stack>
  //   </ThemeProvider>
  // );

  return (
    // <Stack screenOptions={{ headerShown: false }}>
    //   <Stack.Screen name="(tabs)" />
    //   {/* <Stack.Screen name="appointments/create" />
    //   <Stack.Screen name="appointments/[id]" />
    //   <Stack.Screen name="appointments/edit/[id]" /> */}
    // </Stack>
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
