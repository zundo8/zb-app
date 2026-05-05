import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TextInput, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../constants/colors';
import { config } from '../constants/config';
import { useSearchProducts, useCollections } from '../hooks/useProducts';
import ProductCard from '../components/ProductCard';
import { useRecentStore } from '../store/recentStore';
import { useThemeStore } from '../store/themeStore';
import { useUIStore } from '../store/uiStore';
import GlassHeader from '../components/GlassHeader';
import { Typography } from '../components/Typography';
import { BlurView } from 'expo-blur';
import StorefrontFooter from '../components/StorefrontFooter';

const { width } = Dimensions.get('window');

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const [query, setQuery] = useState('');
  const { results, loading, search } = useSearchProducts();
  const { collections, loading: collectionsLoading, refetch } = useCollections(20, 'menu');
  const { recentProducts } = useRecentStore();
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(text);
    }, 300);
  }, [search]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    if (query) await search(query);
    setRefreshing(false);
  }, [refetch, search, query]);

  const setTabBarVisible = useUIStore(s => s.setTabBarVisible);
  const lastScrollY = useRef(0);

  const onScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;
    
    if (Math.abs(diff) > 5) {
      if (diff > 0 && currentY > 100) {
        setTabBarVisible(false);
      } else {
        setTabBarVisible(true);
      }
    }
    lastScrollY.current = currentY;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader title={query ? query : 'SEARCH'} showBack={false} />
      
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#FFF' : '#000'} />
        }
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={{ height: insets.top + 70 }} />
        
        {/* ── Search Bar: Liquid Glass Capsule ── */}
        <View style={styles.searchWrapper}>
          <View style={[styles.searchIsland, { 
            backgroundColor: isDark ? 'hsla(0,0%,100%,0.06)' : 'hsla(0,0%,0%,0.03)',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          }]}>
            <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <Ionicons name="search-outline" size={16} color={colors.textExtraLight} style={styles.searchIcon} />
            <TextInput
              value={query}
              onChangeText={handleSearch}
              placeholder="SEARCH ZICA BELLA…"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}
              style={[styles.searchInput, { color: colors.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity 
                onPress={() => { setQuery(''); search(''); }} 
                style={styles.clearButton}
              >
                <Typography size={7} color={colors.textExtraLight} weight="600" style={styles.clearText}>CLEAR</Typography>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Results header ── */}
        {query.length > 0 && (
          <View style={styles.resultsHeader}>
            <Typography rocaston size={10} color={colors.textSecondary} style={styles.queryLabel}>"{query.toUpperCase()}"</Typography>
            <Typography size={7} color={colors.textExtraLight} weight="300" style={styles.countLabel}>
              {results.length} {results.length === 1 ? 'RESULT' : 'RESULTS'}
            </Typography>
          </View>
        )}

        {/* ── Search Results ── */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.textExtraLight} />
          </View>
        )}

        {query.length > 0 && results.length > 0 && (
          <View style={styles.productGrid}>
            {results.map((product) => (
              <View key={product.id} style={styles.cardWrapper}>
                <ProductCard product={product} />
              </View>
            ))}
          </View>
        )}

        {query.length > 0 && !loading && results.length === 0 && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            }]}>
              <Ionicons name="search-outline" size={20} color={colors.textExtraLight} style={{ opacity: 0.4 }} />
            </View>
            <Typography size={9} weight="400" color={colors.textExtraLight} style={styles.emptyTitle}>NO RESULTS FOR "{query.toUpperCase()}"</Typography>
            <Typography size={7} weight="300" color={colors.textExtraLight} style={styles.emptySubtitle}>TRY A DIFFERENT TERM</Typography>
          </View>
        )}

        {/* ── Empty state: trending + collections ── */}
        {query.length === 0 && (
          <View style={styles.sectionsContainer}>
            {/* Trending */}
            <View style={styles.section}>
              <Typography size={7} color={colors.textExtraLight} weight="400" style={styles.sectionLabel}>TRENDING</Typography>
              <View style={styles.trendingContainer}>
                {config.trending.map((term) => (
                  <TouchableOpacity
                    key={term}
                    style={[styles.trendingPill, { 
                      backgroundColor: isDark ? 'hsla(0,0%,100%,0.04)' : 'hsla(255,100%,100%,0.4)',
                      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    }]}
                    onPress={() => handleSearch(term)}
                  >
                    <BlurView intensity={12} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                    <Typography size={8} color={colors.textSecondary} weight="300" style={styles.trendingText}>{term.toUpperCase()}</Typography>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Recently Viewed */}
            {recentProducts.length > 0 && (
              <View style={styles.section}>
                <Typography size={7} color={colors.textExtraLight} weight="400" style={styles.sectionLabel}>RECENTLY VIEWED</Typography>
                <View style={[styles.productGrid, { paddingHorizontal: 0 }]}>
                  {recentProducts.slice(0, 4).map((product) => (
                    <View key={product.id} style={styles.cardWrapper}>
                      <ProductCard product={product} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Collections */}
            {collections.length > 0 && (
              <View style={styles.section}>
                <Typography size={7} color={colors.textExtraLight} weight="400" style={styles.sectionLabel}>COLLECTIONS</Typography>
                {collections.slice(0, 10).map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.collectionRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }]}
                    onPress={() => navigation.navigate('Collection', { handle: c.handle, title: c.title })}
                  >
                    <Typography size={12} color={colors.textSecondary} weight="300" style={styles.collectionTitle}>{c.title.toUpperCase()}</Typography>
                    <Ionicons name="chevron-forward" size={14} color={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        <StorefrontFooter />
        <View style={{ height: 100 + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    paddingHorizontal: 16,
  },
  searchWrapper: {
    marginBottom: 24,
  },
  searchIsland: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 54,
    overflow: 'hidden',
  },
  searchIcon: {
    marginRight: 10,
    opacity: 0.5,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 1.5,
  },
  clearButton: {
    paddingLeft: 12,
  },
  clearText: {
    letterSpacing: 2,
    opacity: 0.6,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  queryLabel: {
    letterSpacing: 1.5,
  },
  countLabel: {
    letterSpacing: 3,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  cardWrapper: {
    width: (width - 32 - 12) / 2,
    marginBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    letterSpacing: 4,
    marginBottom: 8,
    textAlign: 'center',
    opacity: 0.6,
  },
  emptySubtitle: {
    letterSpacing: 2,
    opacity: 0.4,
  },
  sectionsContainer: {
    marginTop: 8,
  },
  section: {
    marginBottom: 48,
  },
  sectionLabel: {
    letterSpacing: 5,
    marginBottom: 20,
    opacity: 0.3,
  },
  trendingContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trendingPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 99,
    borderWidth: 1,
    overflow: 'hidden',
  },
  trendingText: {
    letterSpacing: 2,
  },
  collectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  collectionTitle: {
    letterSpacing: 1,
  },
});

