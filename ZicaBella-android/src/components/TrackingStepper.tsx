import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../constants/colors';
import { Typography } from './Typography';

export const TRACKING_STEPS = [
  'Confirmed',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
] as const;

interface Props {
  currentStatus: string;
  timestamps?: Record<string, string>;
}

export const TrackingStepper = ({ currentStatus, timestamps = {} }: Props) => {
  const colors = useColors();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const getStatusIndex = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('delivered')) return 4;
    if (s.includes('out for delivery') || s.includes('out_for_delivery')) return 3;
    if (s.includes('shipped') || s.includes('transit') || s.includes('dispatched') || s.includes('picked')) return 2;
    if (s.includes('packed') || s.includes('ready')) return 1;
    if (s.includes('confirmed') || s.includes('paid') || s.includes('open') || s.includes('pending')) return 0;
    return -1;
  };

  const currentIndex = getStatusIndex(currentStatus);

  const getStepColor = (index: number) => {
    if (index === 4 && currentIndex === 4) return colors.success; // Delivered
    if (index <= currentIndex) {
       // Confirmed to Out for Delivery
       if (index === 0) return colors.iosBlue;
       if (index === 1) return colors.warning;
       if (index === 2) return '#A855F7'; // Purple (Shipped)
       if (index === 3) return '#FF9500'; // Orange (Out for Delivery)
    }
    return colors.textExtraLight;
  };

  return (
    <View style={styles.container}>
      {TRACKING_STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isFuture = index > currentIndex;
        const statusColor = getStepColor(index);
        const time = timestamps[step.toLowerCase().replace(/ /g, '_')];

        return (
          <View key={step} style={styles.stepRow}>
            <View style={styles.leftColumn}>
              <Animated.View 
                style={[
                  styles.node, 
                  { 
                    backgroundColor: isCompleted || isCurrent ? statusColor : 'transparent',
                    borderColor: isCompleted || isCurrent ? statusColor : colors.borderLight,
                    transform: [{ scale: isCurrent ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) : 1 }]
                  }
                ]}
              >
                {isCompleted ? (
                   <Ionicons name="checkmark" size={12} color="#fff" />
                ) : isCurrent ? (
                   <View style={styles.pulseDot} />
                ) : null}
              </Animated.View>
              {index < TRACKING_STEPS.length - 1 && (
                <View 
                  style={[
                    styles.line, 
                    { 
                      backgroundColor: isCompleted ? statusColor : colors.borderExtraLight,
                      opacity: isFuture ? 0.3 : 1
                    }
                  ]} 
                />
              )}
            </View>

            <View style={styles.rightColumn}>
              <Typography 
                size={9} 
                weight="700" 
                color={isFuture ? colors.textExtraLight : colors.text}
                style={{ letterSpacing: 1.5 }}
              >
                {step.toUpperCase()}
              </Typography>
              {time && (
                <Typography size={7} color={colors.textLight} style={{ marginTop: 2 }}>
                  {new Date(time).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Typography>
              )}
              {isCurrent && !time && (
                <Typography size={7} color={colors.textLight} style={{ marginTop: 2 }}>PROCESSING...</Typography>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
  stepRow: {
    flexDirection: 'row',
  },
  leftColumn: {
    width: 32,
    alignItems: 'center',
  },
  node: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  line: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  rightColumn: {
    flex: 1,
    paddingBottom: 24,
    paddingLeft: 12,
  }
});
