import React, { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../constants/colors';
import { Typography } from '../../components/Typography';
import { haptics } from '../../utils/haptics';

export default function ForgotEmailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const handleSendOTP = async () => {
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      haptics.error();
      return;
    }

    setLoading(true);
    try {
      // API call to /api/auth/forgot-password would go here
      setTimeout(() => {
        setLoading(false);
        haptics.success();
        navigation.navigate('OTPVerification', { email });
      }, 1200);
    } catch (e) {
      setLoading(false);
      Alert.alert('Error', 'Could not send verification code.');
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
        <Typography heading weight="700" size={20} color={colors.text} style={styles.title}>FORGOT PASSWORD</Typography>
        <Typography weight="400" size={10} color={colors.textExtraLight} style={styles.subtitle}>
          ENTER YOUR EMAIL TO RECEIVE A 6-DIGIT VERIFICATION CODE. USE 123456 FOR DEMO LOGIN.
        </Typography>

        <View style={styles.field}>
          <Typography size={7} weight="600" color={colors.textExtraLight} style={styles.label}>EMAIL ADDRESS</Typography>
          <TextInput
            value={email}
            onChangeText={(v) => { setEmail(v); setError(undefined); }}
            placeholder="charlotte@example.com"
            placeholderTextColor={colors.textExtraLight}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[styles.input, { color: colors.text, borderColor: error ? colors.error : colors.borderLight, backgroundColor: colors.surface }]}
          />
          {error && <Typography size={8} color={colors.error} style={styles.errorText}>{error}</Typography>}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.foreground }]}
          onPress={handleSendOTP}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Typography heading weight="700" size={11} color={colors.background}>SEND CODE</Typography>
          )}
        </TouchableOpacity>
      </View>
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
  field: { gap: 8 },
  label: { letterSpacing: 2, marginLeft: 4 },
  input: { height: 60, borderRadius: 20, borderWidth: 1, paddingHorizontal: 20, fontSize: 14, fontWeight: '500' },
  errorText: { marginLeft: 12, marginTop: 2 },
  primaryButton: { height: 64, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginTop: 32 },
});
