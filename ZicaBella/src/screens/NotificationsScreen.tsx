import React from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';

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

const { width } = Dimensions.get('window');

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const navigation = useNavigation<any>();

  const notifications = useNotificationStore(s => s.notifications);
  const markAsRead = useNotificationStore(s => s.markAsRead);
  const markAllAsRead = useNotificationStore(s => s.markAllAsRead);
  const [refreshing, setRefreshing] = React.useState(false);
  const token = useAuthStore(s => s.token);

  const fetchNotifications = React.useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`${config.appUrl}/api/app/notifications/history`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.notifications)) {
        // We sync server notifications into our local store to merge them
        data.notifications.forEach((n: any) => {
          useNotificationStore.getState().addNotification(n);
        });
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
    markAsRead(item.id);
    if (item.data) {
      NotificationService.handleDeepLink(item.data);
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => handlePress(item)}
      style={[
        styles.notificationCard,
        { 
          backgroundColor: item.isRead ? 'transparent' : colors.surface,
          borderColor: colors.borderLight
        }
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Ionicons 
            name="notifications-outline" 
            size={16} 
            color={item.isRead ? colors.textSecondary : colors.primary} 
          />
        </View>
        <Typography size={10} color={colors.textLight} style={styles.timeText}>
          {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
        </Typography>
      </View>
      
      <Typography size={14} weight="bold" color={colors.text} style={styles.titleText}>
        {item.title}
      </Typography>
      
      <Typography size={13} color={colors.textSecondary} style={styles.bodyText}>
        {item.body}
      </Typography>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader title="NOTIFICATIONS" showBack />
      
      <View style={[styles.headerActions, { paddingTop: insets.top + 60 }]}>
        <Typography size={12} color={colors.textSecondary} style={{ letterSpacing: 1 }}>
          {notifications.length} MESSAGES
        </Typography>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Typography size={12} color={colors.primary} weight="bold">
              Mark all as read
            </Typography>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => { haptics.buttonTap(); fetchNotifications(); }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.textLight} />
            <Typography size={14} color={colors.textSecondary} style={styles.emptyText}>
              No notifications yet.
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
  },
  notificationCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeText: {
    textTransform: 'uppercase',
  },
  titleText: {
    marginBottom: 4,
  },
  bodyText: {
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 16,
  },
});
