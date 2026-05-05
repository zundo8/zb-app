import React, { useEffect, useState } from 'react';
import { 
  View, StyleSheet, TouchableOpacity, Animated, Dimensions, Pressable, ScrollView 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Typography } from './Typography';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { haptics } from '../utils/haptics';
import { Image } from 'expo-image';
import { useCollections } from '../hooks/useProducts';

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
    setTimeout(() => {
      navigation.navigate(screen, params);
    }, 300);
  };

  const shopTerms = ["T-SHIRT", "JEANS", "PANTS", "SHIRTS", "ACCESSORIES"];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop with 2xl Blur */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
           <BlurView intensity={isDark ? 40 : 60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </Pressable>

      {/* Floating Glass Drawer — Left Aligned (Next.js Parity) */}
      <Animated.View style={[
        styles.drawer, 
        { 
          transform: [{ translateX: slideAnim }, { scale: scaleAnim }],
          backgroundColor: isDark ? 'rgba(8, 8, 8, 0.75)' : 'rgba(255, 255, 255, 0.82)',
          top: insets.top + 12,
          bottom: insets.bottom + 12,
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        }
      ]}>
        <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        
        {/* TOP BAR */}
        <View style={styles.header}>
          <Typography size={6.5} weight="300" color={colors.text} style={{ letterSpacing: 5, opacity: 0.15 }}>
            ZICA BELLA
          </Typography>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
             <Ionicons name="close" size={14} color={colors.textExtraLight} />
          </TouchableOpacity>
        </View>

        {/* ZONE A: COLLECTIONS & SHOP SPLIT */}
        <View style={styles.mainZone}>
           <View style={styles.collectionsCol}>
             <Typography size={5.5} weight="300" color={colors.textExtraLight} style={styles.zoneTag}>COLLECTIONS</Typography>
             <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.colItems}>
               {loading ? [1,2,3,4].map(i => (
                 <View key={i} style={[styles.skeleton, { backgroundColor: isDark ? 'white' : 'black' }]} />
               )) : collections.map(c => (
                 <TouchableOpacity 
                   key={c.id} 
                   style={styles.colLink}
                   onPress={() => handleNavigate('Main', { screen: 'ShopTab', params: { screen: 'Collection', params: { handle: c.handle } } })}
                 >
                   <Typography size={10} weight="300" color={colors.textSecondary} style={{ letterSpacing: 1.5 }}>{c.title.toUpperCase()}</Typography>
                   <Ionicons name="chevron-forward" size={10} color={colors.textExtraLight} style={{ opacity: 0 }} />
                 </TouchableOpacity>
               ))}
             </ScrollView>
           </View>

           <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]} />

           <View style={styles.shopCol}>
             <Typography size={5.5} weight="300" color={colors.textExtraLight} style={styles.zoneTag}>SHOP</Typography>
             <View style={styles.colItems}>
               {shopTerms.map(term => (
                 <TouchableOpacity 
                   key={term} 
                   style={styles.shopLink}
                   onPress={() => handleNavigate('Main', { screen: 'SearchTab', params: { screen: 'SearchScreen', params: { query: term } } })}
                 >
                   <Typography size={9} weight="300" color={colors.textExtraLight} style={{ letterSpacing: 1 }}>{term}</Typography>
                 </TouchableOpacity>
               ))}
             </View>
           </View>
        </View>

        {/* ZONE B: PRIMARY NAV (LARGE) */}
        <View style={[styles.primaryNav, { borderTopColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]}>
           {['COMMUNITY', 'BLOGS', 'FAQ', 'STORY'].map(item => (
             <TouchableOpacity 
               key={item} 
               style={styles.navLink}
               onPress={() => handleNavigate('Main', { screen: 'HomeTab', params: { screen: item.charAt(0) + item.slice(1).toLowerCase() } })}
             >
               <Typography size={16} weight="300" color={colors.textSecondary} style={{ letterSpacing: -0.5 }}>{item}</Typography>
               <View style={styles.navDot} />
             </TouchableOpacity>
           ))}
        </View>

        {/* ZONE C: ICON DOCK (BOTTOM) */}
        <View style={[styles.dock, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]}>
           <TouchableOpacity style={styles.dockItem} onPress={() => handleNavigate('Main', { screen: 'ProfileTab' })}>
              <Ionicons name="person-outline" size={16} color={colors.textExtraLight} />
              <Typography size={5.5} weight="300" color={colors.textExtraLight} style={{ letterSpacing: 2 }}>PROFILE</Typography>
           </TouchableOpacity>
           <View style={[styles.dockDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]} />
           <TouchableOpacity style={styles.dockItem} onPress={() => handleNavigate('Main', { screen: 'ProfileTab', params: { screen: 'OrderHistory' } })}>
              <Ionicons name="receipt-outline" size={16} color={colors.textExtraLight} />
              <Typography size={5.5} weight="300" color={colors.textExtraLight} style={{ letterSpacing: 2 }}>ORDERS</Typography>
           </TouchableOpacity>
           <View style={[styles.dockDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]} />
           <TouchableOpacity style={styles.dockItem} onPress={() => handleNavigate('Main', { screen: 'HomeTab', params: { screen: 'Story' } })}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textExtraLight} />
              <Typography size={5.5} weight="300" color={colors.textExtraLight} style={{ letterSpacing: 2 }}>STORY</Typography>
           </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  drawer: {
    width: DRAWER_WIDTH,
    position: 'absolute',
    borderRadius: 32,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 30 },
    shadowOpacity: 0.15,
    shadowRadius: 60,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainZone: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 20,
    maxHeight: 300,
  },
  collectionsCol: {
    flex: 1.8,
    paddingVertical: 10,
  },
  shopCol: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 12,
  },
  zoneTag: {
    letterSpacing: 4,
    opacity: 0.15,
    marginBottom: 16,
  },
  colItems: {
    gap: 10,
  },
  colLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shopLink: {
    marginBottom: 2,
  },
  skeleton: {
    height: 14,
    width: '80%',
    borderRadius: 4,
    opacity: 0.05,
    marginBottom: 4,
  },
  divider: {
    width: 1,
    marginVertical: 40,
  },
  primaryNav: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 15,
    borderTopWidth: 1,
    gap: 12,
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    opacity: 0,
  },
  dock: {
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 4,
    paddingVertical: 4,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
  },
  dockItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  dockDivider: {
    width: 1,
    height: 16,
  }
});
