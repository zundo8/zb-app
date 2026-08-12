import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, Platform, StatusBar } from 'react-native';
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
import { GlassBackdrop } from './GlassView';
import CurrencySelectorModal from './CurrencySelectorModal';

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
  const [currencyModalOpen, setCurrencyModalOpen] = React.useState(false);

  const isDark = theme === 'dark';
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0) + 6;

  return (
    <View style={[styles.container, { paddingTop: topPadding }, style]}>
      {/* Box 1: Left Action Capsule (Logo/Back) */}
      <TouchableOpacity
        style={[
          styles.islandBase, 
          styles.leftIsland, 
          { 
            backgroundColor: isDark ? 'rgba(18, 18, 20, 0.75)' : 'rgba(255, 255, 255, 0.82)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
          }
        ]}
        onPress={() => {
          if (showBack) {
            haptics.buttonTap();
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              const parent = navigation.getParent();
              if (parent && parent.canGoBack()) {
                parent.goBack();
              } else {
                navigation.navigate('Main');
              }
            }
          } else {
            haptics.buttonTap();
            setMenuOpen(true);
          }
        }}
        activeOpacity={0.75}
        accessibilityLabel={showBack ? "Go back" : "Open menu"}
        accessibilityRole="button"
      >
        <GlassBackdrop intensity={isDark ? 45 : 85} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.iconCircle}>
          {showBack ? (
            <Ionicons name="chevron-back" size={20} color={colors.text} style={styles.centeredIcon} />
          ) : (
            <Image 
              source={require('../../assets/zb-logo-220px.png')} 
              style={styles.logoImage} 
              contentFit="contain"
            />
          )}
        </View>
      </TouchableOpacity>

      {/* Box 2: Center Identity Capsule (Minimalist Typography) */}
      {!hideCenter && (
        <TouchableOpacity 
          style={[
            styles.islandBase, 
            styles.centerIsland, 
            { 
              backgroundColor: isDark ? 'rgba(18, 18, 20, 0.75)' : 'rgba(255, 255, 255, 0.82)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
            }
          ]}
          onPress={() => {
            if (onPressCenter) {
              onPressCenter();
            } else {
              navigation.navigate('HomeTab');
            }
          }}
          activeOpacity={0.8}
          accessibilityLabel="Go to home"
          accessibilityRole="button"
        >
          <GlassBackdrop intensity={isDark ? 45 : 85} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <Typography rocaston size={10} color={colors.text} style={styles.titleText}>
            {title.toUpperCase()}
          </Typography>
        </TouchableOpacity>
      )}

      {/* Box 3: Right Actions Capsule (Consolidated Island) */}
      <View 
        style={[
          styles.islandBase, 
          styles.rightIsland, 
          { 
            backgroundColor: isDark ? 'rgba(18, 18, 20, 0.75)' : 'rgba(255, 255, 255, 0.82)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
          }
        ]}
      >
        <GlassBackdrop intensity={isDark ? 45 : 85} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.rightActions}>
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => {
              haptics.buttonTap();
              setCurrencyModalOpen(true);
            }}
            accessibilityLabel="Select global currency"
            accessibilityRole="button"
          >
            <Ionicons 
              name="globe-outline" 
              size={15} 
              color={colors.text} 
              style={{ opacity: 0.75 }} 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={toggleTheme}
            accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            accessibilityRole="button"
          >
            <Ionicons 
              name={isDark ? "sunny-outline" : "moon-outline"} 
              size={15} 
              color={colors.text} 
              style={{ opacity: 0.75 }} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setWishlistOpen(true)}
            accessibilityLabel="View wishlist"
            accessibilityRole="button"
          >
            <Ionicons 
              name={isWishlisted ? "bookmark" : "bookmark-outline"} 
              size={15} 
              color={colors.text} 
              style={!isWishlisted ? { opacity: 0.75 } : undefined} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setCartOpen(true)}
            accessibilityLabel="View shopping bag"
            accessibilityRole="button"
          >
            <Ionicons 
              name="bag-outline" 
              size={15} 
              color={colors.text} 
              style={{ opacity: 0.75 }} 
            />
            {cartCount > 0 && (
              <View style={[styles.cartBadge, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <CurrencySelectorModal visible={currencyModalOpen} onClose={() => setCurrencyModalOpen(false)} />
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
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        // No Android elevation on container to avoid polygon shadow box artifacts
      },
    }),
  },
  leftIsland: {
    width: 44,
  },
  centerIsland: {
    flex: 1,
    marginHorizontal: 8,
    paddingHorizontal: 16,
  },
  rightIsland: {
    paddingHorizontal: 4,
  },
  iconCircle: {
    width: 44,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  logoImage: {
    width: 22,
    height: 22,
    opacity: 0.85,
    alignSelf: 'center',
  },
  centeredIcon: {
    alignSelf: 'center',
  },
  titleText: {
    letterSpacing: 2.5,
    textAlign: 'center',
    alignSelf: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
  },
  actionBtn: {
    width: 36,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: 11,
    right: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
