import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, RefreshControl, FlatList, Dimensions,
  Animated, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import GlassHeader from '../components/GlassHeader';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { useAuth } from '../hooks/useAuth';
import { config } from '../constants/config';
import { formatPrice } from '../utils/formatPrice';
import { haptics } from '../utils/haptics';
import { Typography } from '../components/Typography';
import { OrderSkeleton } from '../components/OrderSkeleton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
type OrderTab = 'ACTIVE' | 'HISTORY';

const TAB_CONFIG: { key: OrderTab; label: string; icon: string }[] = [
  { key: 'ACTIVE', label: 'Active', icon: 'time-outline' },
  { key: 'HISTORY', label: 'History', icon: 'receipt-outline' },
];

export default function OrderHistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';
  const { user } = useAuth();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<OrderTab>('ACTIVE');
  const [error, setError] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const fetchOrders = useCallback(async () => {
    try {
      if (!user?.id && !user?.phone && !user?.email) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Build query params for customer lookup
      const params = new URLSearchParams();
      if (user?.id) params.set('customerId', user.id);
      if (user?.phone) params.set('phone', user.phone);
      if (user?.email) params.set('email', user.email);

      const url = `${config.appUrl}/api/app/orders?${params.toString()}`;

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      const contentType = res.headers.get('content-type') || '';

      // Guard against HTML error pages from the server
      if (!contentType.includes('application/json')) {
        const preview = await res.text();
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch orders');

      setOrders(json.orders || []);
    } catch (err: any) {
      console.error('Fetch Orders:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, user?.phone, user?.email]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders])
  );

  const onRefresh = useCallback(() => {
    haptics.buttonTap();
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const status = (o.status || '').toLowerCase();
      const timeline = Array.isArray(o.statusTimeline) ? o.statusTimeline : [];
      const deliveredAt = timeline.find((t: any) => t.step === 'delivered')?.completedAt;
      
      const isCancelled = status.includes('cancel');
      const isDelivered = !!deliveredAt;
      if (activeTab === 'HISTORY') return true;
      return !isCancelled && !isDelivered;
    });
  }, [orders, activeTab]);

  const getStatusConfig = (order: any) => {
    const s = (order.status || '').toLowerCase();
    if (s.includes('cancel')) return { color: '#FF3B30', bg: 'rgba(255,59,48,0.08)', label: 'Cancelled', icon: 'close-circle' as const };
    if (s === 'awaiting_approval') return { color: '#FF9F0A', bg: 'rgba(255,159,10,0.08)', label: 'Awaiting Approval', icon: 'time' as const };
    const timeline = Array.isArray(order.statusTimeline) ? order.statusTimeline : [];
    const deliveredAt = timeline.find((t: any) => t.step === 'delivered')?.completedAt;
    const outForDeliveryAt = timeline.find((t: any) => t.step === 'out_for_delivery')?.completedAt;
    const shippedAt = timeline.find((t: any) => t.step === 'shipped')?.completedAt;
    const approvedAt = timeline.find((t: any) => t.step === 'approved')?.completedAt;

    if (deliveredAt) return { color: '#34C759', bg: 'rgba(52,199,89,0.08)', label: 'Delivered', icon: 'checkmark-circle' as const };
    if (outForDeliveryAt) return { color: '#FF9500', bg: 'rgba(255,149,0,0.08)', label: 'Out for Delivery', icon: 'bicycle' as const };
    if (shippedAt) return { color: '#AF52DE', bg: 'rgba(175,82,222,0.08)', label: 'Shipped', icon: 'airplane' as const };
    if (approvedAt) return { color: '#007AFF', bg: 'rgba(0,122,255,0.08)', label: 'Approved', icon: 'checkmark-done' as const };
    return { color: '#007AFF', bg: 'rgba(0,122,255,0.08)', label: 'Processing', icon: 'hourglass-outline' as const };
  };

  const getProgressSteps = (order: any) => {
    const timeline = Array.isArray(order.statusTimeline) ? order.statusTimeline : [];
    const deliveredAt = timeline.find((t: any) => t.step === 'delivered')?.completedAt;
    const outForDeliveryAt = timeline.find((t: any) => t.step === 'out_for_delivery')?.completedAt;
    const shippedAt = timeline.find((t: any) => t.step === 'shipped')?.completedAt;
    const approvedAt = timeline.find((t: any) => t.step === 'approved')?.completedAt;
    if (deliveredAt) return 4;
    if (outForDeliveryAt) return 3;
    if (shippedAt) return 2;
    if (approvedAt) return 1;
    return 0;
  };

  const renderStepDots = (order: any) => {
    const current = getProgressSteps(order);
    const { color } = getStatusConfig(order);
    const isCancelled = (order.status || '').toLowerCase().includes('cancel') || (order.status || '').toLowerCase().includes('void');
    
    if (isCancelled) return null;

    return (
      <View style={styles.stepDotsRow}>
        {[0, 1, 2, 3, 4].map(i => (
          <React.Fragment key={i}>
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor: i <= current ? color : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  width: i <= current ? 8 : 6,
                  height: i <= current ? 8 : 6,
                  borderRadius: i <= current ? 4 : 3,
                }
              ]}
            />
            {i < 4 && (
              <View
                style={[
                  styles.stepLine,
                  {
                    backgroundColor: i < current ? color : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  }
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>
    );
  };

  const renderOrder = ({ item: order, index }: { item: any; index: number }) => {
    const { color, bg, label, icon } = getStatusConfig(order);
    const orderNumber = order.orderNumber || order.id?.slice(0, 8);
    const itemCount = order.items?.length || 0;
    const isCancelled = (order.status || '').toLowerCase().includes('cancel') || (order.status || '').toLowerCase().includes('void');
    const firstItem = order.items?.[0];
    const paymentMethod = order.paymentMethod;
    
    return (
      <Animated.View style={{ opacity: 1 }}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            haptics.buttonTap();
            navigation.navigate('OrderDetail', { orderForDetail: order });
          }}
          style={[
            styles.orderCard,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            }
          ]}
        >
          {/* ─── Card Header ─── */}
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Typography size={16} weight="800" color={colors.text} style={{ letterSpacing: -0.3 }}>
                  #{orderNumber}
                </Typography>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 }}>
                <Ionicons name="calendar-outline" size={11} color={colors.textExtraLight} />
                <Typography size={11} color={colors.textMuted} weight="500">
                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </Typography>
                <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textExtraLight }} />
                <Typography size={11} color={colors.textMuted} weight="500">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </Typography>
              </View>
            </View>
            <View style={[styles.statusChip, { backgroundColor: bg }]}>
              <Ionicons name={icon} size={12} color={color} />
              <Typography size={10} weight="700" color={color} style={{ marginLeft: 4 }}>{label}</Typography>
            </View>
          </View>

          {/* ─── Progress Dots ─── */}
          {renderStepDots(order)}

          {/* ─── Items Preview ─── */}
          <View style={styles.itemsSection}>
            {order.items?.slice(0, 3).map((item: any, idx: number) => (
              <View key={item.id || idx} style={[styles.itemPreviewRow, idx > 0 && { marginTop: 10 }]}>
                <View style={[
                  styles.itemThumb,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }
                ]}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <Ionicons name="shirt-outline" size={18} color={colors.textExtraLight} />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Typography size={13} weight="600" color={colors.text} numberOfLines={1}>
                    {item.title || item.fullTitle}
                  </Typography>
                  <View style={{ flexDirection: 'row', marginTop: 3, gap: 8 }}>
                    {item.size && (
                      <Typography size={11} color={colors.textMuted} weight="500">
                        Size: {item.size}
                      </Typography>
                    )}
                    <Typography size={11} color={colors.textMuted} weight="500">
                      Qty: {item.quantity}
                    </Typography>
                  </View>
                </View>
                <Typography size={13} weight="700" color={colors.text}>
                  {formatPrice(item.price * item.quantity)}
                </Typography>
              </View>
            ))}
            {itemCount > 3 && (
              <View style={{ marginTop: 10, alignItems: 'center' }}>
                <Typography size={11} color={colors.textMuted} weight="600">
                  +{itemCount - 3} more {itemCount - 3 === 1 ? 'item' : 'items'}
                </Typography>
              </View>
            )}
          </View>

          {/* ─── Footer with Total & Actions ─── */}
          <View style={[styles.cardFooter, { borderTopColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }]}>
            <View>
              <Typography size={10} color={colors.textExtraLight} weight="500">Total</Typography>
              <Typography size={18} weight="800" color={colors.text} style={{ marginTop: 2, letterSpacing: -0.3 }}>
                {formatPrice(order.total || order.totalPrice || 0)}
              </Typography>
              {paymentMethod && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                  <Ionicons 
                    name={paymentMethod.includes('COD') || paymentMethod.includes('Cash') ? 'cash-outline' : 'card-outline'} 
                    size={10} 
                    color={colors.textExtraLight} 
                  />
                  <Typography size={9} color={colors.textExtraLight} weight="500">{paymentMethod}</Typography>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.viewDetailsPill, { backgroundColor: colors.foreground }]}
                onPress={() => {
                  haptics.buttonTap();
                  navigation.navigate('OrderDetail', { orderForDetail: order });
                }}
              >
                <Typography size={10} weight="700" color={colors.background}>Details</Typography>
                <Ionicons name="chevron-forward" size={12} color={colors.background} style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ─── Order count summary ───
  const orderCounts = useMemo(() => {
    const isDelivered = (o: any) => (Array.isArray(o.statusTimeline) ? o.statusTimeline : []).some((t: any) => t.step === 'delivered' && t.completedAt);
    const isCancelled = (o: any) => String(o.status || '').toLowerCase().includes('cancel');
    const active = orders.filter(o => !isCancelled(o) && !isDelivered(o)).length;
    const history = orders.length;
    return { ACTIVE: active, HISTORY: history };
  }, [orders]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader title="Orders" showBack />
      
      {/* ─── Tab Bar ─── */}
      <View style={[styles.tabBar, { paddingTop: insets.top + 56 }]}>
        <View style={[styles.tabBarInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
          {TAB_CONFIG.map(tab => {
            const isActive = activeTab === tab.key;
            const count = orderCounts[tab.key];
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => { haptics.buttonTap(); setActiveTab(tab.key); }}
                style={[
                  styles.tabItem,
                  isActive && {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                    ...Platform.select({
                      ios: {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 8,
                      },
                      android: { elevation: 2 }
                    })
                  }
                ]}
              >
                <Ionicons 
                  name={tab.icon as any} 
                  size={14} 
                  color={isActive ? colors.text : colors.textExtraLight} 
                />
                <Typography
                  size={10}
                  weight={isActive ? '700' : '500'}
                  color={isActive ? colors.text : colors.textExtraLight}
                  style={{ marginTop: 2 }}
                >
                  {tab.label}
                </Typography>
                {count > 0 && isActive && (
                  <View style={[styles.countBadge, { backgroundColor: colors.foreground }]}>
                    <Typography size={8} weight="800" color={colors.background}>{count}</Typography>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.listContent}>
          {[1, 2, 3].map(i => <OrderSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={item => item.id}
          renderItem={renderOrder}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            error ? (
              <View style={styles.empty}>
                <Ionicons name="alert-circle-outline" size={44} color="#FF3B30" />
                <Typography size={17} weight="700" color={colors.text} style={{ marginTop: 24 }}>
                  Order Fetch Error
                </Typography>
                <Typography size={13} color={colors.textMuted} style={{ marginTop: 8, textAlign: 'center' }}>
                  {error}
                </Typography>
                <TouchableOpacity
                  style={[styles.shopNowBtn, { backgroundColor: colors.foreground }]}
                  onPress={() => { setError(null); setLoading(true); fetchOrders(); }}
                >
                  <Typography size={12} weight="700" color={colors.background}>Try Again</Typography>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                  <Ionicons
                    name={activeTab === 'HISTORY' ? 'receipt-outline' : 'cube-outline'}
                    size={44}
                    color={colors.textExtraLight}
                  />
                </View>
                <Typography size={17} weight="700" color={colors.text} style={{ marginTop: 24 }}>
                  No {activeTab === 'ACTIVE' ? 'active' : 'orders'} yet
                </Typography>
                <Typography size={13} color={colors.textMuted} style={{ marginTop: 8, textAlign: 'center', lineHeight: 20, maxWidth: 280 }}>
                  {activeTab === 'ACTIVE'
                    ? 'Your active orders will appear here once you place an order.'
                    : 'Your order history will show up here.'}
                </Typography>
                <TouchableOpacity
                  style={[styles.shopNowBtn, { backgroundColor: colors.foreground }]}
                  onPress={() => {
                    haptics.buttonTap();
                    navigation.navigate('BottomTabs', { screen: 'Shop' });
                  }}
                >
                  <Typography size={12} weight="700" color={colors.background}>Start Shopping</Typography>
                </TouchableOpacity>
              </View>
            )
          }
          ListFooterComponent={null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tabBarInner: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    position: 'relative',
  },
  countBadge: {
    position: 'absolute',
    top: 4,
    right: 8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  listContent: { 
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  orderCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
      },
      android: { elevation: 2 }
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 18,
    paddingBottom: 0,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  stepDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginTop: 14,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stepLine: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    marginHorizontal: 2,
  },
  itemsSection: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  itemPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  actionPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewDetailsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopNowBtn: {
    marginTop: 28,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
});
