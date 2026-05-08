import React, { useState, useMemo } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useColors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { Typography } from '../components/Typography';
import { haptics } from '../utils/haptics';
import { signInWithApple } from '../auth/apple';
import { useThemeStore } from '../store/themeStore';
import { config } from '../constants/config';

const COUNTRIES = [
  { name: 'India', code: '+91', flag: '🇮🇳' },
  { name: 'US/Canada', code: '+1', flag: '🇺🇸' },
  { name: 'UK', code: '+44', flag: '🇬🇧' },
  { name: 'UAE', code: '+971', flag: '🇦🇪' },
  { name: 'Australia', code: '+61', flag: '🇦🇺' },
  { name: 'Singapore', code: '+65', flag: '🇸🇬' },
  { name: 'Germany', code: '+49', flag: '🇩🇪' },
];

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';
  const { login, rememberMe, setRememberMe } = useAuth();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; otp?: string }>({});

  const handleSendOTP = async () => {
    // Exact 10 digit validation as requested
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      setErrors({ phone: 'Please enter exactly 10 digits' });
      haptics.error();
      return;
    }

    const fullPhone = country.code + cleaned;
    
    setLoading(true);
    try {
      const res = await fetch(`${config.appUrl}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json.error || 'Failed to send OTP');

      setStep('OTP');
      haptics.success();
    } catch (e: any) {
      Alert.alert('Error', e.message);
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!otp || otp.length < 6) {
      setErrors({ otp: 'Enter 6-digit OTP' });
      haptics.error();
      return;
    }

    setLoading(true);
    try {
      const fullPhone = country.code + phone.replace(/\D/g, '');
      const res = await fetch(`${config.appUrl}/api/auth/mobile-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, otp }),
      });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json.error || 'Verification failed');

      if (!json.token) throw new Error('Missing session token');
      login(json.user, json.token);
      haptics.success();
    } catch (e: any) {
      Alert.alert('Login Failed', e.message);
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    haptics.buttonTap();
    setLoading(true);
    const success = await signInWithApple();
    if (success) {
      haptics.success();
    } else {
      haptics.error();
    }
    setLoading(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 60 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── MINIMAL LOGO ── */}
          <View style={styles.header}>
            <Image 
              source={require('../../assets/zica-bella-logo_8.png')}
              style={styles.logo}
              contentFit="contain"
            />
            <Typography weight="700" size={14} color={colors.text} style={styles.title}>
              ZICA BELLA
            </Typography>
          </View>

          {/* ── AUTH INTERFACE ── */}
          <View style={styles.form}>
            {step === 'PHONE' ? (
              <View style={styles.phoneInputContainer}>
                 <TouchableOpacity 
                   style={styles.countryBox} 
                   onPress={() => { haptics.buttonTap(); setShowPicker(true); }}
                   activeOpacity={0.7}
                 >
                   <BlurView intensity={isDark ? 25 : 65} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                   <Typography size={22} style={{ marginBottom: 2 }}>{country.flag}</Typography>
                   <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                     <Typography size={10} weight="700" color={colors.text}>{country.code}</Typography>
                   </View>
                 </TouchableOpacity>

                 <View style={styles.numberBox}>
                   <BlurView intensity={isDark ? 25 : 65} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                   <TextInput
                     value={phone}
                     onChangeText={(v) => { 
                       const cleaned = v.replace(/\D/g, '').slice(0, 10);
                       setPhone(cleaned); 
                       if (errors.phone) setErrors({}); 
                     }}
                     placeholder="Phone Number"
                     placeholderTextColor={colors.textExtraLight}
                     keyboardType="number-pad"
                     maxLength={10}
                     style={[styles.input, { color: colors.text }]}
                     autoFocus
                   />
                 </View>
              </View>
            ) : (
              <View style={[styles.otpBox, { borderColor: colors.borderLight }]}>
                <BlurView intensity={isDark ? 25 : 65} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                <TextInput
                  value={otp}
                  onChangeText={(v) => { setOtp(v.replace(/\D/g, '').slice(0, 6)); if (errors.otp) setErrors({}); }}
                  placeholder="000000"
                  placeholderTextColor={colors.textExtraLight}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  style={[styles.input, { color: colors.text, textAlign: 'center', letterSpacing: 14, fontSize: 18 }]}
                />
              </View>
            )}

            {errors.phone && <Typography size={8} color={colors.error} style={styles.error}>{errors.phone}</Typography>}
            {errors.otp && <Typography size={8} color={colors.error} style={styles.error}>{errors.otp}</Typography>}

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.foreground }]}
              onPress={step === 'PHONE' ? handleSendOTP : handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Typography weight="700" size={10} color={colors.background} style={{ letterSpacing: 2 }}>
                  {step === 'PHONE' ? 'CONTINUE' : 'VERIFY'}
                </Typography>
              )}
            </TouchableOpacity>

            {step === 'OTP' && (
              <TouchableOpacity onPress={() => setStep('PHONE')} style={styles.backBtn}>
                <Typography size={8} weight="600" color={colors.textMuted} style={{ letterSpacing: 1 }}>CHANGE NUMBER</Typography>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.dividerRow}>
            <View style={[styles.line, { backgroundColor: colors.borderLight }]} />
            <Typography size={8} color={colors.textExtraLight} style={{ marginHorizontal: 15, letterSpacing: 2 }}>OR</Typography>
            <View style={[styles.line, { backgroundColor: colors.borderLight }]} />
          </View>

          <TouchableOpacity style={[styles.appleButton, { backgroundColor: colors.surface }]} onPress={handleAppleSignIn} activeOpacity={0.7}>
            <BlurView intensity={isDark ? 10 : 30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <Ionicons name="logo-apple" size={18} color={colors.text} />
            <Typography weight="600" size={10} color={colors.text} style={{ marginLeft: 8, letterSpacing: 1 }}>CONTINUE WITH APPLE</Typography>
          </TouchableOpacity>

          <Typography size={8} color={colors.textExtraLight} style={styles.footerText}>
            By continuing, you agree to our Terms & Privacy Policy
          </Typography>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── COUNTRY PICKER MODAL ── */}
      <Modal visible={showPicker} transparent animationType="slide">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowPicker(false)}
        >
          <View style={[styles.pickerContent, { backgroundColor: colors.surface }]}>
            <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View style={styles.pickerDragIndicator} />
            <Typography weight="700" size={12} style={styles.pickerTitle}>SELECT COUNTRY</Typography>
            <FlatList
              data={COUNTRIES}
              keyExtractor={item => item.code}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.pickerItem}
                  onPress={() => {
                    setCountry(item);
                    setShowPicker(false);
                    haptics.buttonTap();
                  }}
                >
                  <Typography size={22}>{item.flag}</Typography>
                  <Typography size={12} weight="600" style={{ flex: 1, marginLeft: 16 }}>{item.name}</Typography>
                  <Typography size={12} color={colors.textMuted} weight="500">{item.code}</Typography>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 32, paddingBottom: 40 },
  header: { alignItems: 'center', marginTop: 40, marginBottom: 50 },
  logo: { width: 50, height: 50, marginBottom: 12 },
  title: { letterSpacing: 6 },
  form: { width: '100%', alignItems: 'center' },
  phoneInputContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  countryBox: {
    width: 76,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  numberBox: {
    flex: 1,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.15)',
    overflow: 'hidden',
  },
  otpBox: {
    width: '100%',
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.15)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 20,
  },
  error: { alignSelf: 'flex-start', marginLeft: 4, marginBottom: 12, fontWeight: '600', letterSpacing: 0.5 },
  primaryButton: {
    width: '100%',
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  backBtn: { alignSelf: 'center', marginTop: 24, padding: 10 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 36, width: '100%' },
  line: { flex: 1, height: 1, opacity: 0.1 },
  appleButton: {
    width: '100%',
    height: 60,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.15)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    overflow: 'hidden',
  },
  footerText: { textAlign: 'center', opacity: 0.4, lineHeight: 16, letterSpacing: 0.5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingBottom: 40,
    maxHeight: '65%',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  pickerDragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(150,150,150,0.3)',
    alignSelf: 'center',
    marginTop: 12,
  },
  pickerTitle: { textAlign: 'center', marginVertical: 24, letterSpacing: 3, opacity: 0.6 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.15)',
  },
});
