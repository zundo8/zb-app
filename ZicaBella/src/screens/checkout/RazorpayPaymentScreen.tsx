import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Dimensions, ActivityIndicator, Platform, Alert, Linking, Image, KeyboardAvoidingView, Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import RazorpayCheckout from 'react-native-razorpay';
import { haptics } from '../../utils/haptics';
import { getPaymentApiBaseUrl, config } from '../../constants/config';
import { useColors } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const UPI_APPS = [
  { id: 'phonepe', label: 'PhonePe', package: 'com.phonepe.app', icon: 'https://cdn-icons-png.flaticon.com/512/825/825590.png' },
  { id: 'google_pay', label: 'GPay', package: 'com.google.android.apps.nbu.paisa.user', icon: 'https://cdn-icons-png.flaticon.com/512/6124/6124998.png' },
  { id: 'paytm', label: 'Paytm', package: 'net.one97.paytm', icon: 'https://cdn-icons-png.flaticon.com/512/825/825508.png' },
  { id: 'mobikwik', label: 'MobiKwik', package: 'com.mobikwik_new', icon: 'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/mobikwik-icon.png' },
];

const TOP_BANKS = [
  { code: 'SBIN', name: 'SBI', icon: '🏦' },
  { code: 'HDFC', name: 'HDFC', icon: '🏦' },
  { code: 'ICIC', name: 'ICICI', icon: '🏦' },
  { code: 'UTIB', name: 'Axis', icon: '🏦' },
];

export default function RazorpayPaymentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const { amount, orderId, razorpayKeyId, prefill, orderData } = route.params || {};
  const { clearCart, buyNowItem, setBuyNowItem } = useCartStore();
  const token = useAuthStore((s) => s.token) || '';

  const [viewState, setViewState] = useState<'SELECTING' | 'PROCESSING'>('SELECTING');
  const [tab, setTab] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [loading, setLoading] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  const cleanPhone = (p: string) => p ? p.replace(/\D/g, '').slice(-10) : '';
  const safePrefill = { ...prefill, contact: cleanPhone(prefill?.contact) };

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const safeFetch = async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (!res.ok) throw new Error(json.error || 'Server error');
        return json;
      } catch (e) {
        throw new Error(`Invalid response from ${url.split('/').pop()}. Check backend logs.`);
      }
    } catch (e: any) {
      throw new Error(e.message || 'Network error. Please check your connection.');
    }
  };

  const handlePaymentSuccess = async (rzpData: any) => {
    setLoading(true);
    try {
      const apiBase = getPaymentApiBaseUrl();
      const verifyRes = await fetch(`${apiBase}/api/app/payment/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(rzpData),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyJson.success) throw new Error(verifyJson.error || 'Payment verification failed.');

      const res = await fetch(`${config.appUrl}/api/app/orders/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...orderData, paymentId: rzpData.razorpay_payment_id, razorpayOrderId: rzpData.razorpay_order_id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Payment succeeded but order recording failed.');

      haptics.success();
      buyNowItem ? setBuyNowItem(null) : clearCart();
      navigation.getParent()?.reset({
        index: 1,
        routes: [
          { name: 'Main' },
          { name: 'OrderConfirmation', params: { orderId: json.orderId || json.id, paymentMethod: 'PREPAID', estimatedDelivery: '3-5 Business Days' } }
        ],
      });
    } catch (e: any) {
      haptics.error();
      Alert.alert('Order Recording Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (id: string) => {
    setViewState('PROCESSING');
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      try {
        const data = await safeFetch(`${getPaymentApiBaseUrl()}/api/app/payment/status/${id}`);
        if (data.status === 'captured' || data.status === 'authorized') {
          clearInterval(pollTimer.current!);
          handlePaymentSuccess({ razorpay_payment_id: id, razorpay_order_id: orderId, razorpay_signature: 'HEADLESS' });
        } else if (data.status === 'failed') {
          clearInterval(pollTimer.current!);
          setViewState('SELECTING');
          Alert.alert('Payment Failed', data.error_description || 'Transaction declined.');
        }
      } catch (e) {}
    }, 3000);
  };

  const handleHeadless = async (method: string, details: any) => {
    setLoading(true);
    try {
      const data = await safeFetch(`${getPaymentApiBaseUrl()}/api/app/payment/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ order_id: orderId, amount: Math.round(amount * 100), method, ...safePrefill, ...details }),
      });
      if (method === 'netbanking' && data.authorize_url) Linking.openURL(data.authorize_url);
      startPolling(data.id);
    } catch (err: any) {
      Alert.alert('Payment Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSdk = async (options: any) => {
    setLoading(true);
    try {
      const fullOptions = {
        ...options,
        currency: 'INR',
        name: 'Zica Bella',
        description: 'Order Payment',
      };
      const data = await RazorpayCheckout.open(fullOptions);
      handlePaymentSuccess(data);
    } catch (e: any) {
      if (e?.code !== 2) Alert.alert('Payment Error', e?.description || 'Failed to process.');
    } finally {
      setLoading(false);
    }
  };

  const onPay = () => {
    haptics.buttonTap();
    if (tab === 'upi') {
      if (upiId.includes('@')) handleHeadless('upi', { vpa: upiId.trim() });
      else Alert.alert('Invalid UPI ID', 'Enter a valid VPA (e.g. name@upi)');
    } else if (tab === 'netbanking') {
      if (selectedBank) handleHeadless('netbanking', { bank: selectedBank });
      else Alert.alert('Select Bank', 'Choose a bank.');
    } else if (tab === 'card') {
      handleSdk({ 
        key: razorpayKeyId, 
        amount: Math.round(amount * 100), 
        order_id: orderId, 
        prefill: safePrefill, 
        method: 'card', 
        theme: { color: colors.primary } 
      });
    }
  };

  const isDark = colors.background === '#000000';

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={s.headerBar}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: colors.surface }]} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Complete Payment</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60, paddingHorizontal: 20 }}>
          <View style={[s.priceBox, { backgroundColor: isDark ? '#111' : '#FFF', borderColor: colors.borderLight }]}>
            <Text style={[s.priceLabel, { color: colors.textExtraLight }]}>TOTAL AMOUNT</Text>
            <Text style={[s.priceValue, { color: colors.text }]}>₹{(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>

          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: colors.textExtraLight }]}>QUICK PAY</Text>
            <View style={s.appsGrid}>
              {UPI_APPS.map(app => (
                <TouchableOpacity key={app.id} style={s.appItem} onPress={() => {
                  if (Platform.OS === 'android' && app.package) {
                    handleSdk({ key: razorpayKeyId, amount: Math.round(amount * 100), order_id: orderId, method: 'upi', upi_type: 'intent', upi_app_package_name: app.package, prefill: safePrefill });
                  } else {
                    handleHeadless('upi', { vpa: `${safePrefill.contact}@ybl` });
                  }
                }}>
                  <View style={[s.iconWrapper, { backgroundColor: isDark ? '#111' : '#FFF', borderColor: colors.borderLight }]}>
                    <Image source={{ uri: app.icon }} style={s.brandIcon} resizeMode="contain" />
                  </View>
                  <Text style={[s.appTitle, { color: colors.text }]}>{app.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: colors.textExtraLight }]}>ALL OPTIONS</Text>
            <View style={[s.optionsCard, { backgroundColor: isDark ? '#111' : '#FFF', borderColor: colors.borderLight }]}>
              <TouchableOpacity style={s.optionItem} onPress={() => setTab('card')}>
                <View style={s.optionLeft}>
                  <Ionicons name="card-outline" size={18} color={tab === 'card' ? colors.primary : colors.textExtraLight} />
                  <Text style={[s.optionText, { color: tab === 'card' ? colors.text : colors.textMuted }, tab === 'card' && s.optionTextActive]}>Cards</Text>
                </View>
                <Ionicons name="chevron-forward" size={12} color={colors.textExtraLight} />
              </TouchableOpacity>
              <View style={[s.divider, { backgroundColor: colors.borderLight }]} />
              <TouchableOpacity style={s.optionItem} onPress={() => setTab('upi')}>
                <View style={s.optionLeft}>
                  <Ionicons name="at-outline" size={18} color={tab === 'upi' ? colors.primary : colors.textExtraLight} />
                  <Text style={[s.optionText, { color: tab === 'upi' ? colors.text : colors.textMuted }, tab === 'upi' && s.optionTextActive]}>UPI ID</Text>
                </View>
                <Ionicons name="chevron-down" size={12} color={colors.textExtraLight} />
              </TouchableOpacity>
              {tab === 'upi' && <TextInput style={[s.input, { backgroundColor: isDark ? '#222' : '#F2F2F7', color: colors.text }]} placeholder="name@upi" placeholderTextColor={colors.textExtraLight} value={upiId} onChangeText={setUpiId} autoCapitalize="none" />}
              <View style={[s.divider, { backgroundColor: colors.borderLight }]} />
              <TouchableOpacity style={s.optionItem} onPress={() => setTab('netbanking')}>
                <View style={s.optionLeft}>
                  <Ionicons name="business-outline" size={18} color={tab === 'netbanking' ? colors.primary : colors.textExtraLight} />
                  <Text style={[s.optionText, { color: tab === 'netbanking' ? colors.text : colors.textMuted }, tab === 'netbanking' && s.optionTextActive]}>Netbanking</Text>
                </View>
                <Ionicons name="chevron-down" size={12} color={colors.textExtraLight} />
              </TouchableOpacity>
              {tab === 'netbanking' && <View style={s.nbGrid}>{TOP_BANKS.map(b => (
                <TouchableOpacity key={b.code} style={[s.nbItem, { backgroundColor: isDark ? '#222' : '#F2F2F7' }, selectedBank === b.code && s.nbItemActive]} onPress={() => setSelectedBank(b.code)}>
                  <Text style={{fontSize:18}}>{b.icon}</Text><Text style={[s.nbLabel, { color: colors.text }]}>{b.name}</Text>
                </TouchableOpacity>
              ))}</View>}
            </View>
          </View>

          <TouchableOpacity style={[s.payBtn, { backgroundColor: colors.primary, marginTop: 30 }, loading && { opacity: 0.7 }]} onPress={onPay} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.background} /> : <Text style={[s.payBtnText, { color: colors.background }]}>PAY NOW</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {viewState === 'PROCESSING' && (
        <Modal visible transparent animationType="fade">
          <View style={[s.procOverlay, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[s.procTitle, { color: '#FFF' }]}>Awaiting Confirmation</Text>
            <Text style={[s.procSub, { color: '#CCC' }]}>Please approve the request in your UPI app.</Text>
            <TouchableOpacity style={s.procCancel} onPress={() => setViewState('SELECTING')}>
              <Text style={[s.procCancelText, { color: colors.iosRed }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  priceBox: { borderRadius: 24, padding: 24, marginTop: 16, alignItems: 'center', borderWidth: 1 },
  priceLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  priceValue: { fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  section: { marginTop: 28 },
  sectionLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
  appsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  appItem: { width: (SCREEN_WIDTH - 80) / 4, alignItems: 'center' },
  iconWrapper: { width: 54, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, marginBottom: 8 },
  brandIcon: { width: 26, height: 26 },
  appTitle: { fontSize: 9, fontWeight: '700' },
  optionsCard: { borderRadius: 24, paddingHorizontal: 16, borderWidth: 1 },
  optionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionText: { fontSize: 13, fontWeight: '600' },
  optionTextActive: { fontWeight: '800' },
  divider: { height: 1 },
  input: { height: 44, borderRadius: 10, paddingHorizontal: 12, fontSize: 13, marginBottom: 16 },
  nbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 16 },
  nbItem: { width: '22%', aspectRatio: 1, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  nbItemActive: { borderColor: '#34C759' },
  nbLabel: { fontSize: 8, fontWeight: '800', marginTop: 2 },
  payBtn: { height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', marginTop: 20, marginBottom: 20 },
  payBtnText: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  procOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  procTitle: { fontSize: 18, fontWeight: '900', marginTop: 24 },
  procSub: { fontSize: 12, textAlign: 'center', marginTop: 10 },
  procCancel: { marginTop: 40, padding: 10 },
  procCancelText: { fontWeight: '800', fontSize: 13 },
});
