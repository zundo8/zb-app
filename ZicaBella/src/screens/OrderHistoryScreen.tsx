import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useAuthStore } from '../store/authStore';
import { config } from '../constants/config';
import { formatPrice } from '../utils/formatPrice';
import { haptics } from '../utils/haptics';
import { Typography } from '../components/Typography';
import { OrderSkeleton } from '../components/OrderSkeleton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_SIZE = 20;

type OrderTab = 'ACTIVE' | 'DELIVERED' | 'CANCELLED' | 'RETURNS';

const TAB_CONFIG: { key: OrderTab; label: string; icon: string }[] = [
  { key: 'ACTIVE', label: 'Active', icon: 'time-outline' },
  { key: 'DELIVERED', label: 'Delivered', icon: 'checkmark-circle-outline' },
  { key: 'CANCELLED', label: 'Cancelled', icon: 'close-circle-outline' },
  { key: 'RETURNS', label: 'Returns', icon: 'return-down-back-outline' },
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<OrderTab>('ACTIVE');
  const offsetRef = useRef(0);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (activeTab === 'RETURNS') {
      navigation.navigate('ServiceFlow', { screen: 'ServiceHistory' });
      setActiveTab('ACTIVE');
    }
  }, [activeTab, navigation]);

  const fetchOrders = useCallback(async (mode: 'reset' | 'more' = 'reset') => {
    if (activeTab === 'RETURNS') return;
    try {
      if (!user?.id && !user?.phone && !user?.email) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (user?.id) params.set('customerId', user.id);
      else if (user?.phone) params.set('phone', user.phone);
      else if (user?.email) params.set('email', user.email);
      
      params.set('limit', String(PAGE_SIZE));
      const nextOffset = mode === 'more' ? offsetRef.current : 0;
      params.set('offset', String(nextOffset));

      const res = await fetch(`${config.appUrl}/api/app/orders?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${useAuthStore.getState().token || ''}`
        }
      });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json.error || 'Failed to fetch orders');

      const incoming = json.orders || [];
      if (mode === 'more') {
        setOrders(prev => [...prev, ...incoming]);
      } else {
        setOrders(incoming);
      }
      offsetRef.current = nextOffset + incoming.length;
      setHasMore(incoming.length === PAGE_SIZE);
    } catch (err: any) {
      console.error('Fetch Orders:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [user?.id, user?.phone, user?.email, activeTab]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders('reset');
    }, [fetchOrders])
  );

  const onRefresh = useCallback(() => {
    haptics.buttonTap();
    setRefreshing(true);
    fetchOrders('reset');
  }, [fetchOrders]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || refreshing) return;
    setLoadingMore(true);
    fetchOrders('more');
  }, [loadingMore, hasMore, refreshing, fetchOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const status = (o.status || '').toUpperCase();
      const delStatus = (o.deliveryStatus || '').toUpperCase();
      
      if (activeTab === 'CANCELLED') return status === 'CANCELLED' || status === 'VOIDED' || status === 'REFUNDED';
      if (activeTab === 'DELIVERED') return delStatus === 'DELIVERED';
      return status !== 'CANCELLED' && status !== 'VOIDED' && status !== 'REFUNDED' && delStatus !== 'DELIVERED';
    });
  }, [orders, activeTab]);

  const getStatusConfig = (order: any) => {
    const s = (order.status || '').toUpperCase();
    const d = (order.deliveryStatus || '').toUpperCase();
    
    if (s === 'CANCELLED' || s === 'VOIDED') return { color: '#FF3B30', bg: 'rgba(255,59,48,0.08)', label: 'Cancelled', icon: 'close-circle' as const };
    if (s === 'REFUNDED') return { color: '#8E8E93', bg: 'rgba(142,142,147,0.08)', label: 'Refunded', icon: 'return-down-back' as const };
    if (d === 'DELIVERED') return { color: '#34C759', bg: 'rgba(52,199,89,0.08)', label: 'Delivered', icon: 'checkmark-circle' as const };
    if (d === 'OUT_FOR_SERVICE' || d === 'OUT_FOR_DELIVERY') return { color: '#FF9500', bg: 'rgba(255,149,0,0.08)', label: 'Out for Delivery', icon: 'bicycle' as const };
    if (d === 'SHIPPED') return { color: '#AF52DE', bg: 'rgba(175,82,222,0.08)', label: 'Shipped', icon: 'airplane' as const };
    if (s === 'PACKED') return { color: '#FF9F0A', bg: 'rgba(255,159,10,0.08)', label: 'Packed', icon: 'cube' as const };
    if (s === 'PAID' || s === 'CONFIRMED') return { color: '#007AFF', bg: 'rgba(0,122,255,0.08)', label: 'Confirmed', icon: 'checkmark-done' as const };
    return { color: '#007AFF', bg: 'rgba(0,122,255,0.08)', label: 'Processing', icon: 'hourglass-outline' as const };
  };

  const getProgressSteps = (order: any) => {
    const d = (order.deliveryStatus || '').toUpperCase();
    const s = (order.status || '').toUpperCase();
    if (s === 'CANCELLED') return 0;
    if (d === 'DELIVERED') return 4;
    if (d === 'OUT_FOR_DELIVERY' || d === 'OUT_FOR_SERVICE') return 3;
    if (d === 'SHIPPED') return 2;
    if (s === 'PACKED') return 1;
    return 0;
  };

  const renderStepDots = (order: any) => {
    const current = getProgressSteps(order);
    const { color } = getStatusConfig(order);
    const isCancelled = (order.status || '').toUpperCase() === 'CANCELLED';
    
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
    const orderNumber = order.orderNumber || order.shopifyOrderId || order.id?.slice(0, 8);
    const itemCount = order.items?.length || 0;
    const isDelivered = (order.deliveryStatus || '').toUpperCase() === 'DELIVERED';
    const isCancelled = (order.status || '').toUpperCase() === 'CANCELLED';
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
                {formatPrice(order.totalPrice || order.total || 0)}
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
              {isDelivered && (
                <>
                  <TouchableOpacity
                    style={[styles.actionPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      haptics.buttonTap();
                      navigation.navigate('ServiceFlow', { screen: 'ReturnWizard', params: { orderId: order.id } });
                    }}
                  >
                    <Ionicons name="return-down-back-outline" size={13} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      haptics.buttonTap();
                      navigation.navigate('ServiceFlow', { screen: 'ExchangeWizard', params: { orderId: order.id } });
                    }}
                  >
                    <Ionicons name="swap-horizontal-outline" size={13} color={colors.text} />
                  </TouchableOpacity>
                </>
              )}
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
    const active = orders.filter(o => (o.status || '').toUpperCase() !== 'CANCELLED' && (o.deliveryStatus || '').toUpperCase() !== 'DELIVERED').length;
    const delivered = orders.filter(o => (o.deliveryStatus || '').toUpperCase() === 'DELIVERED').length;
    const cancelled = orders.filter(o => (o.status || '').toUpperCase() === 'CANCELLED').length;
    return { ACTIVE: active, DELIVERED: delivered, CANCELLED: cancelled, RETURNS: 0 };
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
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                <Ionicons
                  name={activeTab === 'CANCELLED' ? 'close-circle-outline' : activeTab === 'DELIVERED' ? 'checkmark-circle-outline' : 'cube-outline'}
                  size={44}
                  color={colors.textExtraLight}
                />
              </View>
              <Typography size={17} weight="700" color={colors.text} style={{ marginTop: 24 }}>
                No {activeTab === 'ACTIVE' ? 'active' : activeTab === 'DELIVERED' ? 'delivered' : 'cancelled'} orders
              </Typography>
              <Typography size={13} color={colors.textMuted} style={{ marginTop: 8, textAlign: 'center', lineHeight: 20, maxWidth: 280 }}>
                {activeTab === 'ACTIVE'
                  ? 'Your active orders will appear here once you place an order.'
                  : activeTab === 'DELIVERED'
                  ? 'Your delivered orders will show up here.'
                  : 'No cancelled orders to display.'}
              </Typography>
              <TouchableOpacity
                style={[styles.shopNowBtn, { backgroundColor: colors.foreground }]}
                onPress={() => {
                  haptics.buttonTap();
                  navigation.navigate('BottomTabs', { screen: 'Shop' });
                }}
              >
                <Typography size={12} weight="700" color={colors.background}>Browse Products</Typography>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ padding: 20 }}><OrderSkeleton /></View>
            ) : null
          }
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
