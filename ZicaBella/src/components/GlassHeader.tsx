import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { useUIStore } from '../store/uiStore';
import { useCartStore } from '../store/cartStore';
import { Typography } from './Typography';
import { haptics } from '../utils/haptics';

const { width } = Dimensions.get('window');

interface Props {
  title?: string;
  showBack?: boolean;
  onPressMenu?: () => void;
  onPressCenter?: () => void;
  isWishlisted?: boolean;
  hideCenter?: boolean;
  style?: any;
}

export default function GlassHeader({ 
  title = 'ZICA BELLA', 
  showBack = false,
  onPressMenu,
  onPressCenter,
  isWishlisted = false,
  hideCenter = false,
  style,
}: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const { theme, toggleTheme } = useThemeStore();
  const setWishlistOpen = useUIStore((state) => state.setWishlistOpen);
  const setMenuOpen = useUIStore((state) => state.setMenuOpen);
  const setCartOpen = useUIStore((state) => state.setCartOpen);
  const cartCount = useCartStore((s) => s.itemCount());

  const isDark = theme === 'dark';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }, style]}>
      {/* Box 1: Left Action Capsule (Logo/Back) */}
      <TouchableOpacity
        style={[styles.islandBase, styles.leftIsland, { borderColor: colors.borderLight }]}
        onPress={() => {
          if (showBack) {
            navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main');
          } else {
            haptics.buttonTap();
            setMenuOpen(true);
          }
        }}
        activeOpacity={0.7}
      >
        <BlurView intensity={10} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.iconCircle}>
          {showBack ? (
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          ) : (
            <Image 
              source={require('../../assets/zb-logo-220px.png')} 
              style={{ width: 22, height: 22, opacity: 0.8 }} 
              contentFit="contain"
            />
          )}
        </View>
      </TouchableOpacity>

      {/* Box 2: Center Identity Capsule (Minimalist Typography) */}
      {!hideCenter && (
        <TouchableOpacity 
          style={[styles.islandBase, styles.centerIsland, { borderColor: colors.borderLight }]}
          onPress={() => {
            if (onPressCenter) {
              onPressCenter();
            } else {
              navigation.navigate('HomeTab');
            }
          }}
          activeOpacity={0.8}
        >
          <BlurView intensity={10} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <Typography rocaston size={10} color={colors.text} style={styles.titleText}>
            {title.toUpperCase()}
          </Typography>
        </TouchableOpacity>
      )}

      {/* Box 3: Right Actions Capsule (Consolidated Island) */}
      <View style={[styles.islandBase, styles.rightIsland, { borderColor: colors.borderLight }]}>
        <BlurView intensity={10} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.rightActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={toggleTheme}>
            <Ionicons 
              name={isDark ? "sunny-outline" : "moon-outline"} 
              size={15} 
              color={colors.text} 
              style={{ opacity: 0.7 }} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setWishlistOpen(true)}
          >
            <Ionicons 
              name={isWishlisted ? "bookmark" : "bookmark-outline"} 
              size={15} 
              color={colors.text} 
              style={!isWishlisted ? { opacity: 0.7 } : undefined} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setCartOpen(true)}
          >
            <Ionicons 
              name="bag-outline" 
              size={15} 
              color={colors.text} 
              style={{ opacity: 0.7 }} 
            />
            {cartCount > 0 && (
              <View style={[styles.cartBadge, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  islandBase: {
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  leftIsland: {
    width: 40,
  },
  centerIsland: {
    flex: 1,
    marginHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  rightIsland: {
    paddingHorizontal: 4,
  },
  iconCircle: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    letterSpacing: 2.5,
    paddingTop: 2,
    textAlign: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  actionBtn: {
    width: 36,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});

