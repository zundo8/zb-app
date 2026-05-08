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
  const { login } = useAuth();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; otp?: string }>({});

  const handleSendOTP = async () => {
    // Advanced cleaning: Strip non-digits and redundant country code if present
    let cleaned = phone.replace(/\D/g, '');
    
    // If user typed the country code (e.g. 91...) strip it to get the 10-digit base
    const countryDigits = country.code.replace(/\D/g, '');
    if (cleaned.startsWith(countryDigits) && cleaned.length > 10) {
      cleaned = cleaned.slice(countryDigits.length);
    }

    if (cleaned.length !== 10) {
      setErrors({ phone: 'ENTER 10 DIGITS' });
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
      
      if (!res.ok) throw new Error(json.error || 'UNABLE TO SEND OTP');

      setStep('OTP');
      haptics.success();
    } catch (e: any) {
      Alert.alert('DELIVERY FAILED', e.message);
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!otp || otp.length < 6) {
      setErrors({ otp: 'ENTER 6-DIGIT CODE' });
      haptics.error();
      return;
    }

    setLoading(true);
    try {
      let cleanedPhone = phone.replace(/\D/g, '');
      const countryDigits = country.code.replace(/\D/g, '');
      if (cleanedPhone.startsWith(countryDigits) && cleanedPhone.length > 10) {
        cleanedPhone = cleanedPhone.slice(countryDigits.length);
      }
      
      const fullPhone = country.code + cleanedPhone;
      const res = await fetch(`${config.appUrl}/api/auth/mobile-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, otp }),
      });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json.error || 'VERIFICATION FAILED');

      if (!json.token) throw new Error('SESSION EXPIRED');
      login(json.user, json.token);
      haptics.success();
    } catch (e: any) {
      Alert.alert('ACCESS DENIED', e.message);
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
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 80 }]}
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
            <Typography weight="700" size={16} color={colors.text} style={styles.title}>
              ZICA BELLA
            </Typography>
            <Typography size={7} color={colors.textExtraLight} weight="500" style={styles.subtitle}>
              AUTHENTIC LUXURY STREETWEAR
            </Typography>
          </View>

          {/* ── AUTH INTERFACE ── */}
          <View style={styles.form}>
            {step === 'PHONE' ? (
              <View style={styles.phoneInputContainer}>
                 <TouchableOpacity 
                   style={[styles.countryBox, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]} 
                   onPress={() => { haptics.buttonTap(); setShowPicker(true); }}
                   activeOpacity={0.7}
                 >
                   <BlurView intensity={isDark ? 15 : 25} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                   <View style={styles.countryInner}>
                     <Typography size={22}>{country.flag}</Typography>
                     <View style={styles.codeRow}>
                        <Typography size={10} weight="800" color={colors.text}>{country.code}</Typography>
                        <Ionicons name="chevron-down" size={8} color={colors.textExtraLight} style={{ marginLeft: 2 }} />
                     </View>
                   </View>
                 </TouchableOpacity>

                 <View style={[styles.numberBox, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
                   <BlurView intensity={isDark ? 15 : 25} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                   <TextInput
                     value={phone}
                     onChangeText={(v) => { 
                       const cleaned = v.replace(/[^\d+]/g, ''); // Allow digits and + for now
                       setPhone(cleaned); 
                       if (errors.phone) setErrors({}); 
                     }}
                     placeholder="PHONE NUMBER"
                     placeholderTextColor={colors.textExtraLight}
                     keyboardType="phone-pad"
                     style={[styles.input, { color: colors.text }]}
                     autoFocus
                   />
                 </View>
              </View>
            ) : (
              <View style={[styles.otpBox, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
                <BlurView intensity={isDark ? 15 : 25} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                <TextInput
                  value={otp}
                  onChangeText={(v) => { setOtp(v.replace(/\D/g, '').slice(0, 6)); if (errors.otp) setErrors({}); }}
                  placeholder="000000"
                  placeholderTextColor={colors.textExtraLight}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  style={[styles.input, { color: colors.text, textAlign: 'center', letterSpacing: 16, fontSize: 20, fontWeight: '700' }]}
                />
              </View>
            )}

            <View style={styles.errorContainer}>
              {errors.phone && <Typography size={7} weight="700" color={colors.error} style={styles.errorText}>{errors.phone}</Typography>}
              {errors.otp && <Typography size={7} weight="700" color={colors.error} style={styles.errorText}>{errors.otp}</Typography>}
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.foreground }]}
              onPress={step === 'PHONE' ? handleSendOTP : handleLogin}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Typography weight="700" size={10} color={colors.background} style={{ letterSpacing: 4 }}>
                  {step === 'PHONE' ? 'GET ACCESS' : 'VERIFY CODE'}
                </Typography>
              )}
            </TouchableOpacity>

            {step === 'OTP' && (
              <TouchableOpacity onPress={() => setStep('PHONE')} style={styles.backBtn}>
                <Typography size={7} weight="700" color={colors.textExtraLight} style={{ letterSpacing: 2 }}>BACK TO PHONE</Typography>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.dividerRow}>
            <View style={[styles.line, { backgroundColor: colors.text, opacity: 0.05 }]} />
            <Typography size={7} weight="700" color={colors.textExtraLight} style={{ marginHorizontal: 20, letterSpacing: 3, opacity: 0.3 }}>OR</Typography>
            <View style={[styles.line, { backgroundColor: colors.text, opacity: 0.05 }]} />
          </View>

          <TouchableOpacity style={[styles.appleButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]} onPress={handleAppleSignIn} activeOpacity={0.8}>
            <BlurView intensity={5} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <Ionicons name="logo-apple" size={18} color={colors.text} />
            <Typography weight="700" size={9} color={colors.text} style={{ marginLeft: 10, letterSpacing: 2 }}>CONTINUE WITH APPLE</Typography>
          </TouchableOpacity>

          <Typography size={7} color={colors.textExtraLight} style={styles.footerText}>
            BY CONTINUING, YOU AGREE TO OUR{'\n'}
            <Typography size={7} weight="700" color={colors.text}>TERMS & PRIVACY POLICY</Typography>
          </Typography>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── COUNTRY PICKER MODAL ── */}
      <Modal visible={showPicker} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowPicker(false)}
        >
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.pickerContent, { backgroundColor: colors.surface }]}>
            <View style={styles.pickerDragIndicator} />
            <Typography weight="700" size={11} style={styles.pickerTitle}>SELECT ORIGIN</Typography>
            <FlatList
              data={COUNTRIES}
              keyExtractor={item => item.code}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.pickerItem}
                  onPress={() => {
                    setCountry(item);
                    setShowPicker(false);
                    haptics.buttonTap();
                  }}
                >
                  <Typography size={24}>{item.flag}</Typography>
                  <Typography size={12} weight="700" style={{ flex: 1, marginLeft: 20, letterSpacing: 1 }}>{item.name.toUpperCase()}</Typography>
                  <Typography size={11} color={colors.textExtraLight} weight="700">{item.code}</Typography>
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
  scroll: { paddingHorizontal: 40, paddingBottom: 60 },
  header: { alignItems: 'center', marginBottom: 60 },
  logo: { width: 60, height: 60, marginBottom: 20 },
  title: { letterSpacing: 8, marginBottom: 8 },
  subtitle: { letterSpacing: 3, opacity: 0.3 },
  form: { width: '100%', alignItems: 'center' },
  phoneInputContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginBottom: 12,
  },
  countryBox: {
    width: 88,
    height: 72,
    borderRadius: 24,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  countryInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -2,
  },
  numberBox: {
    flex: 1,
    height: 72,
    borderRadius: 24,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  otpBox: {
    width: '100%',
    height: 72,
    borderRadius: 24,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 24,
    letterSpacing: 1,
  },
  errorContainer: {
    height: 20,
    width: '100%',
    justifyContent: 'center',
    paddingLeft: 8,
    marginBottom: 8,
  },
  errorText: { letterSpacing: 2, textTransform: 'uppercase' },
  primaryButton: {
    width: '100%',
    height: 64,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  backBtn: { alignSelf: 'center', marginTop: 32, padding: 12 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 40, width: '100%' },
  line: { flex: 1, height: 1.5 },
  appleButton: {
    width: '100%',
    height: 64,
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 60,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.05)',
  },
  footerText: { textAlign: 'center', opacity: 0.3, lineHeight: 18, letterSpacing: 2 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerContent: {
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    maxHeight: '70%',
    paddingHorizontal: 32,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.1,
    shadowRadius: 40,
    elevation: 20,
  },
  pickerDragIndicator: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(150,150,150,0.15)',
    alignSelf: 'center',
    marginBottom: 32,
  },
  pickerTitle: { textAlign: 'center', marginBottom: 32, letterSpacing: 4, opacity: 0.4 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.05)',
  },
});
