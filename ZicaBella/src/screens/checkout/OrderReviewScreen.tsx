import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../constants/colors';
import { Typography } from '../../components/Typography';
import CheckoutSummaryBar from '../../components/CheckoutSummaryBar';
import { useCartStore } from '../../store/cartStore';
import { formatPrice } from '../../utils/formatPrice';
import { haptics } from '../../utils/haptics';
import { config, getPaymentApiBaseUrl } from '../../constants/config';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';
import { Image } from 'expo-image';

const { width } = Dimensions.get('window');

export default function OrderReviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const { total, items, clearCart, shippingAddress, buyNowItem, setBuyNowItem } = useCartStore();
  const checkoutItems = buyNowItem ? [buyNowItem] : items;
  const checkoutTotal = buyNowItem ? parseFloat(buyNowItem.price) * buyNowItem.quantity : total();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');

  // ─── Payment State ──────────────────────────────────────────────
  const [pendingOrderData, setPendingOrderData] = useState<any>(null);

  // ─── Promo Code State ────────────────────────────────────────────────
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    type: string;
    value: number;
    discountAmount: number;
  } | null>(null);

  const subtotal = checkoutTotal;
  const shipping = 0;
  const codFee = selectedPaymentMethod === 'cod' ? 99 : 0;
  const discountAmount = appliedDiscount?.discountAmount ?? 0;
  const grandTotal = Math.max(0, subtotal + shipping + codFee - discountAmount);

  // ─── Promo Code Handlers ─────────────────────────────────────────────
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError(null);

    try {
      const res = await fetch(`${config.appUrl}/api/app/discounts/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim(), orderAmount: subtotal }),
      });
      const data = await res.json();

      if (data.success) {
        haptics.success();
        setAppliedDiscount(data.discount);
        setPromoError(null);
      } else {
        haptics.error();
        setPromoError(data.error || 'Invalid promo code');
        setAppliedDiscount(null);
      }
    } catch (e) {
      haptics.error();
      setPromoError('Could not validate code. Please try again.');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    haptics.buttonTap();
    setAppliedDiscount(null);
    setPromoCode('');
    setPromoError(null);
  };

  // ─── Build the shared order payload ──────────────────────────────────
  const buildOrderData = () => {
    return {
      customerId: user?.id || 'GUEST',
      customerEmail: user?.email || shippingAddress?.email || 'guest@zicabella.com',
      customerPhone: user?.phone || shippingAddress?.phone || '',
      lineItems: checkoutItems.map((i: any) => ({
        variantId: i.variantId,
        productId: i.productId,
        quantity: i.quantity,
        price: i.price,
        name: i.title,
        image: i.image,
        sku: i.sku || `variant:${i.variantId}`,
      })),
      appliedStoreCredits: 0,
      discountCode: appliedDiscount?.code || null,
      discountAmount,
      shippingAddress: {
        name: shippingAddress?.name || user?.name || 'Zica User',
        first_name: (shippingAddress?.name || user?.name || 'Zica').split(' ')[0],
        last_name: (shippingAddress?.name || user?.name || 'User').split(' ').slice(1).join(' ') || 'User',
        line1: shippingAddress?.street || shippingAddress?.line1 || 'Address not provided',
        line2: shippingAddress?.line2 || '',
        city: shippingAddress?.city || 'New Delhi',
        state: shippingAddress?.state || 'Delhi',
        pincode: shippingAddress?.zip || shippingAddress?.pincode || '110001',
        country: 'India',
        phone: shippingAddress?.phone || user?.phone || '',
        email: user?.email || shippingAddress?.email || '',
      },
      paymentMethod: selectedPaymentMethod === 'cod' ? 'COD' : 'PREPAID',
      paymentStatus: selectedPaymentMethod === 'cod' ? 'pending' : 'paid',
      total: grandTotal,
      total_price: grandTotal,
      subtotal,
      deliveryFee: codFee,
      tags: `mobile-app, AppOrder, ${selectedPaymentMethod === 'cod' ? 'COD' : 'Razorpay'}`,
      note: `Mobile app order | Payment: ${selectedPaymentMethod === 'cod' ? 'COD' : 'Razorpay'}`,
    };
  };

  // ─── Place Order (COD) or open PaymentSheet (Razorpay) ───────────────
  const handlePlaceOrder = async () => {
    if (loading) return;
    haptics.buttonTap();

    const token = useAuthStore.getState().token || '';
    const orderData = buildOrderData();

    if (selectedPaymentMethod === 'cod') {
      setLoading(true);
      try {
        const res = await fetch(`${config.appUrl}/api/app/orders/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify(orderData),
        });
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) throw new Error(`Server error (${res.status})`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to place order');
        haptics.success();
        buyNowItem ? setBuyNowItem(null) : clearCart();
        navigation.getParent()?.reset({
            index: 1,
            routes: [
              { name: 'Main' },
              { name: 'OrderConfirmation', params: { orderId: json.orderId || json.id, paymentMethod: 'COD', estimatedDelivery: '3-5 Business Days' } }
            ],
          });
      } catch (e: any) {
        haptics.error();
        Alert.alert('Order Failed', e.message || 'Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Razorpay: Step 1 — create order on backend, then navigate to Payment Screen
    setLoading(true);
    try {
      const apiBase = getPaymentApiBaseUrl();
      const orderRes = await fetch(`${apiBase}/api/app/payment/create-order`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Accept': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ 
          amount: grandTotal, 
          currency: 'INR', 
          receipt: `zb_${Date.now()}`,
          orderData: orderData // Pass the full order data to pre-create the record
        }),
      });
      
      const resText = await orderRes.text();
      let orderJson: any;
      try {
        orderJson = JSON.parse(resText);
      } catch (e) {
        throw new Error(`Server returned HTML instead of JSON. Check if your backend is running at ${apiBase}`);
      }

      if (!orderRes.ok || !orderJson.order_id) {
        throw new Error(orderJson.error || 'Failed to create payment order.');
      }
      if (!orderJson.key_id || !String(orderJson.key_id).startsWith('rzp_')) {
        throw new Error('Invalid Razorpay key. Please contact support.');
      }
      
      setLoading(false);
      
      navigation.navigate('RazorpayPayment', {
        amount: grandTotal,
        orderId: orderJson.order_id,
        razorpayKeyId: orderJson.key_id,
        prefill: {
          name: shippingAddress?.name || user?.name || '',
          email: user?.email || shippingAddress?.email || '',
          contact: (user?.phone || shippingAddress?.phone || '').replace(/^\+91/, ''),
        },
        orderData: orderData,
      });
    } catch (e: any) {
      haptics.error();
      Alert.alert('Payment Error', e.message || 'Could not start payment. Please try again.');
      setLoading(false);
    }
  };



  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')} style={[styles.back, { backgroundColor: colors.surface }]}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Typography size={7} color={colors.textExtraLight} weight="600" style={styles.stepTag}>STEP 2 OF 2</Typography>
          <Typography size={14} color={colors.text} weight="700">REVIEW & PAY</Typography>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scroll, { paddingBottom: 180 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── ITEMS IN ORDER ─── */}
        <View style={styles.section}>
          <Typography size={7} weight="700" color={colors.textExtraLight} style={styles.sectionLabel}>ITEMS IN ORDER</Typography>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight, padding: 16 }]}>
            {checkoutItems.map((item, idx) => (
              <View key={item.id || idx} style={[styles.itemRow, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 12, marginTop: 12 }]}>
                <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: colors.background, overflow: 'hidden' }}>
                  {item.image && <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" />}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Typography size={12} weight="600" color={colors.text} numberOfLines={1}>{item.title}</Typography>
                  <Typography size={10} color={colors.textMuted} style={{ marginTop: 4 }}>
                    Qty: {item.quantity}{(item as any).size ? ` · ${(item as any).size}` : ''}
                  </Typography>
                </View>
                <Typography size={13} weight="700" color={colors.text}>{formatPrice(Number(item.price || 0) * Number(item.quantity || 1))}</Typography>
              </View>
            ))}
          </View>
        </View>

        {/* ─── DELIVERY ADDRESS ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Typography size={7} weight="700" color={colors.textExtraLight} style={styles.sectionLabel}>DELIVERY</Typography>
            <TouchableOpacity onPress={() => navigation.navigate('DeliveryAddress')}><Typography size={7} weight="600" color={colors.foreground}>EDIT</Typography></TouchableOpacity>
          </View>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
             <Typography size={12} weight="600" color={colors.text}>{shippingAddress?.name || user?.name}</Typography>
             <Typography size={10} color={colors.textSecondary} style={{ marginTop: 6, lineHeight: 16 }}>
                {shippingAddress?.street || shippingAddress?.line1}{'\n'}
                {shippingAddress?.city}, {shippingAddress?.state} {shippingAddress?.zip || shippingAddress?.pincode}
             </Typography>
             <Typography size={10} color={colors.textSecondary} style={{ marginTop: 8 }}>{shippingAddress?.phone || user?.phone}</Typography>
          </View>
        </View>

        {/* ─── PROMO CODE ─── */}
        <View style={styles.section}>
          <View style={[styles.promoSection, { borderColor: colors.borderLight }]}>
            <Typography size={7} weight="700" color={colors.textExtraLight} style={styles.promoLabel}>
              PROMO CODE
            </Typography>

            {appliedDiscount ? (
              <View style={[styles.promoApplied, { backgroundColor: 'rgba(52,199,89,0.08)', borderColor: 'rgba(52,199,89,0.2)' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Ionicons name="checkmark-circle" size={18} color="#34C759" />
                  <View>
                    <Typography size={11} weight="800" color="#34C759">{appliedDiscount.code}</Typography>
                    <Typography size={9} color="#34C759" style={{ opacity: 0.8 }}>
                      {appliedDiscount.type === 'percentage'
                        ? `${appliedDiscount.value}% off applied`
                        : `₹${appliedDiscount.value} off applied`}
                      {' · '}Saving {formatPrice(discountAmount)}
                    </Typography>
                  </View>
                </View>
                <TouchableOpacity onPress={handleRemovePromo} style={styles.removeBtn}>
                  <Ionicons name="close-circle" size={20} color="rgba(52,199,89,0.5)" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.promoRow}>
                <TextInput
                  value={promoCode}
                  onChangeText={(v) => { setPromoCode(v.toUpperCase()); setPromoError(null); }}
                  placeholder="Enter promo code"
                  placeholderTextColor={colors.textExtraLight}
                  autoCapitalize="characters"
                  style={[styles.promoInput, { 
                    backgroundColor: colors.surface, 
                    borderColor: promoError ? 'rgba(255,59,48,0.4)' : colors.borderLight, 
                    color: colors.text 
                  }]}
                />
                <TouchableOpacity
                  onPress={handleApplyPromo}
                  disabled={promoLoading || !promoCode.trim()}
                  style={[styles.applyBtn, { 
                    backgroundColor: promoCode.trim() ? colors.foreground : colors.surface,
                    opacity: !promoCode.trim() ? 0.4 : 1,
                  }]}
                >
                  {promoLoading ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <Typography size={9} weight="800" color={promoCode.trim() ? colors.background : colors.textMuted} style={{ letterSpacing: 1 }}>
                      APPLY
                    </Typography>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {promoError && (
              <View style={styles.promoErrorRow}>
                <Ionicons name="alert-circle-outline" size={12} color="rgba(255,59,48,0.8)" />
                <Typography size={9} color="rgba(255,59,48,0.8)" weight="600" style={{ marginLeft: 4 }}>
                  {promoError}
                </Typography>
              </View>
            )}
          </View>
        </View>

        {/* ─── PAYMENT METHOD ─── */}
        <View style={styles.section}>
          <Typography size={7} weight="700" color={colors.textExtraLight} style={styles.sectionLabel}>PAYMENT METHOD</Typography>
          <View style={{ gap: 12 }}>
            <TouchableOpacity
              style={[
                styles.optionCard,
                { backgroundColor: colors.surface, borderColor: selectedPaymentMethod === 'razorpay' ? colors.foreground : colors.borderLight },
              ]}
              onPress={() => { haptics.buttonTap(); setSelectedPaymentMethod('razorpay'); }}
              activeOpacity={0.8}
            >
              <View style={[styles.iconBox, { backgroundColor: selectedPaymentMethod === 'razorpay' ? colors.foreground : colors.background }]}>
                <Ionicons name="flash-outline" size={18} color={selectedPaymentMethod === 'razorpay' ? colors.background : colors.textMuted} />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Typography size={12} weight="800" color={colors.text}>Pay Now</Typography>
                <Typography size={9} weight="600" color={colors.textExtraLight} style={{ marginTop: 4 }}>UPI / Card / Netbanking via Razorpay</Typography>
              </View>
              <View style={[styles.radio, { borderColor: selectedPaymentMethod === 'razorpay' ? colors.foreground : colors.borderLight }]}>
                {selectedPaymentMethod === 'razorpay' && <View style={[styles.radioInner, { backgroundColor: colors.foreground }]} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionCard,
                { backgroundColor: colors.surface, borderColor: selectedPaymentMethod === 'cod' ? colors.foreground : colors.borderLight },
              ]}
              onPress={() => { haptics.buttonTap(); setSelectedPaymentMethod('cod'); }}
              activeOpacity={0.8}
            >
              <View style={[styles.iconBox, { backgroundColor: selectedPaymentMethod === 'cod' ? colors.foreground : colors.background }]}>
                <Ionicons name="cash-outline" size={18} color={selectedPaymentMethod === 'cod' ? colors.background : colors.textMuted} />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Typography size={12} weight="800" color={colors.text}>Cash on Delivery</Typography>
                <Typography size={9} weight="600" color={colors.textExtraLight} style={{ marginTop: 4 }}>Extra ₹99 service fee applies</Typography>
              </View>
              <View style={[styles.radio, { borderColor: selectedPaymentMethod === 'cod' ? colors.foreground : colors.borderLight }]}>
                {selectedPaymentMethod === 'cod' && <View style={[styles.radioInner, { backgroundColor: colors.foreground }]} />}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── ORDER SUMMARY ─── */}
        <View style={styles.section}>
          <Typography size={7} weight="700" color={colors.textExtraLight} style={styles.sectionLabel}>ORDER SUMMARY</Typography>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
             <View style={styles.row}>
               <Typography size={10} color={colors.textSecondary}>Subtotal</Typography>
               <Typography size={10} weight="600" color={colors.text}>{formatPrice(subtotal)}</Typography>
             </View>
             {codFee > 0 && (
               <View style={styles.row}>
                 <Typography size={10} color={colors.textSecondary}>COD Service Fee</Typography>
                 <Typography size={10} weight="600" color={colors.text}>{formatPrice(codFee)}</Typography>
               </View>
             )}
             <View style={styles.row}>
               <Typography size={10} color={colors.textSecondary}>Shipping</Typography>
               <Typography size={10} weight="600" color={colors.success}>FREE</Typography>
             </View>
             {discountAmount > 0 && (
               <View style={styles.row}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                   <Ionicons name="pricetag-outline" size={12} color="#34C759" />
                   <Typography size={10} color="#34C759" weight="700">{appliedDiscount?.code}</Typography>
                 </View>
                 <Typography size={10} color="#34C759" weight="700">−{formatPrice(discountAmount)}</Typography>
               </View>
             )}
             <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
             <View style={styles.row}>
               <Typography size={12} weight="700" color={colors.text}>Grand Total</Typography>
               <Typography size={18} weight="800" color={colors.text}>{formatPrice(grandTotal)}</Typography>
             </View>
          </View>
        </View>

        <View style={styles.legalBox}>
          <Typography size={8} color={colors.textMuted} style={{ textAlign: 'center', lineHeight: 14 }}>
            By placing this order, you authorize Zica Bella to charge your payment method and agree to our Terms of Service & Refund Policy.
          </Typography>
        </View>
      </ScrollView>

      {/* Summary Bar */}
      <CheckoutSummaryBar 
        itemCount={checkoutItems.length}
        total={grandTotal}
        primaryLabel={loading ? "PROCESSING..." : "PLACE ORDER"}
        onPrimaryPress={handlePlaceOrder}
        loading={loading}
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
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { letterSpacing: 2, marginLeft: 4, marginBottom: 12 },
  card: { padding: 24, borderRadius: 28, borderWidth: 1.5 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  divider: { height: 1, marginVertical: 16, opacity: 0.5 },
  legalBox: { marginTop: 12, paddingHorizontal: 30, opacity: 0.6 },
  // Payment option styles
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
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  // Promo Code styles
  promoSection: { padding: 18, borderRadius: 24, borderWidth: 1.5 },
  promoLabel: { letterSpacing: 2, marginBottom: 12 },
  promoRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  promoInput: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  applyBtn: {
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  removeBtn: { padding: 4 },
  promoErrorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingLeft: 2 },
});
