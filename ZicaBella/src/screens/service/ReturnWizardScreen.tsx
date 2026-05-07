import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import GlassHeader from '../../components/GlassHeader';
import { useColors } from '../../constants/colors';
import { useThemeStore } from '../../store/themeStore';
import { Typography } from '../../components/Typography';
import { haptics } from '../../utils/haptics';
import { config } from '../../constants/config';
import { formatPrice } from '../../utils/formatPrice';
import { ServiceStackParamList } from '../../navigation/types';

type Step = 'SELECTION' | 'REASON' | 'METHOD' | 'REFUND_METHOD' | 'REVIEW' | 'SUCCESS';

const RETURN_REASONS = [
  'Size too small',
  'Size too large',
  'Damaged / Defective',
  'Wrong item received',
  'Not as described',
  'Quality not as expected',
  'Other',
];

export default function ReturnWizardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ServiceStackParamList, 'ReturnWizard'>>();
  const { orderId, initialItems } = route.params;
  const colors = useColors();
  const isDark = useThemeStore(s => s.theme) === 'dark';

  const [step, setStep] = useState<Step>('SELECTION');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>(initialItems || []);
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [method, setMethod] = useState<'DROP_OFF' | 'PICKUP' | null>(null);
  const [refundMethod, setRefundMethod] = useState<'ORIGINAL' | 'STORE_CREDIT'>('ORIGINAL');
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
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

  const toggleItem = (id: string) => {
    haptics.buttonTap();
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    haptics.buttonTap();
    if (step === 'SELECTION' && selectedItems.length > 0) setStep('REASON');
    else if (step === 'REASON' && (reason || otherReason)) setStep('METHOD');
    else if (step === 'METHOD' && method) setStep('REFUND_METHOD');
    else if (step === 'REFUND_METHOD') setStep('REVIEW');
    else if (step === 'REVIEW') submitReturn();
  };

  const handleBack = () => {
    haptics.buttonTap();
    if (step === 'REASON') setStep('SELECTION');
    else if (step === 'METHOD') setStep('REASON');
    else if (step === 'REFUND_METHOD') setStep('METHOD');
    else if (step === 'REVIEW') setStep('REFUND_METHOD');
    else navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main');
  };

  const selectedItemsData = order?.items?.filter((i: any) => selectedItems.includes(i.id)) || [];
  const totalRefund = selectedItemsData.reduce((sum: number, i: any) => sum + (i.price * (i.quantity || 1)), 0);

  const submitReturn = async () => {
    setSubmitting(true);
    try {
      const payload = {
        orderId,
        method,
        refundMethod,
        items: selectedItems.map(id => ({
          lineItemId: id,
          quantity: 1,
          reason: reason === 'Other' ? otherReason : reason,
          action: 'return' as const,
        })),
        notes: reason === 'Other' ? otherReason : reason,
      };

      const res = await fetch(`${config.appUrl}/api/app/orders/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setResult(json);
        setStep('SUCCESS');
        haptics.success();
      } else {
        throw new Error(json.error || 'Failed to submit return');
      }
    } catch (e: any) {
      console.error('Submit Return Error:', e);
      haptics.error();
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = () => {
    if (step === 'SELECTION') return selectedItems.length > 0;
    if (step === 'REASON') return reason !== '' && (reason !== 'Other' || otherReason.trim().length > 0);
    if (step === 'METHOD') return method !== null;
    if (step === 'REFUND_METHOD') return true;
    if (step === 'REVIEW') return true;
    return false;
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.foreground} /></View>;

  const stepIndex = ['SELECTION', 'REASON', 'METHOD', 'REFUND_METHOD', 'REVIEW'].indexOf(step);
  const totalSteps = 5;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader title="INITIATE RETURN" showBack />
      
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120, paddingTop: insets.top + 70 }]}>
        {/* Step indicator */}
        {step !== 'SUCCESS' && (
          <View style={styles.stepIndicator}>
            {Array.from({ length: totalSteps }).map((_, idx) => (
              <View
                key={idx}
                style={[styles.stepDot, { 
                  backgroundColor: idx <= stepIndex ? colors.foreground : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                  flex: idx <= stepIndex ? 2 : 1,
                }]}
              />
            ))}
          </View>
        )}

        {/* STEP 1: SELECTION */}
        {step === 'SELECTION' && (
          <View>
            <Typography size={12} weight="700" color={colors.text} style={styles.stepTitle}>Select items to return</Typography>
            <Typography size={9} color={colors.textMuted} style={{ marginBottom: 20 }}>Tap to select one or more items for return</Typography>
            <View style={styles.itemList}>
              {order?.items?.map((item: any) => {
                const isSelected = selectedItems.includes(item.id);
                return (
                  <TouchableOpacity 
                    key={item.id} 
                    activeOpacity={0.8}
                    onPress={() => toggleItem(item.id)}
                    style={[styles.itemCard, { 
                      borderColor: isSelected ? colors.foreground : colors.borderLight,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff'
                    }]}
                  >
                    <View style={[styles.checkbox, { borderColor: isSelected ? colors.foreground : colors.borderLight, backgroundColor: isSelected ? colors.foreground : 'transparent' }]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color={colors.background} />}
                    </View>
                    <View style={styles.itemThumb}>
                      {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="shirt-outline" size={16} color={colors.textExtraLight} />}
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Typography size={10} weight="600" color={colors.text} numberOfLines={1}>{item.title}</Typography>
                      <Typography size={8} color={colors.textMuted} style={{ marginTop: 2 }}>SIZE: {item.size || 'M'} · {formatPrice(item.price)}</Typography>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* STEP 2: REASON */}
        {step === 'REASON' && (
          <View>
            <Typography size={12} weight="700" color={colors.text} style={styles.stepTitle}>Why are you returning?</Typography>
            <View style={styles.reasonList}>
              {RETURN_REASONS.map(r => (
                <TouchableOpacity
                  key={r}
                  activeOpacity={0.8}
                  onPress={() => { haptics.buttonTap(); setReason(r); }}
                  style={[
                    styles.reasonChip,
                    {
                      borderColor: reason === r ? colors.foreground : colors.borderLight,
                      backgroundColor: reason === r ? (isDark ? 'rgba(255,255,255,0.06)' : colors.surface) : 'transparent',
                    }
                  ]}
                >
                  <View style={[styles.radioOuter, { borderColor: reason === r ? colors.foreground : colors.borderLight }]}>
                    {reason === r && <View style={[styles.radioInner, { backgroundColor: colors.foreground }]} />}
                  </View>
                  <Typography size={10} weight={reason === r ? '700' : '500'} color={reason === r ? colors.text : colors.textMuted}>{r}</Typography>
                </TouchableOpacity>
              ))}

              {reason === 'Other' && (
                <TextInput
                  placeholder="Please describe the issue..."
                  placeholderTextColor={colors.textExtraLight}
                  value={otherReason}
                  onChangeText={setOtherReason}
                  multiline
                  style={[styles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.borderLight }]}
                />
              )}
            </View>
          </View>
        )}

        {/* STEP 3: RETURN METHOD */}
        {step === 'METHOD' && (
          <View>
            <Typography size={12} weight="700" color={colors.text} style={styles.stepTitle}>How will you return?</Typography>
            <View style={styles.methodList}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => { haptics.buttonTap(); setMethod('PICKUP'); }}
                style={[styles.methodCard, { borderColor: method === 'PICKUP' ? colors.foreground : colors.borderLight, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff' }]}
              >
                <View style={[styles.methodIcon, { backgroundColor: method === 'PICKUP' ? colors.foreground + '15' : colors.surface }]}>
                  <Ionicons name="car-outline" size={24} color={method === 'PICKUP' ? colors.foreground : colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Typography size={11} weight="700" color={colors.text}>Schedule Pickup</Typography>
                  <Typography size={8} color={colors.textMuted} style={{ marginTop: 4, lineHeight: 13 }}>We'll send a courier to pick up the item from your address. Takes 3–5 business days.</Typography>
                </View>
                <View style={[styles.radioOuter, { borderColor: method === 'PICKUP' ? colors.foreground : colors.borderLight, marginLeft: 12 }]}>
                  {method === 'PICKUP' && <View style={[styles.radioInner, { backgroundColor: colors.foreground }]} />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => { haptics.buttonTap(); setMethod('DROP_OFF'); }}
                style={[styles.methodCard, { borderColor: method === 'DROP_OFF' ? colors.foreground : colors.borderLight, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff' }]}
              >
                <View style={[styles.methodIcon, { backgroundColor: method === 'DROP_OFF' ? colors.foreground + '15' : colors.surface }]}>
                  <Ionicons name="location-outline" size={24} color={method === 'DROP_OFF' ? colors.foreground : colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Typography size={11} weight="700" color={colors.text}>Self Drop-off</Typography>
                  <Typography size={8} color={colors.textMuted} style={{ marginTop: 4, lineHeight: 13 }}>Ship the item back using any courier. We'll provide a shipping label.</Typography>
                </View>
                <View style={[styles.radioOuter, { borderColor: method === 'DROP_OFF' ? colors.foreground : colors.borderLight, marginLeft: 12 }]}>
                  {method === 'DROP_OFF' && <View style={[styles.radioInner, { backgroundColor: colors.foreground }]} />}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 4: REFUND METHOD */}
        {step === 'REFUND_METHOD' && (
          <View>
            <Typography size={12} weight="700" color={colors.text} style={styles.stepTitle}>Refund preference</Typography>
            <Typography size={9} color={colors.textMuted} style={{ marginBottom: 24 }}>Choose how you'd like to receive your refund</Typography>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => { haptics.buttonTap(); setRefundMethod('STORE_CREDIT'); }}
              style={[styles.methodCard, { 
                borderColor: refundMethod === 'STORE_CREDIT' ? colors.success : colors.borderLight, 
                backgroundColor: refundMethod === 'STORE_CREDIT' ? (isDark ? 'rgba(52,199,89,0.06)' : 'rgba(52,199,89,0.03)') : (isDark ? 'rgba(255,255,255,0.03)' : '#fff')
              }]}
            >
              <View style={[styles.methodIcon, { backgroundColor: refundMethod === 'STORE_CREDIT' ? 'rgba(52,199,89,0.15)' : colors.surface }]}>
                <Ionicons name="wallet-outline" size={24} color={refundMethod === 'STORE_CREDIT' ? colors.success : colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Typography size={11} weight="700" color={colors.text}>Store Credits</Typography>
                  <View style={[styles.recommendedBadge, { backgroundColor: colors.success + '20' }]}>
                    <Typography size={5.5} weight="800" color={colors.success}>RECOMMENDED</Typography>
                  </View>
                </View>
                <Typography size={8} color={colors.textMuted} style={{ marginTop: 4, lineHeight: 13 }}>Instant credit of {formatPrice(totalRefund)} to your account. Use on any future purchase.</Typography>
              </View>
              <View style={[styles.radioOuter, { borderColor: refundMethod === 'STORE_CREDIT' ? colors.success : colors.borderLight, marginLeft: 12 }]}>
                {refundMethod === 'STORE_CREDIT' && <View style={[styles.radioInner, { backgroundColor: colors.success }]} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => { haptics.buttonTap(); setRefundMethod('ORIGINAL'); }}
              style={[styles.methodCard, { 
                borderColor: refundMethod === 'ORIGINAL' ? colors.foreground : colors.borderLight, 
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                marginTop: 12,
              }]}
            >
              <View style={[styles.methodIcon, { backgroundColor: refundMethod === 'ORIGINAL' ? colors.foreground + '15' : colors.surface }]}>
                <Ionicons name="card-outline" size={24} color={refundMethod === 'ORIGINAL' ? colors.foreground : colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Typography size={11} weight="700" color={colors.text}>Original Payment Method</Typography>
                <Typography size={8} color={colors.textMuted} style={{ marginTop: 4, lineHeight: 13 }}>Refund to your original payment method. Takes 5–7 business days after item is received.</Typography>
              </View>
              <View style={[styles.radioOuter, { borderColor: refundMethod === 'ORIGINAL' ? colors.foreground : colors.borderLight, marginLeft: 12 }]}>
                {refundMethod === 'ORIGINAL' && <View style={[styles.radioInner, { backgroundColor: colors.foreground }]} />}
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 5: REVIEW */}
        {step === 'REVIEW' && (
          <View>
            <Typography size={12} weight="700" color={colors.text} style={styles.stepTitle}>Review your return</Typography>
            <View style={[styles.reviewCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff', borderColor: colors.borderLight }]}>
              <Typography size={7} weight="800" color={colors.textExtraLight} style={{ letterSpacing: 1.5, marginBottom: 16 }}>RETURN SUMMARY</Typography>
              
              {selectedItemsData.map((item: any) => (
                <View key={item.id} style={styles.reviewItem}>
                  <Typography size={9} weight="500" color={colors.text} numberOfLines={1} style={{ flex: 1 }}>{item.title}</Typography>
                  <Typography size={9} weight="600" color={colors.textMuted}>{formatPrice(item.price)}</Typography>
                </View>
              ))}

              <View style={[styles.reviewDivider, { backgroundColor: colors.borderExtraLight }]} />
              
              <View style={styles.reviewRow}>
                <Typography size={8} color={colors.textMuted}>Reason</Typography>
                <Typography size={8} weight="600" color={colors.text}>{reason === 'Other' ? otherReason : reason}</Typography>
              </View>
              <View style={styles.reviewRow}>
                <Typography size={8} color={colors.textMuted}>Return Method</Typography>
                <Typography size={8} weight="600" color={colors.text}>{method === 'PICKUP' ? 'Courier Pickup' : 'Self Drop-off'}</Typography>
              </View>
              <View style={styles.reviewRow}>
                <Typography size={8} color={colors.textMuted}>Refund To</Typography>
                <Typography size={8} weight="600" color={refundMethod === 'STORE_CREDIT' ? colors.success : colors.text}>
                  {refundMethod === 'STORE_CREDIT' ? 'Store Credits (Instant)' : 'Original Payment'}
                </Typography>
              </View>

              <View style={[styles.reviewDivider, { backgroundColor: colors.borderExtraLight }]} />
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Typography size={11} weight="800" color={colors.text}>REFUND</Typography>
                <Typography size={14} weight="800" color={refundMethod === 'STORE_CREDIT' ? colors.success : colors.iosBlue}>{formatPrice(totalRefund)}</Typography>
              </View>
            </View>
          </View>
        )}

        {/* SUCCESS */}
        {step === 'SUCCESS' && (
          <View style={styles.successView}>
            <View style={[styles.successIcon, { backgroundColor: colors.success + '15' }]}>
              <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            </View>
            <Typography size={16} weight="800" color={colors.text} style={{ marginTop: 24 }}>RETURN SUBMITTED</Typography>
            <Typography size={10} color={colors.textMuted} style={{ marginTop: 8, textAlign: 'center' }}>Ref: {result?.referenceNumber || 'ZB-RET-XXXX'}</Typography>
            
            {refundMethod === 'STORE_CREDIT' && (
              <View style={[styles.creditConfirm, { backgroundColor: 'rgba(52,199,89,0.08)', borderColor: 'rgba(52,199,89,0.2)' }]}>
                <Ionicons name="wallet-outline" size={18} color={colors.success} />
                <Typography size={9} weight="600" color={colors.success} style={{ marginLeft: 8 }}>{formatPrice(totalRefund)} credited to your account</Typography>
              </View>
            )}
            
            <Typography size={9} color={colors.textLight} style={{ marginTop: 20, textAlign: 'center', lineHeight: 16 }}>
              {method === 'PICKUP' 
                ? 'A courier will contact you to schedule pickup. Keep the item packed and ready.'
                : 'Please ship the item back within 5 days. Download the shipping label from your services page.'}
            </Typography>
            <TouchableOpacity style={[styles.backBtn, { borderColor: colors.borderLight, marginTop: 40 }]} onPress={() => navigation.popToTop()}>
              <Typography size={9} weight="700" color={colors.text}>BACK TO HOME</Typography>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Footer Navigation */}
      {step !== 'SUCCESS' && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.footerRow}>
            {step !== 'SELECTION' && (
              <TouchableOpacity 
                onPress={handleBack}
                style={[styles.backStepBtn, { borderColor: colors.borderLight }]}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              disabled={!canProceed() || submitting}
              onPress={handleNext}
              style={[styles.nextBtn, { 
                backgroundColor: colors.foreground, 
                opacity: !canProceed() ? 0.4 : 1,
                flex: 1,
                marginLeft: step !== 'SELECTION' ? 12 : 0,
              }]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Typography size={10} weight="800" color={colors.background}>
                  {step === 'REVIEW' ? 'SUBMIT RETURN' : 'CONTINUE'}
                </Typography>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stepIndicator: { flexDirection: 'row', gap: 4, marginBottom: 28 },
  stepDot: { height: 3, borderRadius: 1.5 },
  stepTitle: { marginBottom: 8, letterSpacing: -0.5 },
  itemList: { gap: 12 },
  itemCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  itemThumb: { width: 56, height: 56, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
  reasonList: { gap: 10 },
  reasonChip: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 14 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  textArea: { height: 100, borderRadius: 16, borderWidth: 1, padding: 16, fontSize: 13, textAlignVertical: 'top', marginTop: 12 },
  methodList: { gap: 12 },
  methodCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, borderWidth: 1 },
  methodIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  recommendedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  reviewCard: { padding: 24, borderRadius: 24, borderWidth: 1 },
  reviewItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  reviewDivider: { height: 1, marginVertical: 16 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  footer: { position: 'absolute', bottom: 0, left: 20, right: 20 },
  footerRow: { flexDirection: 'row', alignItems: 'center' },
  backStepBtn: { width: 52, height: 56, borderRadius: 18, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  nextBtn: { height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  successView: { alignItems: 'center', paddingTop: 60 },
  successIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  creditConfirm: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, borderWidth: 1, marginTop: 20 },
  backBtn: { width: '100%', height: 60, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
});
