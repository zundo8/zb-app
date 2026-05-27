import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useColors } from '../constants/colors';
import { Typography } from './Typography';
import { formatPrice } from '../utils/formatPrice';
import { haptics } from '../utils/haptics';
import { useThemeStore } from '../store/themeStore';

interface Props {
  itemCount: number;
  total: number;
  onPrimaryPress: () => void;
  primaryLabel: string;
  loading?: boolean;
  disabled?: boolean;
}

export default function CheckoutSummaryBar({ 
  itemCount, total, onPrimaryPress, primaryLabel, loading, disabled 
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 12 }]}>
      <BlurView intensity={isDark ? 40 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
      
      <View style={styles.container}>
        <View style={styles.info}>
          <Typography size={7} weight="600" color={colors.textExtraLight} style={styles.count}>
            {itemCount} {itemCount === 1 ? 'ITEM' : 'ITEMS'}
          </Typography>
          <Typography size={16} weight="700" color={colors.text}>
            {formatPrice(total)}
          </Typography>
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton, 
            { backgroundColor: disabled ? colors.textMuted : colors.foreground }
          ]}
          onPress={() => { haptics.buttonTap(); onPrimaryPress(); }}
          disabled={disabled || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Typography heading weight="700" size={10} color={colors.background}>
              {primaryLabel.toUpperCase()}
            </Typography>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  info: {
    gap: 2,
  },
  count: {
    letterSpacing: 1.5,
  },
  primaryButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 32,
  },
});
