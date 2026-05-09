import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Dimensions, Animated } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { useCollectionByHandle, useCollections } from '../hooks/useProducts';
import { RootStackParamList } from '../navigation/types';
import ProductCard from '../components/ProductCard';
import GlassHeader from '../components/GlassHeader';
import CollectionFilters from '../components/CollectionFilters';
import QuickAddModal from '../components/QuickAddModal';
import CollectionHeaderCarousel from '../components/CollectionHeaderCarousel';
import StorefrontFooter from '../components/StorefrontFooter';
import { useUIStore } from '../store/uiStore';
import { FlatProduct } from '../api/types';
import { Typography } from '../components/Typography';


export default function CollectionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Collection'>>();
  const { handle } = route.params;
  const colors = useColors();
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';

  const { collection, products, loading, refetch } = useCollectionByHandle(handle);
  const { collections: allCollections } = useCollections(50);
  
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('featured');
  const [viewMode, setViewMode] = useState<'grid' | 'grid4' | 'large'>('grid');
  const [isSizeOpen, setIsSizeOpen] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<FlatProduct | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleQuickAdd = useCallback((product: FlatProduct) => {
    setSelectedProduct(product);
    setModalVisible(true);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const setTabBarVisible = useUIStore(s => s.setTabBarVisible);
  const isTabBarVisible = useUIStore(s => s.isTabBarVisible);
  const scrollY = useRef(new Animated.Value(0)).current;
  const filterTranslateY = useRef(new Animated.Value(0)).current;
  const filterOpacity = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const [isCompact, setIsCompact] = useState(false);

  const onScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;
    
    // Smart Header Logic - Adjusted for GlassHeader clearance
    const stickyOffset = insets.top + 50;
    const isInStickyZone = currentY > 150;

    if (currentY < 100) {
      // Always show full at top
      Animated.spring(filterTranslateY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      setIsCompact(false);
    } else if (diff > 20) {
      // Scrolling down - make compact and ensure it's below GlassHeader islands
      Animated.spring(filterTranslateY, { 
        toValue: isInStickyZone ? stickyOffset : 0, 
        useNativeDriver: true,
        bounciness: 0
      }).start();
      setIsCompact(true);
    } else if (diff < -15) {
      // Scrolling up - show full and ensure it's below GlassHeader islands
      Animated.spring(filterTranslateY, { 
        toValue: isInStickyZone ? stickyOffset : 0, 
        useNativeDriver: true,
        bounciness: 0
      }).start();
      setIsCompact(false);
    }

    if (Math.abs(diff) > 15) {
      const isCurrentlyVisible = useUIStore.getState().isTabBarVisible;
      if (diff > 0 && currentY > 200) {
        if (isCurrentlyVisible) setTabBarVisible(false);
      } else {
        if (!isCurrentlyVisible) setTabBarVisible(true);
      }
      
      if (Math.abs(diff) > 20 && isSizeOpen) {
        setIsSizeOpen(false);
      }
      lastScrollY.current = currentY;
    }
  };

  const { width: screenWidth } = Dimensions.get('window');


  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <ActivityIndicator size="small" color={colors.textExtraLight} />
      </View>
    );
  }

  // Extract all unique sizes
  const allSizes = Array.from(new Set(
    products.flatMap(p => p.variants.map(v => v.size).filter(s => s && s !== 'Default Title'))
  )).sort();

  // Filter and Sort Logic
  let filteredProducts = [...products];
  if (selectedSize) {
    filteredProducts = filteredProducts.filter(p => 
      p.variants.some(v => v.size === selectedSize)
    );
  }

  if (sortBy === 'newest') {
    filteredProducts.sort((a, b) => b.id.localeCompare(a.id));
  } else if (sortBy === 'price-asc') {
    filteredProducts.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  } else if (sortBy === 'price-desc') {
    filteredProducts.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  }

  const toggleView = () => {
    const modes: ('grid' | 'grid4' | 'large')[] = ['grid', 'grid4', 'large'];
    setViewMode(modes[(modes.indexOf(viewMode) + 1) % modes.length]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader 
        title={collection?.title || 'Collection'} 
        showBack={true} 
        style={{ backgroundColor: 'transparent' }}
      />
      
      <ScrollView
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={isDark ? '#FFF' : '#000'} 
            progressViewOffset={20} 
          />
        }
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Top Section - Carousel - Now clearing the header properly */}
        <View style={{ paddingTop: insets.top + 60, paddingBottom: 8 }}>
          <CollectionHeaderCarousel currentHandle={handle} collections={allCollections as any[]} />
        </View>

        {/* Filters Sticky Section */}
        <Animated.View style={[
          styles.filterSection,
          { transform: [{ translateY: filterTranslateY }] }
        ]}>
          <CollectionFilters 
            allSizes={allSizes as string[]}
            selectedSize={selectedSize}
            onSelectSize={setSelectedSize}
            sortBy={sortBy}
            onSelectSort={setSortBy}
            viewMode={viewMode}
            onToggleView={toggleView}
            isTabBarVisible={isTabBarVisible}
            isSizeOpen={isSizeOpen}
            setIsSizeOpen={setIsSizeOpen}
            compact={isCompact}
          />
        </Animated.View>

        <View style={styles.content}>
          <Typography size={7} weight="300" color={colors.textExtraLight} style={styles.count}>
            {filteredProducts.length} PRODUCTS
          </Typography>
          
          <View style={[
            styles.grid,
          ]}>
            {filteredProducts.map((p, index) => {
              const isGrid = viewMode === 'grid';
              const isGrid4 = viewMode === 'grid4';
              const isFullWidthInGrid = isGrid && (index + 1) % 5 === 0;
              
              return (
                <View 
                  key={p.id} 
                  style={[
                    styles.cardWrapper,
                    isGrid && (isFullWidthInGrid ? styles.largeWrapper : styles.gridWrapper),
                    isGrid4 && styles.grid4Wrapper,
                    viewMode === 'large' && styles.largeWrapper,
                  ]}
                >
                  <ProductCard 
                    product={p} 
                    onQuickAdd={handleQuickAdd}
                    style={(viewMode === 'large' || isFullWidthInGrid) ? { width: '100%' } : undefined}
                    compact={isGrid4}
                  />
                </View>
              );
            })}
          </View>
          <View style={{ height: 40 }} />
          <StorefrontFooter />
          <View style={{ height: 100 + insets.bottom }} />
        </View>
      </ScrollView>

      <QuickAddModal 
        visible={modalVisible}
        product={selectedProduct}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterSection: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  content: {
    paddingHorizontal: 0,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  count: {
    letterSpacing: 4,
    marginBottom: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 0,
  },
  listGrid: {
    flexDirection: 'column',
  },
  cardWrapper: {
    marginBottom: 16,
  },
  gridWrapper: {
    width: Math.floor(Dimensions.get('window').width / 2),
    backgroundColor: 'transparent',
  },
  grid4Wrapper: {
    width: Math.floor(Dimensions.get('window').width / 4),
    backgroundColor: 'transparent',
  },
  largeWrapper: {
    width: '100%',
  },
});

