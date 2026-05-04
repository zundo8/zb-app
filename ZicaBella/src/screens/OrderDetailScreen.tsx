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
import { TrackingStepper } from '../components/TrackingStepper';
import { Image } from 'expo-image';

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
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchOrderDetails = useCallback(async (isPolling = false) => {
    if (!order?.id) return;
    try {
      if (!isPolling) setLoading(true);
      const res = await fetch(`${config.appUrl}/api/app/orders?orderId=${order.id}`);
      const json = await res.json();
      if (res.ok && json.order) {
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

  const openTracking = () => {
    if (order.trackingUrl) {
      Linking.openURL(order.trackingUrl);
      haptics.buttonTap();
    } else if (order.trackingNumber) {
      copyTracking();
    }
  };

  const copyTracking = async () => {
    if (!order.trackingNumber) return;
    await Share.share({ message: order.trackingNumber });
    haptics.success();
  };

  const contactSupport = () => {
    haptics.buttonTap();
    Linking.openURL(config.contactPage);
  };

  if (!order) return null;

  const hasReturns = order.returns && order.returns.length > 0;
  const hasExchanges = order.exchanges && order.exchanges.length > 0;
  const isDelivered = (order.deliveryStatus || '').toUpperCase() === 'DELIVERED';
  const isCancelled = (order.status || '').toUpperCase() === 'CANCELLED';
  const canReturn = isDelivered && !isCancelled;
  const orderNumber = order.orderNumber || (order.shopifyOrderId || '').replace(/^#/, '') || order.id?.slice(0, 8);

  // Status color
  const getStatusColor = () => {
    if (isCancelled) return '#FF3B30';
    if (isDelivered) return '#34C759';
    const d = (order.deliveryStatus || '').toUpperCase();
    if (d === 'SHIPPED') return '#AF52DE';
    if (d === 'OUT_FOR_DELIVERY') return '#FF9500';
    return '#007AFF';
  };

  const statusColor = getStatusColor();

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
            <TrackingStepper currentStatus={order.deliveryStatus || order.status} timestamps={order.timeline} />

            {/* Detailed Event History */}
            {order.shipmentEvents && order.shipmentEvents.length > 0 && (
              <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', paddingTop: 20 }}>
                <Typography size={10} weight="700" color={colors.textExtraLight} style={{ letterSpacing: 1.5, marginBottom: 16 }}>DETAILED HISTORY</Typography>
                {order.shipmentEvents.map((ev: any, idx: number) => (
                  <View key={idx} style={{ flexDirection: 'row', marginBottom: 16, gap: 12 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: idx === 0 ? colors.iosBlue : colors.borderLight, marginTop: 4 }} />
                    <View style={{ flex: 1 }}>
                      <Typography size={12} weight="600" color={colors.text}>{ev.activity || ev.status_name}</Typography>
                      <Typography size={10} color={colors.textMuted} style={{ marginTop: 2 }}>{ev.location || ev.city}</Typography>
                      <Typography size={9} color={colors.textExtraLight} style={{ marginTop: 2 }}>
                        {new Date(ev.date || ev.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </SectionCard>
        )}

        {/* ─── Return / Exchange Status ─── */}
        {(hasReturns || hasExchanges) && (
          <SectionCard style={{ borderColor: 'rgba(52, 199, 89, 0.2)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(52,199,89,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="refresh-circle" size={16} color="#34C759" />
              </View>
              <Typography size={13} weight="700" color="#34C759">Service Active</Typography>
            </View>
            
            {order.returns?.map((r: any) => (
              <View key={r.id} style={styles.serviceRow}>
                <View style={{ flex: 1 }}>
                  <Typography size={13} weight="600" color={colors.text}>Return Requested</Typography>
                  {r.refundMethod === 'STORE_CREDIT' && (
                    <Typography size={11} color="#007AFF" weight="500" style={{ marginTop: 2 }}>Refund as Store Credit</Typography>
                  )}
                  {r.refundAmount && (
                    <Typography size={11} color={colors.textMuted} weight="500" style={{ marginTop: 2 }}>Refund: {formatPrice(r.refundAmount)}</Typography>
                  )}
                </View>
                <View style={[styles.serviceBadge, { backgroundColor: 'rgba(52,199,89,0.1)' }]}>
                  <Typography size={10} weight="700" color="#34C759">{(r.status || 'REQUESTED').toUpperCase()}</Typography>
                </View>
              </View>
            ))}
            
            {order.exchanges?.map((e: any) => (
              <View key={e.id} style={styles.serviceRow}>
                <View style={{ flex: 1 }}>
                  <Typography size={13} weight="600" color={colors.text}>Exchange Requested</Typography>
                  {e.priceDifference !== 0 && (
                    <Typography size={11} color={colors.textMuted} weight="500" style={{ marginTop: 2 }}>
                      Price diff: {formatPrice(Math.abs(e.priceDifference))}
                    </Typography>
                  )}
                </View>
                <View style={[styles.serviceBadge, { backgroundColor: 'rgba(0,122,255,0.1)' }]}>
                  <Typography size={10} weight="700" color="#007AFF">{(e.status || 'REQUESTED').toUpperCase()}</Typography>
                </View>
              </View>
            ))}
            
            <TouchableOpacity 
              style={styles.serviceLink}
              onPress={() => navigation.navigate('ServiceFlow', { screen: 'ServiceHistory' })}
            >
              <Typography size={12} weight="600" color="#007AFF">View Service Details</Typography>
              <Ionicons name="chevron-forward" size={14} color="#007AFF" />
            </TouchableOpacity>
          </SectionCard>
        )}

        {/* ─── Tracking Number ─── */}
        {order.trackingNumber && (
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={openTracking}
            onLongPress={copyTracking}
            style={[
              styles.trackingCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              }
            ]}
          >
            <View style={[styles.trackingIcon, { backgroundColor: isDark ? 'rgba(175,82,222,0.1)' : 'rgba(175,82,222,0.06)' }]}>
              <Ionicons name="navigate-circle-outline" size={20} color="#AF52DE" />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Typography size={10} weight="600" color={colors.textExtraLight} style={{ letterSpacing: 1 }}>TRACKING NUMBER</Typography>
              <Typography size={14} weight="700" color={colors.text} style={{ marginTop: 4 }}>{order.trackingNumber}</Typography>
              <Typography size={11} color={colors.iosBlue} weight="600" style={{ marginTop: 2 }}>Tap to track · Long press to copy</Typography>
            </View>
            <View style={[styles.copyBtn, { backgroundColor: colors.foreground }]}>
              <Ionicons name="chevron-forward" size={16} color={colors.background} />
            </View>
          </TouchableOpacity>
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
          
          {canReturn && (
            <>
              <TouchableOpacity 
                style={[styles.returnActionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]} 
                onPress={() => {
                  haptics.buttonTap();
                  navigation.navigate('ServiceFlow', { screen: 'ReturnWizard', params: { orderId: order.id } });
                }}
              >
                <Ionicons name="return-down-back-outline" size={16} color={colors.text} />
                <Typography size={12} weight="600" color={colors.text} style={{ marginLeft: 6 }}>Return</Typography>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.exchangeActionBtn, { backgroundColor: colors.foreground }]} 
                onPress={() => {
                  haptics.buttonTap();
                  navigation.navigate('ServiceFlow', { screen: 'ExchangeWizard', params: { orderId: order.id } });
                }}
              >
                <Ionicons name="swap-horizontal-outline" size={16} color={colors.background} />
                <Typography size={12} weight="700" color={colors.background} style={{ marginLeft: 6 }}>Exchange</Typography>
              </TouchableOpacity>
            </>
          )}
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
