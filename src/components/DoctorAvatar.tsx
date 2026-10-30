import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

type Props = {
  image?: string | null;
  name?: string;
  size?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  iconColor?: string;
  backgroundColor?: string;
  showBadge?: boolean;
};

export function DoctorAvatar({
  image,
  name,
  size = 48,
  borderRadius,
  style,
  iconColor = '#0F766E',
  backgroundColor = '#CCFBF1',
  showBadge = false,
}: Props) {
  const [hasError, setHasError] = useState(false);
  const radius = borderRadius ?? size / 2;

  // Reset error state if image URI changes
  useEffect(() => {
    setHasError(false);
  }, [image]);

  const hasValidImage = Boolean(image && image.trim().length > 0 && !hasError);

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {hasValidImage ? (
        <Image
          source={{ uri: image! }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: radius,
            },
          ]}
          contentFit="cover"
          transition={200}
          onError={() => setHasError(true)}
          accessibilityLabel={name ? `Doctor ${name}` : 'Doctor photo'}
        />
      ) : (
        <View
          style={[
            styles.fallbackContainer,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor,
            },
          ]}
        >
          {/* Medical Doctor Icon */}
          <Ionicons
            name="medical"
            size={Math.max(16, Math.round(size * 0.44))}
            color={iconColor}
          />
        </View>
      )}

      {showBadge && (
        <View
          style={[
            styles.badge,
            {
              width: Math.max(14, Math.round(size * 0.32)),
              height: Math.max(14, Math.round(size * 0.32)),
              borderRadius: Math.round(size * 0.16),
            },
          ]}
        >
          <Ionicons
            name="checkmark"
            size={Math.max(9, Math.round(size * 0.2))}
            color="#FFFFFF"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    backgroundColor: '#E2E8F0',
  },
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
  },
  badge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
