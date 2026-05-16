/**
 * InAppNotificationBanner
 *
 * Displays a slide-down banner when a notification arrives while the app is in the foreground.
 * Uses Expo Notifications instead of Firebase messaging.
 */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  runOnJS
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { Typography } from './Typography';
import { NotificationService } from '../services/NotificationService';

const { width } = Dimensions.get('window');

interface BannerNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export const InAppNotificationBanner = () => {
  const [notification, setNotification] = useState<BannerNotification | null>(null);
  const translateY = useSharedValue(-150);
  const opacity = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((event) => {
      const { title, body, data } = event.request.content;
      setNotification({
        title: title || 'Zica Bella',
        body: body || '',
        data: (data as Record<string, string>) || {},
      });
      
      // Animate in
      translateY.value = withSpring(insets.top + 10, {
        damping: 15,
        stiffness: 150
      });
      opacity.value = withTiming(1, { duration: 300 });

      // Auto dismiss after 4 seconds
      setTimeout(() => {
        dismiss();
      }, 4000);
    });

    return () => subscription.remove();
  }, []);

  const dismiss = () => {
    translateY.value = withTiming(-150, { duration: 300 }, () => {
      runOnJS(setNotification)(null);
    });
    opacity.value = withTiming(0, { duration: 300 });
  };

  const handlePress = () => {
    if (notification?.data) {
      NotificationService.handleDeepLink(notification.data);
    }
    dismiss();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!notification) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <TouchableOpacity 
        activeOpacity={0.9} 
        onPress={handlePress}
        style={[styles.banner, { borderColor: colors.borderLight }]}
        accessibilityLabel={`Notification: ${notification.title}. ${notification.body}`}
        accessibilityRole="button"
      >
        <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: colors.foreground + '10' }]}>
            <Ionicons name="notifications" size={16} color={colors.text} />
          </View>
          
          <View style={styles.textContainer}>
            <Typography size={12} weight="bold" color={colors.text} style={styles.title}>
              {notification.title}
            </Typography>
            <Typography size={11} color={colors.textSecondary} style={styles.body} numberOfLines={2}>
              {notification.body}
            </Typography>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  banner: {
    width: Math.min(width - 32, 400),
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  content: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    marginBottom: 4,
  },
  body: {
    lineHeight: 16,
  },
});
