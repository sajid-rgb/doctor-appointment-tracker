import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface ApiSyncIndicatorProps {
  label?: string;
  isSyncing: boolean;
}

export function ApiSyncIndicator({
  label = 'Updating data...',
  isSyncing,
}: ApiSyncIndicatorProps) {
  if (!isSyncing) return null;

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color="#0F766E" />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#F0FDFA',
    borderRadius: 20,
    alignSelf: 'center',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F766E',
  },
});
