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
      const { config } = require('../constants/config');
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
      const { config } = require('../constants/config');
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
              <View style={[styles.inputGroup, { borderColor: colors.borderLight }]}>
                 <BlurView intensity={isDark ? 10 : 40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                 
                 <TouchableOpacity 
                   style={styles.countryTrigger} 
                   onPress={() => { haptics.buttonTap(); setShowPicker(true); }}
                 >
                   <Typography size={16}>{country.flag}</Typography>
                   <Typography size={12} weight="600" style={{ marginLeft: 4 }}>{country.code}</Typography>
                   <Ionicons name="chevron-down" size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />
                 </TouchableOpacity>

                 <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

                 <TextInput
                   value={phone}
                   onChangeText={(v) => { 
                     const cleaned = v.replace(/\D/g, '').slice(0, 10);
                     setPhone(cleaned); 
                     if (errors.phone) setErrors({}); 
                   }}
                   placeholder="Mobile Number"
                   placeholderTextColor={colors.textExtraLight}
                   keyboardType="number-pad"
                   maxLength={10}
                   style={[styles.input, { color: colors.text }]}
                 />
              </View>
            ) : (
              <View style={[styles.inputGroup, { borderColor: colors.borderLight }]}>
                <BlurView intensity={isDark ? 10 : 40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                <TextInput
                  value={otp}
                  onChangeText={(v) => { setOtp(v.replace(/\D/g, '').slice(0, 6)); if (errors.otp) setErrors({}); }}
                  placeholder="6-Digit Code"
                  placeholderTextColor={colors.textExtraLight}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  style={[styles.input, { color: colors.text, textAlign: 'center', letterSpacing: 8 }]}
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
                <Typography weight="700" size={11} color={colors.background}>
                  {step === 'PHONE' ? 'SEND CODE' : 'VERIFY'}
                </Typography>
              )}
            </TouchableOpacity>

            {step === 'OTP' && (
              <TouchableOpacity onPress={() => setStep('PHONE')} style={styles.backBtn}>
                <Typography size={9} weight="600" color={colors.textMuted}>CHANGE NUMBER</Typography>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.dividerRow}>
            <View style={[styles.line, { backgroundColor: colors.borderLight }]} />
            <Typography size={8} color={colors.textExtraLight} style={{ marginHorizontal: 15 }}>OR</Typography>
            <View style={[styles.line, { backgroundColor: colors.borderLight }]} />
          </View>

          <TouchableOpacity style={[styles.appleButton, { backgroundColor: colors.text }]} onPress={handleAppleSignIn}>
            <Ionicons name="logo-apple" size={18} color={colors.background} />
            <Typography weight="700" size={10} color={colors.background} style={{ marginLeft: 8 }}>CONTINUE WITH APPLE</Typography>
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
            <Typography weight="700" size={14} style={styles.pickerTitle}>SELECT COUNTRY</Typography>
            <FlatList
              data={COUNTRIES}
              keyExtractor={item => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.pickerItem}
                  onPress={() => {
                    setCountry(item);
                    setShowPicker(false);
                    haptics.buttonTap();
                  }}
                >
                  <Typography size={18}>{item.flag}</Typography>
                  <Typography size={13} weight="600" style={{ flex: 1, marginLeft: 12 }}>{item.name}</Typography>
                  <Typography size={13} color={colors.textMuted}>{item.code}</Typography>
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
  header: { alignItems: 'center', marginBottom: 60 },
  logo: { width: 60, height: 60, marginBottom: 16 },
  title: { letterSpacing: 4 },
  form: { width: '100%' },
  inputGroup: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  countryTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingRight: 12,
  },
  divider: { width: 1, height: 24, marginHorizontal: 4, opacity: 0.2 },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    fontWeight: '600',
    paddingLeft: 10,
  },
  error: { marginLeft: 4, marginBottom: 8, fontWeight: '600' },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  backBtn: { alignSelf: 'center', marginTop: 20, padding: 10 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 40 },
  line: { flex: 1, height: 1, opacity: 0.1 },
  appleButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  footerText: { textAlign: 'center', opacity: 0.5, lineHeight: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 40,
    maxHeight: '60%',
    paddingHorizontal: 24,
  },
  pickerTitle: { textAlign: 'center', marginVertical: 24, letterSpacing: 2 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
});
