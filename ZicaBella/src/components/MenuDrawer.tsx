import React, { useEffect, useState } from 'react';
import { 
  View, StyleSheet, TouchableOpacity, Animated, Dimensions, Pressable, ScrollView, Platform 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Typography } from './Typography';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { haptics } from '../utils/haptics';
import { Image } from 'expo-image';
import { useCollections } from '../hooks/useProducts';
import { useCurrencyStore } from '../store/currencyStore';
import CurrencySelectorModal from './CurrencySelectorModal';

const { width, height } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.88, 340);

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function MenuDrawer({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';
  const { collections, loading } = useCollections(10, 'page');
  const currentCurrency = useCurrencyStore(s => s.currentCurrency);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);

  const slideAnim = React.useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.96)).current;

  const [isRendered, setIsRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 12,
          damping: 30,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -DRAWER_WIDTH,
          damping: 30,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 0.96,
          friction: 8,
          useNativeDriver: true,
        })
      ]).start(() => {
        setIsRendered(false);
      });
    }
  }, [visible]);

  if (!isRendered) return null;

  const handleNavigate = (screen: string, params?: any) => {
    haptics.buttonTap();
    onClose();
    // Use a small timeout to allow drawer close animation to finish
    setTimeout(() => {
      navigation.navigate(screen, params);
    }, 300);
  };

  const shopTerms = ['T-SHIRTS', 'HOODIES', 'DENIM', 'ACCESSORIES', 'OUTERWEAR'];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* ── BACKDROP ── */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
           {Platform.OS === 'android' ? (
             <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.60)' }]} />
           ) : (
             <BlurView intensity={isDark ? 30 : 50} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
           )}
        </Animated.View>
      </Pressable>

      {/* ── ETHEREAL GLASS DRAWER ── */}
      <Animated.View style={[
        styles.drawer, 
        { 
          transform: [{ translateX: slideAnim }, { scale: scaleAnim }],
          backgroundColor: isDark ? 'rgba(10, 10, 10, 0.7)' : 'rgba(255, 255, 255, 0.8)',
          top: insets.top + 10,
          bottom: insets.bottom + 10,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        }
      ]}>
        {Platform.OS === 'android' ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(10, 10, 10, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]} />
        ) : (
          <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        )}
        
        {/* HEADER: MINIMAL SYSTEM TAG & LOGO */}
        <View style={styles.header}>
          <View style={styles.logoTitleRow}>
            <Image 
              source={require('../../assets/zb-logo-220px.png')} 
              style={styles.drawerLogo} 
              contentFit="contain"
            />
            <View style={{ justifyContent: 'center' }}>
              <Typography size={7} weight="800" color={colors.text} style={{ letterSpacing: 5, opacity: 0.35 }}>
                ZICA BELLA
              </Typography>
              <Typography size={5} weight="400" color={colors.textExtraLight} style={{ letterSpacing: 2, opacity: 0.25, marginTop: 1 }}>
                SYSTEM ARCHIVE v.26
              </Typography>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
             <Ionicons name="close" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: 100 }}
          style={{ flex: 1 }}
        >
          {/* PRIMARY ARCHIVE LIST */}
          <View style={styles.archiveSection}>
            {loading ? (
              [1, 2, 3, 4, 5].map(i => <View key={i} style={[styles.skeleton, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} />)
            ) : (
              collections.map((c, idx) => (
                <TouchableOpacity 
                  key={c.id} 
                  activeOpacity={0.7}
                  style={styles.archiveLink}
                  onPress={() => handleNavigate('Main', { screen: 'ShopTab', params: { screen: 'Collection', params: { handle: c.handle } } })}
                >
                  <Typography size={6} weight="400" color={colors.textExtraLight} style={styles.archiveIndex}>
                    0{idx + 1}
                  </Typography>
                  <Typography size={12} weight="300" color={colors.text} style={styles.archiveTitle}>
                    {c.title.toUpperCase()}
                  </Typography>
                  <Ionicons name="chevron-forward" size={14} color={colors.textExtraLight} style={{ opacity: 0.3 }} />
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* SECONDARY UTILITIES */}
          <View style={[styles.utilsSection, { borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
            {[
              { label: 'COMMUNITY', tab: 'HomeTab', screen: 'Community', icon: 'people-outline' },
              { label: 'EDITORIALS', tab: 'HomeTab', screen: 'Editorials', icon: 'newspaper-outline' },
              { label: 'ZICA AI', tab: 'ChatTab', screen: undefined, icon: 'sparkles-outline' },
              { label: `CURRENCY: ${currentCurrency.flag} ${currentCurrency.code} (${currentCurrency.symbol})`, isCurrency: true, icon: 'globe-outline' }
            ].map(item => (
              <TouchableOpacity 
                key={item.label} 
                style={styles.utilLink}
                onPress={() => {
                  if (item.isCurrency) {
                    haptics.buttonTap();
                    setCurrencyModalVisible(true);
                  } else if (item.screen) {
                    handleNavigate('Main', { screen: item.tab, params: { screen: item.screen } });
                  } else {
                    handleNavigate('Main', { screen: item.tab });
                  }
                }}
              >
                <Ionicons name={item.icon as any} size={18} color={colors.textSecondary} style={{ marginRight: 12, opacity: 0.7 }} />
                <Typography size={10} weight="400" color={colors.textSecondary}>{item.label}</Typography>
              </TouchableOpacity>
            ))}
          </View>
          <CurrencySelectorModal visible={currencyModalVisible} onClose={() => setCurrencyModalVisible(false)} />

          {/* SHOP SHORTCUTS: HORIZONTAL CHIPS */}
          <View style={styles.chipsContainer}>
            <Typography size={5.5} weight="700" color={colors.textExtraLight} style={styles.chipsLabel}>QUICK DISCOVER</Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              {shopTerms.map(term => (
                <TouchableOpacity 
                  key={term} 
                  style={[styles.chip, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
                  onPress={() => handleNavigate('Main', { screen: 'SearchTab', params: { screen: 'SearchScreen', params: { query: term } } })}
                >
                  <Typography size={7} weight="500" color={colors.textExtraLight}>{term}</Typography>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        {/* FLOATING SYSTEM DOCK */}
        <View style={[styles.dock, { backgroundColor: isDark ? 'rgba(20,20,20,0.4)' : 'rgba(240,240,240,0.4)' }]}>
           {Platform.OS === 'android' ? (
             <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(20, 20, 20, 0.85)' : 'rgba(240, 240, 240, 0.85)' }]} />
           ) : (
             <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
           )}
           <TouchableOpacity style={styles.dockItem} onPress={() => handleNavigate('Main', { screen: 'ProfileTab' })}>
              <Ionicons name="person-outline" size={18} color={colors.text} />
              <Typography size={5} weight="700" color={colors.text} style={{ letterSpacing: 1 }}>PROFILE</Typography>
           </TouchableOpacity>
           <View style={[styles.dockDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} />
           <TouchableOpacity style={styles.dockItem} onPress={() => handleNavigate('Main', { screen: 'ProfileTab', params: { screen: 'OrderHistory' } })}>
              <Ionicons name="receipt-outline" size={18} color={colors.text} />
              <Typography size={5} weight="700" color={colors.text} style={{ letterSpacing: 1 }}>ORDERS</Typography>
           </TouchableOpacity>
           <View style={[styles.dockDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} />
           <TouchableOpacity style={styles.dockItem} onPress={() => handleNavigate('Main', { screen: 'HomeTab', params: { screen: 'Story' } })}>
              <Ionicons name="infinite-outline" size={20} color={colors.text} />
              <Typography size={5} weight="700" color={colors.text} style={{ letterSpacing: 1 }}>STORY</Typography>
           </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
  drawer: {
    width: DRAWER_WIDTH,
    position: 'absolute',
    borderRadius: 40,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 40 },
        shadowOpacity: 0.2,
        shadowRadius: 80,
      },
      android: {
        elevation: 16,
      },
    }),
    paddingTop: 24,
    left: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    marginBottom: 32,
  },
  logoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drawerLogo: {
    width: 26,
    height: 26,
    opacity: 0.85,
    alignSelf: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  archiveSection: {
    paddingHorizontal: 28,
    gap: 24,
  },
  archiveLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  archiveIndex: {
    width: 32,
    opacity: 0.3,
    letterSpacing: 1,
  },
  archiveTitle: {
    flex: 1,
    letterSpacing: 2,
  },
  skeleton: {
    height: 40,
    width: '100%',
    borderRadius: 12,
    marginBottom: 16,
  },
  utilsSection: {
    marginTop: 40,
    paddingTop: 32,
    paddingHorizontal: 28,
    borderTopWidth: 1,
    gap: 24,
  },
  utilLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipsContainer: {
    marginTop: 40,
  },
  chipsLabel: {
    paddingHorizontal: 28,
    letterSpacing: 4,
    opacity: 0.2,
    marginBottom: 16,
  },
  chipsScroll: {
    paddingHorizontal: 28,
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  dock: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    height: 70,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  dockItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dockDivider: {
    width: 1,
    height: 20,
  }
});
