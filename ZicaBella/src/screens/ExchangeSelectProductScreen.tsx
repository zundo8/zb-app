import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import GlassHeader from '../components/GlassHeader';
import { Typography } from '../components/Typography';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { formatPrice } from '../utils/formatPrice';
import { useAuthStore } from '../store/authStore';
import { config } from '../constants/config';
import { haptics } from '../utils/haptics';
import { useUIStore } from '../store/uiStore';
import { useEffect } from 'react';

export default function ExchangeSelectProductScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { order } = route.params || {};
  const colors = useColors();

  const setTabBarVisible = useUIStore(s => s.setTabBarVisible);
  useEffect(() => {
    setTabBarVisible(false);
    return () => setTabBarVisible(true);
  }, []);

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Typography color={colors.text}>Order details are missing.</Typography>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')} style={{ marginTop: 20 }}>
          <Typography color={colors.iosBlue}>Go Back</Typography>
        </TouchableOpacity>
      </View>
    );
  }
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  // Mapping of orderItemId -> replacement productId
  const [replacements, setReplacements] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleSelection = (itemId: string) => {
    haptics.buttonTap();
    const newSet = new Set(selectedItems);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedItems(newSet);
  };

  const calculatePriceDifference = () => {
    let diff = 0;
    for (const itemId of selectedItems) {
      const originalItem = order.items.find((i: any) => i.id === itemId);
      const replacement = replacements[itemId];
      if (originalItem && replacement) {
        diff += (replacement.price - originalItem.price) * originalItem.quantity;
      }
    }
    return diff;
  };

  const priceDifference = calculatePriceDifference();

  const handleReplacementSelect = (itemId: string) => {
    navigation.navigate('Shop', {
      onSelectReplacement: (product: any) => {
        setReplacements(prev => ({ ...prev, [itemId]: product }));
        navigation.navigate('ExchangeSelectProduct', { order }); // go back
      }
    });
  };

  const handleSubmit = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('Error', 'Please select at least one item to exchange');
      return;
    }

    for (const itemId of selectedItems) {
      if (!replacements[itemId]) {
        Alert.alert('Error', 'Please select a replacement for all selected items');
        return;
      }
    }

    // Direct exchange if no extra payment, otherwise mock payment for now
    if (priceDifference > 0) {
      // In real app, integrate Razorpay here
      Alert.alert('Payment Required', `You need to pay ${formatPrice(priceDifference)} difference. Proceed to mock payment?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay & Submit', onPress: () => processExchange('mock_payment_id') }
      ]);
    } else {
      processExchange(null);
    }
  };

  const processExchange = async (paymentId: string | null) => {
    setIsSubmitting(true);
    try {
      const token = useAuthStore.getState().token;
      const user = useAuthStore.getState().user;

      const exchangeItemsPayload = Array.from(selectedItems).map(itemId => {
        const item = order.items.find((i: any) => i.id === itemId);
        const rep = replacements[itemId];
        return {
          orderItemId: itemId,
          quantity: item.quantity,
          replacementProductId: rep.id,
          replacementVariant: { size: rep.size || 'M', color: rep.color || 'Black' }
        };
      });

      const res = await fetch(`${config.appUrl}/api/exchanges/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId: order.id,
          userId: user?.id,
          exchangeItems: exchangeItemsPayload,
          paymentDetails: {
            priceDifference,
            paymentId,
            paymentMethod: paymentId ? 'razorpay' : 'cod'
          }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit exchange request');

      haptics.success();
      Alert.alert('Success', 'Your exchange request has been submitted successfully.', [
        { text: 'OK', onPress: () => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main') }
      ]);
    } catch (err: any) {
      console.error(err);
      haptics.error();
      Alert.alert('Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getItemImage = (item: any): string | null => {
    if (item.image) return item.image;
    if (item.imageUrl) return item.imageUrl;
    if (item.product?.image) return item.product.image;
    if (item.product?.images?.[0]) return item.product.images[0];
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader title="Request Exchange" showBack />
      
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 70, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Typography size={14} weight="700" color={colors.text}>Select items to exchange</Typography>
          <Typography size={12} color={colors.textMuted} style={{ marginTop: 4 }}>
            Choose the items you want to return and select their replacements.
          </Typography>
        </View>

        {order.items?.map((item: any) => {
          const isSelected = selectedItems.has(item.id);
          const imgUrl = getItemImage(item);
          const rep = replacements[item.id];

          return (
            <View key={item.id} style={[styles.itemCard, { borderColor: isSelected ? colors.foreground : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') }]}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => toggleSelection(item.id)}
                style={styles.itemHeader}
              >
                <View style={[styles.checkbox, { borderColor: isSelected ? colors.foreground : colors.borderLight, backgroundColor: isSelected ? colors.foreground : 'transparent' }]}>
                  {isSelected && <Ionicons name="checkmark" size={12} color={colors.background} />}
                </View>
                <View style={[styles.itemThumb, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }]}>
                  {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <Ionicons name="shirt-outline" size={20} color={colors.textExtraLight} />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Typography size={14} weight="600" color={colors.text} numberOfLines={2}>{item.title}</Typography>
                  <Typography size={12} color={colors.textMuted} style={{ marginTop: 4 }}>Qty: {item.quantity} • {formatPrice(item.price)}</Typography>
                </View>
              </TouchableOpacity>

              {isSelected && (
                <View style={styles.replacementSection}>
                  <Typography size={12} weight="600" color={colors.text} style={{ marginBottom: 10 }}>Replacement Product</Typography>
                  
                  {rep ? (
                    <View style={styles.repCard}>
                      <View style={styles.repThumb}>
                        {rep.images?.[0] ? <Image source={{ uri: rep.images[0] }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Typography size={12} weight="600" color={colors.text} numberOfLines={1}>{rep.title}</Typography>
                        <Typography size={11} color={colors.textMuted} style={{ marginTop: 2 }}>{formatPrice(rep.price)}</Typography>
                      </View>
                      <TouchableOpacity onPress={() => handleReplacementSelect(item.id)} style={styles.changeBtn}>
                        <Typography size={10} weight="700" color={colors.text}>Change</Typography>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.selectBtn, { borderColor: colors.borderLight, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }]}
                      onPress={() => handleReplacementSelect(item.id)}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={colors.text} />
                      <Typography size={12} weight="600" color={colors.text} style={{ marginLeft: 6 }}>Select Replacement</Typography>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20), backgroundColor: isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)', borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
          <Typography size={13} color={colors.textMuted}>{priceDifference > 0 ? "Additional Payment Required" : priceDifference < 0 ? "Refund Credit" : "Price Difference"}</Typography>
          <Typography size={18} weight="800" color={priceDifference > 0 ? '#FF3B30' : priceDifference < 0 ? '#34C759' : colors.text}>
            {priceDifference > 0 ? '+' : ''}{formatPrice(Math.abs(priceDifference))}
          </Typography>
        </View>
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: selectedItems.size > 0 ? colors.foreground : colors.borderLight }]}
          disabled={selectedItems.size === 0 || isSubmitting}
          onPress={handleSubmit}
        >
          {isSubmitting ? <ActivityIndicator color={colors.background} /> : (
            <Typography size={14} weight="700" color={selectedItems.size > 0 ? colors.background : colors.textMuted}>
              {priceDifference > 0 ? 'Proceed to Payment' : 'Submit Exchange Request'}
            </Typography>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  itemCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden'
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemThumb: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginLeft: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center'
  },
  replacementSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.2)'
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12
  },
  repCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.1)'
  },
  repThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden'
  },
  changeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(150,150,150,0.2)'
  },
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  submitBtn: {
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
