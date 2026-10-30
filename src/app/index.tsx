import * as Device from 'expo-device';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

function getDevMenuHint() {
  if (Platform.OS === 'web') {
    return <ThemedText type="small">use browser devtools</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        shake device or press <ThemedText type="code">m</ThemedText> in terminal
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d';
  return (
    <ThemedText type="small">
      press <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

export default function HomeScreen() {
  // return (
  //   <ThemedView style={styles.container}>
  //     <SafeAreaView style={styles.safeArea}>
  //       <ThemedView style={styles.heroSection}>
  //         <AnimatedIcon />
  //         <ThemedText type="title" style={styles.title}>
  //           Welcome to&nbsp;Expo
  //         </ThemedText>
  //       </ThemedView>

  //       <ThemedText type="code" style={styles.code}>
  //         get started
  //       </ThemedText>

  //       <ThemedView type="backgroundElement" style={styles.stepContainer}>
  //         <HintRow
  //           title="Try editing"
  //           hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
  //         />
  //         <HintRow title="Dev tools" hint={getDevMenuHint()} />
  //         <HintRow
  //           title="Fresh start"
  //           hint={<ThemedText type="code">npm run reset-project</ThemedText>}
  //         />
  //       </ThemedView>

  //       {Platform.OS === 'web' && <WebBadge />}
  //     </SafeAreaView>
  //   </ThemedView>
  // );
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  if (!hasHydrated) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (user.role === 'doctor') {
    return <Redirect href="/(doctor)" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  code: {
    textTransform: 'uppercase',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});
