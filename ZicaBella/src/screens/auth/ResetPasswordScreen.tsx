import React, { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../constants/colors';
import { Typography } from '../../components/Typography';
import { haptics } from '../../utils/haptics';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { email, otp } = route.params;
  const colors = useColors();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  const handleReset = async () => {
    const newErrors: any = {};
    if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (password !== confirmPassword) newErrors.confirm = 'Passwords do not match';
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      haptics.error();
      return;
    }

    setLoading(true);
    try {
      // API call to reset password
      setTimeout(() => {
        setLoading(false);
        haptics.success();
        Alert.alert('Success', 'Your password has been reset successfully.', [
          { text: 'Login', onPress: () => navigation.navigate('Login') }
        ]);
      }, 1500);
    } catch (e) {
      setLoading(false);
      Alert.alert('Error', 'Failed to reset password.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')} style={[styles.backBtn, { backgroundColor: colors.surface }]}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Typography heading weight="700" size={20} color={colors.text} style={styles.title}>NEW PASSWORD</Typography>
          <Typography weight="400" size={10} color={colors.textExtraLight} style={styles.subtitle}>
            CREATE A SECURE PASSWORD FOR YOUR ACCOUNT.
          </Typography>

          <View style={styles.form}>
            <View style={styles.field}>
              <Typography size={7} weight="600" color={colors.textExtraLight} style={styles.label}>NEW PASSWORD</Typography>
              <TextInput
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors({ ...errors, password: undefined }); }}
                placeholder="••••••••"
                placeholderTextColor={colors.textExtraLight}
                secureTextEntry
                style={[styles.input, { color: colors.text, borderColor: errors.password ? colors.error : colors.borderLight, backgroundColor: colors.surface }]}
              />
              {errors.password && <Typography size={8} color={colors.error} style={styles.errorText}>{errors.password}</Typography>}
            </View>

            <View style={styles.field}>
              <Typography size={7} weight="600" color={colors.textExtraLight} style={styles.label}>CONFIRM PASSWORD</Typography>
              <TextInput
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setErrors({ ...errors, confirm: undefined }); }}
                placeholder="••••••••"
                placeholderTextColor={colors.textExtraLight}
                secureTextEntry
                style={[styles.input, { color: colors.text, borderColor: errors.confirm ? colors.error : colors.borderLight, backgroundColor: colors.surface }]}
              />
              {errors.confirm && <Typography size={8} color={colors.error} style={styles.errorText}>{errors.confirm}</Typography>}
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.foreground }]}
              onPress={handleReset}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Typography heading weight="700" size={11} color={colors.background}>RESET PASSWORD</Typography>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, marginBottom: 40 },
  backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 24 },
  title: { letterSpacing: 4, marginBottom: 12 },
  subtitle: { letterSpacing: 2, opacity: 0.6, marginBottom: 40, lineHeight: 16 },
  form: { gap: 20 },
  field: { gap: 8 },
  label: { letterSpacing: 2, marginLeft: 4 },
  input: { height: 60, borderRadius: 20, borderWidth: 1, paddingHorizontal: 20, fontSize: 14, fontWeight: '500' },
  errorText: { marginLeft: 12, marginTop: 2 },
  primaryButton: { height: 64, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
});
