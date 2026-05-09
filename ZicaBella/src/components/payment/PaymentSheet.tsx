import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Dimensions,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import RazorpayCheckout from 'react-native-razorpay';
import { useColors } from '../../constants/colors';
import { formatPrice } from '../../utils/formatPrice';
import { haptics } from '../../utils/haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.88;

// ─── UPI Apps ────────────────────────────────────────────────────────────────

const UPI_APPS = [
  { id: 'phonepe',    label: 'PhonePe',   icon: '📱', app_name: 'phonepe' },
  { id: 'google_pay', label: 'GPay',      icon: '🔵', app_name: 'google_pay' },
  { id: 'paytm',     label: 'Paytm',     icon: '💙', app_name: 'paytm' },
  { id: 'mobikwik',  label: 'MobiKwik',  icon: '💜', app_name: 'mobikwik' },
  { id: 'bhim',      label: 'BHIM',      icon: '🇮🇳', app_name: 'bhim' },
  { id: 'upi',       label: 'Other UPI', icon: '🔗', app_name: '' },
] as const;

// ─── Banks ───────────────────────────────────────────────────────────────────

const TOP_BANKS = [
  { code: 'SBIN', name: 'SBI',    icon: '🏦' },
  { code: 'HDFC', name: 'HDFC',   icon: '🏦' },
  { code: 'ICIC', name: 'ICICI',  icon: '🏦' },
  { code: 'UTIB', name: 'Axis',   icon: '🏦' },
  { code: 'KKBK', name: 'Kotak',  icon: '🏦' },
  { code: 'YESB', name: 'Yes Bank', icon: '🏦' },
];

const ALL_BANKS = [
  ...TOP_BANKS,
  { code: 'PUNB', name: 'Punjab National', icon: '🏦' },
  { code: 'BARB', name: 'Bank of Baroda', icon: '🏦' },
  { code: 'CNRB', name: 'Canara Bank', icon: '🏦' },
  { code: 'UBIN', name: 'Union Bank', icon: '🏦' },
  { code: 'IOBA', name: 'IOB', icon: '🏦' },
  { code: 'INDB', name: 'IndusInd', icon: '🏦' },
  { code: 'FDRL', name: 'Federal Bank', icon: '🏦' },
  { code: 'KVBL', name: 'KVB', icon: '🏦' },
];

// ─── Wallets ─────────────────────────────────────────────────────────────────

const WALLETS = [
  { id: 'paytm',       name: 'Paytm Wallet',   icon: '💙' },
  { id: 'phonepe',     name: 'PhonePe Wallet',  icon: '📱' },
  { id: 'amazonpay',   name: 'Amazon Pay',      icon: '🟠' },
  { id: 'freecharge',  name: 'Freecharge',      icon: '🟡' },
  { id: 'airtelmoney', name: 'Airtel Money',    icon: '🔴' },
];

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'upi' | 'card' | 'netbanking' | 'wallet';

export interface PaymentSheetProps {
  visible: boolean;
  amount: number;        // in rupees
  orderId: string;       // razorpay order_id from backend
  razorpayKeyId: string;
  prefill: { name: string; email: string; contact: string };
  onSuccess: (data: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  onFailure: (error: any) => void;
  onClose: () => void;
}

// ─── Format card number with spaces ──────────────────────────────────────────

function formatCardNumber(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PaymentSheet({
  visible,
  amount,
  orderId,
  razorpayKeyId,
  prefill,
  onSuccess,
  onFailure,
  onClose,
}: PaymentSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const [tab, setTab] = useState<Tab>('upi');
  const [loading, setLoading] = useState(false);

  // UPI state
  const [selectedUpiApp, setSelectedUpiApp] = useState<string | null>(null);
  const [upiId, setUpiId] = useState('');

  // Card state
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  // Net banking state
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [bankSearch, setBankSearch] = useState('');

  // Wallet state
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  // ── Animate in/out ────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 24,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const amountPaise = Math.round(amount * 100);
  const amountLabel = formatPrice(amount);

  // ── Build Razorpay options ────────────────────────────────────────────────
  const buildOptions = (): Record<string, any> => {
    const base = {
      key: razorpayKeyId,
      amount: String(amountPaise),
      currency: 'INR',
      name: 'Zica Bella',
      order_id: orderId,
      prefill,
      theme: { color: '#FFFFFF' },
      modal: { confirm_close: true, backdropclose: false },
    };

    if (tab === 'upi') {
      if (Platform.OS === 'android' && selectedUpiApp && selectedUpiApp !== 'upi') {
        return { ...base, method: 'upi', upi_type: 'intent', app_name: selectedUpiApp };
      }
      // iOS or "Other UPI" — use collect flow with UPI ID
      return { ...base, method: 'upi', vpa: upiId.trim() };
    }

    if (tab === 'card') {
      return { ...base, method: 'card' };
    }

    if (tab === 'netbanking') {
      return { ...base, method: 'netbanking', bank: selectedBank ?? '' };
    }

    if (tab === 'wallet') {
      return { ...base, method: 'wallet', wallet: selectedWallet ?? '' };
    }

    return base;
  };

  // ── Validation before opening ─────────────────────────────────────────────
  const validate = (): string | null => {
    if (tab === 'upi') {
      if (Platform.OS === 'android') {
        if (!selectedUpiApp) return 'Please select a UPI app.';
        if (selectedUpiApp === 'upi' && !upiId.trim()) return 'Please enter your UPI ID.';
      } else {
        if (!upiId.trim()) return 'Please enter your UPI ID.';
      }
    }
    if (tab === 'card') {
      if (cardNumber.replace(/\s/g, '').length < 16) return 'Enter a valid 16-digit card number.';
      if (!cardName.trim()) return 'Enter cardholder name.';
      if (expiry.length < 5) return 'Enter a valid expiry (MM/YY).';
      if (cvv.length < 3) return 'Enter a valid CVV.';
    }
    if (tab === 'netbanking' && !selectedBank) return 'Please select a bank.';
    if (tab === 'wallet' && !selectedWallet) return 'Please select a wallet.';
    return null;
  };

  const handlePay = async () => {
    const err = validate();
    if (err) { Alert.alert('Missing details', err); return; }

    haptics.buttonTap();
    setLoading(true);

    try {
      const options = buildOptions();
      const data = await RazorpayCheckout.open(options);
      onSuccess(data as any);
    } catch (error: any) {
      if (error?.code === 2 || error?.code === 0 || error?.description === 'User cancelled') {
        // User cancelled — just close, no error alert
        onClose();
      } else {
        onFailure(error);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Filtered banks ────────────────────────────────────────────────────────
  const filteredBanks = bankSearch.trim()
    ? ALL_BANKS.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()))
    : TOP_BANKS;

  // ── Colors shorthand ──────────────────────────────────────────────────────
  const CARD_BG = 'rgba(255,255,255,0.05)';
  const CARD_BORDER = 'rgba(255,255,255,0.10)';
  const SELECTED_BORDER = 'rgba(255,255,255,0.90)';
  const TEXT = '#FFFFFF';
  const MUTED = 'rgba(255,255,255,0.55)';

  const inputStyle = [s.input, { backgroundColor: CARD_BG, borderColor: CARD_BORDER, color: TEXT }];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 16 }]}>

        {/* Drag Handle */}
        <View style={s.handleBar} />

        {/* Header */}
        <View style={s.sheetHeader}>
          <View>
            <Text style={s.sheetTitle}>Payment</Text>
            <Text style={s.sheetSubtitle}>{amountLabel} · Zica Bella</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          {(['upi', 'card', 'netbanking', 'wallet'] as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tab, tab === t && s.tabActive]}
              onPress={() => { haptics.buttonTap(); setTab(t); }}
              activeOpacity={0.75}
            >
              <Text style={[s.tabLabel, { color: tab === t ? '#000' : MUTED }]}>
                {t === 'netbanking' ? 'Net Banking' : t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── UPI Tab ─────────────────────────────────────────── */}
            {tab === 'upi' && (
              <View style={s.section}>
                {Platform.OS === 'android' ? (
                  <>
                    <Text style={[s.sectionLabel, { color: MUTED }]}>PAY WITH UPI APP</Text>
                    <View style={s.upiGrid}>
                      {UPI_APPS.map(app => (
                        <TouchableOpacity
                          key={app.id}
                          style={[
                            s.upiCard,
                            {
                              backgroundColor: CARD_BG,
                              borderColor: selectedUpiApp === app.id ? SELECTED_BORDER : CARD_BORDER,
                            },
                          ]}
                          onPress={() => {
                            haptics.buttonTap();
                            setSelectedUpiApp(app.id);
                          }}
                          activeOpacity={0.75}
                        >
                          <Text style={s.upiIcon}>{app.icon}</Text>
                          <Text style={[s.upiLabel, { color: TEXT }]}>{app.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {selectedUpiApp === 'upi' && (
                      <TextInput
                        style={inputStyle}
                        placeholder="Enter UPI ID (e.g. name@upi)"
                        placeholderTextColor={MUTED}
                        value={upiId}
                        onChangeText={setUpiId}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                    )}
                  </>
                ) : (
                  /* iOS — UPI ID only */
                  <>
                    <Text style={[s.sectionLabel, { color: MUTED }]}>UPI ID</Text>
                    <TextInput
                      style={inputStyle}
                      placeholder="Enter UPI ID (e.g. name@upi)"
                      placeholderTextColor={MUTED}
                      value={upiId}
                      onChangeText={setUpiId}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                    <Text style={[s.hint, { color: MUTED }]}>
                      UPI app intents are not supported on iOS. Please enter your VPA to pay.
                    </Text>
                  </>
                )}
              </View>
            )}

            {/* ── Card Tab ────────────────────────────────────────── */}
            {tab === 'card' && (
              <View style={s.section}>
                <Text style={[s.sectionLabel, { color: MUTED }]}>CARD DETAILS</Text>
                <TextInput
                  style={inputStyle}
                  placeholder="Card number"
                  placeholderTextColor={MUTED}
                  value={cardNumber}
                  onChangeText={v => setCardNumber(formatCardNumber(v))}
                  keyboardType="numeric"
                  maxLength={19}
                />
                <TextInput
                  style={inputStyle}
                  placeholder="Cardholder name"
                  placeholderTextColor={MUTED}
                  value={cardName}
                  onChangeText={setCardName}
                  autoCapitalize="words"
                />
                <View style={s.cardRow}>
                  <TextInput
                    style={[inputStyle, { flex: 1 }]}
                    placeholder="MM/YY"
                    placeholderTextColor={MUTED}
                    value={expiry}
                    onChangeText={v => setExpiry(formatExpiry(v))}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                  <TextInput
                    style={[inputStyle, { flex: 1 }]}
                    placeholder="CVV"
                    placeholderTextColor={MUTED}
                    value={cvv}
                    onChangeText={v => setCvv(v.replace(/\D/g, '').slice(0, 4))}
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={4}
                  />
                </View>
                <View style={[s.secureRow, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}>
                  <Ionicons name="lock-closed" size={12} color={MUTED} />
                  <Text style={[s.secureText, { color: MUTED }]}>
                    Your card details are encrypted and processed securely.
                  </Text>
                </View>
              </View>
            )}

            {/* ── Net Banking Tab ──────────────────────────────────── */}
            {tab === 'netbanking' && (
              <View style={s.section}>
                <Text style={[s.sectionLabel, { color: MUTED }]}>SELECT BANK</Text>
                <View style={s.bankGrid}>
                  {TOP_BANKS.map(bank => (
                    <TouchableOpacity
                      key={bank.code}
                      style={[
                        s.bankCard,
                        {
                          backgroundColor: CARD_BG,
                          borderColor: selectedBank === bank.code ? SELECTED_BORDER : CARD_BORDER,
                        },
                      ]}
                      onPress={() => { haptics.buttonTap(); setSelectedBank(bank.code); }}
                      activeOpacity={0.75}
                    >
                      <Text style={s.bankIcon}>{bank.icon}</Text>
                      <Text style={[s.bankName, { color: TEXT }]}>{bank.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[inputStyle, { marginTop: 12 }]}
                  placeholder="Search other banks..."
                  placeholderTextColor={MUTED}
                  value={bankSearch}
                  onChangeText={setBankSearch}
                />
                {bankSearch.trim().length > 0 && (
                  <View style={[s.bankList, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}>
                    {filteredBanks.length === 0 ? (
                      <Text style={[s.bankListEmpty, { color: MUTED }]}>No banks found</Text>
                    ) : (
                      filteredBanks.map(bank => (
                        <TouchableOpacity
                          key={bank.code}
                          style={[
                            s.bankListItem,
                            { borderBottomColor: CARD_BORDER },
                            selectedBank === bank.code && { backgroundColor: 'rgba(255,255,255,0.08)' },
                          ]}
                          onPress={() => { haptics.buttonTap(); setSelectedBank(bank.code); setBankSearch(''); }}
                          activeOpacity={0.75}
                        >
                          <Text style={[s.bankListName, { color: TEXT }]}>{bank.name}</Text>
                          {selectedBank === bank.code && (
                            <Ionicons name="checkmark" size={16} color={TEXT} />
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>
            )}

            {/* ── Wallet Tab ───────────────────────────────────────── */}
            {tab === 'wallet' && (
              <View style={s.section}>
                <Text style={[s.sectionLabel, { color: MUTED }]}>SELECT WALLET</Text>
                {WALLETS.map(w => (
                  <TouchableOpacity
                    key={w.id}
                    style={[
                      s.walletRow,
                      {
                        backgroundColor: CARD_BG,
                        borderColor: selectedWallet === w.id ? SELECTED_BORDER : CARD_BORDER,
                      },
                    ]}
                    onPress={() => { haptics.buttonTap(); setSelectedWallet(w.id); }}
                    activeOpacity={0.75}
                  >
                    <Text style={s.walletIcon}>{w.icon}</Text>
                    <Text style={[s.walletName, { color: TEXT }]}>{w.name}</Text>
                    {selectedWallet === w.id && (
                      <View style={s.walletCheck}>
                        <Ionicons name="checkmark-circle" size={20} color={TEXT} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

          </ScrollView>
        </KeyboardAvoidingView>

        {/* Pay Button */}
        <TouchableOpacity
          style={[s.payBtn, loading && { opacity: 0.7 }]}
          onPress={handlePay}
          disabled={loading}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={`Pay ${amountLabel}`}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={s.payBtnText}>Pay {amountLabel}</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: 'rgba(12,12,12,0.97)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  content: {
    paddingBottom: 8,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  // UPI
  upiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  upiCard: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  upiIcon: {
    fontSize: 26,
  },
  upiLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  hint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  // Card
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  secureText: {
    fontSize: 10,
    flex: 1,
    lineHeight: 14,
  },
  // Net Banking
  bankGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bankCard: {
    width: '30%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 6,
  },
  bankIcon: {
    fontSize: 22,
  },
  bankName: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  bankList: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  bankListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bankListName: {
    fontSize: 13,
    fontWeight: '600',
  },
  bankListEmpty: {
    padding: 16,
    textAlign: 'center',
    fontSize: 12,
  },
  // Wallet
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 14,
  },
  walletIcon: {
    fontSize: 24,
  },
  walletName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  walletCheck: {
    opacity: 0.9,
  },
  // Input
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  // Pay button
  payBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  payBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
