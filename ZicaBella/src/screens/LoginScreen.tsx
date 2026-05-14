import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Modal, FlatList, Keyboard, Pressable, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useColors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { Typography } from '../components/Typography';
import { haptics } from '../utils/haptics';
import { signInWithApple } from '../auth/apple';
import { useThemeStore } from '../store/themeStore';
import { useWishlistStore } from '../store/wishlistStore';
import { config } from '../constants/config';

const { width } = Dimensions.get('window');

// Clean base URL to prevent double slashes
const BASE_URL = config.appUrl.replace(/\/$/, '');

const COUNTRIES = [
  { name: 'India', code: '+91', flag: '🇮🇳' },
  { name: 'United States', code: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪' },
  { name: 'Canada', code: '+1', flag: '🇨🇦' },
  { name: 'Australia', code: '+61', flag: '🇦🇺' },
  { name: 'Singapore', code: '+65', flag: '🇸🇬' },
  { name: 'Germany', code: '+49', flag: '🇩🇪' },
  { name: 'France', code: '+33', flag: '🇫🇷' },
  { name: 'Italy', code: '+39', flag: '🇮🇹' },
  { name: 'Spain', code: '+34', flag: '🇪🇸' },
  { name: 'Japan', code: '+81', flag: '🇯🇵' },
  { name: 'South Korea', code: '+82', flag: '🇰🇷' },
  { name: 'Saudi Arabia', code: '+966', flag: '🇸🇦' },
  { name: 'Qatar', code: '+974', flag: '🇶🇦' },
  { name: 'Kuwait', code: '+965', flag: '🇰🇼' },
  { name: 'Netherlands', code: '+31', flag: '🇳🇱' },
  { name: 'Switzerland', code: '+41', flag: '🇨🇭' },
  { name: 'Ireland', code: '+353', flag: '🇮🇪' },
  { name: 'Hong Kong', code: '+852', flag: '🇭🇰' },
];

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'PHONE' | 'NAME' | 'OTP'>('PHONE');
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; otp?: string; name?: string }>({});

  const otpInputs = useRef<TextInput[]>([]);

  const handleContinuePhone = async () => {
    let cleaned = phone.replace(/\D/g, '');
    const countryDigits = country.code.replace(/\D/g, '');
    
    // Handle cases where user might have pasted phone with country code
    if (cleaned.startsWith(countryDigits) && cleaned.length > 10) {
      cleaned = cleaned.slice(countryDigits.length);
    }

    if (cleaned.length < 7) {
      setErrors({ phone: 'Enter a valid number' });
      haptics.error();
      return;
    }

    const fullPhone = country.code + cleaned;
    
    setLoading(true);
    try {
      // 1. Check if user exists
      const checkRes = await fetch(`${BASE_URL}/api/auth/check-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone }),
      });
      
      const checkData = await checkRes.json().catch(() => ({}));

      if (!checkRes.ok) {
        throw new Error(checkData.error || `Server error (${checkRes.status})`);
      }
      
      if (checkData.exists) {
        // User exists, send OTP directly
        try {
          await sendOTP(fullPhone);
          if (checkData.name) setName(checkData.name);
          setStep('OTP');
          haptics.success();
        } catch (otpErr: any) {
          Alert.alert('Verification Error', otpErr.message);
          haptics.error();
        }
      } else {
        // User doesn't exist, ask for name
        setStep('NAME');
        haptics.success();
      }
    } catch (e: any) {
      console.error('Login error:', e);
      Alert.alert('Unable to proceed', e.message);
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const handleContinueName = async () => {
    if (!name.trim()) {
      setErrors({ name: 'Tell us your name' });
      haptics.error();
      return;
    }

    const cleaned = phone.replace(/\D/g, '');
    const fullPhone = country.code + cleaned;

    setLoading(true);
    try {
      await sendOTP(fullPhone);
      setStep('OTP');
      haptics.success();
    } catch (e: any) {
      Alert.alert('OTP Error', e.message);
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async (fullPhone: string) => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const json = await res.json().catch(() => ({ error: 'Invalid server response' }));
      if (!res.ok) throw new Error(json.error || `Server error (${res.status})`);
      return json;
    } catch (e: any) {
      throw new Error(e.message || 'Network request failed');
    }
  };

  const handleOTPChange = (val: string, index: number) => {
    if (val.length > 1) {
      const digits = val.slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextIdx = Math.min(index + digits.length, 5);
      otpInputs.current[nextIdx]?.focus();
      
      if (newOtp.every(d => d !== '')) {
        handleLogin(newOtp.join(''));
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    if (val && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
    
    if (newOtp.every(d => d !== '') && index === 5) {
        handleLogin(newOtp.join(''));
    }
  };

  const handleOTPKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleLogin = async (codeOverride?: string) => {
    const finalOtp = codeOverride || otp.join('');
    if (finalOtp.length < 6) {
      setErrors({ otp: 'Enter 6-digit OTP' });
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
      const res = await fetch(`${BASE_URL}/api/auth/mobile-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, otp: finalOtp, name: name.trim() }),
      });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json.error || 'Verification failed');
      if (!json.token) throw new Error('Session expired');
      
      const { syncWishlist } = useWishlistStore.getState();
      await syncWishlist(json.token);
      
      login(json.user, json.token);
      haptics.success();
    } catch (e: any) {
      Alert.alert('Error', e.message);
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    haptics.buttonTap();
    setLoading(true);
    const success = await signInWithApple();
    if (success) haptics.success();
    else haptics.error();
    setLoading(false);
  };

  const renderStep = () => {
    switch (step) {
      case 'PHONE':
        return (
          <View style={styles.stepContainer}>
            <Typography weight="400" size={18} style={styles.stepTitle}>Hello</Typography>
            <Typography size={12} weight="300" color={colors.textExtraLight} style={styles.stepSubtitle}>
              Are you a member?
            </Typography>
            
            <View style={[styles.phoneContainer, { borderColor: errors.phone ? colors.error : isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]}>
              <BlurView intensity={isDark ? 5 : 10} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              <TouchableOpacity 
                style={styles.flagPicker} 
                onPress={() => { haptics.buttonTap(); setShowPicker(true); }}
              >
                <Typography size={22}>{country.flag}</Typography>
                <Ionicons name="chevron-down" size={10} color={colors.textExtraLight} style={{ marginLeft: 2 }} />
              </TouchableOpacity>
              
              <View style={styles.phoneInputWrapper}>
                <TextInput
                  value={phone}
                  onChangeText={(v) => { setPhone(v.replace(/[^\d+]/g, '')); if (errors.phone) setErrors({}); }}
                  placeholder="Mobile Number"
                  placeholderTextColor={colors.textExtraLight}
                  keyboardType="phone-pad"
                  style={[styles.phoneInput, { color: colors.text }]}
                  autoFocus
                />
              </View>
            </View>
            {errors.phone && <Typography size={10} weight="600" color={colors.error} style={styles.errorText}>{errors.phone}</Typography>}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleContinuePhone}
              disabled={loading}
            >
              <BlurView intensity={isDark ? 10 : 20} tint={isDark ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
              {loading ? <ActivityIndicator color={colors.text} /> : (
                <Typography weight="400" size={11} color={colors.text} style={{ letterSpacing: 1.5 }}>CONTINUE</Typography>
              )}
            </TouchableOpacity>
          </View>
        );

      case 'NAME':
        return (
          <View style={styles.stepContainer}>
            <Typography weight="400" size={18} style={styles.stepTitle}>Welcome</Typography>
            <Typography size={12} weight="300" color={colors.textExtraLight} style={styles.stepSubtitle}>
              What's your name?
            </Typography>

            <View style={[styles.inputWrapper, { borderColor: errors.name ? colors.error : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
              <BlurView intensity={isDark ? 5 : 10} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              <TextInput
                value={name}
                onChangeText={(v) => { setName(v); if (errors.name) setErrors({}); }}
                placeholder="Name"
                placeholderTextColor={colors.textExtraLight}
                style={[styles.nameInput, { color: colors.text }]}
                autoFocus
                autoCorrect={false}
              />
            </View>
            {errors.name && <Typography size={10} weight="600" color={colors.error} style={styles.errorText}>{errors.name}</Typography>}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleContinueName}
              disabled={loading}
            >
              <BlurView intensity={isDark ? 10 : 20} tint={isDark ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
              {loading ? <ActivityIndicator color={colors.text} /> : (
                <Typography weight="400" size={11} color={colors.text} style={{ letterSpacing: 1.5 }}>CREATE ACCOUNT</Typography>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('PHONE')} style={styles.backLink}>
              <Typography size={12} weight="600" color={colors.textExtraLight}>Back to Phone</Typography>
            </TouchableOpacity>
          </View>
        );

      case 'OTP':
        return (
          <View style={styles.stepContainer}>
            <Typography weight="400" size={18} style={styles.stepTitle}>Verify</Typography>
            <Typography size={12} weight="300" color={colors.textExtraLight} style={styles.stepSubtitle}>
              Enter the code sent to you.
            </Typography>

            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <View key={i} style={[styles.otpBox, { borderColor: digit ? colors.foreground : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
                  <BlurView intensity={isDark ? 5 : 10} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                  <TextInput
                    ref={(el) => { if (el) otpInputs.current[i] = el; }}
                    value={digit}
                    onChangeText={(v) => handleOTPChange(v, i)}
                    onKeyPress={(e) => handleOTPKeyPress(e, i)}
                    keyboardType="number-pad"
                    maxLength={i === 0 ? 6 : 1}
                    style={[styles.otpInput, { color: colors.text }]}
                    autoFocus={i === 0}
                    selectTextOnFocus
                  />
                </View>
              ))}
            </View>
            {errors.otp && <Typography size={10} weight="600" color={colors.error} style={styles.errorText}>{errors.otp}</Typography>}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleLogin()}
              disabled={loading}
            >
              <BlurView intensity={isDark ? 10 : 20} tint={isDark ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
              {loading ? <ActivityIndicator color={colors.text} /> : (
                <Typography weight="400" size={11} color={colors.text} style={{ letterSpacing: 1.5 }}>VERIFY</Typography>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('PHONE')} style={styles.backLink}>
              <Typography size={12} weight="600" color={colors.textExtraLight}>Edit Phone Number</Typography>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
          <ScrollView 
            contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 80 }]} 
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Image source={require('../../assets/zica-bella-logo_8.png')} style={styles.logo} contentFit="contain" />
              <Typography weight="400" size={18} color={colors.text} style={styles.brandTitle}>ZICA BELLA</Typography>
            </View>

            <View style={[styles.mainCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)', borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]}>
              <BlurView intensity={isDark ? 15 : 25} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              {renderStep()}
            </View>

            {step === 'PHONE' && (
              <>
                <View style={styles.dividerContainer}>
                  <View style={[styles.dividerLine, { backgroundColor: colors.textExtraLight, opacity: 0.1 }]} />
                  <Typography size={10} weight="700" color={colors.textExtraLight} style={styles.dividerText}>OR</Typography>
                  <View style={[styles.dividerLine, { backgroundColor: colors.textExtraLight, opacity: 0.1 }]} />
                </View>

                <TouchableOpacity style={[styles.appleButton, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} onPress={handleAppleSignIn}>
                  <Ionicons name="logo-apple" size={20} color={colors.text} />
                  <Typography weight="700" size={12} color={colors.text} style={{ marginLeft: 12 }}>Continue with Apple</Typography>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.footer}>
              <Typography size={9} color={colors.textExtraLight} style={styles.footerText}>
                By continuing, you agree to our Terms and Privacy Policy.
              </Typography>
              <Typography size={8} color={colors.textExtraLight} style={[styles.footerText, { marginTop: 4, opacity: 0.4 }]}>
                SECURED ARCHIVAL PROTOCOL v2.0
              </Typography>
            </View>
          </ScrollView>
        </Pressable>
      </KeyboardAvoidingView>

      <Modal visible={showPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.pickerContent, { backgroundColor: colors.surface }]}>
            <View style={styles.pickerDragIndicator} />
            <Typography weight="700" size={12} style={styles.pickerTitle}>SELECT REGION</Typography>
            <FlatList
              data={COUNTRIES}
              keyExtractor={item => item.name}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.pickerItem}
                  onPress={() => { setCountry(item); setShowPicker(false); haptics.buttonTap(); }}
                >
                  <Typography size={24}>{item.flag}</Typography>
                  <Typography size={14} weight="700" style={{ flex: 1, marginLeft: 16 }}>{item.name.toUpperCase()}</Typography>
                  <Typography size={12} color={colors.textExtraLight} weight="700">{item.code}</Typography>
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
  scroll: { paddingHorizontal: 12, paddingBottom: 40, flexGrow: 1 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 44, height: 44, marginBottom: 12 },
  brandTitle: { letterSpacing: 4, fontFamily: 'Rocaston' },
  mainCard: {
    borderRadius: 24,
    borderWidth: 0.5,
    padding: 24,
    overflow: 'hidden',
    width: '100%',
    minHeight: 280,
    justifyContent: 'center',
    // Prism effect using subtle shadow
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  stepContainer: { width: '100%' },
  stepTitle: { marginBottom: 6, letterSpacing: -0.5 },
  stepSubtitle: { marginBottom: 24, opacity: 0.4, lineHeight: 18, letterSpacing: 0.2 },
  phoneContainer: {
    flexDirection: 'row',
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(150,150,150,0.01)',
    borderWidth: 0.5,
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  flagPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
    borderRightWidth: 0.5,
    borderRightColor: 'rgba(150,150,150,0.1)',
  },
  phoneInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
  },
  phoneInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  inputWrapper: {
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(150,150,150,0.01)',
    borderWidth: 0.5,
    paddingHorizontal: 16,
    marginBottom: 16,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  nameInput: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  otpBox: {
    width: (width - 108) / 6,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.01)',
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  otpInput: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: { marginTop: -10, marginBottom: 12, marginLeft: 4 },
  primaryButton: {
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(150,150,150,0.1)',
  },
  backLink: { alignSelf: 'center', marginTop: 16, padding: 8 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 0.5 },
  dividerText: { marginHorizontal: 12, opacity: 0.2 },
  appleButton: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    backgroundColor: 'transparent',
  },
  footer: { marginTop: 32, alignItems: 'center' },
  footerText: { textAlign: 'center', opacity: 0.3, letterSpacing: 0.5 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  pickerContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '65%',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  pickerDragIndicator: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(150,150,150,0.2)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  pickerTitle: { textAlign: 'center', marginBottom: 20, letterSpacing: 2, opacity: 0.3 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(150,150,150,0.05)',
  },
});
