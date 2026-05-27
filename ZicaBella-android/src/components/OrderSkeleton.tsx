import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';

export const OrderSkeleton = () => {
  const colors = useColors();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [opacity]);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Animated.View style={[styles.bar, { width: '40%', opacity, backgroundColor: colors.textExtraLight }]} />
          <Animated.View style={[styles.bar, { width: '25%', height: 8, marginTop: 8, opacity, backgroundColor: colors.textExtraLight }]} />
        </View>
        <Animated.View style={[styles.pill, { opacity, backgroundColor: colors.borderExtraLight }]} />
      </View>
      
      <View style={styles.content}>
        <View style={styles.thumbs}>
          {[1, 2, 3].map(i => (
            <Animated.View key={i} style={[styles.thumb, { opacity, backgroundColor: colors.borderExtraLight, marginLeft: i > 1 ? -12 : 0 }]} />
          ))}
        </View>
        <Animated.View style={[styles.bar, { width: '20%', opacity, backgroundColor: colors.textExtraLight }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  bar: {
    height: 12,
    borderRadius: 6,
  },
  pill: {
    width: 80,
    height: 24,
    borderRadius: 12,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  thumbs: {
    flexDirection: 'row',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  }
});
