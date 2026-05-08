import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../constants/colors';
import { Typography } from '../../components/Typography';
import { haptics } from '../../utils/haptics';

export default function OTPVerificationScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { email } = route.params;
  const colors = useColors();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputs = useRef<TextInput[]>([]);

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < otp.length - 1) {
      inputs.current[index + 1].focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1].focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      haptics.error();
      return;
    }

    setLoading(true);
    try {
        // In production, this would call your backend to verify the code
        // and return a secure token or flag to allow reset
        setLoading(false);
        haptics.success();
        navigation.navigate('ResetPassword', { email, otp: code });
    } catch (e) {
      setLoading(false);
      Alert.alert('Error', 'Invalid verification code.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')} style={[styles.backBtn, { backgroundColor: colors.surface }]}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Typography heading weight="700" size={20} color={colors.text} style={styles.title}>VERIFICATION</Typography>
        <Typography weight="400" size={10} color={colors.textExtraLight} style={styles.subtitle}>
          WE'VE SENT A 6-DIGIT CODE TO {email.toUpperCase()}.
        </Typography>

        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => { if (ref) inputs.current[i] = ref; }}
              value={digit}
              onChangeText={(text) => handleChange(text, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              style={[styles.otpInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.borderLight }]}
              selectionColor={colors.foreground}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.foreground }]}
          onPress={handleVerify}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Typography heading weight="700" size={11} color={colors.background}>VERIFY CODE</Typography>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendBtn} onPress={() => haptics.buttonTap()}>
          <Typography size={8} weight="600" color={colors.textExtraLight}>RESEND CODE</Typography>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, marginBottom: 40 },
  backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 24, alignItems: 'center' },
  title: { letterSpacing: 4, marginBottom: 12, textAlign: 'center' },
  subtitle: { letterSpacing: 2, opacity: 0.6, marginBottom: 60, lineHeight: 16, textAlign: 'center' },
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 60 },
  otpInput: { width: 44, height: 64, borderRadius: 16, borderWidth: 1, textAlign: 'center', fontSize: 22, fontWeight: '700' },
  primaryButton: { height: 64, width: '100%', borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  resendBtn: { marginTop: 32, padding: 12 },
});
