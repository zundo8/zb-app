import React, { useState, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
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
  const [errors, setErrors] = useState<{ phone?: string; otp?: string }>({});

  const handleSendOTP = () => {
    if (!phone || phone.length < 10) {
      setErrors({ phone: 'Please enter a valid phone number' });
      haptics.error();
      return;
    }
    setLoading(true);
    // Simulate sending OTP
    setTimeout(() => {
       setLoading(false);
       setStep('OTP');
       haptics.success();
    }, 1000);
  };

  const handleLogin = async () => {
    if (!otp || otp.length < 6) {
      setErrors({ otp: 'Please enter the 6-digit OTP' });
      haptics.error();
      return;
    }

    setLoading(true);
    try {
      const { config } = require('../constants/config');
      const res = await fetch(`${config.appUrl}/api/auth/mobile-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json.error || 'Verification failed');

      // #region agent log
      fetch('http://127.0.0.1:7254/ingest/81a9aa65-a1fe-4363-864a-d27b95a27b63',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7ff929'},body:JSON.stringify({sessionId:'7ff929',runId:'auth-pre',hypothesisId:'H2',location:'LoginScreen.tsx:handleLogin',message:'mobile-verify response',data:{ok:res.ok,status:res.status,hasToken:!!json?.token,tokenLen:String(json?.token||'').length,hasUser:!!json?.user,hasUserId:!!json?.user?.id},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (!json.token) throw new Error('Missing session token from server');
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
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 50 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── PREMIUM HEADER ── */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/zica-bella-logo_8.png')}
                style={styles.logo}
                contentFit="contain"
              />
            </View>
            <Typography 
              weight="400" 
              size={18} 
              color={colors.text} 
              style={styles.title}
            >
              ZICA BELLA
            </Typography>
            <Typography weight="300" size={8} color={colors.textExtraLight} style={styles.subtitle}>
              ESTABLISHED IN ARCHIVE
            </Typography>
          </View>

          {/* ── AUTH CARD ── */}
          <View style={[styles.authCard, { borderColor: colors.borderLight }]}>
             <BlurView intensity={isDark ? 10 : 30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
             
             {step === 'PHONE' ? (
              <View style={styles.field}>
                <Typography size={7} weight="800" color={colors.textExtraLight} style={styles.label}>IDENTIFIER / PHONE</Typography>
                <TextInput
                  value={phone}
                  onChangeText={(v) => { setPhone(v); if (errors.phone) setErrors({ ...errors, phone: undefined }); }}
                  placeholder="+91 00000 00000"
                  placeholderTextColor={colors.textExtraLight}
                  keyboardType="phone-pad"
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: errors.phone ? colors.error : colors.borderLight },
                    isDark && { backgroundColor: 'rgba(255,255,255,0.02)' }
                  ]}
                />
                {errors.phone && (
                  <Typography size={7} color={colors.error} style={styles.errorText}>{errors.phone}</Typography>
                )}
              </View>
            ) : (
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Typography size={7} weight="800" color={colors.textExtraLight} style={styles.label}>ENTER OTP</Typography>
                  <TouchableOpacity onPress={() => setStep('PHONE')}>
                    <Typography size={7} weight="800" color={colors.foreground} style={styles.forgotBtn}>EDIT NUMBER</Typography>
                  </TouchableOpacity>
                </View>
                <TextInput
                  value={otp}
                  onChangeText={(v) => { setOtp(v); if (errors.otp) setErrors({ ...errors, otp: undefined }); }}
                  placeholder="000 000"
                  placeholderTextColor={colors.textExtraLight}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: errors.otp ? colors.error : colors.borderLight, letterSpacing: 8, textAlign: 'center' },
                    isDark && { backgroundColor: 'rgba(255,255,255,0.02)' }
                  ]}
                />
                {errors.otp && (
                  <Typography size={7} color={colors.error} style={styles.errorText}>{errors.otp}</Typography>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, { borderColor: colors.borderLight, backgroundColor: rememberMe ? colors.foreground : 'transparent' }]}>
                {rememberMe && <Ionicons name="checkmark" size={10} color={colors.background} />}
              </View>
              <Typography size={8} weight="600" color={colors.textSecondary}>KEEP ME SIGNED IN</Typography>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.foreground }]}
              onPress={step === 'PHONE' ? handleSendOTP : handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Typography weight="800" size={10} color={colors.background} style={{ letterSpacing: 2 }}>
                  {step === 'PHONE' ? 'PROCEED' : 'VERIFY IDENTITY'}
                </Typography>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.guestRow}>
            <Typography size={9} color={colors.textMuted}>Don't have an account?</Typography>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Typography size={9} weight="800" color={colors.foreground} style={{ marginLeft: 6, letterSpacing: 1 }}>JOIN THE CLUB</Typography>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderLight }]} />
            <Typography size={7} weight="700" color={colors.textExtraLight} style={{ paddingHorizontal: 16 }}>SECURE ACCESS</Typography>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderLight }]} />
          </View>

          <View style={styles.oauthContainer}>
            <TouchableOpacity
              style={[
                styles.oauthButton, 
                { 
                  backgroundColor: colors.text, 
                  borderColor: colors.text 
                }
              ]}
              onPress={handleAppleSignIn}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-apple" size={18} color={colors.background} />
              <Typography weight="700" size={9} color={colors.background} style={{ marginLeft: 10, letterSpacing: 1 }}>SIGN IN WITH APPLE</Typography>
            </TouchableOpacity>
          </View>

          <View style={styles.legalRow}>
            <Typography size={7} color={colors.textMuted} style={{ textAlign: 'center', lineHeight: 14 }}>
              By joining, you represent shared values of{'\n'}
              <Typography size={7} weight="800" color={colors.text}>INTEGRITY</Typography>
              {' '}and{' '}
              <Typography size={7} weight="800" color={colors.text}>EXCELLENCE</Typography>
            </Typography>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontFamily: 'Rocaston', // Using the specified premium font
    letterSpacing: 4,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    letterSpacing: 6,
    opacity: 0.5,
  },
  authCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  field: {
    gap: 10,
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    letterSpacing: 3,
    marginLeft: 4,
    opacity: 0.6,
  },
  forgotBtn: {
    letterSpacing: 1,
  },
  input: {
    height: 60,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    marginLeft: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 4,
    marginBottom: 24,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 40,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.1,
  },
  oauthContainer: {
    flexDirection: 'row',
  },
  oauthButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalRow: {
    marginTop: 40,
    alignItems: 'center',
  },
});
