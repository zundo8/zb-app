import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../constants/colors';
import { Typography } from '../../components/Typography';
import CheckoutSummaryBar from '../../components/CheckoutSummaryBar';
import { useCartStore } from '../../store/cartStore';
import { formatPrice } from '../../utils/formatPrice';
import { haptics } from '../../utils/haptics';

export default function DeliveryMethodScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const { total, items } = useCartStore();

  const [method, setMethod] = useState<'standard' | 'express'>('standard');

  const methods = [
    {
      id: 'standard',
      title: 'Standard Delivery',
      subtitle: '3–5 BUSINESS DAYS',
      price: 0,
      icon: 'cube-outline',
    },
    {
      id: 'express',
      title: 'Express Shipping',
      subtitle: '1–2 BUSINESS DAYS',
      price: 499,
      icon: 'flash-outline',
    },
  ];

  const currentTotal = total() + (method === 'express' ? 499 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')} style={[styles.back, { backgroundColor: colors.surface }]}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Typography size={7} color={colors.textExtraLight} weight="600" style={styles.stepTag}>STEP 3 OF 5</Typography>
          <Typography size={14} color={colors.text} weight="700">SHIPPING METHOD</Typography>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Typography size={22} weight="700" color={colors.text} style={styles.title}>Select your preferred pace.</Typography>

        <View style={styles.options}>
          {methods.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.optionCard,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: method === m.id ? colors.foreground : colors.borderLight 
                }
              ]}
              onPress={() => { haptics.buttonTap(); setMethod(m.id as any); }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.background }]}>
                <Ionicons 
                  name={m.icon as any} 
                  size={20} 
                  color={method === m.id ? colors.foreground : colors.textMuted} 
                />
              </View>
              
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Typography size={12} weight="700" color={colors.text}>{m.title.toUpperCase()}</Typography>
                <Typography size={8} weight="600" color={colors.textExtraLight} style={{ marginTop: 4 }}>{m.subtitle}</Typography>
              </View>

              <Typography size={12} weight="700" color={m.price === 0 ? colors.success : colors.text}>
                {m.price === 0 ? 'FREE' : formatPrice(m.price)}
              </Typography>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <Typography size={9} color={colors.textMuted} style={{ flex: 1, marginLeft: 12, lineHeight: 14 }}>
            SHIPPING TIMES ARE ESTIMATES. ORDERS ARE DISPATCHED WITHIN 24–48 HOURS OF CONFIRMATION.
          </Typography>
        </View>
      </ScrollView>

      {/* Summary Bar */}
      <CheckoutSummaryBar 
        itemCount={items.length}
        total={currentTotal}
        primaryLabel="CONTINUE TO PAYMENT"
        onPrimaryPress={() => navigation.navigate('OrderReview')}
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 40,
  }
});
