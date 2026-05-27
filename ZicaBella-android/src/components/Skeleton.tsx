import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { useColors } from '../constants/colors';

export const Skeleton = ({ width, height, borderRadius = 4, style }: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}) => {
  const colors = useColors();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: colors.border, opacity },
        style,
      ]}
    />
  );
};

export const ProductGridSkeleton = () => {
  return (
    <View style={skeletonStyles.grid}>
      {[...Array(6)].map((_, i) => (
        <View key={i} style={skeletonStyles.card}>
          <Skeleton width="100%" height={240} borderRadius={12} />
          <Skeleton width="80%" height={10} style={{ marginTop: 10 }} />
          <Skeleton width="40%" height={8} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
};

export const OrderListSkeleton = () => {
  return (
    <View style={skeletonStyles.list}>
      {[...Array(3)].map((_, i) => (
        <View key={i} style={skeletonStyles.orderCard}>
          <Skeleton width={60} height={60} borderRadius={8} />
          <View style={skeletonStyles.orderInfo}>
            <Skeleton width="60%" height={12} />
            <Skeleton width="40%" height={10} style={{ marginTop: 6 }} />
            <Skeleton width="30%" height={10} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
};

const skeletonStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  card: {
    width: '47%',
    marginBottom: 16,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  orderCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  orderInfo: {
    flex: 1,
    justifyContent: 'center',
  },
});
