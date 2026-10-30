import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  type AppNotification,
  useNotificationStore,
} from '../store/notificationStore';

type Props = {
  visible: boolean;
  onClose: () => void;
  userId?: string;
  userEmail?: string;
  userRole?: 'patient' | 'doctor' | 'admin';
};

function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    const days = Math.floor(diffSec / 86400);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export function NotificationModal({
  visible,
  onClose,
  userId,
  userEmail,
  userRole,
}: Props) {
  const allNotifications = useNotificationStore(
    (state) => state.notifications
  );
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const deleteNotification = useNotificationStore(
    (state) => state.deleteNotification
  );
  const clearNotificationsForUser = useNotificationStore(
    (state) => state.clearNotificationsForUser
  );

  // STRICTLY USER-SPECIFIC: Filter notifications belonging only to this logged-in user
  const userNotifications = useMemo(() => {
    if (!userId && !userEmail) return [];
    return allNotifications.filter((n) => {
      if (userId && n.recipientId === userId) return true;
      if (userEmail && n.recipientId === userEmail) return true;
      return false;
    });
  }, [allNotifications, userId, userEmail]);

  const unreadCount = useMemo(
    () => userNotifications.filter((n) => !n.isRead).length,
    [userNotifications]
  );

  const getIconConfig = (type: AppNotification['type']) => {
    switch (type) {
      case 'doctor_new_appointment':
        return {
          icon: 'calendar' as const,
          color: '#0F766E',
          bgColor: '#CCFBF1',
        };
      case 'patient_appointment_reminder':
        return {
          icon: 'alarm' as const,
          color: '#D97706',
          bgColor: '#FEF3C7',
        };
      case 'patient_booking_confirmation':
        return {
          icon: 'checkmark-circle' as const,
          color: '#2563EB',
          bgColor: '#DBEAFE',
        };
      case 'appointment_cancelled':
        return {
          icon: 'close-circle' as const,
          color: '#DC2626',
          bgColor: '#FEE2E2',
        };
      default:
        return {
          icon: 'notifications' as const,
          color: '#0F766E',
          bgColor: '#CCFBF1',
        };
    }
  };

  const handleNotificationPress = (item: AppNotification) => {
    if (!item.isRead) {
      markAsRead(item.id);
    }
  };

  const handleMarkAllRead = () => {
    if (userId) {
      markAllAsRead(userId);
    }
    if (userEmail && userEmail !== userId) {
      markAllAsRead(userEmail);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear Notifications',
      'Are you sure you want to clear your notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            if (userId) {
              clearNotificationsForUser(userId);
            }
            if (userEmail && userEmail !== userId) {
              clearNotificationsForUser(userEmail);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.title}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadCountBadge}>
                <Text style={styles.unreadCountBadgeText}>{unreadCount} new</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={12}
          >
            <Ionicons name="close" size={24} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* Sub-header Actions for this user */}
        {userNotifications.length > 0 && (
          <View style={styles.actionRow}>
            {unreadCount > 0 && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleMarkAllRead}
              >
                <Ionicons name="checkmark-done" size={14} color="#0F766E" />
                <Text style={styles.actionBtnText}>Mark all read</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, styles.clearBtn]}
              onPress={handleClearAll}
            >
              <Ionicons name="trash-outline" size={14} color="#64748B" />
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* List of Specific User Notifications */}
        {userNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons
                name="notifications-off-outline"
                size={44}
                color="#94A3B8"
              />
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              {userRole === 'doctor'
                ? "You'll be alerted immediately when a patient books an appointment with you."
                : "You'll receive your appointment confirmations and reminders 10 minutes prior to your consultation."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={userNotifications}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const { icon, color, bgColor } = getIconConfig(item.type);

              return (
                <Pressable
                  onPress={() => handleNotificationPress(item)}
                  style={[
                    styles.notificationCard,
                    !item.isRead && styles.unreadCard,
                  ]}
                >
                  <View
                    style={[styles.iconContainer, { backgroundColor: bgColor }]}
                  >
                    <Ionicons name={icon} size={20} color={color} />
                  </View>

                  <View style={styles.contentContainer}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[
                          styles.notificationTitle,
                          !item.isRead && styles.unreadTitle,
                        ]}
                      >
                        {item.title}
                      </Text>
                      <Text style={styles.timeAgo}>
                        {formatTimeAgo(item.createdAt)}
                      </Text>
                    </View>

                    <Text style={styles.notificationMessage}>
                      {item.message}
                    </Text>

                    {(item.date || item.time || item.serialNumber) && (
                      <View style={styles.metaRow}>
                        {item.serialNumber && (
                          <View style={styles.metaBadge}>
                            <Ionicons
                              name="ticket-outline"
                              size={11}
                              color="#0F766E"
                            />
                            <Text style={styles.metaBadgeText}>
                              {item.serialNumber}
                            </Text>
                          </View>
                        )}
                        {item.date && (
                          <View style={styles.metaBadge}>
                            <Ionicons
                              name="calendar-outline"
                              size={11}
                              color="#0F766E"
                            />
                            <Text style={styles.metaBadgeText}>{item.date}</Text>
                          </View>
                        )}
                        {item.time && (
                          <View style={styles.metaBadge}>
                            <Ionicons
                              name="time-outline"
                              size={11}
                              color="#0F766E"
                            />
                            <Text style={styles.metaBadgeText}>{item.time}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteNotification(item.id)}
                    hitSlop={10}
                  >
                    <Ionicons name="close" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  unreadCountBadge: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  unreadCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F0FDFA',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F766E',
  },
  clearBtn: {
    backgroundColor: '#F1F5F9',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  unreadCard: {
    borderColor: '#99F6E4',
    backgroundColor: '#F0FDFA',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  contentContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  unreadTitle: {
    color: '#0F766E',
  },
  timeAgo: {
    fontSize: 11,
    color: '#94A3B8',
  },
  notificationMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6FFFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F766E',
  },
  deleteButton: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
