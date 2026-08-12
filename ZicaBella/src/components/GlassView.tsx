/**
 * GlassView — Platform-aware blur/glass container.
 *
 * On iOS: renders expo-blur BlurView (unchanged behavior).
 * On Android: renders a solid semi-transparent View with border + elevation,
 * because BlurView is unreliable on Android and often renders transparent.
 *
 * Usage:
 *   Replace <BlurView intensity={X} tint={T} style={S}>{children}</BlurView>
 *   with   <GlassView intensity={X} tint={T} style={S}>{children}</GlassView>
 *
 * For absoluteFill backdrop overlays, use <GlassBackdrop> instead.
 */
import React from 'react';
import { View, Platform, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';

// ─── GlassView: container-level blur replacement ────────────────────────

interface GlassViewProps {
  /** expo-blur intensity (iOS only) */
  intensity?: number;
  /** expo-blur tint (iOS only) */
  tint?: 'dark' | 'light' | 'default';
  /** Style applied to the container */
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function GlassView({ intensity = 20, tint = 'dark', style, children }: GlassViewProps) {
  if (Platform.OS === 'android') {
    const isDark = tint === 'dark' || tint === 'default';
    return (
      <View
        style={[
          {
            backgroundColor: isDark
              ? 'rgba(18, 18, 18, 0.92)'
              : 'rgba(245, 245, 245, 0.95)',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDark
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(0, 0, 0, 0.06)',
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  // iOS — keep existing BlurView behavior
  return (
    <BlurView intensity={intensity} tint={tint} style={style}>
      {children}
    </BlurView>
  );
}

// ─── GlassBackdrop: absoluteFill overlay blur replacement ───────────────

interface GlassBackdropProps {
  /** expo-blur intensity (iOS only) */
  intensity?: number;
  /** expo-blur tint (iOS only) */
  tint?: 'dark' | 'light' | 'default';
  /** Additional style overrides */
  style?: StyleProp<ViewStyle>;
}

export function GlassBackdrop({ intensity = 30, tint = 'dark', style }: GlassBackdropProps) {
  if (Platform.OS === 'android') {
    const isDark = tint === 'dark' || tint === 'default';
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDark
              ? 'rgba(10, 10, 10, 0.90)'
              : 'rgba(240, 240, 240, 0.92)',
          },
          style,
        ]}
      />
    );
  }

  return (
    <BlurView
      intensity={intensity}
      tint={tint}
      style={[StyleSheet.absoluteFill, style]}
    />
  );
}

// ─── androidShadow: Platform-aware shadow helper ─────────────────────

/**
 * Returns platform-appropriate shadow styles.
 * iOS → shadowColor, shadowOffset, shadowOpacity, shadowRadius
 * Android → elevation
 */
export function platformShadow(
  elevation: number = 6,
  iosShadow?: {
    color?: string;
    offsetX?: number;
    offsetY?: number;
    opacity?: number;
    radius?: number;
  }
): ViewStyle {
  if (Platform.OS === 'android') {
    return { elevation };
  }

  return {
    shadowColor: iosShadow?.color ?? '#000',
    shadowOffset: {
      width: iosShadow?.offsetX ?? 0,
      height: iosShadow?.offsetY ?? 4,
    },
    shadowOpacity: iosShadow?.opacity ?? 0.3,
    shadowRadius: iosShadow?.radius ?? 8,
  };
}

export default GlassView;
