import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Modal, FlatList, Keyboard, Pressable,
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
import { config } from '../constants/config';

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

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; otp?: string }>({});

  const otpInputs = useRef<TextInput[]>([]);

  const handleSendOTP = async () => {
    let cleaned = phone.replace(/\D/g, '');
    const countryDigits = country.code.replace(/\D/g, '');
    if (cleaned.startsWith(countryDigits) && cleaned.length > 10) {
      cleaned = cleaned.slice(countryDigits.length);
    }

    if (cleaned.length !== 10) {
      setErrors({ phone: 'Enter 10-digit number' });
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
      const res = await fetch(`${config.appUrl}/api/auth/mobile-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, otp: finalOtp }),
      });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json.error || 'Verification failed');

      if (!json.token) throw new Error('Session expired');
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 60 }]} keyboardShouldPersistTaps="handled">
          
          <View style={styles.header}>
            <Image source={require('../../assets/zica-bella-logo_8.png')} style={styles.logo} contentFit="contain" />
            <Typography weight="700" size={24} color={colors.text} style={styles.title}>ZICA BELLA</Typography>
            <Typography size={8} color={colors.textExtraLight} weight="600" style={styles.subtitle}>ARCHIVAL EXCELLENCE</Typography>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
            <BlurView intensity={isDark ? 10 : 30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            
            <Typography weight="700" size={13} style={styles.cardTitle}>
                {step === 'PHONE' ? 'Sign in to your account' : 'Verify your number'}
            </Typography>
            
            <View style={styles.form}>
              {step === 'PHONE' ? (
                <View style={styles.inputGroup}>
                  <TouchableOpacity 
                    style={[styles.countryPicker, { borderRightColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} 
                    onPress={() => { haptics.buttonTap(); setShowPicker(true); }}
                  >
                    <Typography size={18} style={{ marginRight: 4 }}>{country.flag}</Typography>
                    <Typography size={12} weight="700">{country.code}</Typography>
                    <Ionicons name="chevron-down" size={10} color={colors.textExtraLight} style={{ marginLeft: 2 }} />
                  </TouchableOpacity>
                  
                  <TextInput
                    value={phone}
                    onChangeText={(v) => { setPhone(v.replace(/[^\d+]/g, '')); if (errors.phone) setErrors({}); }}
                    placeholder="Phone Number"
                    placeholderTextColor={colors.textExtraLight}
                    keyboardType="phone-pad"
                    style={[styles.phoneInput, { color: colors.text }]}
                    autoFocus
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                </View>
              ) : (
                <View style={styles.otpRow}>
                  {otp.map((digit, i) => (
                    <View key={i} style={[styles.otpBox, { borderColor: digit ? colors.foreground : 'rgba(150,150,150,0.1)' }]}>
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
              )}

              {errors.phone && <Typography size={7} weight="700" color={colors.error} style={styles.errorText}>{errors.phone}</Typography>}
              {errors.otp && <Typography size={7} weight="700" color={colors.error} style={styles.errorText}>{errors.otp}</Typography>}

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.foreground }]}
                onPress={step === 'PHONE' ? handleSendOTP : () => handleLogin()}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Typography weight="700" size={10} color={colors.background} style={{ letterSpacing: 2 }}>
                    {step === 'PHONE' ? 'SEND CODE' : 'VERIFY'}
                  </Typography>
                )}
              </TouchableOpacity>
            </View>

            {step === 'OTP' && (
              <TouchableOpacity onPress={() => setStep('PHONE')} style={styles.backBtn}>
                <Typography size={7} weight="700" color={colors.textExtraLight}>CHANGE NUMBER</Typography>
              </TouchableOpacity>
            )}

            <View style={styles.divider}>
              <View style={[styles.line, { backgroundColor: colors.textExtraLight }]} />
              <Typography size={8} weight="700" color={colors.textExtraLight} style={{ marginHorizontal: 15, opacity: 0.3 }}>OR</Typography>
              <View style={[styles.line, { backgroundColor: colors.textExtraLight }]} />
            </View>

            <TouchableOpacity style={styles.appleButton} onPress={handleAppleSignIn}>
              <Ionicons name="logo-apple" size={16} color={colors.text} />
              <Typography weight="700" size={9} color={colors.text} style={{ marginLeft: 8, letterSpacing: 1 }}>SIGN IN WITH APPLE</Typography>
            </TouchableOpacity>
          </View>

          <Typography size={7} color={colors.textExtraLight} style={styles.footerText}>
            By signing in, you agree to our Terms & Privacy Policy
          </Typography>
        </ScrollView>
      </Pressable>
    </KeyboardAvoidingView>

      <Modal visible={showPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.pickerContent, { backgroundColor: colors.surface }]}>
            <View style={styles.pickerDragIndicator} />
            <Typography weight="700" size={11} style={styles.pickerTitle}>SELECT COUNTRY</Typography>
            <FlatList
              data={COUNTRIES}
              keyExtractor={item => item.name}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.pickerItem}
                  onPress={() => { setCountry(item); setShowPicker(false); haptics.buttonTap(); }}
                >
                  <Typography size={24}>{item.flag}</Typography>
                  <Typography size={12} weight="700" style={{ flex: 1, marginLeft: 20 }}>{item.name.toUpperCase()}</Typography>
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
  scroll: { paddingHorizontal: 24, paddingBottom: 60 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 50, height: 50, marginBottom: 16 },
  title: { letterSpacing: 6, marginBottom: 4, fontFamily: 'Rocaston' },
  subtitle: { letterSpacing: 4, opacity: 0.4 },
  card: {
    borderRadius: 40,
    borderWidth: 1,
    padding: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 40,
    elevation: 10,
  },
  cardTitle: { textAlign: 'center', marginBottom: 32, opacity: 0.6, letterSpacing: 1 },
  form: { width: '100%' },
  inputGroup: {
    flexDirection: 'row',
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(150,150,150,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.1)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  countryPicker: {
    width: 90,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
  },
  phoneInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 20,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  otpBox: {
    width: 44,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(150,150,150,0.06)',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpInput: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
  },
  errorText: { marginBottom: 8, marginLeft: 4, letterSpacing: 1 },
  primaryButton: {
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  backBtn: { alignSelf: 'center', marginTop: 24, padding: 12 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 32 },
  line: { flex: 1, height: 1, opacity: 0.1 },
  appleButton: {
    height: 64,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.1)',
  },
  footerText: { textAlign: 'center', marginTop: 40, opacity: 0.3, letterSpacing: 1 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  pickerContent: {
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    maxHeight: '75%',
    paddingHorizontal: 32,
    paddingTop: 12,
  },
  pickerDragIndicator: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(150,150,150,0.2)',
    alignSelf: 'center',
    marginBottom: 24,
  },
  pickerTitle: { textAlign: 'center', marginBottom: 24, letterSpacing: 3, opacity: 0.4 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.05)',
  },
});
