import React, { useEffect } from 'react';
import { 
  View, StyleSheet, Modal, TouchableOpacity, 
  Dimensions, Pressable, FlatList, ActivityIndicator 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useCartStore } from '../store/cartStore';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { formatPrice } from '../utils/formatPrice';
import CartItem from './CartItem';
import { Typography } from './Typography';
import { haptics } from '../utils/haptics';

const { width, height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.85;

interface Props {
  visible: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export default function CartDrawer({ visible, onClose, onCheckout }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';
  const { items, total, updateQuantity, removeItem, itemCount } = useCartStore();

  const translateY = useSharedValue(height);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 400 });
      translateY.value = withSpring(height - SHEET_HEIGHT, { 
        damping: 24, 
        stiffness: 180,
        mass: 0.8
      });
      haptics.buttonTap();
    } else {
      backdropOpacity.value = withTiming(0, { duration: 300 });
      translateY.value = withTiming(height, { duration: 300 });
    }
  }, [visible]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible && backdropOpacity.value === 0) return null;

  return (
    <Modal visible={visible} transparent onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Backdrop with Glass Blur */}
        <Animated.View style={[styles.backdrop, animatedBackdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
            <BlurView 
              intensity={isDark ? 20 : 40} 
              tint={isDark ? 'dark' : 'light'} 
              style={StyleSheet.absoluteFill} 
            />
          </Pressable>
        </Animated.View>

        {/* Bottom Sheet Cart */}
        <Animated.View style={[
          styles.sheet,
          animatedSheetStyle,
          { 
            backgroundColor: isDark ? 'rgba(10, 10, 10, 0.7)' : 'rgba(255, 255, 255, 0.75)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
          }
        ]}>
          <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          
          {/* Grab Bar */}
          <View style={styles.grabBarContainer}>
             <View style={[styles.grabBar, { backgroundColor: colors.textExtraLight, opacity: 0.15 }]} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="bag-handle" size={16} color={colors.text} style={{ opacity: 0.4 }} />
              <Typography size={10} weight="800" color={colors.text} style={styles.drawerTitle}>SHOPPING BAG</Typography>
              {itemCount() > 0 && (
                <View style={[styles.countBadge, { backgroundColor: colors.text }]}>
                  <Typography size={8} weight="800" color={colors.background}>{itemCount()}</Typography>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
              <Ionicons name="close" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bag-outline" size={60} color={colors.textExtraLight} style={{ opacity: 0.05 }} />
              <Typography size={9} weight="400" color={colors.textExtraLight} style={styles.emptyText}>BAG IS CURRENTLY EMPTY</Typography>
              <TouchableOpacity onPress={onClose} style={[styles.shopBtn, { borderColor: colors.borderLight }]}>
                <Typography size={8} weight="800" color={colors.textSecondary} style={styles.shopBtnText}>BROWSE ARCHIVE</Typography>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.listContent, { paddingBottom: 200 + insets.bottom }]}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={styles.itemWrapper}>
                    <CartItem 
                      item={item} 
                      onUpdateQuantity={(id, q) => { haptics.buttonTap(); updateQuantity(id, q); }}
                      onRemove={(id) => { haptics.buttonTap(); removeItem(id); }}
                      onPress={() => {
                        onClose();
                        setTimeout(() => navigation.navigate('ProductDetail', { handle: item.handle }), 300);
                      }}
                    />
                  </View>
                )}
              />

              {/* Unique Solid Glass Footer */}
              <View style={[styles.footerContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom + 10 : 30 }]}>
                <BlurView intensity={95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                <View style={[styles.footerBorder, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} />
                
                <View style={styles.footerContent}>
                  <View style={styles.totalRow}>
                    <View>
                      <Typography size={9} weight="800" color={colors.textExtraLight} style={styles.totalLabel}>ESTIMATED TOTAL</Typography>
                      <Typography weight="400" size={10} color={colors.textMuted} style={{ marginTop: 2 }}>Duties & Taxes included</Typography>
                    </View>
                    <Typography size={22} weight="300" color={colors.text} style={styles.priceText}>{formatPrice(total())}</Typography>
                  </View>
                  
                  <TouchableOpacity 
                    style={[styles.checkoutBtn, { backgroundColor: colors.text }]} 
                    onPress={onCheckout}
                    activeOpacity={0.8}
                  >
                    <View style={styles.checkoutBtnContent}>
                      <Typography size={10} weight="800" color={colors.background} style={styles.checkoutBtnText}>CHECKOUT SECURELY</Typography>
                      <View style={[styles.btnBadge, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)' }]}>
                         <Ionicons name="lock-closed" size={12} color={colors.background} />
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 20,
  },
  grabBarContainer: {
    alignItems: 'center',
    paddingTop: 12,
  },
  grabBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drawerTitle: {
    letterSpacing: 4,
  },
  countBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 24,
  },
  itemWrapper: {
    marginBottom: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    letterSpacing: 4,
    opacity: 0.3,
    marginTop: 20,
    marginBottom: 30,
  },
  shopBtn: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 14,
    borderWidth: 1,
  },
  shopBtnText: {
    letterSpacing: 3,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  footerBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  footerContent: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: {
    letterSpacing: 2,
  },
  priceText: {
    letterSpacing: -0.5,
  },
  checkoutBtn: {
    height: 60,
    borderRadius: 20,
    overflow: 'hidden',
  },
  checkoutBtnContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  checkoutBtnText: {
    letterSpacing: 2.5,
  },
  btnBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
