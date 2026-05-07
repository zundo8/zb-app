import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
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
import { useAuthStore } from '../../store/authStore';
import { openRazorpayCheckout } from '../../services/razorpayService';
import { navigationRef } from '../../navigation/navigationUtils';

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const { total, items, shippingAddress } = useCartStore();
  const { user } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'PREPAID' | null>(null);
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const subtotal = useMemo(() => total(), [total]);
  const deliveryFee = 0;
  const grandTotal = subtotal + deliveryFee;

  const continueToReview = async () => {
    if (!paymentMethod) {
      setInlineError('Please select a payment option.');
      return;
    }
    
    haptics.buttonTap();
    navigation.navigate('OrderReview', { 
      paymentMethod: paymentMethod === 'COD' ? 'cod' : 'razorpay' 
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')} style={[styles.back, { backgroundColor: colors.surface }]}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Typography size={7} color={colors.textExtraLight} weight="600" style={styles.stepTag}>PAYMENT</Typography>
          <Typography size={14} color={colors.text} weight="700">ORDER SUMMARY</Typography>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Typography size={22} weight="700" color={colors.text} style={styles.title}>Review & pay.</Typography>

        {/* Compact order summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Typography size={7} weight="700" color={colors.textExtraLight} style={{ letterSpacing: 2, marginBottom: 12 }}>
            ORDER SUMMARY
          </Typography>
          {(items || []).slice(0, 3).map((it: any) => (
            <View key={it.id} style={styles.summaryItemRow}>
              <View style={[styles.thumb, { backgroundColor: colors.background }]}>
                <Ionicons name="shirt-outline" size={16} color={colors.textExtraLight} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Typography size={11} weight="600" color={colors.text} numberOfLines={1}>{it.title}</Typography>
                <Typography size={9} color={colors.textExtraLight} style={{ marginTop: 2 }}>
                  Qty: {it.quantity}{it.size ? ` • ${it.size}` : ''}
                </Typography>
              </View>
              <Typography size={11} weight="700" color={colors.text}>
                {formatPrice(parseFloat(it.price) * it.quantity)}
              </Typography>
            </View>
          ))}
          {items.length > 3 && (
            <Typography size={9} color={colors.textExtraLight} style={{ marginTop: 8 }}>
              +{items.length - 3} more item(s)
            </Typography>
          )}
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <View style={styles.row}>
            <Typography size={10} color={colors.textMuted} weight="500">Subtotal</Typography>
            <Typography size={10} color={colors.text} weight="700">{formatPrice(subtotal)}</Typography>
          </View>
          <View style={styles.row}>
            <Typography size={10} color={colors.textMuted} weight="500">Delivery</Typography>
            <Typography size={10} color={colors.text} weight="700">{deliveryFee === 0 ? 'FREE' : formatPrice(deliveryFee)}</Typography>
          </View>
          <View style={[styles.row, { marginTop: 6 }]}>
            <Typography size={12} color={colors.text} weight="800">Total</Typography>
            <Typography size={14} color={colors.text} weight="800">{formatPrice(grandTotal)}</Typography>
          </View>
        </View>

        {/* Payment selection */}
        <View style={{ marginTop: 18, gap: 12 }}>
          <TouchableOpacity
            style={[
              styles.optionCard,
              { backgroundColor: colors.surface, borderColor: paymentMethod === 'COD' ? colors.foreground : colors.borderLight },
            ]}
            onPress={() => { haptics.buttonTap(); setPaymentMethod('COD'); }}
            activeOpacity={0.8}
          >
            <View style={[styles.iconBox, { backgroundColor: paymentMethod === 'COD' ? colors.foreground : colors.background }]}>
              <Ionicons name="cash-outline" size={18} color={paymentMethod === 'COD' ? colors.background : colors.textMuted} />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Typography size={12} weight="800" color={colors.text}>Cash on Delivery</Typography>
              <Typography size={9} weight="600" color={colors.textExtraLight} style={{ marginTop: 4 }}>Pay when it arrives</Typography>
            </View>
            <View style={[styles.radio, { borderColor: paymentMethod === 'COD' ? colors.foreground : colors.borderLight }]}>
              {paymentMethod === 'COD' && <View style={[styles.radioDot, { backgroundColor: colors.foreground }]} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionCard,
              { backgroundColor: colors.surface, borderColor: paymentMethod === 'PREPAID' ? colors.foreground : colors.borderLight },
            ]}
            onPress={() => { haptics.buttonTap(); setPaymentMethod('PREPAID'); }}
            activeOpacity={0.8}
          >
            <View style={[styles.iconBox, { backgroundColor: paymentMethod === 'PREPAID' ? colors.foreground : colors.background }]}>
              <Ionicons name="flash-outline" size={18} color={paymentMethod === 'PREPAID' ? colors.background : colors.textMuted} />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Typography size={12} weight="800" color={colors.text}>Pay Now</Typography>
              <Typography size={9} weight="600" color={colors.textExtraLight} style={{ marginTop: 4 }}>UPI / Card / Netbanking via Razorpay</Typography>
            </View>
            <View style={[styles.radio, { borderColor: paymentMethod === 'PREPAID' ? colors.foreground : colors.borderLight }]}>
              {paymentMethod === 'PREPAID' && <View style={[styles.radioDot, { backgroundColor: colors.foreground }]} />}
            </View>
          </TouchableOpacity>
        </View>

        {inlineError && (
          <View style={{ marginTop: 14, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,59,48,0.08)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.15)' }}>
            <Typography size={10} weight="700" color={colors.error}>{inlineError}</Typography>
          </View>
        )}
      </ScrollView>

      {/* Summary Bar */}
      <CheckoutSummaryBar 
        itemCount={items.length}
        total={grandTotal}
        primaryLabel={loading ? "REDIRECTING..." : "REVIEW ORDER"}
        onPrimaryPress={continueToReview}
        disabled={!paymentMethod || loading}
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
  summaryCard: { padding: 20, borderRadius: 24, borderWidth: 1.5 },
  summaryItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  thumb: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  divider: { height: 1, marginVertical: 14, opacity: 0.6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
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
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
