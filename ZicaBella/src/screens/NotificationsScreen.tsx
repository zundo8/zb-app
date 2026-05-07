import React from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { Typography } from '../components/Typography';
import GlassHeader from '../components/GlassHeader';
import { useNotificationStore, NotificationItem } from '../store/notificationStore';
import { NotificationService } from '../services/NotificationService';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { config } from '../constants/config';
import { haptics } from '../utils/haptics';

function safeFormatDate(dateStr: string): string {
  try {
    if (!dateStr) return 'Recently';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recently';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return 'Recently';
  }
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const navigation = useNavigation<any>();

  const notifications = useNotificationStore(s => s.notifications);
  const markAsRead = useNotificationStore(s => s.markAsRead);
  const markAllAsRead = useNotificationStore(s => s.markAllAsRead);
  const clearAll = useNotificationStore(s => s.clearAll);
  const [refreshing, setRefreshing] = React.useState(false);
  const token = useAuthStore(s => s.token);

  const fetchNotifications = React.useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`${config.appUrl}/api/app/notifications/history`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Accept': 'application/json',
        }
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;

      const data = await res.json();
      if (data.success && Array.isArray(data.notifications)) {
        const normalized = data.notifications.map((n: any, idx: number) => ({
          // Guarantee unique ID — fallback uses index + timestamp
          id: String(n.id || n._id || `server-${Date.now()}-${idx}`).trim(),
          title: String(n.title || 'Notification'),
          body: String(n.body || n.message || ''),
          date: n.date || n.createdAt || new Date().toISOString(),
          isRead: Boolean(n.isRead),
          data: (n.data && typeof n.data === 'object') ? n.data : {},
        }));

        useNotificationStore.getState().setNotifications(normalized);
      }
    } catch (e) {
      console.warn('[Notifications] Fetch error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handlePress = (item: NotificationItem) => {
    haptics.buttonTap();
    markAsRead(item.id);
    if (item.data && Object.keys(item.data).length > 0) {
      NotificationService.handleDeepLink(item.data);
    }
  };

  // Safe background color — fallback if surface is not in palette
  const unreadBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => handlePress(item)}
      style={[
        styles.notificationCard,
        {
          backgroundColor: item.isRead ? 'transparent' : unreadBg,
          borderColor: colors.borderLight,
        }
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: item.isRead ? 'rgba(128,128,128,0.08)' : 'rgba(0,0,0,0.06)' }]}>
          <Ionicons
            name="notifications-outline"
            size={15}
            color={item.isRead ? colors.textSecondary : colors.text}
          />
        </View>
        {!item.isRead && (
          <View style={styles.unreadDot} />
        )}
        <Typography size={10} color={colors.textExtraLight} style={[styles.timeText, { flex: 1, textAlign: 'right' }]}>
          {safeFormatDate(item.date)}
        </Typography>
      </View>

      <Typography size={13} weight="700" color={colors.text} style={styles.titleText}>
        {item.title}
      </Typography>

      {!!item.body && (
        <Typography size={12} color={colors.textSecondary} style={styles.bodyText} numberOfLines={3}>
          {item.body}
        </Typography>
      )}
    </TouchableOpacity>
  );

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader title="NOTIFICATIONS" showBack />

      <View style={[styles.headerActions, { paddingTop: insets.top + 60 }]}>
        <Typography size={11} color={colors.textExtraLight} style={{ letterSpacing: 1 }}>
          {notifications.length} {notifications.length === 1 ? 'MESSAGE' : 'MESSAGES'}
          {unreadCount > 0 ? ` · ${unreadCount} UNREAD` : ''}
        </Typography>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={() => { haptics.buttonTap(); markAllAsRead(); }}>
              <Typography size={11} color={colors.text} weight="600">
                Mark all read
              </Typography>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={() => { haptics.buttonTap(); clearAll(); }}>
              <Typography size={11} color={colors.textExtraLight} weight="500">
                Clear
              </Typography>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={notifications}
        // Double-safety: string key with index fallback to prevent ANY duplicate key
        keyExtractor={(item, index) => `notif-${String(item.id)}-${index}`}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 }
        ]}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => { haptics.buttonTap(); fetchNotifications(); }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.textExtraLight} />
            <Typography size={14} weight="700" color={colors.text} style={{ marginTop: 20, letterSpacing: 1 }}>
              No notifications yet
            </Typography>
            <Typography size={12} color={colors.textSecondary} style={{ marginTop: 8, textAlign: 'center' }}>
              We'll notify you about orders, promotions, and updates.
            </Typography>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  notificationCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#007AFF',
  },
  timeText: {
    letterSpacing: 0.5,
    opacity: 0.5,
  },
  titleText: {
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  bodyText: {
    lineHeight: 18,
    opacity: 0.7,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
});
