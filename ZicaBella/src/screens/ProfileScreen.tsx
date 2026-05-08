import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Pressable, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { sendOTP, verifyOTP, signOut } from '../auth/firebase';
import { signInWithApple, isAppleSignInAvailable } from '../auth/apple';
import { haptics } from '../utils/haptics';
import { config } from '../constants/config';
import { navigationRef } from '../navigation/navigationUtils';
import { useUIStore } from '../store/uiStore';
import { Typography } from '../components/Typography';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useThemeStore } from '../store/themeStore';
import { useBookmarkStore } from '../store/bookmarkStore';
import { formatPrice } from '../utils/formatPrice';
import { useNotificationStore } from '../store/notificationStore';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const { user, isAuthenticated, biometricEnabled, login, logout, setBiometric, updateUser } = useAuth();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';
  const setTabBarVisible = useUIStore(s => s.setTabBarVisible);
  const { bookmarks } = useBookmarkStore();
  const unreadCount = useNotificationStore(s => s.unreadCount());

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [orderCount, setOrderCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [storeCredits, setStoreCredits] = useState(0);
  const [storeCreditPreference, setStoreCreditPreference] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [profileImage, setProfileImage] = useState<string | undefined>(user?.image || undefined);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const lastScrollY = useRef(0);

  const fetchProfile = useCallback(async () => {
    if (!isAuthenticated || !user) return;
    try {
      const params = new URLSearchParams();
      if (user.id) params.set('customerId', user.id);
      if (user.phone) params.set('phone', user.phone);
      if (user.email) params.set('email', user.email);

      const authOptions = { headers: { 'Authorization': `Bearer ${useAuthStore.getState().token || ''}` } };
      
      const [profileRes, ordersRes, addrRes, returnsRes, exchangesRes, creditsRes] = await Promise.all([
        fetch(`${config.appUrl}/api/app/profile?${params.toString()}`, authOptions),
        fetch(`${config.appUrl}/api/app/orders?${params.toString()}&limit=1&count=true`, authOptions),
        fetch(`${config.appUrl}/api/app/customers/addresses?${params.toString()}`, authOptions),
        fetch(`${config.appUrl}/api/app/returns?${params.toString()}`, authOptions),
        fetch(`${config.appUrl}/api/app/exchanges?${params.toString()}`, authOptions),
        fetch(`${config.appUrl}/api/app/store-credits?${params.toString()}`, authOptions),
      ]);

      const profileJson = await profileRes.json().catch(() => ({}));
      if (profileRes.ok && profileJson?.customer) {
        updateUser({
          name: profileJson.customer.name || user.name,
          email: profileJson.customer.email || user.email,
          phone: profileJson.customer.phone || user.phone,
          image: profileJson.customer.image || undefined,
          isCommunityMember: !!profileJson.customer.isCommunityMember,
        });
        setProfileImage(profileJson.customer.image || undefined);
        setStoreCredits(profileJson.customer.storeCredits ?? 0);
        setStoreCreditPreference(profileJson.customer.storeCreditPreference ?? false);
      }

      const ordersJson = await ordersRes.json().catch(() => ({}));
      if (ordersRes.ok && ordersJson.orders) {
        setOrderCount((ordersJson.page?.total as number) ?? ordersJson.orders.length);
      }

      const addrJson = await addrRes.json().catch(() => ({}));
      if (addrRes.ok && Array.isArray(addrJson.addresses)) {
        setSavedAddresses(addrJson.addresses);
      }

      const returnsJson = await returnsRes.json().catch(() => ({ returns: [] }));
      const exchangesJson = await exchangesRes.json().catch(() => ({ exchanges: [] }));
      setServiceCount((returnsJson.returns?.length || 0) + (exchangesJson.exchanges?.length || 0));

      const creditsJson = await creditsRes.json().catch(() => ({}));
      if (creditsRes.ok && creditsJson.balance !== undefined) {
        setStoreCredits(creditsJson.balance);
        setStoreCreditPreference(creditsJson.preferStoreCredits ?? false);
      }
    } catch (e) {
      console.error('Fetch profile orders error:', e);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (isAuthenticated && user) {
      setEditName(user.name || '');
      setEditEmail(user.email || '');
      setProfileImage(user.image);
      fetchProfile();
    }
  }, [isAuthenticated, user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
    haptics.success();
  }, [fetchProfile]);

  const handleToggleStoreCreditPreference = async (val: boolean) => {
    if (!user) return;
    haptics.buttonTap();
    setStoreCreditPreference(val);
    try {
      await fetch(`${config.appUrl}/api/app/store-credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: user.id,
          action: 'set_preference',
          preferStoreCredits: val,
        }),
      });
    } catch (e) {
      console.error('Toggle store credit preference error:', e);
      setStoreCreditPreference(!val); // Revert on error
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`${config.appUrl}/api/app/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customerId: user.id,
          name: editName,
          email: editEmail,
          phone: user.phone,
          image: profileImage,
        }),
      });

      if (res.ok) {
        updateUser({ name: editName, email: editEmail });
        setIsEditing(false);
        haptics.success();
      } else {
        Alert.alert('Error', 'Failed to update profile');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handlePickAvatar = async () => {
    if (!user) return;
    haptics.buttonTap();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission', 'Photo access is required to update your profile photo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];

    setLoading(true);
    try {
      const form = new FormData();
      (form as any).append('file', {
        uri: a.uri,
        type: a.mimeType || 'image/jpeg',
        name: a.fileName || 'avatar.jpg',
      } as any);
      const upload = await fetch(`${config.appUrl}/api/admin/upload-image`, {
        method: 'POST',
        body: form as any,
      });
      const upJson = await upload.json();
      if (!upload.ok) throw new Error(upJson.error || 'Upload failed');
      const url = upJson.url as string;
      setProfileImage(url);
      updateUser({ image: url });
      await fetch(`${config.appUrl}/api/app/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: user.id, image: url }),
      });
      haptics.success();
    } catch (e: any) {
      haptics.error();
      Alert.alert('Error', e.message || 'Failed to update photo');
    } finally {
      setLoading(false);
    }
  };

  const onScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;
    
    if (Math.abs(diff) > 5) {
      if (diff > 0 && currentY > 100) {
        setTabBarVisible(false);
      } else {
        setTabBarVisible(true);
      }
    }
    lastScrollY.current = currentY;
  };

  const handleSendOTP = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    const success = await sendOTP(phone);
    if (success) {
      setOtpSent(true);
    } else {
      Alert.alert('Error', 'Failed to send OTP');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) return;
    setLoading(true);
    const success = await verifyOTP(phone, otp);
    if (success) {
      haptics.success();
    } else {
      Alert.alert('Error', 'Invalid OTP');
      haptics.error();
    }
    setLoading(false);
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    const success = await signInWithApple();
    if (success) haptics.success();
    setLoading(false);
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity',
        fallbackLabel: 'Use passcode',
      });
      if (result.success) {
        setBiometric(true);
        haptics.success();
      }
    } else {
      setBiometric(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          signOut();
          setOtpSent(false);
          setPhone('');
          setOtp('');
        },
      },
    ]);
  };

  const navigatePolicy = (type: 'privacy' | 'refund' | 'shipping' | 'terms') => {
    const titles: Record<string, string> = {
      privacy: 'Privacy Policy',
      refund: 'Refund Policy',
      shipping: 'Shipping Policy',
      terms: 'Terms of Service',
    };
    haptics.buttonTap();
    if (navigationRef.isReady()) {
      navigationRef.navigate('Policy', { url: config.policies[type], title: titles[type] });
    }
  };

  const MenuItem = ({ icon, title, subtitle, onPress, destructive, badge, type, value, onToggle }: any) => {
    const colors = useColors();
    return (
      <TouchableOpacity 
        style={[styles.menuItem, { borderBottomColor: colors.borderExtraLight }]} 
        onPress={type === 'toggle' ? () => onToggle?.(!value) : onPress}
        activeOpacity={0.7}
      >
        <View style={styles.menuItemLeft}>
          <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
            <Ionicons name={icon} size={16} color={destructive ? colors.error : colors.text} />
          </View>
          <Typography weight="500" size={12} color={destructive ? colors.error : colors.text} style={styles.menuLabel}>
            {title}
          </Typography>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {badge !== undefined && (
            <View style={{ backgroundColor: colors.error, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
              <Typography size={10} color="#FFF" weight="bold">{badge}</Typography>
            </View>
          )}
          {type === 'toggle' ? (
            <Pressable onPress={() => onToggle?.(!value)}>
              <View style={[styles.toggleTrack, { backgroundColor: value ? colors.foreground : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }]}>
                <View style={[styles.toggleThumb, { transform: [{ translateX: value ? 20 : 2 }], backgroundColor: '#FFF' }]} />
              </View>
            </Pressable>
          ) : (
            <Ionicons name="chevron-forward" size={14} color={colors.textExtraLight} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ─── NOT AUTHENTICATED ───────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: insets.top + 60, paddingHorizontal: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.loginHeader}>
            <Image 
              source={require('../../assets/zica-bella-logo_8.png')} 
              style={{ width: 44, height: 44, marginBottom: 16 }} 
              contentFit="contain"
            />
            <Typography rocaston size={24} color={colors.text} style={styles.loginTitle}>ZICA BELLA</Typography>
            <Typography weight="400" size={8} color={colors.textExtraLight} style={styles.loginSubtitle}>ARCHIVAL EXCELLENCE</Typography>
          </View>

          <BlurView 
            intensity={isDark ? 10 : 60} 
            tint={theme} 
            style={[
              styles.loginCard, 
              { 
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.4)'
              }
            ]}
          >
            <Typography weight="300" size={14} color={colors.textSecondary} style={styles.welcomeText}>Sign in to your account</Typography>
            
            <View style={styles.formSection}>
              <Typography heading size={7} color={colors.textExtraLight} style={styles.formLabel}>PHONE NUMBER</Typography>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 00000 00000"
                placeholderTextColor={colors.textExtraLight}
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.borderLight }]}
                keyboardType="phone-pad"
              />

              {otpSent && (
                <View style={{ marginTop: 20 }}>
                  <Typography heading size={7} color={colors.textExtraLight} style={styles.formLabel}>VERIFICATION CODE</Typography>
                  <TextInput
                    value={otp}
                    onChangeText={setOtp}
                    placeholder="0 0 0 0 0 0"
                    placeholderTextColor={colors.textExtraLight}
                    style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.borderLight }]}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.foreground }]}
                onPress={otpSent ? handleVerifyOTP : handleSendOTP}
                disabled={loading}
                activeOpacity={0.8}
                accessibilityLabel={otpSent ? 'Confirm OTP and sign in' : 'Send verification code'}
                accessibilityRole="button"
              >
                <Typography heading weight="700" size={9} color={colors.background}>
                  {loading ? 'PROCESSING' : otpSent ? 'CONFIRM OTP' : 'SEND CODE'}
                </Typography>
              </TouchableOpacity>
            </View>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.borderLight }]} />
              <Typography weight="300" size={8} color={colors.textExtraLight} style={{ paddingHorizontal: 12 }}>OR</Typography>
              <View style={[styles.dividerLine, { backgroundColor: colors.borderLight }]} />
            </View>

            <TouchableOpacity
              style={[styles.appleButton, { backgroundColor: colors.text }]}
              onPress={handleAppleSignIn}
              activeOpacity={0.8}
              accessibilityLabel="Sign in with Apple"
              accessibilityRole="button"
            >
              <Ionicons name="logo-apple" size={16} color={colors.background} />
              <Typography heading weight="600" size={9} color={colors.background} style={{ marginLeft: 6 }}>SIGN IN WITH APPLE</Typography>
            </TouchableOpacity>
          </BlurView>

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    );
  }

  // ─── AUTHENTICATED VIEW ──────────────────────────────────────────────
  const goRoot = (name: 'OrderHistory' | 'Wishlist' | 'Community') => {
    haptics.buttonTap();
    if (navigationRef.isReady()) {
      navigationRef.navigate(name as never);
    }
  };

  const quickActions = [
    { icon: 'receipt-outline' as const, label: 'Orders', onPress: () => goRoot('OrderHistory') },
    { icon: 'heart-outline' as const, label: 'Wishlist', onPress: () => navigation.navigate('Wishlist') },
    { icon: 'swap-horizontal-outline' as const, label: 'Returns', onPress: () => navigation.navigate('ServiceFlow', { screen: 'ServiceHistory' }) },
    { icon: 'help-circle-outline' as const, label: 'FAQ', onPress: () => navigation.navigate('FAQ') },
    { icon: 'people-outline' as const, label: 'Collabs', onPress: () => navigation.navigate('Collaborations') },
    { icon: 'newspaper-outline' as const, label: 'Blogs', onPress: () => navigation.navigate('Blogs') },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 40, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />
        }
      >
        <View style={styles.profileHeader}>
          <TouchableOpacity activeOpacity={0.8} onPress={handlePickAvatar}>
            <BlurView intensity={isDark ? 20 : 60} tint={theme} style={[styles.avatarGlass, { borderColor: colors.borderLight }]}>
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={250}
                />
              ) : (
                <Typography heading weight="700" size={24} color={colors.text}>
                  {(user?.name || 'U')[0].toUpperCase()}
                </Typography>
              )}
              <View style={styles.avatarEditDot}>
                <Ionicons name="pencil" size={12} color={colors.background} />
              </View>
            </BlurView>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Typography heading weight="600" size={18} color={colors.text}>{user?.name || 'ZICA USER'}</Typography>
            <Typography weight="300" size={9} color={colors.textLight} style={{ letterSpacing: 1 }}>{user?.id ? `ID: ${user.id.slice(0, 8).toUpperCase()}` : 'MEMBER SINCE 2024'}</Typography>
          </View>
        </View>

        <View style={[styles.statsRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderColor: colors.borderExtraLight }]}>
          <TouchableOpacity style={styles.statItem} onPress={() => goRoot('OrderHistory')}>
            <Typography heading size={16} color={colors.text} style={{ letterSpacing: 2 }}>
              {String(orderCount).padStart(2, '0')}
            </Typography>
            <Typography size={6.5} color={colors.textExtraLight} weight="600">ORDERS</Typography>
          </TouchableOpacity>
          <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
          <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('Wishlist')}>
            <Typography heading size={16} color={colors.text} style={{ letterSpacing: 2 }}>
               {String(bookmarks.length).padStart(2, '0')}
            </Typography>
            <Typography size={6.5} color={colors.textExtraLight} weight="600">WISHLIST</Typography>
          </TouchableOpacity>
          <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
          <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('ServiceFlow', { screen: 'ServiceHistory' })}>
             <Typography heading size={16} color={colors.text} style={{ letterSpacing: 2 }}>
               {String(serviceCount).padStart(2, '0')}
             </Typography>
             <Typography size={6.5} color={colors.textExtraLight} weight="600">SERVICES</Typography>
          </TouchableOpacity>
          <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
          <TouchableOpacity style={styles.statItem}>
            <Typography heading size={16} color={storeCredits > 0 ? colors.success : colors.text} style={{ letterSpacing: 1 }}>
              {storeCredits > 0 ? `₹${storeCredits}` : '—'}
            </Typography>
            <Typography size={6.5} color={colors.textExtraLight} weight="600">CREDITS</Typography>
          </TouchableOpacity>
        </View>

        <View style={styles.quickActionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={[styles.quickActionItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: colors.borderExtraLight }]}
              onPress={() => { haptics.buttonTap(); action.onPress(); }}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                <Ionicons name={action.icon} size={18} color={colors.text} />
              </View>
              <Typography size={7} weight="600" color={colors.textMuted} style={{ marginTop: 8, letterSpacing: 0.5 }}>{action.label.toUpperCase()}</Typography>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionContainer}>
          <Typography heading size={7} color={colors.textLight} style={styles.sectionTitle}>NOTIFICATIONS</Typography>
          <BlurView intensity={isDark ? 10 : 40} tint={theme} style={[styles.menuGlass, { borderColor: colors.borderLight }]}>
            <MenuItem 
              icon="notifications-outline" 
              title="Notifications" 
              onPress={() => navigation.navigate('Notifications')} 
              badge={unreadCount > 0 ? unreadCount : undefined}
            />
          </BlurView>
        </View>

        <View style={styles.sectionContainer}>
          <Typography heading size={7} color={colors.textLight} style={styles.sectionTitle}>STORE CREDITS</Typography>
          <BlurView 
            intensity={isDark ? 10 : 40} 
            tint={theme} 
            style={[styles.menuGlass, { borderColor: storeCredits > 0 ? 'rgba(52, 199, 89, 0.2)' : colors.borderLight }]}
          >
            <View style={styles.creditCard}>
              <View style={styles.creditBalanceRow}>
                <View>
                  <Typography size={7} weight="800" color={colors.textExtraLight} style={{ letterSpacing: 2 }}>AVAILABLE BALANCE</Typography>
                  <Typography heading size={28} weight="700" color={storeCredits > 0 ? colors.success : colors.text} style={{ marginTop: 4 }}>
                    {formatPrice(storeCredits)}
                  </Typography>
                </View>
                <View style={[styles.creditIcon, { backgroundColor: storeCredits > 0 ? 'rgba(52,199,89,0.12)' : colors.surface }]}>
                  <Ionicons name="wallet-outline" size={24} color={storeCredits > 0 ? colors.success : colors.textExtraLight} />
                </View>
              </View>
              
              <View style={[styles.creditDivider, { backgroundColor: colors.borderExtraLight }]} />
              
              <TouchableOpacity
                style={styles.creditPreferenceRow}
                onPress={() => handleToggleStoreCreditPreference(!storeCreditPreference)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Typography size={10} weight="600" color={colors.text}>Prefer Store Credits on Refund</Typography>
                  <Typography size={8} weight="400" color={colors.textMuted} style={{ marginTop: 2 }}>Get instant credit instead of waiting for bank refund</Typography>
                </View>
                <View style={[styles.toggleTrack, { backgroundColor: storeCreditPreference ? colors.success : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }]}>
                  <View style={[styles.toggleThumb, { transform: [{ translateX: storeCreditPreference ? 20 : 2 }], backgroundColor: '#FFF' }]} />
                </View>
              </TouchableOpacity>

              <Typography size={7} weight="400" color={colors.textExtraLight} style={{ paddingHorizontal: 20, paddingBottom: 16, lineHeight: 12 }}>
                Store credits can be used on any future purchase and never expire.
              </Typography>
            </View>
          </BlurView>
        </View>

        {/* Personal Details Section */}

        {/* ── Edit Profile Section ── */}
        <View style={styles.sectionContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Typography heading size={7} color={colors.textLight} style={styles.sectionTitle}>PERSONAL DETAILS</Typography>
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
              <Typography size={7} color={colors.foreground} weight="600">{isEditing ? 'CANCEL' : 'EDIT'}</Typography>
            </TouchableOpacity>
          </View>

          <BlurView 
            intensity={isDark ? 10 : 40} 
            tint={theme} 
            style={[styles.menuGlass, { borderColor: colors.borderLight }]}
          >
            <View style={styles.editForm}>
              <View style={styles.editField}>
                <Typography size={7} color={colors.textExtraLight} style={styles.fieldLabel}>FULL NAME</Typography>
                {isEditing ? (
                  <TextInput 
                    value={editName}
                    onChangeText={setEditName}
                    style={[styles.editInput, { color: colors.text, borderBottomColor: colors.borderLight }]}
                  />
                ) : (
                  <Typography size={12} color={colors.text}>{user?.name || 'Set Name'}</Typography>
                )}
              </View>
              <View style={[styles.fieldDivider, { backgroundColor: colors.borderLight }]} />
              <View style={styles.editField}>
                <Typography size={7} color={colors.textExtraLight} style={styles.fieldLabel}>EMAIL ADDRESS</Typography>
                {isEditing ? (
                  <TextInput 
                    value={editEmail}
                    onChangeText={setEditEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={[styles.editInput, { color: colors.text, borderBottomColor: colors.borderLight }]}
                  />
                ) : (
                  <Typography size={12} color={colors.text}>{user?.email || 'Set Email'}</Typography>
                )}
              </View>
              <View style={[styles.fieldDivider, { backgroundColor: colors.borderLight }]} />
              <View style={styles.editField}>
                <Typography size={7} color={colors.textExtraLight} style={styles.fieldLabel}>PHONE NUMBER</Typography>
                <Typography size={12} color={colors.textMuted}>{user?.phone || 'Not provided'}</Typography>
              </View>
            </View>
          </BlurView>
          
          {isEditing && (
            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: colors.foreground }]}
              onPress={handleSaveProfile}
              disabled={loading}
            >
              <Typography heading size={8} weight="700" color={colors.background}>
                {loading ? 'SAVING...' : 'SAVE CHANGES'}
              </Typography>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity 
          style={[styles.logoutBtn, { borderColor: colors.error + '40' }]} 
          onPress={handleLogout}
          activeOpacity={0.7}
          accessibilityLabel="Sign out"
          accessibilityRole="button"
        >
          <Ionicons name="log-out-outline" size={16} color={colors.error} />
          <Typography weight="500" size={11} color={colors.error}>SIGN OUT</Typography>
        </TouchableOpacity>

        <Typography weight="300" size={8} color={colors.textExtraLight} style={styles.versionText}>ZICA ARCHIVE v1.0.5</Typography>

        <View style={{ height: 120 + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // ── Login Styles ──
  loginHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  loginTitle: {
    fontFamily: 'Rocaston',
    letterSpacing: 4,
    marginBottom: 4,
  },
  loginSubtitle: {
    letterSpacing: 4,
    opacity: 0.5,
  },
  loginCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  welcomeText: {
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
  },
  formSection: {
    gap: 16,
  },
  formLabel: {
    letterSpacing: 3,
    marginLeft: 4,
    opacity: 0.6,
  },
  input: {
    height: 60,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    fontSize: 14,
    fontWeight: '500',
  },
  primaryButton: {
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 40,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.2,
  },
  appleButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
  },
  // ── Authenticated Profile Styles ──
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  avatarGlass: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 20,
    overflow: 'hidden',
  },
  avatarEditDot: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  headerInfo: {
    flex: 1,
    gap: 6,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderRadius: 24,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  statItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 28,
    opacity: 0.15,
  },
  // ── Quick Actions ──
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 4,
    marginBottom: 32,
  },
  quickActionItem: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Sections ──
  sectionContainer: {
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    letterSpacing: 4,
    marginBottom: 12,
    opacity: 0.7,
  },
  menuGlass: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  menuItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    flex: 1,
    letterSpacing: 0.5,
  },
  // ── Store Credits ──
  creditCard: {
    overflow: 'hidden',
  },
  creditBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  creditIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  creditDivider: {
    height: 1,
    marginHorizontal: 20,
    opacity: 0.3,
  },
  creditPreferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  // ── Edit Profile ──
  editForm: {
    padding: 20,
    gap: 20,
  },
  editField: {
    gap: 8,
  },
  fieldLabel: {
    letterSpacing: 2,
    opacity: 0.6,
  },
  editInput: {
    fontSize: 14,
    borderBottomWidth: 1,
    paddingVertical: 4,
  },
  fieldDivider: {
    height: 1,
    opacity: 0.05,
  },
  saveBtn: {
    marginTop: 16,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  // ── Controls ──
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: 'absolute',
  },
  // ── Footer ──
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 48,
    marginHorizontal: 4,
  },
  versionText: {
    textAlign: 'center',
    letterSpacing: 4,
    opacity: 0.4,
  },
});
