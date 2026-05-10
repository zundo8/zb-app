import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Dimensions, ActivityIndicator, Platform, KeyboardAvoidingView, Animated,
  Image, FlatList,
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
import { TOP_BANKS } from '../../constants/bankCodes';
import { WALLETS } from '../../constants/walletCodes';

const UPI_LOGOS: Record<string, string> = {
  'com.google.android.apps.nbu.paisa.user': 'https://cdn.razorpay.com/app/google_pay.png',
  'com.phonepe.app': 'https://cdn.razorpay.com/app/phonepe.png',
  'net.one97.paytm': 'https://cdn.razorpay.com/app/paytm.png',
  'in.org.npci.upiapp': 'https://cdn.razorpay.com/app/bhim.png',
  'com.amazon.mShop.android.shopping': 'https://cdn.razorpay.com/app/amazon_pay.png',
  'phonepe://': 'https://cdn.razorpay.com/app/phonepe.png',
  'tez://': 'https://cdn.razorpay.com/app/google_pay.png',
  'paytmmp://': 'https://cdn.razorpay.com/app/paytm.png',
};

const { width: SW } = Dimensions.get('window');

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

  const {
    status, error, successData, startPayment, reset,
    upiApps, isLoadingApps, fetchInstalledUPIApps,
  } = useRazorpay();
  const isProcessing = status === 'processing' || status === 'verifying' || status === 'creating_order';

  const [tab, setTab] = useState<PaymentMethod>('upi');
  const [selectedUPIApp, setSelectedUPIApp] = useState<string | null>(null);

  const [cardNum, setCardNum] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [bankSearch, setBankSearch] = useState('');

  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  const orderRecordedRef = useRef(false);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const tabIndicator = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const failScale = useRef(new Animated.Value(0)).current;

  const TABS: PaymentMethod[] = ['upi', 'card', 'netbanking', 'wallet'];
  const TAB_LABELS = ['UPI', 'Card', 'Netbanking', 'Wallets'];
  const tabWidth = (SW - 48) / 4;

  // Fetch installed UPI apps when UPI tab is selected
  useEffect(() => {
    if (tab === 'upi') {
      fetchInstalledUPIApps();
    }
  }, [tab]);

  useEffect(() => {
    if (tab !== 'upi') return;
    if (selectedUPIApp && upiApps.some(app => app.package_name === selectedUPIApp && app.is_available !== false)) return;

    const firstAvailableApp = upiApps.find(app => app.is_available !== false);
    setSelectedUPIApp(firstAvailableApp?.package_name || null);
  }, [tab, upiApps, selectedUPIApp]);

  useEffect(() => {
    Animated.spring(tabIndicator, { toValue: TABS.indexOf(tab) * tabWidth, useNativeDriver: true }).start();
  }, [tab]);

  useEffect(() => {
    if (isProcessing) {
      Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1200, useNativeDriver: true })).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [status]);

  // ── Record order on backend after successful payment ──
  const [isRecording, setIsRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const recordOrderOnBackend = useCallback(async (paymentId: string, rzpOrderId: string) => {
    if (orderRecordedRef.current) return;
    setIsRecording(true);
    setRecordError(null);

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
          setRecordError(resJson.error || 'Failed to sync order. Please contact support.');
          // Don't mark as recorded so we can retry
          setIsRecording(false);
          return;
        } else {
          console.log('[RazorpayPayment] Order recorded:', resJson.orderId || resJson.id);
          orderRecordedRef.current = true;
          setIsRecording(false);
        }
      } else {
         orderRecordedRef.current = true;
         setIsRecording(false);
      }

      buyNowItem ? setBuyNowItem(null) : clearCart();
    } catch (e: any) {
      console.error('[RazorpayPayment] Error recording order:', e.message);
      setRecordError('Connection error. Retrying...');
      setIsRecording(false);
      // Optional: auto-retry after 3s
      setTimeout(() => recordOrderOnBackend(paymentId, rzpOrderId), 3000);
    }
  }, [orderData, buyNowItem, setBuyNowItem, clearCart]);

  useEffect(() => {
    if (status === 'success' && successData) {
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, friction: 4, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
      recordOrderOnBackend(successData.paymentId, successData.orderId);
    }
  }, [status, successData]);

  useEffect(() => {
    if (status === 'failed') {
      Animated.spring(failScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    }
  }, [status]);

  const isPayReady = (): boolean => {
    if (tab === 'upi') return !!selectedUPIApp;
    if (tab === 'card') return cardNum.replace(/\s/g, '').length === 16 && cardExpiry.length === 5 && cardCvv.length >= 3 && cardName.trim().length > 0;
    if (tab === 'netbanking') return !!selectedBank;
    if (tab === 'wallet') return !!selectedWallet;
    return false;
  };

  const onPay = async () => {
    if (!isPayReady()) return;
    haptics.buttonTap();
    orderRecordedRef.current = false;

    const opts: any = {
      amount,
      orderId,
      razorpayKeyId,
      prefill,
      selectedAppPackage: selectedUPIApp || undefined,
      cardNumber: cardNum,
      cardExpiry,
      cardCvv,
      cardName,
      bankCode: selectedBank || undefined,
      walletCode: selectedWallet || undefined,
      notes: { source: 'zicabella-app', flow: 'custom-ui' },
    };

    await startPayment(tab, opts);
  };

  const goToOrders = () => {
    nav.getParent()?.reset({
      index: 1,
      routes: [{ name: 'Main' }, { name: 'OrderConfirmation', params: { orderId, paymentMethod: 'PREPAID', estimatedDelivery: '3-5 Business Days' } }],
    });
  };

  const retry = () => {
    orderRecordedRef.current = false;
    reset();
  };

  const filteredBanks = TOP_BANKS.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()));
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // ── SUCCESS STATE ──
  if (status === 'success') {
    return (
      <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={s.overlay}>
          <Animated.View style={[s.resultCircle, { backgroundColor: isDark ? 'rgba(52,199,89,0.15)' : 'rgba(52,199,89,0.1)', transform: [{ scale: successScale }], opacity: successOpacity }]}>
            <Ionicons name="checkmark-done" size={56} color={colors.success} />
          </Animated.View>
          <Animated.View style={{ opacity: successOpacity, alignItems: 'center' }}>
            <Typography size={24} weight="800" color={colors.text} style={{ letterSpacing: 4, marginTop: 40 }}>THANK YOU!</Typography>
            <Typography size={12} weight="600" color={colors.textMuted} style={{ marginTop: 12, letterSpacing: 1 }}>Order Successfully Placed</Typography>
            
            {isRecording ? (
               <View style={{ marginTop: 32, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                 <ActivityIndicator size="small" color={colors.textMuted} />
                 <Typography size={10} color={colors.textMuted} weight="700" style={{ letterSpacing: 1 }}>SYNCING WITH STORE...</Typography>
               </View>
            ) : recordError ? (
               <View style={{ marginTop: 32, alignItems: 'center' }}>
                 <Typography size={10} color={colors.error} weight="700" style={{ textAlign: 'center' }}>{recordError}</Typography>
                 <TouchableOpacity onPress={() => recordOrderOnBackend(successData?.paymentId || '', successData?.orderId || '')} style={{ marginTop: 12 }}>
                    <Typography size={10} color={colors.foreground} weight="800">RETRY SYNC</Typography>
                 </TouchableOpacity>
               </View>
            ) : (
               <>
                <Typography size={9} color={colors.textExtraLight} style={{ marginTop: 24, letterSpacing: 1 }}>Payment ID: {successData?.paymentId}</Typography>
                <TouchableOpacity style={[s.ctaBtn, { backgroundColor: colors.foreground, marginTop: 48, shadowColor: colors.foreground, shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } }]} onPress={goToOrders}>
                  <Typography size={11} weight="800" color={colors.background} style={{ letterSpacing: 2 }}>TRACK ORDER</Typography>
                </TouchableOpacity>
               </>
            )}
          </Animated.View>
        </View>
      </View>
    );
  }

  // ── FAILED STATE ──
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

  // ── MAIN PAYMENT UI ──
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
              <TouchableOpacity key={t} style={[s.tabItem, { width: tabWidth }]} onPress={() => { haptics.tabPress(); setTab(t); }}>
                <Typography size={10} weight={tab === t ? '800' : '600'} color={tab === t ? colors.background : colors.textMuted}>{TAB_LABELS[i]}</Typography>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── UPI PANEL (Dynamic App Detection) ── */}
          {tab === 'upi' && (
            <View style={s.panel}>
              <Typography size={8} weight="700" color={colors.textExtraLight} style={s.panelLabel}>SELECT UPI APP</Typography>
              {isLoadingApps ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.textMuted} />
                  <Typography size={10} color={colors.textMuted} style={{ marginTop: 12 }}>Detecting installed UPI apps...</Typography>
                </View>
              ) : upiApps.length === 0 ? (
                <View style={[s.noAppsBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: colors.borderLight }]}>
                  <Ionicons name="phone-portrait-outline" size={32} color={colors.textMuted} />
                  <Typography size={11} weight="600" color={colors.textMuted} style={{ marginTop: 12, textAlign: 'center', lineHeight: 18 }}>
                    No installed UPI apps found on this device.{'\n'}Install GPay, PhonePe, Paytm, MobiKwik, or BHIM to pay via UPI.
                  </Typography>
                </View>
              ) : (
                <View style={s.methodGrid}>
                  {upiApps.map(app => {
                    const isAvailable = app.is_available !== false;
                    const isSelected = selectedUPIApp === app.package_name;
                    const originalLogo = UPI_LOGOS[app.package_name];

                    return (
                      <TouchableOpacity
                        key={app.package_name}
                        disabled={!isAvailable}
                        style={[
                          s.methodCard,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                            borderColor: isSelected ? colors.foreground : colors.borderLight,
                            opacity: isAvailable ? 1 : 0.45,
                          }
                        ]}
                        onPress={() => { haptics.buttonTap(); setSelectedUPIApp(app.package_name); }}
                      >
                        {originalLogo ? (
                          <Image
                            source={{ uri: originalLogo }}
                            style={s.methodIcon}
                            resizeMode="contain"
                          />
                        ) : app.app_icon ? (
                          <Image
                            source={{ uri: `data:image/png;base64,${app.app_icon}` }}
                            style={s.methodIcon}
                            resizeMode="contain"
                          />
                        ) : (
                          <View style={[s.methodIconFallback, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                            <Ionicons name="phone-portrait-outline" size={20} color={colors.textMuted} />
                          </View>
                        )}
                        <Typography size={9} weight="800" color={colors.text} style={{ marginTop: 10, textAlign: 'center' }} numberOfLines={1}>
                          {app.app_name.toUpperCase()}
                        </Typography>
                        {!isAvailable && (
                          <Typography size={7} weight="700" color={colors.textExtraLight} style={{ marginTop: 2 }} numberOfLines={1}>
                            NOT INSTALLED
                          </Typography>
                        )}
                        {isSelected && (
                          <View style={[s.checkBadge, { backgroundColor: colors.foreground }]}>
                            <Ionicons name="checkmark" size={10} color={colors.background} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {upiApps.filter(app => app.is_available !== false).length > 0 ? (
                <Typography size={9} color={colors.textExtraLight} style={{ marginTop: 16, textAlign: 'center' }}>
                  Select an app → Enter UPI PIN → Done
                </Typography>
              ) : (
                <Typography size={9} color={colors.textExtraLight} style={{ marginTop: 16, textAlign: 'center', lineHeight: 16 }}>
                  Install a listed UPI app on this phone to continue.
                </Typography>
              )}
            </View>
          )}

          {/* ── CARD PANEL ── */}
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

          {/* ── NETBANKING PANEL ── */}
          {tab === 'netbanking' && (
            <View style={s.panel}>
              <Typography size={8} weight="700" color={colors.textExtraLight} style={s.panelLabel}>POPULAR BANKS</Typography>
              <View style={s.methodGrid}>
                {filteredBanks.map(bank => (
                  <TouchableOpacity
                    key={bank.code}
                    style={[s.methodCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: selectedBank === bank.code ? colors.foreground : colors.borderLight }]}
                    onPress={() => { haptics.buttonTap(); setSelectedBank(bank.code); }}
                  >
                    <Image source={{ uri: bank.icon }} style={s.methodIcon} resizeMode="contain" />
                    <Typography size={9} weight="700" color={colors.text} style={{ marginTop: 8 }}>{bank.name}</Typography>
                    {selectedBank === bank.code && (
                      <View style={[s.checkBadge, { backgroundColor: colors.foreground }]}>
                        <Ionicons name="checkmark" size={10} color={colors.background} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              <Typography size={8} weight="700" color={colors.textExtraLight} style={[s.panelLabel, { marginTop: 24 }]}>SEARCH BANKS</Typography>
              <TextInput style={[s.input, { backgroundColor: isDark ? '#111' : '#F2F2F7', color: colors.text, borderColor: colors.borderLight, marginBottom: 12 }]}
                placeholder="Search banks..." placeholderTextColor={colors.textExtraLight}
                value={bankSearch} onChangeText={setBankSearch} />
            </View>
          )}

          {/* ── WALLET PANEL ── */}
          {tab === 'wallet' && (
            <View style={s.panel}>
              <Typography size={8} weight="700" color={colors.textExtraLight} style={s.panelLabel}>SELECT WALLET</Typography>
              <View style={s.methodGrid}>
                {WALLETS.map(wallet => (
                  <TouchableOpacity
                    key={wallet.id}
                    style={[s.methodCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: selectedWallet === wallet.id ? colors.foreground : colors.borderLight }]}
                    onPress={() => { haptics.buttonTap(); setSelectedWallet(wallet.id); }}
                  >
                    <Image source={{ uri: wallet.icon }} style={s.methodIcon} resizeMode="contain" />
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

      {/* ── PAY BUTTON ── */}
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

      {/* ── PROCESSING OVERLAY ── */}
      {isProcessing && (
        <View style={[StyleSheet.absoluteFill, s.overlay, { backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 9999 }]}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="sync-outline" size={48} color="rgba(255,255,255,0.6)" />
          </Animated.View>
          <Typography size={16} weight="700" color="#FFF" style={{ marginTop: 28, letterSpacing: 2 }}>
            {status === 'creating_order' ? 'INITIATING' : status === 'verifying' ? 'VERIFYING' : 'PROCESSING'}
          </Typography>
          <Typography size={11} color="rgba(255,255,255,0.5)" style={{ marginTop: 8 }}>
            {tab === 'upi' ? 'Complete payment in your UPI app...' : 'Please do not close the app...'}
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
  methodIconFallback: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  checkBadge: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  payBtn: { height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center' },
  noAppsBox: { borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, marginTop: 4 },
});
