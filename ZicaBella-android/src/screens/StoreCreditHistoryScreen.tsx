import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../components/GlassView';
import { useColors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { config } from '../constants/config';
import { Typography } from '../components/Typography';
import { haptics } from '../utils/haptics';
import { formatPrice } from '../utils/formatPrice';
import { useThemeStore } from '../store/themeStore';

export default function StoreCreditHistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const colors = useColors();
  const { user } = useAuth();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';

  const [transactions, setTransactions] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${config.appUrl}/api/app/store-credits?customerId=${user.id}`, {
        headers: { 'Authorization': `Bearer ${token || ''}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setBalance(data.balance || 0);
      }
    } catch (error) {
      console.error('[StoreCreditHistory] Fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
    haptics.buttonTap();
  };

  const renderItem = ({ item }: { item: any }) => {
    const isCredit = item.amount > 0;
    return (
      <View style={[styles.transactionItem, { borderBottomColor: colors.borderExtraLight }]}>
        <View style={[styles.iconContainer, { backgroundColor: isCredit ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)' }]}>
          <Ionicons 
            name={isCredit ? "arrow-up-outline" : "arrow-down-outline"} 
            size={18} 
            color={isCredit ? colors.success : colors.error} 
          />
        </View>
        <View style={styles.itemMain}>
          <Typography weight="600" size={13} color={colors.text}>{item.description}</Typography>
          <Typography weight="400" size={10} color={colors.textExtraLight} style={{ marginTop: 2 }}>
            {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Typography>
        </View>
        <View style={styles.itemRight}>
          <Typography 
            weight="700" 
            size={14} 
            color={isCredit ? colors.success : colors.error}
          >
            {isCredit ? '+' : ''}{formatPrice(item.amount)}
          </Typography>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <GlassView intensity={isDark ? 30 : 60} tint={theme} style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderExtraLight }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Typography heading weight="700" size={16} color={colors.text}>STORE CREDITS</Typography>
        <View style={{ width: 40 }} />
      </GlassView>

      <FlatList
        data={transactions}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
        ListHeaderComponent={() => (
          <View style={styles.balanceContainer}>
            <View style={[styles.balanceCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <Typography weight="500" size={10} color={colors.textExtraLight} style={{ letterSpacing: 1.5 }}>CURRENT BALANCE</Typography>
              <Typography heading weight="700" size={32} color={colors.text} style={{ marginTop: 8 }}>
                {formatPrice(balance)}
              </Typography>
              <View style={styles.walletIcon}>
                <Ionicons name="wallet-outline" size={40} color={colors.textExtraLight} style={{ opacity: 0.1 }} />
              </View>
            </View>
            <Typography heading weight="600" size={12} color={colors.textLight} style={styles.sectionTitle}>TRANSACTION HISTORY</Typography>
          </View>
        )}
        ListEmptyComponent={() => (
          loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.textExtraLight} />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color={colors.textExtraLight} style={{ opacity: 0.2 }} />
              <Typography size={12} color={colors.textExtraLight} style={{ marginTop: 16 }}>No transactions yet</Typography>
            </View>
          )
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textExtraLight} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  listContent: {
    paddingTop: 20,
  },
  balanceContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  balanceCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 32,
  },
  walletIcon: {
    position: 'absolute',
    right: -10,
    bottom: -10,
  },
  sectionTitle: {
    letterSpacing: 2,
    marginBottom: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  itemMain: {
    flex: 1,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
});
