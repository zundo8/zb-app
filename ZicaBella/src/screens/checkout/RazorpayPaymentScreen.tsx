import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Dimensions, ActivityIndicator, Platform, KeyboardAvoidingView, Animated,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { haptics } from '../../utils/haptics';
import { useColors } from '../../constants/colors';
import { Typography } from '../../components/Typography';
import { useRazorpay, PaymentMethod } from '../../hooks/useRazorpay';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { config } from '../../constants/config';

const { width: SW } = Dimensions.get('window');

const UPI_APPS = [
  { id: 'gpay', label: 'Google Pay', app: 'gpay' as const, icon: 'https://cdn.razorpay.com/app/gpay.png' },
  { id: 'phonepe', label: 'PhonePe', app: 'phonepe' as const, icon: 'https://cdn.razorpay.com/app/phonepe.png' },
  { id: 'paytm', label: 'Paytm', app: 'paytm' as const, icon: 'https://cdn.razorpay.com/app/paytm.png' },
  { id: 'bhim', label: 'BHIM', app: 'bhim' as const, icon: 'https://cdn.razorpay.com/app/bhim.png' },
];
const TOP_BANKS = [
  { code: 'SBIN', name: 'SBI', icon: 'https://cdn.razorpay.com/bank/SBIN.gif' },
  { code: 'HDFC', name: 'HDFC', icon: 'https://cdn.razorpay.com/bank/HDFC.gif' },
  { code: 'ICIC', name: 'ICICI', icon: 'https://cdn.razorpay.com/bank/ICIC.gif' },
  { code: 'UTIB', name: 'Axis', icon: 'https://cdn.razorpay.com/bank/UTIB.gif' },
  { code: 'KKBK', name: 'Kotak', icon: 'https://cdn.razorpay.com/bank/KKBK.gif' },
];
const WALLETS = [
  { id: 'paytm', name: 'Paytm', icon: 'https://cdn.razorpay.com/app/paytm.png' },
  { id: 'phonepe', name: 'PhonePe', icon: 'https://cdn.razorpay.com/app/phonepe.png' },
  { id: 'amazonpay', name: 'Amazon Pay', icon: 'https://cdn.razorpay.com/app/amazonpay.png' },
  { id: 'mobikwik', name: 'Mobikwik', icon: 'https://cdn.razorpay.com/app/mobikwik.png' },
  { id: 'freecharge', name: 'Freecharge', icon: 'https://cdn.razorpay.com/app/freecharge.png' },
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
  const isDark = colors.background === '#000000';

  const { status, error, successData, startPayment, reset } = useRazorpay();
  const isProcessing = status === 'processing' || status === 'verifying' || status === 'creating_order';

  const [tab, setTab] = useState<PaymentMethod>('upi');
  const [upiId, setUpiId] = useState('');
  const [selectedUpiApp, setSelectedUpiApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'bhim' | null>(null);
  
  const [cardNum, setCardNum] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [bankSearch, setBankSearch] = useState('');
  
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  // Track if we've already recorded the order (prevent double-recording)
  const orderRecordedRef = useRef(false);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const tabIndicator = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const failScale = useRef(new Animated.Value(0)).current;

  const TABS: PaymentMethod[] = ['upi', 'card', 'netbanking', 'wallet'];
  const TAB_LABELS = ['UPI', 'Card', 'Netbanking', 'Wallets'];
  const tabWidth = (SW - 48) / 4;

  useEffect(() => {
    Animated.spring(tabIndicator, { toValue: TABS.indexOf(tab) * tabWidth, useNativeDriver: true }).start();
  }, [tab]);

  useEffect(() => {
    if (status === 'processing' || status === 'verifying' || status === 'creating_order') {
      Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1200, useNativeDriver: true })).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [status]);

  // ── Record order on backend after successful payment ──
  const recordOrderOnBackend = useCallback(async (paymentId: string, rzpOrderId: string) => {
    if (orderRecordedRef.current) return;
    orderRecordedRef.current = true;

    try {
      const token = useAuthStore.getState().token || '';
      const apiBase = config.appUrl;

      if (orderData) {
        console.log('[RazorpayPayment] Recording order on backend...');
        const orderPayload = {
          ...orderData,
          paymentId: paymentId,
          razorpayOrderId: rzpOrderId,
          razorpay_order_id: rzpOrderId,
          paymentStatus: 'paid',
          paymentMethod: 'PREPAID',
        };

        const res = await fetch(`${apiBase}/api/app/orders/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify(orderPayload),
        });

        const resText = await res.text();
        let resJson: any;
        try {
          resJson = JSON.parse(resText);
        } catch {
          console.warn('[RazorpayPayment] Non-JSON order creation response:', resText.slice(0, 200));
          resJson = {};
        }

        if (!res.ok) {
          console.error('[RazorpayPayment] Order creation failed:', resJson);
        } else {
          console.log('[RazorpayPayment] Order recorded:', resJson.orderId || resJson.id);
        }
      }

      // Clear cart
      buyNowItem ? setBuyNowItem(null) : clearCart();
    } catch (e: any) {
      console.error('[RazorpayPayment] Error recording order:', e.message);
    }
  }, [orderData, buyNowItem, setBuyNowItem, clearCart]);

  useEffect(() => {
    if (status === 'success' && successData) {
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, friction: 4, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
      
      // Record the paid order on backend
      recordOrderOnBackend(successData.paymentId, successData.orderId);
    }
  }, [status, successData]);

  useEffect(() => {
    if (status === 'failed') {
      Animated.spring(failScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    }
  }, [status]);


  const cleanPhone = (p: string) => p ? p.replace(/\D/g, '').slice(-10) : '';

  const isPayReady = (): boolean => {
    if (tab === 'upi') return UPI_REGEX.test(upiId.trim()) || !!selectedUpiApp;
    if (tab === 'card') return cardNum.replace(/\s/g, '').length === 16 && cardExpiry.length === 5 && cardCvv.length >= 3 && cardName.trim().length > 0;
    if (tab === 'netbanking') return !!selectedBank;
    if (tab === 'wallet') return !!selectedWallet;
    return false;
  };

  const onPay = async () => {
    if (!isPayReady()) return;
    haptics.buttonTap();

    // Reset order recording flag for new attempt
    orderRecordedRef.current = false;

    const opts = {
      amount,
      // Pass pre-created order from OrderReviewScreen
      orderId: orderId,
      razorpayKeyId: razorpayKeyId,
      prefill,
      upiId: upiId.trim() || undefined,
      upiApp: selectedUpiApp || undefined,
      cardNumber: cardNum,
      cardExpiry,
      cardCvv,
      cardName,
      bankCode: selectedBank || undefined,
      walletCode: selectedWallet || undefined,
      notes: { source: 'zicabella-app' },
    };

    await startPayment(tab, opts);
  };


  const goToOrders = () => {
    nav.getParent()?.reset({
      index: 1,
      routes: [{ name: 'Main' }, { name: 'OrderConfirmation', params: { orderId: orderId, paymentMethod: 'PREPAID', estimatedDelivery: '3-5 Business Days' } }],
    });
  };

  const retry = () => {
    orderRecordedRef.current = false;
    reset();
  };

  const filteredBanks = TOP_BANKS.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()));
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  if (status === 'success') {
    return (
      <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={s.overlay}>
          <Animated.View style={[s.resultCircle, { backgroundColor: 'rgba(52,199,89,0.1)', transform: [{ scale: successScale }], opacity: successOpacity }]}>
            <Ionicons name="checkmark-done" size={48} color={colors.success} />
          </Animated.View>
          <Animated.View style={{ opacity: successOpacity, alignItems: 'center' }}>
            <Typography size={20} weight="800" color={colors.text} style={{ letterSpacing: 3, marginTop: 32 }}>PAYMENT SUCCESSFUL!</Typography>
            <Typography size={10} color={colors.textMuted} style={{ marginTop: 12, letterSpacing: 1 }}>Payment ID: {successData?.paymentId}</Typography>
            <TouchableOpacity style={[s.ctaBtn, { backgroundColor: colors.foreground, marginTop: 40 }]} onPress={goToOrders}>
              <Typography size={11} weight="800" color={colors.background} style={{ letterSpacing: 1 }}>VIEW ORDER</Typography>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }

  if (status === 'failed') {
    return (
      <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={s.overlay}>
          <Animated.View style={[s.resultCircle, { backgroundColor: 'rgba(255,59,48,0.1)', transform: [{ scale: failScale }] }]}>
            <Ionicons name="close" size={48} color={colors.error} />
          </Animated.View>
          <Typography size={20} weight="800" color={colors.text} style={{ letterSpacing: 3, marginTop: 32 }}>PAYMENT FAILED</Typography>
          <Typography size={11} color={colors.textMuted} style={{ marginTop: 12, textAlign: 'center', paddingHorizontal: 40 }}>{error}</Typography>
          <TouchableOpacity style={[s.ctaBtn, { backgroundColor: colors.foreground, marginTop: 40 }]} onPress={retry}>
            <Typography size={11} weight="800" color={colors.background} style={{ letterSpacing: 1 }}>RETRY PAYMENT</Typography>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={s.headerBar}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: colors.surface }]} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Typography size={14} weight="700" color={colors.text} style={{ letterSpacing: 1 }}>Complete Payment</Typography>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
          <View style={[s.amountBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: colors.borderLight }]}>
            <Typography size={9} weight="800" color={colors.textExtraLight} style={{ letterSpacing: 1 }}>TOTAL AMOUNT</Typography>
            <Typography size={32} weight="800" color={colors.text} style={{ marginTop: 4, letterSpacing: -0.5 }}>₹{(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography>
            <Typography size={9} color={colors.textMuted} style={{ marginTop: 6 }}>Order ID: {orderId?.slice(-12)}</Typography>
          </View>

          <View style={[s.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }]}>
            <Animated.View style={[s.tabIndicator, { width: tabWidth - 8, backgroundColor: colors.foreground, transform: [{ translateX: Animated.add(tabIndicator, 4) }] }]} />
            {TABS.map((t, i) => (
              <TouchableOpacity key={t} style={[s.tabItem, { width: tabWidth }]} onPress={() => { haptics.tabPress(); setTab(t); setSelectedUpiApp(null); }}>
                <Typography size={10} weight={tab === t ? '800' : '600'} color={tab === t ? colors.background : colors.textMuted}>{TAB_LABELS[i]}</Typography>
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'upi' && (
            <View style={s.panel}>
              <Typography size={8} weight="700" color={colors.textExtraLight} style={s.panelLabel}>SELECT UPI APP</Typography>
              <View style={s.methodGrid}>
                {UPI_APPS.map(app => (
                  <TouchableOpacity 
                    key={app.id} 
                    style={[
                      s.methodCard, 
                      { 
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                        borderColor: selectedUpiApp === app.app ? colors.foreground : colors.borderLight
                      }
                    ]}
                    onPress={() => { haptics.buttonTap(); setSelectedUpiApp(app.app); setUpiId(''); }}
                  >
                    <Image source={{ uri: app.icon }} style={s.methodIcon} contentFit="contain" />
                    <Typography size={10} weight="700" color={colors.text} style={{ marginTop: 8 }}>{app.label}</Typography>
                    {selectedUpiApp === app.app && (
                      <View style={[s.checkBadge, { backgroundColor: colors.foreground }]}>
                        <Ionicons name="checkmark" size={10} color={colors.background} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ marginVertical: 24, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.borderLight }} />
                <Typography size={10} weight="800" color={colors.textExtraLight} style={{ marginHorizontal: 16 }}>OR</Typography>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.borderLight }} />
              </View>

              <Typography size={8} weight="700" color={colors.textExtraLight} style={s.panelLabel}>ENTER UPI ID</Typography>
              <TextInput
                style={[s.input, { backgroundColor: isDark ? '#111' : '#F2F2F7', color: colors.text, borderColor: upiId && !UPI_REGEX.test(upiId) ? colors.error : colors.borderLight }]}
                placeholder="name@upi" placeholderTextColor={colors.textExtraLight}
                value={upiId} onChangeText={(v) => { setUpiId(v); setSelectedUpiApp(null); }} autoCapitalize="none" autoCorrect={false}
              />

            </View>
          )}

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

          {tab === 'netbanking' && (
            <View style={s.panel}>
              <Typography size={8} weight="700" color={colors.textExtraLight} style={s.panelLabel}>POPULAR BANKS</Typography>
              <View style={s.methodGrid}>
                {TOP_BANKS.map(bank => (
                  <TouchableOpacity 
                    key={bank.code} 
                    style={[
                      s.methodCard, 
                      { 
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                        borderColor: selectedBank === bank.code ? colors.foreground : colors.borderLight
                      }
                    ]}
                    onPress={() => { haptics.buttonTap(); setSelectedBank(bank.code); }}
                  >
                    <Image source={{ uri: bank.icon }} style={s.methodIcon} contentFit="contain" />
                    <Typography size={9} weight="700" color={colors.text} style={{ marginTop: 8 }}>{bank.name}</Typography>
                    {selectedBank === bank.code && (
                      <View style={[s.checkBadge, { backgroundColor: colors.foreground }]}>
                        <Ionicons name="checkmark" size={10} color={colors.background} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              
              <Typography size={8} weight="700" color={colors.textExtraLight} style={[s.panelLabel, { marginTop: 24 }]}>OTHER BANKS</Typography>
              <TextInput style={[s.input, { backgroundColor: isDark ? '#111' : '#F2F2F7', color: colors.text, borderColor: colors.borderLight, marginBottom: 12 }]}
                placeholder="Search other banks..." placeholderTextColor={colors.textExtraLight}
                value={bankSearch} onChangeText={setBankSearch} />
            </View>
          )}

          {tab === 'wallet' && (
            <View style={s.panel}>
              <Typography size={8} weight="700" color={colors.textExtraLight} style={s.panelLabel}>SELECT WALLET</Typography>
              <View style={s.methodGrid}>
                {WALLETS.map(wallet => (
                  <TouchableOpacity 
                    key={wallet.id} 
                    style={[
                      s.methodCard, 
                      { 
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                        borderColor: selectedWallet === wallet.id ? colors.foreground : colors.borderLight
                      }
                    ]}
                    onPress={() => { haptics.buttonTap(); setSelectedWallet(wallet.id); }}
                  >
                    <Image source={{ uri: wallet.icon }} style={s.methodIcon} contentFit="contain" />
                    <Typography size={9} weight="700" color={colors.text} style={{ marginTop: 8 }}>{wallet.name}</Typography>
                    {selectedWallet === wallet.id && (
                      <View style={[s.checkBadge, { backgroundColor: colors.foreground }]}>
                        <Ionicons name="checkmark" size={10} color={colors.background} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background, borderTopColor: colors.borderLight }]}>
        <TouchableOpacity style={[s.payBtn, { backgroundColor: isPayReady() ? colors.foreground : colors.surface, opacity: isPayReady() ? 1 : 0.5 }]}
          onPress={onPay} disabled={isProcessing || !isPayReady()} activeOpacity={0.85}>
          {isProcessing ? <ActivityIndicator color={colors.background} /> :
            <Typography size={13} weight="800" color={isPayReady() ? colors.background : colors.textMuted} style={{ letterSpacing: 1 }}>
              PAY ₹{(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
            </Typography>
          }
        </TouchableOpacity>
      </View>

      {isProcessing && (
        <View style={[StyleSheet.absoluteFill, s.overlay, { backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 9999 }]}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="sync-outline" size={48} color="rgba(255,255,255,0.6)" />
          </Animated.View>
          <Typography size={16} weight="700" color="#FFF" style={{ marginTop: 28, letterSpacing: 2 }}>
            {status === 'creating_order' ? 'INITIATING' : status === 'verifying' ? 'VERIFYING' : 'PROCESSING'}
          </Typography>
          <Typography size={11} color="rgba(255,255,255,0.5)" style={{ marginTop: 8 }}>
            Please do not close the app...
          </Typography>
        </View>
      )}
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
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-start' },
  methodCard: { width: (SW - 64) / 3, height: 90, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, position: 'relative', padding: 8 },
  methodIcon: { width: 36, height: 36 },
  checkBadge: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  payBtn: { height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center' },
});
