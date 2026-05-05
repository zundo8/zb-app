import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../constants/colors';
import { Typography } from '../../components/Typography';
import CheckoutSummaryBar from '../../components/CheckoutSummaryBar';
import { useCartStore } from '../../store/cartStore';
import { haptics } from '../../utils/haptics';
import { useAuth } from '../../hooks/useAuth';
import { config } from '../../constants/config';
import { formatPrice } from '../../utils/formatPrice';

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const { total, items } = useCartStore();
  const { user } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'card' | 'apple' | 'google' | 'cod' | 'others'>('razorpay');
  const [storeCredits, setStoreCredits] = useState(0);
  const [useStoreCredit, setUseStoreCredit] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState(false);

  useEffect(() => {
    fetchStoreCredits();
  }, []);

  const fetchStoreCredits = async () => {
    if (!user) return;
    setLoadingCredits(true);
    try {
      const res = await fetch(`${config.appUrl}/api/app/store-credits?customerId=${user.id}`);
      const json = await res.json();
      if (res.ok && json.balance !== undefined) {
        setStoreCredits(json.balance);
      }
    } catch (e) {
      console.error('Fetch store credits error:', e);
    } finally {
      setLoadingCredits(false);
    }
  };

  const methods = [
    { 
      id: 'razorpay', 
      title: 'RAZORPAY SECURE', 
      icon: 'flash', 
      subtitle: 'UPI, CARDS, NETBANKING', 
      badge: 'POPULAR',
      logo: 'https://cdn.razorpay.com/static/assets/logo/payment_method_razorpay.png'
    },
    { 
      id: 'apple', 
      title: 'APPLE PAY', 
      icon: 'logo-apple', 
      subtitle: 'SECURE ONE-TAP PAYMENT',
      badge: 'FAST'
    },
    { 
      id: 'card', 
      title: 'CREDIT / DEBIT CARD', 
      icon: 'card', 
      subtitle: 'POWERED BY STRIPE' 
    },
    { 
      id: 'cod', 
      title: 'CASH ON DELIVERY', 
      icon: 'cash', 
      subtitle: '₹99 EXTRA SERVICE FEE' 
    },
  ];

  const subtotal = total();
  const appliedCredit = useStoreCredit ? Math.min(storeCredits, subtotal) : 0;
  const currentTotal = subtotal - appliedCredit + (paymentMethod === 'cod' ? 99 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.back, { backgroundColor: colors.surface }]}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Typography size={7} color={colors.textExtraLight} weight="600" style={styles.stepTag}>STEP 4 OF 5</Typography>
          <Typography size={14} color={colors.text} weight="700">PAYMENT METHOD</Typography>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Typography size={22} weight="700" color={colors.text} style={styles.title}>Secure your archival pieces.</Typography>

        {/* Store Credits Section */}
        {storeCredits > 0 && (
          <View style={[styles.storeCreditBlock, { backgroundColor: colors.surface, borderColor: useStoreCredit ? colors.success : colors.borderLight }]}>
            <View style={styles.storeCreditHeader}>
              <View style={[styles.creditIcon, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]}>
                <Ionicons name="wallet-outline" size={20} color={colors.success} />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Typography size={10} weight="700" color={colors.text}>STORE CREDITS</Typography>
                <Typography size={7} weight="600" color={colors.textExtraLight}>BALANCE: {formatPrice(storeCredits)}</Typography>
              </View>
              <TouchableOpacity
                onPress={() => { haptics.buttonTap(); setUseStoreCredit(!useStoreCredit); }}
                style={[styles.toggle, { backgroundColor: useStoreCredit ? colors.success : colors.borderLight }]}
              >
                <View style={[styles.toggleThumb, { transform: [{ translateX: useStoreCredit ? 20 : 2 }] }]} />
              </TouchableOpacity>
            </View>
            {useStoreCredit && (
              <View style={styles.creditAppliedRow}>
                <Typography size={8} weight="600" color={colors.success}>- {formatPrice(appliedCredit)} APPLIED</Typography>
              </View>
            )}
          </View>
        )}

        <View style={styles.options}>
          {methods.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.optionCard,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: paymentMethod === m.id ? colors.foreground : colors.borderLight 
                }
              ]}
              onPress={() => { haptics.buttonTap(); setPaymentMethod(m.id as any); }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: paymentMethod === m.id ? colors.foreground : colors.background }]}>
                <Ionicons 
                  name={m.icon as any} 
                  size={20} 
                  color={paymentMethod === m.id ? colors.background : colors.textMuted} 
                />
              </View>
              
              <View style={{ flex: 1, marginLeft: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Typography size={10} weight="700" color={colors.text}>{m.title}</Typography>
                  {m.badge && (
                    <View style={[styles.badge, { backgroundColor: m.id === 'razorpay' ? '#3399FF' : colors.foreground }]}>
                      <Typography size={6} weight="800" color="#FFF">{m.badge}</Typography>
                    </View>
                  )}
                </View>
                <Typography size={7} weight="600" color={colors.textExtraLight} style={{ marginTop: 4, letterSpacing: 1 }}>{m.subtitle}</Typography>
              </View>

              <View style={[styles.radio, { borderColor: paymentMethod === m.id ? colors.foreground : colors.borderLight }]}>
                {paymentMethod === m.id && <View style={[styles.radioDot, { backgroundColor: colors.foreground }]} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {paymentMethod === 'card' && (
          <View style={[styles.cardForm, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <Typography size={7} weight="700" color={colors.textExtraLight} style={{ marginBottom: 16, letterSpacing: 2 }}>STRIPE SECURE INPUT</Typography>
            <View style={[styles.placeholderInput, { borderColor: colors.borderLight }]}>
              <Typography size={12} color={colors.textExtraLight}>0000 0000 0000 0000</Typography>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <View style={[styles.placeholderInput, { flex: 1, borderColor: colors.borderLight }]}>
                <Typography size={12} color={colors.textExtraLight}>MM / YY</Typography>
              </View>
              <View style={[styles.placeholderInput, { width: 100, borderColor: colors.borderLight }]}>
                <Typography size={12} color={colors.textExtraLight}>CVC</Typography>
              </View>
            </View>
          </View>
        )}

        <View style={styles.secureBadge}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.success} />
          <Typography size={7} weight="700" color={colors.textExtraLight} style={{ marginLeft: 6, letterSpacing: 2 }}>ENCRYPTED SECURE PAYMENT</Typography>
        </View>
      </ScrollView>

      {/* Summary Bar */}
      <CheckoutSummaryBar 
        itemCount={items.length}
        total={currentTotal}
        primaryLabel="REVIEW ORDER"
        onPrimaryPress={() => {
          haptics.buttonTap();
          navigation.navigate('OrderReview', { appliedCredit, paymentMethod });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  back: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { alignItems: 'center' },
  stepTag: { letterSpacing: 2, marginBottom: 2 },
  scroll: { paddingHorizontal: 24, paddingTop: 20 },
  title: { letterSpacing: -0.5, marginBottom: 32 },
  storeCreditBlock: { padding: 20, borderRadius: 24, borderWidth: 1.5, marginBottom: 20 },
  storeCreditHeader: { flexDirection: 'row', alignItems: 'center' },
  creditIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  toggle: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  creditAppliedRow: { marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(52,199,89,0.1)', paddingTop: 12, alignItems: 'flex-end' },
  options: { gap: 12 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  cardForm: { padding: 24, borderRadius: 28, borderWidth: 1, marginTop: 20 },
  placeholderInput: { height: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 20, justifyContent: 'center' },
  secureBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 40, opacity: 0.7 }
});
