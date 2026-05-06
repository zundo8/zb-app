import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useColors } from '../constants/colors';
import { config } from '../constants/config';
import { formatPrice } from '../utils/formatPrice';
import { useCartStore } from '../store/cartStore';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { openRazorpayCheckout } from '../services/razorpayService';
import { useThemeStore } from '../store/themeStore';
import { useUIStore } from '../store/uiStore';
import { BlurView } from 'expo-blur';
import { Typography } from '../components/Typography';
import { haptics } from '../utils/haptics';

type Address = {
  name: string;
  phone: string;
  email: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

const fields = [
  'Full name',
  'Phone number',
  'Address line 1',
  'Address line 2 (optional)',
  'City',
  'State',
  'Pincode',
] as const;

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';

  const cartItems = useCartStore((s) => s.items);
  const cartTotal = useCartStore((s) => s.total());
  const clearCart = useCartStore((s) => s.clearCart);

  const codFee = 99;
  const subtotal = cartTotal;
  const { user, updateUser } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'COD'>('ONLINE');

  const [address, setAddress] = useState<Address>({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    country: 'India',
  });
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [fetchingSaved, setFetchingSaved] = useState(false);

  // ─── Fetch Saved Addresses ────────────────────────────────────────

  const fetchSavedAddresses = useCallback(async () => {
    if (!user?.phone && !user?.email) return;
    setFetchingSaved(true);
    try {
      const params = new URLSearchParams();
      if (user?.phone) params.set('phone', user.phone);
      if (user?.email) params.set('email', user.email);
      
      const res = await fetch(`${config.appUrl}/api/app/customers/addresses?${params.toString()}`);
      const json = await res.json();
      
      if (res.ok && json.addresses && json.addresses.length > 0) {
        setSavedAddresses(json.addresses);
        // Auto-fill with the first/primary address if current form is empty
        if (!address.address1) {
          const primary = json.addresses[0];
          setAddress({
            name: primary.name || user?.name || '',
            phone: primary.phone || user?.phone || '',
            email: primary.email || user?.email || '',
            address1: primary.address1 || '',
            address2: primary.address2 || '',
            city: primary.city || '',
            state: primary.state || '',
            zip: primary.zip || '',
            country: primary.country || 'India',
          });
        }
      }
    } catch (e) {
      console.error("Fetch saved addresses error:", e);
    } finally {
      setFetchingSaved(false);
    }
  }, [user, address.address1]);

  React.useEffect(() => {
    fetchSavedAddresses();
  }, [user?.phone, user?.email]);

  const handleSelectAddress = (addr: Address) => {
    haptics.buttonTap();
    setAddress({
      ...addr,
      name: addr.name || user?.name || '',
      phone: addr.phone || user?.phone || '',
      email: addr.email || user?.email || '',
    });
  };

  const shippingOk = useMemo(() => {
    const required: (keyof Address)[] = ['name', 'phone', 'email', 'address1', 'city', 'state', 'zip'];
    return required.every((k) => String(address[k] ?? '').trim().length > 0);
  }, [address]);

  const handleValidateShipping = () => {
    if (!shippingOk) {
      Alert.alert('Missing details', 'Please fill all required delivery fields.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    }
    return true;
  };

  const completeShopifyCheckout = async (payment?: any) => {
    const res = await fetch(`${config.appUrl}/api/checkout/complete`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${useAuthStore.getState().token || ''}`
      },
      body: JSON.stringify({
        address: {
          name: address.name,
          phone: address.phone,
          email: address.email,
          street: address.address1,
          city: address.city,
          state: address.state,
          zip: address.zip,
          country: address.country,
        },
        paymentMethod: paymentMethod === 'COD' ? 'COD' : 'UPI',
        items: cartItems.map((i: any) => ({
          id: i.id,
          productId: i.productId,
          title: i.title,
          quantity: i.quantity,
          variantId: i.variantId,
          price: i.price,
        })),
        total: paymentMethod === 'COD' ? cartTotal + codFee : cartTotal,
        subtotal,
        codFee: paymentMethod === 'COD' ? codFee : 0,
        razorpay: payment,
      }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'Checkout failed');
    return json.orderId as string;
  };

  const handlePay = async () => {
    try {
      if (!shippingOk) {
        Alert.alert('Missing details', 'Please complete the delivery form first.');
        return;
      }

      setLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      if (paymentMethod === 'COD') {
        try {
          const orderId = await completeShopifyCheckout();
          
          updateUser({
            name: address.name,
            phone: address.phone,
            email: address.email,
          });

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          clearCart();
          navigation.replace('OrderConfirmation', { orderId });
        } catch (codErr: any) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            'Order Failed', 
            codErr?.message || 'Could not place your COD order. Please try again.',
            [{ text: 'OK' }]
          );
        }
        return;
      }

      // Razorpay Flow
      const result = await openRazorpayCheckout(
        {
          amount: subtotal,
          receipt: `order_${Date.now()}`,
        },
        useAuthStore.getState().token || ''
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Payment verified — save order to DB via the existing completeShopifyCheckout
      const orderId = await completeShopifyCheckout({
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_order_id: result.razorpay_order_id,
        razorpay_signature: result.razorpay_signature,
      });
      
      updateUser({
        name: address.name,
        phone: address.phone,
        email: address.email,
      });

      clearCart();
      navigation.replace('OrderConfirmation', { orderId, paymentId: result.razorpay_payment_id });
    } catch (err: any) {
      // Silently handle user cancellation
      if (err?.code === 2 || err?.code === 0 || 
          err?.message?.includes('cancelled') || err?.message?.includes('canceled')) {
        return;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Try to get a friendly error message from Claude
      let friendlyMessage = err?.description || err?.message || 'Something went wrong. Please try again.';
      try {
        const claudeRes = await fetch(`${config.appUrl}/api/app/payment-error`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error_code: err?.code || 'UNKNOWN',
            error_description: err?.description || err?.message || 'Payment failed',
            payment_method: paymentMethod,
          }),
        });
        if (claudeRes.ok) {
          const claudeData = await claudeRes.json();
          if (claudeData.message) friendlyMessage = claudeData.message;
        }
      } catch {
        // Silently fall back to original error message
      }
      
      Alert.alert('Payment Failed', friendlyMessage, [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  };

  const inputBg = colors.surface;

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.back, { backgroundColor: colors.surface }]}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Typography size={7} color={colors.textExtraLight} weight="300" style={styles.titleTag}>CHECKOUT</Typography>
          <Typography size={14} color={colors.text} weight="700" style={styles.title}>
            STEP {step} OF 3
          </Typography>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progress}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                s <= step
                  ? [styles.progressActive, { backgroundColor: colors.foreground }]
                  : [styles.progressInactive, { backgroundColor: colors.borderLight }],
              ]}
            />
          ))}
        </View>
      </View>

      {step === 1 && (
        <View style={styles.form}>
          <Typography size={22} weight="700" color={colors.text} style={styles.formTitle}>Delivery</Typography>
          <Typography size={12} color={colors.textMuted} style={styles.formSub}>Where should we send your pieces?</Typography>

          <TextInput
            value={address.name}
            onChangeText={(v) => setAddress((a) => ({ ...a, name: v }))}
            placeholder="Full name"
            placeholderTextColor={colors.textExtraLight}
            style={[styles.input, { backgroundColor: inputBg, color: colors.text }]}
          />
          <TextInput
            value={address.phone}
            onChangeText={(v) => setAddress((a) => ({ ...a, phone: v }))}
            placeholder="Phone number"
            placeholderTextColor={colors.textExtraLight}
            style={[styles.input, { backgroundColor: inputBg, color: colors.text }]}
            keyboardType="phone-pad"
          />
          <TextInput
            value={address.address1}
            onChangeText={(v) => setAddress((a) => ({ ...a, address1: v }))}
            placeholder="Address line 1"
            placeholderTextColor={colors.textExtraLight}
            style={[styles.input, { backgroundColor: inputBg, color: colors.text }]}
          />
          <TextInput
            value={address.address2 ?? ''}
            onChangeText={(v) => setAddress((a) => ({ ...a, address2: v }))}
            placeholder="Address line 2 (optional)"
            placeholderTextColor={colors.textExtraLight}
            style={[styles.input, { backgroundColor: inputBg, color: colors.text }]}
          />
          <TextInput
            value={address.city}
            onChangeText={(v) => setAddress((a) => ({ ...a, city: v }))}
            placeholder="City"
            placeholderTextColor={colors.textExtraLight}
            style={[styles.input, { backgroundColor: inputBg, color: colors.text }]}
          />
          <TextInput
            value={address.state}
            onChangeText={(v) => setAddress((a) => ({ ...a, state: v }))}
            placeholder="State"
            placeholderTextColor={colors.textExtraLight}
            style={[styles.input, { backgroundColor: inputBg, color: colors.text }]}
          />
          <TextInput
            value={address.email}
            onChangeText={(v) => setAddress((a) => ({ ...a, email: v }))}
            placeholder="Email address"
            placeholderTextColor={colors.textExtraLight}
            style={[styles.input, { backgroundColor: inputBg, color: colors.text }]}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            value={address.zip}
            onChangeText={(v) => setAddress((a) => ({ ...a, zip: v }))}
            placeholder="Pincode"
            placeholderTextColor={colors.textExtraLight}
            style={[styles.input, { backgroundColor: inputBg, color: colors.text }]}
            keyboardType="number-pad"
          />

          {/* Saved Addresses Selector */}
          {savedAddresses.length > 0 && (
            <View style={styles.savedSection}>
              <Typography size={7} color={colors.textExtraLight} weight="600" style={styles.savedTitle}>SAVED ADDRESSES</Typography>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.savedScroll}
              >
                {savedAddresses.map((item, idx) => (
                  <TouchableOpacity 
                    key={idx}
                    style={[
                      styles.savedCard, 
                      { backgroundColor: colors.surface, borderColor: address.address1 === item.address1 ? colors.primary : colors.borderLight }
                    ]}
                    onPress={() => handleSelectAddress(item)}
                    activeOpacity={0.7}
                  >
                    <Typography size={10} color={colors.text} weight="600" numberOfLines={1}>{item.name}</Typography>
                    <Typography size={8} color={colors.textSecondary} numberOfLines={2} style={{ marginTop: 4 }}>
                      {item.address1}, {item.city}
                    </Typography>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: colors.foreground }]}
            onPress={() => {
              haptics.buttonTap();
              if (handleValidateShipping()) setStep(2);
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Review Order"
          >
            <Typography size={10} weight="700" color={colors.background} style={styles.ctaText}>Review Order</Typography>
          </TouchableOpacity>

          <View style={styles.noteRow}>
            <Text style={[styles.noteText, { color: colors.textMuted }]}>
              {fields[0]} • {fields[1]} • {fields[4]} • {fields[5]} • {fields[6]}
            </Text>
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={styles.form}>
          <Typography size={22} weight="700" color={colors.text} style={styles.formTitle}>Review</Typography>
          <Typography size={12} color={colors.textMuted} style={styles.formSub}>Confirm your delivery details.</Typography>

          <View style={[styles.summaryCard, { backgroundColor: 'transparent', borderColor: colors.borderLight }]}>
            <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <Typography size={8} weight="700" color={colors.textExtraLight} style={styles.sectionLabel}>DELIVERY</Typography>
            <Typography size={14} color={colors.text} weight="500" style={styles.summaryLine}>{address.name}</Typography>
            <Typography size={14} color={colors.text} weight="500" style={styles.summaryLine}>{address.phone}</Typography>
            <Typography size={14} color={colors.text} weight="500" style={styles.summaryLine}>
              {address.address1}
              {address.address2 ? `, ${address.address2}` : ''}
            </Typography>
            <Typography size={14} color={colors.text} weight="500" style={styles.summaryLine}>
              {address.city}, {address.state} {address.zip}
            </Typography>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: 'transparent', borderColor: colors.borderLight }]}>
            <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View style={styles.summaryRow}>
              <Typography size={13} weight="500" color={colors.textMuted}>Subtotal</Typography>
              <Typography size={13} weight="600" color={colors.text}>{formatPrice(subtotal)}</Typography>
            </View>
            <View style={styles.summaryRow}>
              <Typography size={13} weight="500" color={colors.textMuted}>Shipping</Typography>
              <Typography size={13} weight="600" color={colors.success}>Free</Typography>
            </View>
            {paymentMethod === 'COD' && (
              <View style={styles.summaryRow}>
                <Typography size={13} weight="500" color={colors.textMuted}>COD Fee</Typography>
                <Typography size={13} weight="600" color={colors.text}>{formatPrice(codFee)}</Typography>
              </View>
            )}
            <View style={[styles.divider, { backgroundColor: colors.borderExtraLight }]} />
            <View style={styles.summaryRow}>
              <Typography size={14} weight="700" color={colors.text}>Total</Typography>
              <Typography size={18} weight="800" color={colors.text} style={{ letterSpacing: -0.5 }}>
                {formatPrice(paymentMethod === 'COD' ? subtotal + codFee : subtotal)}
              </Typography>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: colors.foreground }]}
            onPress={() => {
              haptics.buttonTap();
              setStep(3);
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Continue to Payment"
          >
            <Typography size={10} weight="700" color={colors.background} style={styles.ctaText}>Continue to Payment</Typography>
          </TouchableOpacity>
        </View>
      )}

      {step === 3 && (
        <View style={styles.form}>
          <Typography size={22} weight="700" color={colors.text} style={styles.formTitle}>Payment</Typography>
          <Typography size={12} color={colors.textMuted} style={styles.formSub}>Select how you'd like to pay.</Typography>

          <View style={styles.paymentOptions}>
            <TouchableOpacity
              style={[
                styles.paymentOption,
                { backgroundColor: colors.surface, borderColor: paymentMethod === 'ONLINE' ? colors.foreground : colors.borderLight }
              ]}
              onPress={() => {
                haptics.buttonTap();
                setPaymentMethod('ONLINE');
              }}
            >
              <View style={[styles.radio, { borderColor: colors.borderLight }]}>
                {paymentMethod === 'ONLINE' && <View style={[styles.radioDot, { backgroundColor: colors.foreground }]} />}
              </View>
              <View>
                <Typography size={14} weight="700" color={colors.text}>Online Payment</Typography>
                <Typography size={10} color={colors.textMuted} style={{ marginTop: 2 }}>Razorpay • UPI, Card, Netbanking</Typography>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.paymentOption,
                { backgroundColor: colors.surface, borderColor: paymentMethod === 'COD' ? colors.foreground : colors.borderLight }
              ]}
              onPress={() => {
                haptics.buttonTap();
                setPaymentMethod('COD');
              }}
            >
              <View style={[styles.radio, { borderColor: colors.borderLight }]}>
                {paymentMethod === 'COD' && <View style={[styles.radioDot, { backgroundColor: colors.foreground }]} />}
              </View>
              <View>
                <Typography size={14} weight="700" color={colors.text}>Cash on Delivery</Typography>
                <Typography size={10} color={colors.textMuted} style={{ marginTop: 2 }}>Pay ₹99 extra for COD delivery</Typography>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: colors.foreground }]}
            onPress={handlePay}
            disabled={loading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={paymentMethod === 'COD' ? 'Place Order via Cash on Delivery' : 'Pay Online'}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Typography size={10} weight="700" color={colors.background} style={styles.ctaText}>
                {paymentMethod === 'COD' ? 'Place Order' : `Pay ${formatPrice(subtotal)}`}
              </Typography>
            )}
          </TouchableOpacity>

          <Typography size={8} weight="700" color={colors.textExtraLight} style={styles.secureText}>SECURE CHECKOUT</Typography>
        </View>
      )}

      {step === 1 && (
        <View style={styles.noteRow}>
          <Typography size={10} color={colors.textMuted} style={styles.noteText}>
            {fields[0]} • {fields[1]} • {fields[4]} • {fields[5]} • {fields[6]}
          </Typography>
        </View>
      )}

      <View style={{ height: 40 + insets.bottom }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  back: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  titleTag: { letterSpacing: 3, marginBottom: 2 },
  title: { letterSpacing: -0.3 },
  progressContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  progress: { flexDirection: 'row', gap: 6 },
  progressDot: { height: 4, borderRadius: 2 },
  progressActive: { width: 32 },
  progressInactive: { width: 8 },
  form: { paddingHorizontal: 20, gap: 12 },
  formTitle: { letterSpacing: -0.5, marginBottom: 4 },
  formSub: { marginBottom: 12 },
  input: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, fontSize: 13, marginTop: 4 },
  ctaButton: { paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 12 },
  ctaText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 },
  summaryCard: { padding: 18, borderRadius: 16, borderWidth: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryLabel: { fontSize: 13, fontWeight: '500' },
  summaryValue: { fontSize: 13, fontWeight: '600' },
  divider: { height: 1, marginVertical: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8 },
  summaryLine: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  totalLabel: { fontSize: 13, fontWeight: '700' },
  totalValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  secureText: { textAlign: 'center', fontSize: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, marginTop: 16 },
  noteRow: { marginTop: 4 },
  noteText: { fontSize: 11, fontWeight: '400', lineHeight: 16 },
  paymentOptions: { gap: 12, marginTop: 8 },
  paymentOption: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 16, 
    borderWidth: 1.5,
    gap: 16 
  },
  paymentLabel: { fontSize: 13, fontWeight: '700' },
  paymentSub: { fontSize: 10, fontWeight: '400', marginTop: 2 },
  radio: { 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    borderWidth: 2, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  savedSection: { marginTop: 20 },
  savedTitle: { letterSpacing: 2, marginBottom: 12, marginLeft: 4 },
  savedScroll: { gap: 12, paddingRight: 20 },
  savedCard: {
    width: 160,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
});
