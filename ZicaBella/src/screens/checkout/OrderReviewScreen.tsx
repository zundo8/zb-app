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
  const paymentMethod = route.params?.paymentMethod || 'razorpay';
  const subtotal = total();
  const shipping = 0;
  const codFee = paymentMethod === 'cod' ? 99 : 0;
  const grandTotal = subtotal + shipping + codFee - appliedCredit;

  const handlePlaceOrder = async () => {
    if (loading) return;
    setLoading(true);
    haptics.buttonTap();

    try {
      let paymentDetails: any = null;

      // Handle Razorpay Flow
      if (paymentMethod === 'razorpay') {
        // Dynamic Key Resolution
        let razorpayKey = config.razorpay.keyId;
        
        try {
           const { openRazorpayCheckout } = require('../../services/razorpayService');
           paymentDetails = await openRazorpayCheckout(
             { amount: grandTotal },
             { 
               name: user?.name || shippingAddress?.name, 
               email: user?.email || 'customer@zicabella.com', 
               phone: user?.phone || shippingAddress?.phone 
             },
             'INTERNAL_APP_TOKEN'
           );
        } catch (e: any) {
          console.log('Payment Flow Error:', e);
          
          if (e.message?.toLowerCase().includes('cancel') || e.code === 2) {
             setLoading(false);
             return;
          }

          if (e.message?.includes('setup required') || e.message?.includes('Production env')) {
             throw new Error('Payment gateway is currently being configured for production. Please use COD or try again in a few minutes.');
          }

          throw new Error(e.message || 'Payment failed. Please verify your credentials or try again.');
        }
      }

      // API call to order creation endpoint
      const orderData = {
        customerId: user?.id || 'GUEST',
        email: user?.email || 'guest@zicabella.com',
        phone: user?.phone || shippingAddress?.phone || '',
        lineItems: items.map(i => ({ 
          variant_id: i.variantId, 
          product_id: i.productId,
          quantity: i.quantity, 
          price: i.price,
          title: i.title,
          image: i.image
        })),
        appliedStoreCredits: appliedCredit,
        shipping_address: {
          first_name: (shippingAddress?.name || user?.name || 'Zica').split(' ')[0],
          last_name: (shippingAddress?.name || user?.name || 'User').split(' ').slice(1).join(' ') || 'User',
          address1: shippingAddress?.street || 'Address not provided',
          city: shippingAddress?.city || 'New Delhi',
          zip: shippingAddress?.zip || '110001',
          country_code: 'IN',
          state: shippingAddress?.state || 'Delhi',
          district: shippingAddress?.district || '',
          phone: shippingAddress?.phone || user?.phone
        },
        financial_status: (appliedCredit >= grandTotal || paymentDetails) ? 'paid' : 'pending',
        payment_method: paymentMethod,
        payment_id: paymentDetails?.razorpay_payment_id || null,
        razorpay_order_id: paymentDetails?.razorpay_order_id || null,
        total_price: grandTotal,
        subtotal_price: subtotal,
        total_tax: 0,
        currency: 'INR'
      };

      const res = await fetch(`${config.appUrl}/api/app/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(orderData)
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Server error (${res.status}). Please try again.`);
      }

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to place order on server');
      }

      haptics.success();
      clearCart();
      
      // Navigate to success
      navigation.reset({
        index: 0,
        routes: [{ name: 'OrderConfirmation', params: { orderId: json.order?.id || json.id || 'ZB-SUCCESS' } }],
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.back, { backgroundColor: colors.surface }]}>
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
          <View style={styles.sectionHeader}>
            <Typography size={7} weight="700" color={colors.textExtraLight} style={styles.sectionLabel}>DELIVERY</Typography>
            <TouchableOpacity onPress={() => navigation.navigate('DeliveryAddress')}><Typography size={7} weight="600" color={colors.foreground}>EDIT</Typography></TouchableOpacity>
          </View>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
             <Typography size={12} weight="600" color={colors.text}>{shippingAddress?.name || user?.name}</Typography>
             <Typography size={10} color={colors.textSecondary} style={{ marginTop: 6, lineHeight: 16 }}>
                {shippingAddress?.street}{'\n'}
                {shippingAddress?.city}, {shippingAddress?.state} {shippingAddress?.zip}
             </Typography>
             <Typography size={10} color={colors.textSecondary} style={{ marginTop: 8 }}>{shippingAddress?.phone || user?.phone}</Typography>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Typography size={7} weight="700" color={colors.textExtraLight} style={styles.sectionLabel}>PAYMENT METHOD</Typography>
            <TouchableOpacity onPress={() => navigation.navigate('Payment')}><Typography size={7} weight="600" color={colors.foreground}>EDIT</Typography></TouchableOpacity>
          </View>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight, flexDirection: 'row', alignItems: 'center' }]}>
             <View style={[styles.methodIcon, { backgroundColor: colors.background }]}>
               <Ionicons 
                  name={paymentMethod === 'apple' ? 'logo-apple' : paymentMethod === 'cod' ? 'cash' : paymentMethod === 'razorpay' ? 'flash' : 'card'} 
                  size={18} 
                  color={colors.text} 
               />
             </View>
             <Typography size={11} weight="700" color={colors.text} style={{ marginLeft: 16 }}>{paymentMethod.toUpperCase()} {paymentMethod === 'razorpay' && 'SECURE'}</Typography>
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
  divider: { height: 1, marginVertical: 16, opacity: 0.5 },
  legalBox: { marginTop: 12, paddingHorizontal: 30, opacity: 0.6 },
});
