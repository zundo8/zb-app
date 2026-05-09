import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Dimensions, ActivityIndicator, Platform, Alert, Image,
  KeyboardAvoidingView, Modal, Animated, FlatList,
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
import { Typography } from '../../components/Typography';

const { width: SW } = Dimensions.get('window');
type PayMethod = 'upi' | 'card' | 'netbanking' | 'wallet';
type ScreenState = 'form' | 'processing' | 'success' | 'failed';

const UPI_APPS = [
  { id: 'gpay', label: 'GPay', handle: '@okicici' },
  { id: 'phonepe', label: 'PhonePe', handle: '@ybl' },
  { id: 'paytm', label: 'Paytm', handle: '@paytm' },
];
const TOP_BANKS = [
  { code: 'SBIN', name: 'SBI' }, { code: 'HDFC', name: 'HDFC' },
  { code: 'ICIC', name: 'ICICI' }, { code: 'UTIB', name: 'Axis' },
  { code: 'KKBK', name: 'Kotak' }, { code: 'YESB', name: 'Yes Bank' },
  { code: 'INDB', name: 'IndusInd' }, { code: 'PUNB', name: 'PNB' },
];
const WALLETS = [
  { id: 'paytm', name: 'Paytm' }, { id: 'phonepe', name: 'PhonePe' },
  { id: 'amazonpay', name: 'Amazon Pay' }, { id: 'mobikwik', name: 'Mobikwik' },
  { id: 'freecharge', name: 'Freecharge' },
];

const UPI_REGEX = /^[\w.-]+@[\w.-]+$/;

function detectCardType(num: string): string {
  const n = num.replace(/\s/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'Mastercard';
  if (/^6/.test(n) || /^81/.test(n) || /^82/.test(n)) return 'RuPay';
  return '';
}

function formatCardNumber(val: string): string {
  const n = val.replace(/\D/g, '').slice(0, 16);
  return n.replace(/(.{4})/g, '$1 ').trim();
}

export default function RazorpayPaymentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { amount, orderId, razorpayKeyId, prefill, orderData } = route.params || {};
  const { clearCart, buyNowItem, setBuyNowItem } = useCartStore();
  const token = useAuthStore((s) => s.token) || '';
  const isDark = colors.background === '#000000';

  // State
  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [tab, setTab] = useState<PayMethod>('upi');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successPaymentId, setSuccessPaymentId] = useState('');

  // UPI
  const [upiId, setUpiId] = useState('');
  // Card
  const [cardNum, setCardNum] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  // Netbanking
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [bankSearch, setBankSearch] = useState('');
  // Wallet
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  // Animations
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const failScale = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const tabIndicator = useRef(new Animated.Value(0)).current;

  const TABS: PayMethod[] = ['upi', 'card', 'netbanking', 'wallet'];
  const TAB_LABELS = ['UPI', 'Card', 'Netbanking', 'Wallets'];
  const tabWidth = (SW - 48) / 4;

  useEffect(() => {
    Animated.spring(tabIndicator, { toValue: TABS.indexOf(tab) * tabWidth, useNativeDriver: true }).start();
  }, [tab]);

  useEffect(() => {
    if (screenState === 'processing') {
      Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1200, useNativeDriver: true })).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [screenState]);

  useEffect(() => {
    if (screenState === 'success') {
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, friction: 4, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    } else { successScale.setValue(0); successOpacity.setValue(0); }
  }, [screenState]);

  useEffect(() => {
    if (screenState === 'failed') {
      Animated.spring(failScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    } else { failScale.setValue(0); }
  }, [screenState]);

  const cleanPhone = (p: string) => p ? p.replace(/\D/g, '').slice(-10) : '';

  const isPayReady = (): boolean => {
    if (tab === 'upi') return UPI_REGEX.test(upiId.trim());
    if (tab === 'card') return cardNum.replace(/\s/g, '').length === 16 && cardExpiry.length === 5 && cardCvv.length >= 3 && cardName.trim().length > 0;
    if (tab === 'netbanking') return !!selectedBank;
    if (tab === 'wallet') return !!selectedWallet;
    return false;
  };

  const handlePaymentSuccess = async (rzpData: any) => {
    try {
      const apiBase = getPaymentApiBaseUrl();
      const vRes = await fetch(`${apiBase}/api/app/payment/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(rzpData),
      });
      const vJson = await vRes.json();
      if (!vJson.success) throw new Error(vJson.error || 'Verification failed.');

      const oRes = await fetch(`${config.appUrl}/api/app/orders/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...orderData, paymentId: rzpData.razorpay_payment_id, razorpayOrderId: rzpData.razorpay_order_id }),
      });
      const oJson = await oRes.json();
      if (!oRes.ok) throw new Error(oJson.error || 'Order recording failed.');

      haptics.success();
      setSuccessPaymentId(rzpData.razorpay_payment_id);
      setScreenState('success');
      buyNowItem ? setBuyNowItem(null) : clearCart();
    } catch (e: any) {
      setErrorMsg(e.message);
      setScreenState('failed');
    }
  };

  const onPay = async () => {
    if (loading || !isPayReady()) return;
    haptics.buttonTap();
    setLoading(true);
    setScreenState('processing');

    try {
      const safePrefill = { ...prefill, contact: cleanPhone(prefill?.contact) };
      const rzpOptions: any = {
        key: razorpayKeyId,
        amount: Math.round(amount * 100),
        currency: 'INR',
        order_id: orderId,
        name: 'Zica Bella',
        description: 'Order Payment',
        prefill: safePrefill,
        method: { upi: tab === 'upi', card: tab === 'card', netbanking: tab === 'netbanking', wallet: tab === 'wallet' },
        theme: { color: '#000000' },
        modal: { backdropclose: false },
      };
      const data = await RazorpayCheckout.open(rzpOptions);
      await handlePaymentSuccess(data);
    } catch (e: any) {
      if (e?.code === 2) { setScreenState('form'); }
      else { setErrorMsg(e?.description || e?.message || 'Payment failed.'); setScreenState('failed'); }
    } finally {
      setLoading(false);
    }
  };

  const goToOrders = () => {
    nav.getParent()?.reset({
      index: 1,
      routes: [{ name: 'Main' }, { name: 'OrderConfirmation', params: { orderId: orderId, paymentMethod: 'PREPAID', estimatedDelivery: '3-5 Business Days' } }],
    });
  };

  const retry = () => { setScreenState('form'); setErrorMsg(''); };

  const filteredBanks = TOP_BANKS.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()));

  // ── Processing Modal ──
  if (screenState === 'processing') {
    const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent>
        <View style={[s.overlay, { backgroundColor: 'rgba(0,0,0,0.92)' }]}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="sync-outline" size={48} color="rgba(255,255,255,0.6)" />
          </Animated.View>
          <Typography size={16} weight="700" color="#FFF" style={{ marginTop: 28, letterSpacing: 2 }}>PROCESSING</Typography>
          <Typography size={11} color="rgba(255,255,255,0.5)" style={{ marginTop: 8 }}>Processing your payment...</Typography>
        </View>
      </Modal>
    );
  }

  // ── Success Screen ──
  if (screenState === 'success') {
    return (
      <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={s.overlay}>
          <Animated.View style={[s.resultCircle, { backgroundColor: 'rgba(52,199,89,0.1)', transform: [{ scale: successScale }], opacity: successOpacity }]}>
            <Ionicons name="checkmark-done" size={48} color={colors.success} />
          </Animated.View>
          <Animated.View style={{ opacity: successOpacity, alignItems: 'center' }}>
            <Typography size={20} weight="800" color={colors.text} style={{ letterSpacing: 3, marginTop: 32 }}>PAYMENT SUCCESSFUL!</Typography>
            <Typography size={10} color={colors.textMuted} style={{ marginTop: 12, letterSpacing: 1 }}>Payment ID: {successPaymentId}</Typography>
            <TouchableOpacity style={[s.ctaBtn, { backgroundColor: colors.foreground, marginTop: 40 }]} onPress={goToOrders}>
              <Typography size={11} weight="800" color={colors.background} style={{ letterSpacing: 1 }}>VIEW ORDER</Typography>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }

  // ── Failure Screen ──
  if (screenState === 'failed') {
    return (
      <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={s.overlay}>
          <Animated.View style={[s.resultCircle, { backgroundColor: 'rgba(255,59,48,0.1)', transform: [{ scale: failScale }] }]}>
            <Ionicons name="close" size={48} color={colors.error} />
          </Animated.View>
          <Typography size={20} weight="800" color={colors.text} style={{ letterSpacing: 3, marginTop: 32 }}>PAYMENT FAILED</Typography>
          <Typography size={11} color={colors.textMuted} style={{ marginTop: 12, textAlign: 'center', paddingHorizontal: 40 }}>{errorMsg}</Typography>
          <TouchableOpacity style={[s.ctaBtn, { backgroundColor: colors.foreground, marginTop: 40 }]} onPress={retry}>
            <Typography size={11} weight="800" color={colors.background} style={{ letterSpacing: 1 }}>RETRY PAYMENT</Typography>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 20, padding: 10 }} onPress={() => nav.goBack()}>
            <Typography size={10} weight="600" color={colors.textMuted}>Contact Support</Typography>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Main Payment Form ──
  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.headerBar}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: colors.surface }]} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Typography size={14} weight="700" color={colors.text} style={{ letterSpacing: 1 }}>Complete Payment</Typography>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
          {/* Section 1: Amount Header */}
          <View style={[s.amountBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: colors.borderLight }]}>
            <Typography size={9} weight="800" color={colors.textExtraLight} style={{ letterSpacing: 1 }}>TOTAL AMOUNT</Typography>
            <Typography size={32} weight="900" color={colors.text} style={{ marginTop: 4, letterSpacing: -0.5 }}>₹{(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography>
            <Typography size={9} color={colors.textMuted} style={{ marginTop: 6 }}>Order ID: {orderId?.slice(-12)}</Typography>
          </View>

          {/* Section 2: Tabs */}
          <View style={[s.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }]}>
            <Animated.View style={[s.tabIndicator, { width: tabWidth - 8, backgroundColor: colors.foreground, transform: [{ translateX: Animated.add(tabIndicator, 4) }] }]} />
            {TABS.map((t, i) => (
              <TouchableOpacity key={t} style={[s.tabItem, { width: tabWidth }]} onPress={() => { haptics.tabPress(); setTab(t); }}>
                <Typography size={10} weight={tab === t ? '800' : '600'} color={tab === t ? colors.background : colors.textMuted}>{TAB_LABELS[i]}</Typography>
              </TouchableOpacity>
            ))}
          </View>

          {/* Section 3: UPI */}
          {tab === 'upi' && (
            <View style={s.panel}>
              <Typography size={8} weight="700" color={colors.textExtraLight} style={s.panelLabel}>UPI ID</Typography>
              <TextInput
                style={[s.input, { backgroundColor: isDark ? '#111' : '#F2F2F7', color: colors.text, borderColor: upiId && !UPI_REGEX.test(upiId) ? colors.error : colors.borderLight }]}
                placeholder="name@upi" placeholderTextColor={colors.textExtraLight}
                value={upiId} onChangeText={setUpiId} autoCapitalize="none" autoCorrect={false}
              />
              <Typography size={8} weight="700" color={colors.textExtraLight} style={[s.panelLabel, { marginTop: 20 }]}>QUICK SELECT</Typography>
              <View style={s.quickRow}>
                {UPI_APPS.map(app => (
                  <TouchableOpacity key={app.id} style={[s.quickBtn, { backgroundColor: isDark ? '#111' : '#F2F2F7', borderColor: upiId.endsWith(app.handle) ? colors.foreground : colors.borderLight }]}
                    onPress={() => { const base = upiId.split('@')[0] || cleanPhone(prefill?.contact); setUpiId(`${base}${app.handle}`); }}>
                    <Typography size={10} weight="700" color={colors.text}>{app.label}</Typography>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Section 4: Card */}
          {tab === 'card' && (
            <View style={s.panel}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography size={8} weight="700" color={colors.textExtraLight} style={s.panelLabel}>CARD DETAILS</Typography>
                {detectCardType(cardNum) ? <Typography size={9} weight="800" color={colors.text}>{detectCardType(cardNum)}</Typography> : null}
              </View>
              <TextInput style={[s.input, { backgroundColor: isDark ? '#111' : '#F2F2F7', color: colors.text, borderColor: colors.borderLight }]}
                placeholder="Card Number" placeholderTextColor={colors.textExtraLight}
                value={cardNum} onChangeText={(v) => setCardNum(formatCardNumber(v))} keyboardType="number-pad" maxLength={19} />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <TextInput style={[s.input, { flex: 1, backgroundColor: isDark ? '#111' : '#F2F2F7', color: colors.text, borderColor: colors.borderLight }]}
                  placeholder="MM/YY" placeholderTextColor={colors.textExtraLight}
                  value={cardExpiry} onChangeText={(v) => { const c = v.replace(/\D/g, '').slice(0, 4); setCardExpiry(c.length > 2 ? c.slice(0, 2) + '/' + c.slice(2) : c); }} keyboardType="number-pad" maxLength={5} />
                <TextInput style={[s.input, { flex: 1, backgroundColor: isDark ? '#111' : '#F2F2F7', color: colors.text, borderColor: colors.borderLight }]}
                  placeholder="CVV" placeholderTextColor={colors.textExtraLight}
                  value={cardCvv} onChangeText={(v) => setCardCvv(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} />
              </View>
              <TextInput style={[s.input, { marginTop: 12, backgroundColor: isDark ? '#111' : '#F2F2F7', color: colors.text, borderColor: colors.borderLight }]}
                placeholder="Cardholder Name" placeholderTextColor={colors.textExtraLight}
                value={cardName} onChangeText={setCardName} autoCapitalize="words" />
            </View>
          )}

          {/* Section 5: Netbanking */}
          {tab === 'netbanking' && (
            <View style={s.panel}>
              <Typography size={8} weight="700" color={colors.textExtraLight} style={s.panelLabel}>SELECT BANK</Typography>
              <TextInput style={[s.input, { backgroundColor: isDark ? '#111' : '#F2F2F7', color: colors.text, borderColor: colors.borderLight, marginBottom: 12 }]}
                placeholder="Search banks..." placeholderTextColor={colors.textExtraLight}
                value={bankSearch} onChangeText={setBankSearch} />
              {filteredBanks.map(b => (
                <TouchableOpacity key={b.code} style={[s.bankRow, { backgroundColor: selectedBank === b.code ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') : 'transparent', borderColor: selectedBank === b.code ? colors.foreground : colors.borderLight }]}
                  onPress={() => setSelectedBank(b.code)}>
                  <Ionicons name="business-outline" size={18} color={colors.textMuted} />
                  <Typography size={12} weight="600" color={colors.text} style={{ marginLeft: 12, flex: 1 }}>{b.name}</Typography>
                  {selectedBank === b.code && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Section 6: Wallets */}
          {tab === 'wallet' && (
            <View style={s.panel}>
              <Typography size={8} weight="700" color={colors.textExtraLight} style={s.panelLabel}>SELECT WALLET</Typography>
              {WALLETS.map(w => (
                <TouchableOpacity key={w.id} style={[s.bankRow, { backgroundColor: selectedWallet === w.id ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') : 'transparent', borderColor: selectedWallet === w.id ? colors.foreground : colors.borderLight }]}
                  onPress={() => setSelectedWallet(w.id)}>
                  <Ionicons name="wallet-outline" size={18} color={colors.textMuted} />
                  <Typography size={12} weight="600" color={colors.text} style={{ marginLeft: 12, flex: 1 }}>{w.name}</Typography>
                  {selectedWallet === w.id && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Section 7: Pay Button */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background, borderTopColor: colors.borderLight }]}>
        <TouchableOpacity style={[s.payBtn, { backgroundColor: isPayReady() ? colors.foreground : colors.surface, opacity: isPayReady() ? 1 : 0.5 }]}
          onPress={onPay} disabled={loading || !isPayReady()} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color={colors.background} /> :
            <Typography size={13} weight="900" color={isPayReady() ? colors.background : colors.textMuted} style={{ letterSpacing: 1 }}>
              PAY ₹{(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
            </Typography>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  resultCircle: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center' },
  ctaBtn: { paddingVertical: 18, paddingHorizontal: 48, borderRadius: 24, minWidth: 200, alignItems: 'center' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  amountBox: { borderRadius: 24, padding: 24, marginTop: 8, alignItems: 'center', borderWidth: 1 },
  tabBar: { flexDirection: 'row', marginTop: 24, borderRadius: 16, height: 44, overflow: 'hidden', position: 'relative' },
  tabIndicator: { position: 'absolute', top: 4, height: 36, borderRadius: 12 },
  tabItem: { height: 44, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  panel: { marginTop: 24 },
  panelLabel: { letterSpacing: 2, marginBottom: 12, marginLeft: 4 },
  input: { height: 48, borderRadius: 14, paddingHorizontal: 14, fontSize: 14, borderWidth: 1 },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  bankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  payBtn: { height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center' },
});
