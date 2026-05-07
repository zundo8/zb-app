import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
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
import { useThemeStore } from '../store/themeStore';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = 'Please enter your full name';
    if (!email.includes('@')) newErrors.email = 'Please enter a valid email address';
    if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) {
      haptics.error();
      return;
    }

    setLoading(true);
    try {
      // Simulated API call
      setTimeout(() => {
        login({
          id: 'new-user-id',
          name: name,
          email: email,
          phone: '',
        }, 'mock-jwt-token');
        haptics.success();
        setLoading(false);
      }, 1500);
    } catch (e) {
      setLoading(false);
      Alert.alert('Registration Failed', 'Could not create account.');
      haptics.error();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity 
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')} 
            style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>

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
              BECOME A MEMBER OF THE ARCHIVE
            </Typography>
          </View>

          <View style={[styles.authCard, { borderColor: colors.borderLight }]}>
             <BlurView intensity={isDark ? 10 : 30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />

             <View style={styles.form}>
               <View style={styles.field}>
                 <Typography size={7} weight="800" color={colors.textExtraLight} style={styles.label}>FULL NAME</Typography>
                 <TextInput
                   value={name}
                   onChangeText={(v) => { setName(v); if (errors.name) setErrors({ ...errors, name: undefined }); }}
                   placeholder="Charlotte Moss"
                   placeholderTextColor={colors.textExtraLight}
                   style={[
                     styles.input,
                     { color: colors.text, borderColor: errors.name ? colors.error : colors.borderLight },
                     isDark && { backgroundColor: 'rgba(255,255,255,0.02)' }
                   ]}
                 />
                 {errors.name && <Typography size={7} color={colors.error} style={{ marginLeft: 12 }}>{errors.name}</Typography>}
               </View>

               <View style={styles.field}>
                 <Typography size={7} weight="800" color={colors.textExtraLight} style={styles.label}>EMAIL ADDRESS</Typography>
                 <TextInput
                   value={email}
                   onChangeText={(v) => { setEmail(v); if (errors.email) setErrors({ ...errors, email: undefined }); }}
                   placeholder="charlotte@example.com"
                   placeholderTextColor={colors.textExtraLight}
                   autoCapitalize="none"
                   keyboardType="email-address"
                   style={[
                     styles.input,
                     { color: colors.text, borderColor: errors.email ? colors.error : colors.borderLight },
                     isDark && { backgroundColor: 'rgba(255,255,255,0.02)' }
                   ]}
                 />
                 {errors.email && <Typography size={7} color={colors.error} style={{ marginLeft: 12 }}>{errors.email}</Typography>}
               </View>

               <View style={styles.field}>
                 <Typography size={7} weight="800" color={colors.textExtraLight} style={styles.label}>PASSWORD</Typography>
                 <TextInput
                   value={password}
                   onChangeText={(v) => { setPassword(v); if (errors.password) setErrors({ ...errors, password: undefined }); }}
                   placeholder="••••••••"
                   placeholderTextColor={colors.textExtraLight}
                   secureTextEntry
                   style={[
                     styles.input,
                     { color: colors.text, borderColor: errors.password ? colors.error : colors.borderLight },
                     isDark && { backgroundColor: 'rgba(255,255,255,0.02)' }
                   ]}
                 />
                 {errors.password && <Typography size={7} color={colors.error} style={{ marginLeft: 12 }}>{errors.password}</Typography>}
               </View>

               <TouchableOpacity
                 style={[styles.primaryButton, { backgroundColor: colors.foreground }]}
                 onPress={handleRegister}
                 disabled={loading}
                 activeOpacity={0.8}
               >
                 {loading ? (
                   <ActivityIndicator color={colors.background} />
                 ) : (
                   <Typography weight="800" size={10} color={colors.background} style={{ letterSpacing: 2 }}>CREATE ACCOUNT</Typography>
                 )}
               </TouchableOpacity>
             </View>
          </View>

          <View style={styles.loginRow}>
            <Typography size={9} color={colors.textMuted}>Already have an account?</Typography>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Typography size={9} weight="800" color={colors.foreground} style={{ marginLeft: 6, letterSpacing: 1 }}>SIGN IN</Typography>
            </TouchableOpacity>
          </View>
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 30, paddingBottom: 40 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoContainer: {
    width: 80,
    height: 80,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontFamily: 'Rocaston',
    letterSpacing: 4,
    marginBottom: 4,
  },
  subtitle: {
    letterSpacing: 4,
    opacity: 0.5,
  },
  authCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  form: { gap: 16 },
  field: { gap: 8 },
  label: { letterSpacing: 3, marginLeft: 4, opacity: 0.6 },
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
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
});
