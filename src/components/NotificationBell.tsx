import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { NotificationModal } from './NotificationModal';

type Props = {
  color?: string;
};

export function NotificationBell({ color = '#0F766E' }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const user = useAuthStore((state) => state.user);
  const notifications = useNotificationStore((state) => state.notifications);

  const unreadCount = useMemo(() => {
    if (!user?.id) return 0;
    return notifications.filter(
      (n) =>
        (n.recipientId === user.id || (user.email && n.recipientId === user.email)) &&
        !n.isRead
    ).length;
  }, [notifications, user?.id, user?.email]);

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        hitSlop={12}
        style={styles.bellButton}
        accessibilityLabel="Notifications"
        accessibilityRole="button"
      >
        <Ionicons name="notifications-outline" size={24} color={color} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <NotificationModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        userId={user?.id}
        userEmail={user?.email}
        userRole={user?.role}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    position: 'relative',
    marginRight: 14,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -5,
    backgroundColor: '#DC2626',
    borderRadius: 9,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
