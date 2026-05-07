import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../constants/colors';
import { Typography } from '../../components/Typography';
import CheckoutSummaryBar from '../../components/CheckoutSummaryBar';
import { useCartStore } from '../../store/cartStore';
import { formatPrice } from '../../utils/formatPrice';
import { haptics } from '../../utils/haptics';
import { config } from '../../constants/config';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';
import { openRazorpayCheckout } from '../../services/razorpayService';
import { Image } from 'expo-image';

const { width } = Dimensions.get('window');

export default function OrderReviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const colors = useColors();
  const { total, items, clearCart, shippingAddress } = useCartStore();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  
  const appliedCredit = route.params?.appliedCredit || 0;
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'razorpay' | 'cod'>(route.params?.paymentMethod || 'razorpay');
  const subtotal = total();
  const shipping = 0;
  const codFee = selectedPaymentMethod === 'cod' ? 99 : 0;
  const grandTotal = subtotal + shipping + codFee - appliedCredit;

  const handlePlaceOrder = async () => {
    if (loading) return;
    setLoading(true);
    haptics.buttonTap();

    try {
      // Get the real auth token from the store (optional for guest)
      const token = useAuthStore.getState().token || '';

      // Build order payload first
      const orderData = {
        customerId: user?.id || 'GUEST',
        customerEmail: user?.email || shippingAddress?.email || 'guest@zicabella.com',
        customerPhone: user?.phone || shippingAddress?.phone || '',
        lineItems: items.map(i => ({ 
          variantId: i.variantId, 
          productId: i.productId,
          quantity: i.quantity, 
          price: i.price,
          name: i.title,
          image: i.image,
          sku: (i as any).sku || `variant:${i.variantId}` // Ensure variant ID is encoded in SKU for Shopify sync
        })),
        appliedStoreCredits: appliedCredit,
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
          email: user?.email || shippingAddress?.email || ''
        },
        paymentMethod: selectedPaymentMethod === 'cod' ? 'COD' : 'PREPAID',
        paymentStatus: selectedPaymentMethod === 'cod' ? 'pending' : 'paid',
        total: grandTotal,
        total_price: grandTotal, // Backward compatibility
        subtotal: subtotal,
        deliveryFee: codFee,
        tags: `mobile-app, AppOrder, ${selectedPaymentMethod === 'cod' ? 'COD' : 'Razorpay'}`,
        note: `Mobile app order | Payment: ${selectedPaymentMethod === 'cod' ? 'COD' : 'Razorpay'}`
      };

      let finalOrder: any = null;

      // Handle Razorpay Flow
      if (selectedPaymentMethod === 'razorpay') {
        try {
           // 1. Get payment details from Razorpay native UI
           const rzpResult = await openRazorpayCheckout({
             amount: grandTotal,
             currency: 'INR',
             email: orderData.customerEmail,
             phone: orderData.customerPhone,
             shipping_address: orderData.shippingAddress
           }, token);

           const paymentId = rzpResult.payment_id || rzpResult.razorpay_payment_id;
           const rzpOrderId = rzpResult.razorpay_order_id || rzpResult.order_id || (rzpResult.order?.id);

           if (!rzpResult || !paymentId) {
             throw new Error('Payment verification failed or was incomplete.');
           }

           // 2. Create the actual order in our DB with the verified payment info
           const res = await fetch(`${config.appUrl}/api/app/orders/create`, {
             method: 'POST',
             headers: { 
               'Content-Type': 'application/json', 
               'Accept': 'application/json',
               'Authorization': token ? `Bearer ${token}` : ''
             },
             body: JSON.stringify({
               ...orderData,
               paymentId: paymentId,
               razorpayOrderId: rzpOrderId,
             })
           });

           if (!res.ok) {
             const errJson = await res.json().catch(() => ({}));
             throw new Error(errJson.error || 'Payment was successful but we failed to record your order. Please contact support with Payment ID: ' + paymentId);
           }

           const json = await res.json();
           finalOrder = { id: json.orderId || json.id };
        } catch (e: any) {
           console.log('Payment Flow Error:', e);
           if (e.message?.toLowerCase().includes('cancel') || e.code === 2) {
              setLoading(false);
              return;
           }
           throw new Error(e.message || 'Payment failed. Please try again.');
        }
      } else {
        // Handle COD Flow
        const res = await fetch(`${config.appUrl}/api/app/orders/create`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Accept': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify(orderData)
        });

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error(`Server error (${res.status}). Please try again.`);
        }

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Failed to place order');
        }
        finalOrder = { id: json.orderId || json.id };
      }

      haptics.success();
      clearCart();
      
      // Navigate to success
      navigation.reset({
        index: 0,
        routes: [{ 
          name: 'OrderConfirmation', 
          params: { 
            orderId: finalOrder?.id || 'ZB-SUCCESS',
            orderNumber: finalOrder?.orderNumber || finalOrder?.order_number || null,
            paymentMethod: selectedPaymentMethod === 'cod' ? 'COD' : 'PREPAID',
            estimatedDelivery: '3-5 Business Days'
          } 
        }],
      });
      
    } catch (e: any) {
      console.error('Order Submission Error:', e);
      haptics.error();
      Alert.alert('Checkout Interrupted', e.message || 'Something went wrong. Please check your connection and try again.');
    } finally {
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
          <Typography size={7} color={colors.textExtraLight} weight="600" style={styles.stepTag}>STEP 5 OF 5</Typography>
          <Typography size={14} color={colors.text} weight="700">REVIEW ORDER</Typography>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scroll, { paddingBottom: 180 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Typography size={22} weight="700" color={colors.text} style={styles.title}>Final glance before dispatch.</Typography>

        <View style={styles.section}>
          <Typography size={7} weight="700" color={colors.textExtraLight} style={styles.sectionLabel}>ITEMS IN ORDER</Typography>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight, padding: 16 }]}>
            {items.map((item, idx) => (
              <View key={item.id || idx} style={[styles.itemRow, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 12, marginTop: 12 }]}>
                <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: colors.background, overflow: 'hidden' }}>
                  {item.image && <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" />}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Typography size={12} weight="600" color={colors.text} numberOfLines={1}>{item.title}</Typography>
                  <Typography size={10} color={colors.textMuted} style={{ marginTop: 4 }}>Qty: {item.quantity}</Typography>
                </View>
                <Typography size={13} weight="700" color={colors.text}>{formatPrice(Number(item.price || 0) * Number(item.quantity || 1))}</Typography>
              </View>
            ))}
          </View>
        </View>

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

        <View style={styles.section}>
          <Typography size={7} weight="700" color={colors.textExtraLight} style={styles.sectionLabel}>PAYMENT METHOD</Typography>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight, padding: 16 }]}>
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => setSelectedPaymentMethod('razorpay')}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
            >
              <View style={[styles.radio, { borderColor: selectedPaymentMethod === 'razorpay' ? colors.foreground : colors.borderLight }]}>
                {selectedPaymentMethod === 'razorpay' && <View style={[styles.radioInner, { backgroundColor: colors.foreground }]} />}
              </View>
              <View style={[styles.methodIcon, { backgroundColor: colors.background, marginLeft: 12 }]}>
                <Ionicons name="flash" size={18} color={colors.text} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Typography size={12} weight="700" color={colors.text}>Razorpay Secure</Typography>
                <Typography size={10} color={colors.textMuted} style={{ marginTop: 2 }}>UPI, Cards, Wallets</Typography>
              </View>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.borderLight, marginVertical: 0, marginBottom: 16 }]} />

            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => setSelectedPaymentMethod('cod')}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <View style={[styles.radio, { borderColor: selectedPaymentMethod === 'cod' ? colors.foreground : colors.borderLight }]}>
                {selectedPaymentMethod === 'cod' && <View style={[styles.radioInner, { backgroundColor: colors.foreground }]} />}
              </View>
              <View style={[styles.methodIcon, { backgroundColor: colors.background, marginLeft: 12 }]}>
                <Ionicons name="cash" size={18} color={colors.text} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Typography size={12} weight="700" color={colors.text}>Cash on Delivery</Typography>
                <Typography size={10} color={colors.textMuted} style={{ marginTop: 2 }}>Extra ₹99 service fee applies</Typography>
              </View>
            </TouchableOpacity>
          </View>
        </View>

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
             {appliedCredit > 0 && (
               <View style={styles.row}>
                 <Typography size={10} color={colors.success} weight="600">Store Credit Applied</Typography>
                 <Typography size={10} weight="700" color={colors.success}>- {formatPrice(appliedCredit)}</Typography>
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
        itemCount={items.length}
        total={grandTotal}
        primaryLabel={loading ? "AUTHENTICATING..." : "PLACE ORDER"}
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
  title: { letterSpacing: -0.5, marginBottom: 32 },
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { letterSpacing: 2, marginLeft: 4 },
  card: { padding: 24, borderRadius: 28, borderWidth: 1.5 },
  methodIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  divider: { height: 1, marginVertical: 16, opacity: 0.5 },
  legalBox: { marginTop: 12, paddingHorizontal: 30, opacity: 0.6 },
});
