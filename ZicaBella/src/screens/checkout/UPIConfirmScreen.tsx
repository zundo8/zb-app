import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  AppState, AppStateStatus, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../constants/colors';
import { Typography } from '../../components/Typography';
import { haptics } from '../../utils/haptics';
import { checkOrderStatus } from '../../api/payment';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { getPaymentApiBaseUrl } from '../../constants/config';

const { width: SW } = Dimensions.get('window');

type ConfirmState = 'waiting' | 'confirming' | 'success' | 'failed' | 'timeout';

/**
 * UPIConfirmScreen
 *
 * Shown after Linking.openURL(upi://...) fires.
 * Polls GET /api/app/payment/order-status?orderId=xxx every 3 seconds.
 * Also detects AppState changes to poll immediately when user returns.
 *
 * Route params:
 *   - orderId: Razorpay order_id (order_xxxx)
 *   - amount: Amount in rupees
 *   - orderData: The full order payload to record after success
 */
export default function UPIConfirmScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { orderId, amount, orderData } = route.params || {};
  const { clearCart, buyNowItem, setBuyNowItem } = useCartStore();
  const token = useAuthStore((s) => s.token) || '';
  const isDark = colors.background === '#000000';

  const [state, setState] = useState<ConfirmState>('waiting');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  // ── Pulse animation for waiting state ──
  useEffect(() => {
    if (state === 'waiting' || state === 'confirming') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    }
  }, [state]);

  // ── Spin animation for confirming state ──
  useEffect(() => {
    if (state === 'confirming') {
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [state]);

  // ── Success animation ──
  useEffect(() => {
    if (state === 'success') {
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, friction: 4, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [state]);

  // ── Elapsed time counter ──
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  const pollOnce = useCallback(async () => {
    if (!orderId) return;
    try {
      const result = await checkOrderStatus(orderId);
      console.log('[UPIConfirm] Poll result:', result.status);

      if (result.status === 'paid') {
        stopPolling();
        setPaymentId(result.paymentId || 'upi_payment');
        await recordOrder(result.paymentId || 'upi_payment');
        haptics.success();
        setState('success');
      }
      // 'attempted' means payment attempt was made but not yet captured — keep polling
      // 'created' means no attempt yet — keep polling
    } catch (e) {
      console.log('[UPIConfirm] Poll error (non-fatal):', e);
    }
  }, [orderId, stopPolling]);

  // ── Record the order on our backend after payment is confirmed ──
  const recordOrder = async (pId: string) => {
    try {
      // Verify payment (with HEADLESS signature since UPI intent doesn't return signature)
      const apiBase = getPaymentApiBaseUrl();
      const vRes = await fetch(`${apiBase}/api/app/payment/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: pId,
          razorpay_signature: 'HEADLESS',
        }),
      });
      const vJson = await vRes.json();
      if (!vJson.success) {
        console.warn('[UPIConfirm] Verification response:', vJson);
        // Non-blocking: payment was captured by Razorpay, we log the order anyway
      }

      // Create order record
      if (orderData) {
        const oRes = await fetch(`${apiBase}/api/app/orders/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...orderData,
            paymentId: pId,
            razorpayOrderId: orderId,
          }),
        });
        const oJson = await oRes.json();
        if (!oRes.ok) {
          console.warn('[UPIConfirm] Order creation response:', oJson);
        }
      }

      buyNowItem ? setBuyNowItem(null) : clearCart();
    } catch (e) {
      console.error('[UPIConfirm] Record order error:', e);
    }
  };

  // ── Start polling on mount ──
  useEffect(() => {
    if (!orderId) return;

    isPollingRef.current = true;

    // Initial poll after 2 seconds (give user time to switch apps)
    const initialDelay = setTimeout(() => {
      pollOnce();
    }, 2000);

    // Then poll every 3 seconds
    pollIntervalRef.current = setInterval(pollOnce, 3000);

    // Auto-timeout after 5 minutes
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setState('timeout');
    }, 300000);

    return () => {
      clearTimeout(initialDelay);
      stopPolling();
    };
  }, [orderId]);

  // ── AppState: immediate poll when user returns from UPI app ──
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (
        nextState === 'active' &&
        (state === 'waiting' || state === 'confirming') &&
        orderId
      ) {
        console.log('[UPIConfirm] App returned to foreground — immediate poll');
        pollOnce();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [state, orderId, pollOnce]);

  // ── Manual confirm button ──
  const handleManualConfirm = async () => {
    haptics.buttonTap();
    setState('confirming');
    const result = await checkOrderStatus(orderId);
    if (result.status === 'paid') {
      stopPolling();
      setPaymentId(result.paymentId || 'upi_payment');
      await recordOrder(result.paymentId || 'upi_payment');
      haptics.success();
      setState('success');
    } else {
      setState('waiting');
      haptics.error();
    }
  };

  const goToOrders = () => {
    nav.getParent()?.reset({
      index: 1,
      routes: [
        { name: 'Main' },
        {
          name: 'OrderConfirmation',
          params: {
            orderId,
            paymentMethod: 'PREPAID',
            estimatedDelivery: '3-5 Business Days',
          },
        },
      ],
    });
  };

  const retry = () => {
    nav.goBack();
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ═══════════════════════════════════════════════════════════════════
  // SUCCESS STATE
  // ═══════════════════════════════════════════════════════════════════
  if (state === 'success') {
    return (
      <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={s.center}>
          <Animated.View
            style={[
              s.resultCircle,
              { backgroundColor: 'rgba(52,199,89,0.1)', transform: [{ scale: successScale }], opacity: successOpacity },
            ]}
          >
            <Ionicons name="checkmark-done" size={48} color={colors.success} />
          </Animated.View>
          <Animated.View style={{ opacity: successOpacity, alignItems: 'center' }}>
            <Typography size={20} weight="800" color={colors.text} style={{ letterSpacing: 3, marginTop: 32 }}>
              PAYMENT SUCCESSFUL!
            </Typography>
            <Typography size={10} color={colors.textMuted} style={{ marginTop: 12, letterSpacing: 1 }}>
              Payment ID: {paymentId}
            </Typography>
            <TouchableOpacity
              style={[s.ctaBtn, { backgroundColor: colors.foreground, marginTop: 40 }]}
              onPress={goToOrders}
            >
              <Typography size={11} weight="800" color={colors.background} style={{ letterSpacing: 1 }}>
                VIEW ORDER
              </Typography>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // FAILED / TIMEOUT STATE
  // ═══════════════════════════════════════════════════════════════════
  if (state === 'failed' || state === 'timeout') {
    return (
      <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={s.center}>
          <View style={[s.resultCircle, { backgroundColor: 'rgba(255,59,48,0.1)' }]}>
            <Ionicons name={state === 'timeout' ? 'time-outline' : 'close'} size={48} color={colors.error} />
          </View>
          <Typography size={20} weight="800" color={colors.text} style={{ letterSpacing: 3, marginTop: 32 }}>
            {state === 'timeout' ? 'TIMED OUT' : 'PAYMENT FAILED'}
          </Typography>
          <Typography size={11} color={colors.textMuted} style={{ marginTop: 12, textAlign: 'center', paddingHorizontal: 40 }}>
            {state === 'timeout'
              ? 'We did not receive confirmation. If you completed the payment, it will be processed shortly.'
              : errorMsg || 'Payment could not be confirmed.'}
          </Typography>
          <TouchableOpacity
            style={[s.ctaBtn, { backgroundColor: colors.foreground, marginTop: 40 }]}
            onPress={retry}
          >
            <Typography size={11} weight="800" color={colors.background} style={{ letterSpacing: 1 }}>
              TRY AGAIN
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 20, padding: 10 }} onPress={() => nav.goBack()}>
            <Typography size={10} weight="600" color={colors.textMuted}>Contact Support</Typography>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // WAITING STATE — Main UI
  // ═══════════════════════════════════════════════════════════════════
  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.headerBar}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: colors.surface }]}
          onPress={() => {
            stopPolling();
            nav.goBack();
          }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Typography size={14} weight="700" color={colors.text} style={{ letterSpacing: 1 }}>
          Confirm Payment
        </Typography>
        <View style={{ width: 44 }} />
      </View>

      <View style={s.center}>
        {/* Pulsing UPI icon */}
        <Animated.View
          style={[
            s.pulseCircle,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          {state === 'confirming' ? (
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Ionicons name="sync-outline" size={40} color={colors.textMuted} />
            </Animated.View>
          ) : (
            <Ionicons name="phone-portrait-outline" size={40} color={colors.textMuted} />
          )}
        </Animated.View>

        <Typography size={18} weight="800" color={colors.text} style={{ letterSpacing: 2, marginTop: 36 }}>
          {state === 'confirming' ? 'CHECKING...' : 'WAITING FOR PAYMENT'}
        </Typography>

        <Typography size={11} color={colors.textMuted} style={{ marginTop: 12, textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 }}>
          {state === 'confirming'
            ? 'Verifying your payment with Razorpay...'
            : 'Complete the payment in your UPI app.\nWe will automatically detect it.'}
        </Typography>

        {/* Timer */}
        <View style={[s.timerPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }]}>
          <Ionicons name="time-outline" size={14} color={colors.textExtraLight} />
          <Typography size={10} weight="700" color={colors.textExtraLight} style={{ marginLeft: 6 }}>
            {formatTime(elapsedSec)}
          </Typography>
        </View>

        {/* Amount */}
        <View style={[s.amountPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: colors.borderLight }]}>
          <Typography size={9} weight="700" color={colors.textExtraLight} style={{ letterSpacing: 1 }}>
            AMOUNT
          </Typography>
          <Typography size={28} weight="800" color={colors.text} style={{ marginTop: 4 }}>
            ₹{(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </Typography>
        </View>

        {/* Manual confirm button */}
        <TouchableOpacity
          style={[s.ctaBtn, { backgroundColor: colors.foreground, marginTop: 32 }]}
          onPress={handleManualConfirm}
          disabled={state === 'confirming'}
          activeOpacity={0.85}
        >
          <Typography size={11} weight="800" color={colors.background} style={{ letterSpacing: 1 }}>
            {state === 'confirming' ? 'VERIFYING...' : "I'VE COMPLETED PAYMENT"}
          </Typography>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ marginTop: 20, padding: 10 }}
          onPress={() => {
            stopPolling();
            nav.goBack();
          }}
        >
          <Typography size={10} weight="600" color={colors.textMuted}>Cancel and Go Back</Typography>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  pulseCircle: {
    width: 120, height: 120, borderRadius: 60,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5,
  },
  resultCircle: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center' },
  timerPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, marginTop: 24,
  },
  amountPill: {
    alignItems: 'center',
    paddingHorizontal: 32, paddingVertical: 16,
    borderRadius: 24, marginTop: 20,
    borderWidth: 1,
  },
  ctaBtn: {
    paddingVertical: 18, paddingHorizontal: 48,
    borderRadius: 27, minWidth: 200,
    alignItems: 'center',
  },
});
