import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import GlassHeader from '../../components/GlassHeader';
import { useColors } from '../../constants/colors';
import { useThemeStore } from '../../store/themeStore';
import { Typography } from '../../components/Typography';
import { haptics } from '../../utils/haptics';
import { serviceApi, apiGet } from '../../api/shopify';
import { config } from '../../constants/config';
import { formatPrice } from '../../utils/formatPrice';
import { ServiceStackParamList } from '../../navigation/types';

type Step = 'SELECTION' | 'OPTIONS' | 'PAYMENT' | 'SUCCESS';

export default function ExchangeWizardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ServiceStackParamList, 'ExchangeWizard'>>();
  const { orderId } = route.params;
  const colors = useColors();
  const isDark = useThemeStore(s => s.theme) === 'dark';

  const [step, setStep] = useState<Step>('SELECTION');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [productData, setProductData] = useState<any>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        // Use the secure proxy endpoint with orderId to bypass NextAuth session blockers
        const res = await fetch(`${config.appUrl}/api/app/orders?orderId=${orderId}`);
        const json = await res.json();
        if (res.ok && json.order) {
          setOrder(json.order);
        }
      } catch (e) {
        console.error('Fetch Order Error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  const handleSelectItem = async (itemId: string, handle: string) => {
    haptics.buttonTap();
    setSelectedId(itemId);
    setLoadingOptions(true);
    try {
      // Fetch available variants for this product
      const res: any = await apiGet(`/products/${handle}`);
      setProductData(res.product);
      setStep('OPTIONS');
    } catch (e) {
      console.error('Fetch Product Error:', e);
    } finally {
      setLoadingOptions(false);
    }
  };

  const calculateDiff = () => {
    if (!selectedVariant || !selectedId) return 0;
    const oldItem = order.items.find((i: any) => i.id === selectedId);
    if (!oldItem) return 0;
    return Math.max(0, (selectedVariant.price || selectedVariant.amount) - oldItem.price);
  };

  const handleNext = () => {
    haptics.buttonTap();
    if (step === 'OPTIONS') {
      const diff = calculateDiff();
      if (diff > 0) setStep('PAYMENT');
      else submitExchange();
    } else if (step === 'PAYMENT') {
      submitExchange();
    }
  };

  const submitExchange = async () => {
    setSubmitting(true);
    try {
      const oldItem = order.items.find((i: any) => i.id === selectedId);
      const payload = {
        orderId,
        items: [{
          lineItemId: selectedId,
          newVariantId: selectedVariant.id,
          reason: 'Size/Color Exchange',
          action: 'exchange' as const,
        }],
        priceDifference: calculateDiff()
      };
      const res = await serviceApi.exchanges.create(payload);
      setResult(res);
      setStep('SUCCESS');
      haptics.success();
    } catch (e) {
      console.error('Submit Exchange Error:', e);
      haptics.error();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.foreground} /></View>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader title="INITIATE EXCHANGE" showBack />
      
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100, paddingTop: insets.top + 70 }]}>
        {step === 'SELECTION' && (
          <View>
            <Typography size={12} weight="700" color={colors.text} style={styles.stepTitle}>Select item to exchange</Typography>
            <View style={styles.itemList}>
              {order?.items?.map((item: any) => (
                <TouchableOpacity 
                  key={item.id} 
                  activeOpacity={0.8}
                  onPress={() => handleSelectItem(item.id, item.handle || 'product-handle')}
                  style={[styles.itemCard, { borderColor: selectedId === item.id ? colors.foreground : colors.borderLight, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff' }]}
                >
                  <View style={styles.itemThumb}>
                    {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} /> : <Ionicons name="shirt-outline" size={16} color={colors.textExtraLight} />}
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Typography size={10} weight="600" color={colors.text}>{item.title}</Typography>
                    <Typography size={8} color={colors.textMuted} style={{ marginTop: 2 }}>{item.size || 'M'} · {formatPrice(item.price)}</Typography>
                  </View>
                  {loadingOptions && selectedId === item.id ? <ActivityIndicator size="small" color={colors.iosBlue} /> : <Ionicons name="chevron-forward" size={16} color={colors.textExtraLight} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 'OPTIONS' && (
          <View>
            <Typography size={12} weight="700" color={colors.text} style={styles.stepTitle}>Select new option</Typography>
            <Typography size={9} weight="700" color={colors.textMuted} style={{ marginBottom: 16 }}>AVAILABLE SIZES</Typography>
            <View style={styles.chips}>
              {productData?.variants?.map((v: any) => (
                <TouchableOpacity 
                  key={v.id} 
                  disabled={v.inventory_quantity === 0}
                  onPress={() => { haptics.buttonTap(); setSelectedVariant(v); }}
                  style={[styles.variantChip, { 
                    borderColor: selectedVariant?.id === v.id ? colors.foreground : colors.borderLight,
                    backgroundColor: selectedVariant?.id === v.id ? colors.surface : 'transparent',
                    opacity: v.inventory_quantity === 0 ? 0.3 : 1
                  }]}
                >
                  <Typography size={8} weight="700" color={selectedVariant?.id === v.id ? colors.text : colors.textMuted}>{v.title.toUpperCase()}</Typography>
                  {selectedVariant?.id === v.id && (v.price > (order.items.find((i: any) => i.id === selectedId)?.price || 0)) && (
                    <Typography size={6} color={colors.warning} style={{ marginTop: 2 }}>+{formatPrice(v.price - order.items.find((i: any) => i.id === selectedId).price)}</Typography>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 'PAYMENT' && (
          <View>
            <Typography size={12} weight="700" color={colors.text} style={styles.stepTitle}>Complete Payment</Typography>
            <View style={[styles.reviewCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff', borderColor: colors.borderLight }]}>
              <Typography size={7} weight="800" color={colors.textExtraLight} style={{ letterSpacing: 1.5 }}>EXCHANGE SUMMARY</Typography>
              <View style={styles.priceRow}>
                <Typography size={10} color={colors.textMuted}>New Item Price</Typography>
                <Typography size={10} color={colors.text}>{formatPrice(selectedVariant.price)}</Typography>
              </View>
              <View style={styles.priceRow}>
                <Typography size={10} color={colors.textMuted}>Original Credit</Typography>
                <Typography size={10} color={colors.error}>-{formatPrice(order.items.find((i: any) => i.id === selectedId).price)}</Typography>
              </View>
              <View style={{ height: 1, backgroundColor: colors.borderExtraLight, marginVertical: 16 }} />
              <View style={styles.priceRow}>
                <Typography size={11} weight="800" color={colors.text}>TOTAL TO PAY</Typography>
                <Typography size={14} weight="800" color={colors.iosBlue}>{formatPrice(calculateDiff())}</Typography>
              </View>
            </View>
            <Typography size={9} color={colors.textExtraLight} style={{ marginTop: 20, textAlign: 'center' }}>Secure payment powered by Razorpay</Typography>
          </View>
        )}

        {step === 'SUCCESS' && (
          <View style={styles.successView}>
            <View style={[styles.successIcon, { backgroundColor: colors.iosBlue + '20' }]}>
              <Ionicons name="swap-horizontal" size={48} color={colors.iosBlue} />
            </View>
            <Typography size={16} weight="800" color={colors.text} style={{ marginTop: 24 }}>EXCHANGE CONFIRMED</Typography>
            <Typography size={10} color={colors.textMuted} style={{ marginTop: 8, textAlign: 'center' }}>Ref: {result?.exchangeNumber || 'ZB-EXC-4402'}</Typography>
            <Typography size={9} color={colors.textLight} style={{ marginTop: 20, textAlign: 'center', lineHeight: 16 }}>
              Your exchange order has been created. It will be shipped once we receive your original item.
            </Typography>
            <TouchableOpacity style={[styles.backBtn, { borderColor: colors.borderLight, marginTop: 40 }]} onPress={() => navigation.popToTop()}>
              <Typography size={9} weight="700" color={colors.text}>BACK TO HOME</Typography>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {step !== 'SUCCESS' && (
        <View style={styles.footer}>
          <TouchableOpacity 
            disabled={!selectedVariant || submitting}
            onPress={handleNext}
            style={[styles.nextBtn, { backgroundColor: colors.foreground, opacity: !selectedVariant ? 0.5 : 1 }]}
          >
            {submitting ? <ActivityIndicator color={colors.background} /> : <Typography size={10} weight="800" color={colors.background}>CONTINUE</Typography>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stepTitle: { marginBottom: 24, letterSpacing: -0.5 },
  itemList: { gap: 12 },
  itemCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1 },
  itemThumb: { width: 56, height: 56, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  variantChip: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 1, minWidth: '30%', alignItems: 'center' },
  reviewCard: { padding: 24, borderRadius: 24, borderWidth: 1 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  footer: { position: 'absolute', bottom: 40, left: 20, right: 20 },
  nextBtn: { height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  successView: { alignItems: 'center', paddingTop: 60 },
  successIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  backBtn: { width: '100%', height: 60, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
});
