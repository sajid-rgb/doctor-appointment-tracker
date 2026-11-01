import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const memoryFallback = new Map<string, string>();

export interface SafeStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export const safeAsyncStorage: SafeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web' && typeof window === 'undefined') {
        return memoryFallback.get(key) ?? null;
      }
      if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
        const item = await AsyncStorage.getItem(key);
        return item ?? memoryFallback.get(key) ?? null;
      }
      return memoryFallback.get(key) ?? null;
    } catch {
      return memoryFallback.get(key) ?? null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      memoryFallback.set(key, value);
      if (Platform.OS === 'web' && typeof window === 'undefined') {
        return;
      }
      if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
        await AsyncStorage.setItem(key, value);
      }
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      memoryFallback.delete(key);
      if (Platform.OS === 'web' && typeof window === 'undefined') {
        return;
      }
      if (AsyncStorage && typeof AsyncStorage.removeItem === 'function') {
        await AsyncStorage.removeItem(key);
      }
    } catch {}
  },
};
