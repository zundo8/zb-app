import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export default function OrderDetailsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orderId } = route.params || {};
  const colors = useColors();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';

  if (!orderId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Typography color={colors.text}>Order ID is missing.</Typography>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Typography color={colors.iosBlue}>Go Back</Typography>
        </TouchableOpacity>
      </View>
    );
  }

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingLive, setTrackingLive] = useState<any | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchOrderDetails = useCallback(async (isPolling = false) => {
    if (!orderId) return;
    try {
      if (!isPolling) setLoading(true);
      const token = useAuthStore.getState().token || '';
      const user = useAuthStore.getState().user;
      
      const params = new URLSearchParams();
      if (user?.id) params.set('customerId', user.id);
      if (user?.phone) params.set('phone', user.phone);
      if (user?.email) params.set('email', user.email);

      const res = await fetch(`${config.appUrl}/api/app/orders/${orderId}?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Accept': 'application/json',
        }
      });

      // Guard against non-JSON responses
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Server error (${res.status})`);
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch order');
      if (json.order) {
        setOrder(json.order);
        setError(null);
      }
    } catch (e: any) {
      console.error('Fetch Order Detail Error:', e);
      if (!isPolling) setError(e.message || 'Failed to load order details');
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [orderId]);

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

  if (loading && !order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.foreground} />
        <Typography size={14} color={colors.textMuted} style={{ marginTop: 16 }}>AUTHENTICATING...</Typography>
      </View>
    );
  }

  if (error && !order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Typography size={16} weight="700" color={colors.text} style={{ marginTop: 24, textAlign: 'center' }}>
          Unable to Load Order
        </Typography>
        <Typography size={13} color={colors.textMuted} style={{ marginTop: 8, textAlign: 'center' }}>
          {error}
        </Typography>
        <TouchableOpacity 
          style={[styles.retryBtn, { backgroundColor: colors.foreground }]}
          onPress={() => fetchOrderDetails()}
        >
          <Typography size={12} weight="800" color={colors.background}>TRY AGAIN</Typography>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={{ marginTop: 20 }}
        >
          <Typography size={12} weight="600" color={colors.iosBlue}>Go Back</Typography>
        </TouchableOpacity>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="small" color={colors.foreground} />
      </View>
    );
  }

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

  const getItemImage = (item: any): string | null => {
    if (item.image) return item.image;
    if (item.imageUrl) return item.imageUrl;
    if (item.product?.image) return item.product.image;
    if (item.product?.images?.[0]) return item.product.images[0];
    if (order.lineItems) {
      const match = order.lineItems.find((li: any) =>
        li.name === item.title || li.productId === item.productId
      );
      if (match?.imageUrl) return match.imageUrl;
    }
    return null;
  };

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

        {/* ─── Return/Exchange Request Status ─── */}
        {(order.returnRequests?.length > 0 || order.exchangeRequests?.length > 0) && (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons name="sync-circle-outline" size={16} color={colors.text} />
              <Typography size={13} weight="700" color={colors.text} style={{ marginLeft: 8 }}>Service Requests</Typography>
            </View>
            {order.returnRequests?.map((req: any) => (
              <SectionCard key={req.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Typography size={13} weight="700" color={colors.text}>Return Request</Typography>
                  <View style={[styles.itemMeta, { backgroundColor: req.status === 'approved' ? '#34C75915' : req.status === 'rejected' ? '#FF3B3015' : '#FF9F0A15' }]}>
                    <Typography size={10} weight="700" color={req.status === 'approved' ? '#34C759' : req.status === 'rejected' ? '#FF3B30' : '#FF9F0A'}>
                      {req.status.replace('_', ' ').toUpperCase()}
                    </Typography>
                  </View>
                </View>
                <Typography size={11} color={colors.textMuted} style={{ marginBottom: 4 }}>Created on {new Date(req.createdAt).toLocaleDateString()}</Typography>
                <Typography size={11} color={colors.textMuted}>Estimated Refund: {formatPrice(req.estimatedRefund)}</Typography>
                {req.reason && <Typography size={11} color={colors.textMuted} style={{ marginTop: 4 }}>Note: {req.reason}</Typography>}
              </SectionCard>
            ))}
            {order.exchangeRequests?.map((req: any) => (
              <SectionCard key={req.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Typography size={13} weight="700" color={colors.text}>Exchange Request</Typography>
                  <View style={[styles.itemMeta, { backgroundColor: req.status === 'approved' ? '#34C75915' : req.status === 'rejected' ? '#FF3B3015' : '#FF9F0A15' }]}>
                    <Typography size={10} weight="700" color={req.status === 'approved' ? '#34C759' : req.status === 'rejected' ? '#FF3B30' : '#FF9F0A'}>
                      {req.status.replace('_', ' ').toUpperCase()}
                    </Typography>
                  </View>
                </View>
                <Typography size={11} color={colors.textMuted} style={{ marginBottom: 4 }}>Created on {new Date(req.createdAt).toLocaleDateString()}</Typography>
                <Typography size={11} color={colors.textMuted}>Price Difference: {formatPrice(Math.abs(req.priceDifference))} {req.priceDifference > 0 ? '(To Pay)' : '(Refund)'}</Typography>
                {req.reason && <Typography size={11} color={colors.textMuted} style={{ marginTop: 4 }}>Note: {req.reason}</Typography>}
              </SectionCard>
            ))}
          </>
        )}

        {/* ─── Order Items ─── */}
        <View style={styles.sectionHeader}>
          <Ionicons name="bag-outline" size={16} color={colors.text} />
          <Typography size={13} weight="700" color={colors.text} style={{ marginLeft: 8 }}>Order Items</Typography>
        </View>
        <SectionCard style={{ padding: 0 }}>
          {order.items?.map((item: any, index: number) => {
            const imgUrl = getItemImage(item);
            return (
              <View
                key={item.id || index}
                style={[
                  styles.orderItemRow,
                  index > 0 && { borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }
                ]}
              >
                <View style={[
                  styles.orderItemThumb,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }
                ]}>
                  {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <Ionicons name="shirt-outline" size={20} color={colors.textExtraLight} />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Typography size={14} weight="600" color={colors.text} numberOfLines={2}>
                    {item.title || item.fullTitle || item.name}
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
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Typography size={15} weight="700" color={colors.text}>{formatPrice(item.price * item.quantity)}</Typography>
                  <Typography size={10} weight="500" color={colors.textMuted} style={{ marginTop: 2 }}>{formatPrice(item.price)} each</Typography>
                </View>
              </View>
            );
          })}
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
                {order.shippingAddress?.address1 || order.shippingAddress?.line1 || order.shippingAddress?.raw || ''}
                {order.shippingAddress?.address2 || order.shippingAddress?.line2 ? `, ${order.shippingAddress.address2 || order.shippingAddress.line2}` : ''}
                {'\n'}
                {[order.shippingAddress?.city, order.shippingAddress?.province || order.shippingAddress?.state].filter(Boolean).join(', ')}
                {order.shippingAddress?.zip || order.shippingAddress?.pincode ? ` - ${order.shippingAddress.zip || order.shippingAddress.pincode}` : ''}
              </Typography>
              {(order.shippingAddress?.phone) && (
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
            <Typography size={13} color={colors.text} weight="600">{formatPrice(order.subtotalPrice || order.subtotal || order.totalPrice)}</Typography>
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
              {formatPrice(order.totalPrice || order.total)}
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
          {(!isCancelled && !isDelivered && (order.status === 'pending' || order.status === 'awaiting_approval' || !order.statusTimeline?.find((t: any) => t.step === 'shipped')?.completedAt)) && (
            <TouchableOpacity
              style={[styles.supportBtn, { backgroundColor: '#FF3B3015', borderColor: '#FF3B3030' }]}
              onPress={() => {
                haptics.error();
                // Add your cancel logic here
              }}
            >
              <Ionicons name="close-circle-outline" size={16} color="#FF3B30" />
              <Typography size={12} weight="600" color="#FF3B30" style={{ marginLeft: 6 }}>Cancel Order</Typography>
            </TouchableOpacity>
          )}
        </View>

        {/* ─── Returns & Exchanges Actions ─── */}
        {isDelivered && (!order.returnRequests?.length && !order.exchangeRequests?.length) && (
          <>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.supportBtn, { backgroundColor: colors.foreground, flex: 1, borderColor: colors.foreground }]}
                onPress={() => {
                  haptics.buttonTap();
                  navigation.navigate('ReturnRequest', { order });
                }}
              >
                <Ionicons name="return-down-back-outline" size={16} color={colors.background} />
                <Typography size={12} weight="700" color={colors.background} style={{ marginLeft: 6 }}>Request Return</Typography>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.supportBtn, { backgroundColor: colors.foreground, flex: 1, borderColor: colors.foreground }]}
                onPress={() => {
                  haptics.buttonTap();
                  navigation.navigate('ExchangeSelectProduct', { order });
                }}
              >
                <Ionicons name="swap-horizontal-outline" size={16} color={colors.background} />
                <Typography size={12} weight="700" color={colors.background} style={{ marginLeft: 6 }}>Request Exchange</Typography>
              </TouchableOpacity>
            </View>
            <View style={{ alignItems: 'center', marginTop: 10 }}>
              <Typography size={10} color={colors.textMuted}>Returns and exchanges available within 30 days of delivery</Typography>
            </View>
          </>
        )}
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
    width: 64,
    height: 64,
    borderRadius: 16,
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
  retryBtn: {
    marginTop: 32,
    paddingHorizontal: 32,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
