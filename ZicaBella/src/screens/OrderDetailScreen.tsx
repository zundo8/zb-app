import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Animated, ScrollView, ActivityIndicator, Linking, Share,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassHeader from '../components/GlassHeader';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { formatPrice } from '../utils/formatPrice';
import { RootStackParamList } from '../navigation/types';
import { haptics } from '../utils/haptics';
import { config } from '../constants/config';
import { Typography } from '../components/Typography';
import { useAuthStore } from '../store/authStore';
import { Image } from 'expo-image';
import { trackOrder } from '../services/shipmentService';

export default function OrderDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'OrderDetail'>>();
  const { orderForDetail } = route.params;
  const colors = useColors();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';

  const [order, setOrder] = useState<any>(orderForDetail);
  const [loading, setLoading] = useState(false);
  const [trackingLive, setTrackingLive] = useState<any | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchOrderDetails = useCallback(async (isPolling = false) => {
    if (!order?.id) return;
    try {
      if (!isPolling) setLoading(true);
      const token = useAuthStore.getState().token || '';
      const res = await fetch(`${config.appUrl}/api/app/orders/${order.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch order');
      if (json.order) {
        setOrder(json.order);
      }
    } catch (e) {
      console.error('Fetch Order Detail Error:', e);
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [order?.id]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    fetchOrderDetails();

    const interval = setInterval(() => {
      fetchOrderDetails(true);
    }, 60000); // 60s polling
    return () => clearInterval(interval);
  }, [fadeAnim, fetchOrderDetails]);

  const refreshTracking = useCallback(async () => {
    const awb = order?.tracking?.awb;
    if (!awb) return;
    try {
      setTrackingError(null);
      const data = await trackOrder({ awb });
      setTrackingLive(data);
    } catch (e: any) {
      setTrackingError(e?.message || 'Failed to fetch tracking');
    }
  }, [order?.tracking?.awb]);

  const contactSupport = () => {
    haptics.buttonTap();
    Linking.openURL(config.contactPage);
  };

  if (!order) return null;

  const isCancelled = (order.status || '').toLowerCase().includes('cancel');
  const isDelivered = (Array.isArray(order.statusTimeline) ? order.statusTimeline : []).some((t: any) => t.step === 'delivered' && t.completedAt);
  const orderNumber = order.orderNumber || order.id?.slice(0, 8);

  const statusColor = isCancelled ? '#FF3B30' : isDelivered ? '#34C759' : '#007AFF';

  const steps = useMemo(() => {
    const isPrepaid = order.paymentMethod === 'PREPAID';
    return [
      { step: 'order_placed', label: 'Order Placed' },
      { step: 'awaiting_approval', label: isPrepaid ? 'Payment Confirmed' : 'Awaiting Approval' },
      { step: 'approved', label: 'Approved & Processing' },
      { step: 'shipped', label: 'Shipped' },
      { step: 'out_for_delivery', label: 'Out for Delivery' },
      { step: 'delivered', label: isCancelled ? 'Cancelled' : 'Delivered' },
    ];
  }, [order.paymentMethod, isCancelled]);

  const timelineByStep = useMemo(() => {
    const tl = Array.isArray(order.statusTimeline) ? order.statusTimeline : [];
    const m = new Map<string, string | null>();
    tl.forEach((t: any) => m.set(t.step, t.completedAt || null));
    return m;
  }, [order.statusTimeline]);

  const SectionCard = ({ children, style }: { children: React.ReactNode; style?: any }) => (
    <View style={[
      styles.sectionCard,
      {
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      },
      style,
    ]}>
      {children}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader title={`#${orderNumber}`} showBack />

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 70, paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Order Summary Header ─── */}
        <SectionCard>
          <View style={styles.summaryHeader}>
            <View>
              <Typography size={11} color={colors.textExtraLight} weight="500" style={{ letterSpacing: 1 }}>ORDER</Typography>
              <Typography size={22} weight="800" color={colors.text} style={{ marginTop: 4, letterSpacing: -0.5 }}>
                #{orderNumber}
              </Typography>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusColor + '12' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Typography size={11} weight="700" color={statusColor} style={{ marginLeft: 6 }}>
                {isCancelled ? 'Cancelled' : isDelivered ? 'Delivered' : (order.deliveryStatus || 'Processing').replace(/_/g, ' ')}
              </Typography>
            </View>
          </View>

          <View style={styles.summaryMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color={colors.textExtraLight} />
              <Typography size={12} color={colors.textMuted} weight="500" style={{ marginLeft: 6 }}>
                {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Typography>
            </View>
            {order.paymentMethod && (
              <View style={styles.metaItem}>
                <Ionicons
                  name={order.paymentMethod.includes('COD') || order.paymentMethod.includes('Cash') ? 'cash-outline' : 'card-outline'}
                  size={14}
                  color={colors.textExtraLight}
                />
                <Typography size={12} color={colors.textMuted} weight="500" style={{ marginLeft: 6 }}>
                  {order.paymentMethod}
                </Typography>
              </View>
            )}
            <View style={styles.metaItem}>
              <Ionicons name="cube-outline" size={14} color={colors.textExtraLight} />
              <Typography size={12} color={colors.textMuted} weight="500" style={{ marginLeft: 6 }}>
                {order.items?.length || 0} {(order.items?.length || 0) === 1 ? 'item' : 'items'}
              </Typography>
            </View>
          </View>
        </SectionCard>

        {/* ─── Live Tracking Stepper ─── */}
        {!isCancelled && (
          <SectionCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
              <Ionicons name="navigate-outline" size={16} color={colors.text} />
              <Typography size={13} weight="700" color={colors.text}>Order Tracking</Typography>
            </View>
            <View style={{ marginTop: 6 }}>
              {steps.map((s, idx) => {
                const completedAt = timelineByStep.get(s.step) || null;
                const isCompleted = !!completedAt;
                const isCurrent = !isCompleted && (steps.slice(0, idx).every(prev => !!timelineByStep.get(prev.step)));
                return (
                  <View key={s.step} style={{ flexDirection: 'row', gap: 12, paddingBottom: 18 }}>
                    <View style={{ width: 22, alignItems: 'center' }}>
                      <View style={{
                        width: 16, height: 16, borderRadius: 8,
                        backgroundColor: isCompleted ? colors.foreground : 'transparent',
                        borderWidth: 2,
                        borderColor: isCompleted ? colors.foreground : isCurrent ? colors.iosBlue : colors.borderLight,
                        justifyContent: 'center', alignItems: 'center'
                      }}>
                        {isCompleted && <Ionicons name="checkmark" size={10} color={colors.background} />}
                        {!isCompleted && isCurrent && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.iosBlue }} />}
                      </View>
                      {idx < steps.length - 1 && (
                        <View style={{ width: 2, flex: 1, backgroundColor: isCompleted ? colors.foreground : colors.borderExtraLight, marginTop: 4 }} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Typography size={11} weight="700" color={colors.text} style={{ letterSpacing: 1 }}>{s.label.toUpperCase()}</Typography>
                      {completedAt ? (
                        <Typography size={9} color={colors.textMuted} style={{ marginTop: 2 }}>
                          {new Date(completedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      ) : isCurrent ? (
                        <Typography size={9} color={colors.textExtraLight} style={{ marginTop: 2 }}>IN PROGRESS</Typography>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </SectionCard>
        )}

        {/* ─── Tracking Block (only when AWB is set) ─── */}
        {order.tracking?.awb && (
          <SectionCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Typography size={10} weight="700" color={colors.textExtraLight} style={{ letterSpacing: 1 }}>TRACKING</Typography>
                <Typography size={14} weight="800" color={colors.text} style={{ marginTop: 6 }}>
                  {order.tracking.carrier ? `${order.tracking.carrier} • ` : ''}{order.tracking.awb}
                </Typography>
                {(trackingLive?.current_location || order.tracking.lastLocation) && (
                  <Typography size={10} color={colors.textMuted} style={{ marginTop: 6 }}>
                    {trackingLive?.current_location || order.tracking.lastLocation}
                  </Typography>
                )}
                {(trackingLive?.estimated_delivery || order.tracking.estimatedDelivery) && (
                  <Typography size={10} color={colors.textMuted} style={{ marginTop: 2 }}>
                    ETA: {String(trackingLive?.estimated_delivery || order.tracking.estimatedDelivery)}
                  </Typography>
                )}
                {!!trackingError && (
                  <Typography size={9} color={colors.textExtraLight} style={{ marginTop: 8 }}>
                    {trackingError}
                  </Typography>
                )}
              </View>
              <TouchableOpacity
                onPress={() => { haptics.buttonTap(); refreshTracking(); }}
                activeOpacity={0.7}
                style={[styles.copyBtn, { backgroundColor: colors.foreground }]}
              >
                {loading ? <ActivityIndicator color={colors.background} /> : <Ionicons name="refresh" size={16} color={colors.background} />}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={async () => {
                try {
                  haptics.buttonTap();
                  await refreshTracking();
                } catch {}
              }}
              activeOpacity={0.7}
              style={{ marginTop: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', alignItems: 'center' }}
            >
              <Typography size={10} weight="700" color={colors.text}>View Full Tracking</Typography>
            </TouchableOpacity>
          </SectionCard>
        )}

        {/* ─── Order Items ─── */}
        <View style={styles.sectionHeader}>
          <Ionicons name="bag-outline" size={16} color={colors.text} />
          <Typography size={13} weight="700" color={colors.text} style={{ marginLeft: 8 }}>Order Items</Typography>
        </View>
        <SectionCard style={{ padding: 0 }}>
          {order.items?.map((item: any, index: number) => (
            <View
              key={item.id}
              style={[
                styles.orderItemRow,
                index > 0 && { borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }
              ]}
            >
              <View style={[
                styles.orderItemThumb,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }
              ]}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Ionicons name="shirt-outline" size={20} color={colors.textExtraLight} />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Typography size={14} weight="600" color={colors.text} numberOfLines={2}>
                  {item.title || item.fullTitle}
                </Typography>
                <View style={{ flexDirection: 'row', marginTop: 6, gap: 12 }}>
                  {item.size && (
                    <View style={[styles.itemMeta, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                      <Typography size={10} weight="600" color={colors.textMuted}>Size: {item.size}</Typography>
                    </View>
                  )}
                  <View style={[styles.itemMeta, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                    <Typography size={10} weight="600" color={colors.textMuted}>Qty: {item.quantity}</Typography>
                  </View>
                  {item.sku && (
                    <View style={[styles.itemMeta, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                      <Typography size={10} weight="600" color={colors.textExtraLight}>SKU: {item.sku}</Typography>
                    </View>
                  )}
                </View>
              </View>
              <Typography size={15} weight="700" color={colors.text}>{formatPrice(item.price * item.quantity)}</Typography>
            </View>
          ))}
        </SectionCard>

        {/* ─── Delivery Address ─── */}
        {order.shippingAddress && (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons name="location-outline" size={16} color={colors.text} />
              <Typography size={13} weight="700" color={colors.text} style={{ marginLeft: 8 }}>Delivery Address</Typography>
            </View>
            <SectionCard>
              <Typography size={14} weight="600" color={colors.text}>
                {order.shippingAddress?.name || 'Customer'}
              </Typography>
              <Typography size={13} color={colors.textSecondary} style={{ marginTop: 8, lineHeight: 20 }}>
                {order.shippingAddress?.address1 || order.shippingAddress?.raw || ''}
                {order.shippingAddress?.address2 ? `, ${order.shippingAddress.address2}` : ''}
                {'\n'}
                {[order.shippingAddress?.city, order.shippingAddress?.province].filter(Boolean).join(', ')}
                {order.shippingAddress?.zip ? ` - ${order.shippingAddress.zip}` : ''}
              </Typography>
              {order.shippingAddress?.phone && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 }}>
                  <Ionicons name="call-outline" size={13} color={colors.textMuted} />
                  <Typography size={12} color={colors.textMuted} weight="500">{order.shippingAddress.phone}</Typography>
                </View>
              )}
            </SectionCard>
          </>
        )}

        {/* ─── Price Summary ─── */}
        <View style={styles.sectionHeader}>
          <Ionicons name="receipt-outline" size={16} color={colors.text} />
          <Typography size={13} weight="700" color={colors.text} style={{ marginLeft: 8 }}>Payment Summary</Typography>
        </View>
        <SectionCard>
          <View style={styles.priceRow}>
            <Typography size={13} color={colors.textMuted} weight="500">Subtotal</Typography>
            <Typography size={13} color={colors.text} weight="600">{formatPrice(order.subtotalPrice || order.totalPrice)}</Typography>
          </View>
          {order.totalTax != null && order.totalTax > 0 && (
            <View style={styles.priceRow}>
              <Typography size={13} color={colors.textMuted} weight="500">Tax</Typography>
              <Typography size={13} color={colors.text} weight="600">{formatPrice(order.totalTax)}</Typography>
            </View>
          )}
          <View style={styles.priceRow}>
            <Typography size={13} color={colors.textMuted} weight="500">Shipping</Typography>
            <Typography size={13} color="#34C759" weight="600">FREE</Typography>
          </View>
          {order.discountInfo && (
            <View style={styles.priceRow}>
              <Typography size={13} color={colors.textMuted} weight="500">Discount</Typography>
              <Typography size={13} color="#FF3B30" weight="600">-{order.discountInfo}</Typography>
            </View>
          )}
          <View style={[styles.totalRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
            <Typography size={15} weight="800" color={colors.text}>Total</Typography>
            <Typography size={22} weight="800" color={colors.text} style={{ letterSpacing: -0.5 }}>
              {formatPrice(order.totalPrice)}
            </Typography>
          </View>
        </SectionCard>

        {/* ─── Order Notes ─── */}
        {order.note && (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={16} color={colors.text} />
              <Typography size={13} weight="700" color={colors.text} style={{ marginLeft: 8 }}>Notes</Typography>
            </View>
            <SectionCard>
              <Typography size={12} color={colors.textMuted} style={{ lineHeight: 18 }}>{order.note}</Typography>
            </SectionCard>
          </>
        )}
      </Animated.ScrollView>

      {/* ─── Floating Action Footer ─── */}
      <View style={[
        styles.footer,
        {
          paddingBottom: Math.max(insets.bottom, 20),
          backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
          borderTopColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
        }
      ]}>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.supportBtn, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
            onPress={contactSupport}
          >
            <Ionicons name="chatbubble-outline" size={16} color={colors.text} />
            <Typography size={12} weight="600" color={colors.text} style={{ marginLeft: 6 }}>Support</Typography>
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }]}>
          <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color={colors.foreground} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  sectionCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
      },
      android: { elevation: 1 }
    }),
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  summaryMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
    marginLeft: 4,
  },
  trackingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  trackingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  orderItemThumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemMeta: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  serviceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  serviceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionRow: { flexDirection: 'row', gap: 8 },
  supportBtn: {
    flexDirection: 'row',
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  returnActionBtn: {
    flexDirection: 'row',
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exchangeActionBtn: {
    flexDirection: 'row',
    flex: 1.5,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
