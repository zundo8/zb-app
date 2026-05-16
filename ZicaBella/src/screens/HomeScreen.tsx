import React, { useCallback, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  RefreshControl, TouchableOpacity, ActivityIndicator,
  InteractionManager
} from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler, runOnJS } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { config } from '../constants/config';
import { haptics } from '../utils/haptics';
import ProductCard from '../components/ProductCard';
import CollectionCarousel from '../components/CollectionCarousel';
import HeroVideo from '../components/HeroVideo';
import GlassHeader from '../components/GlassHeader';
import QuickAddModal from '../components/QuickAddModal';
import RingCarouselSection from '../components/RingCarouselSection';
import { useProducts, useCollections, useCollectionByHandle, useHomepage } from '../hooks/useProducts';
import { StorefrontAPI } from '../api/storefrontClient';
import { ENDPOINTS } from '../api/queries';
import { FlatProduct } from '../api/types';
import MenuDrawer from '../components/MenuDrawer';
import SpotlightSection from '../components/SpotlightSection';
import FlipbookSection from '../components/FlipbookSection';
import CommunitySection from '../components/CommunitySection';
import { useAdminSettings, useFeaturedUsers } from '../hooks/useAdminFeatures';
import { useUIStore } from '../store/uiStore';
import { Typography } from '../components/Typography';
import StorefrontFooter from '../components/StorefrontFooter';

const { width } = Dimensions.get('window');

const HomeScreen = React.memo(() => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';

  const { settings, loading: settingsLoading } = useAdminSettings();
  const { users: communityUsers } = useFeaturedUsers(); // Pre-fetch community data early
  
  const ringHandle = 'accessories';
  const ringTitle = 'ACCESSORIES';

  const heroVideoSrc = settings?.hero?.video || config.heroVideoUrl;
  const heroImageSrc = settings?.hero?.image;
  const heroTitle = settings?.hero?.title || 'ZICA BELLA';
  const heroSubtitle = settings?.hero?.subtitle || 'ARCHIVAL VISION';
  const showHeroText = settings?.hero?.showText ?? true;

  const latestCurationTitle = settings?.latestCuration?.title || 'LATEST CURATION';
  const latestCurationSubtitle = settings?.latestCuration?.subtitle || 'SEASON DROP';

  const { data: homeData, loading: homeLoading, error: homeError, refetch: refetchHome } = useHomepage();
  const products = homeData?.products || [];
  const collections = homeData?.collections || [];
  const accessories = homeData?.accessories || [];
  const spotlightProducts = homeData?.spotlight || [];
  const loading = homeLoading;
  const error = homeError;
  
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<FlatProduct | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [renderBelowFold, setRenderBelowFold] = useState(false);

  React.useEffect(() => {
    // Delay rendering heavy sections below the fold to avoid locking the UI thread and overheating on launch
    const task = InteractionManager.runAfterInteractions(() => {
      setRenderBelowFold(true);
      
      // Cache warm-up: Prefetch top 2 collections silently
      if (collections && collections.length > 0) {
        const topHandles = collections.slice(0, 2).map(c => c.handle);
        
        topHandles.forEach(handle => {
          // Fire and forget; the StorefrontAPI deduplication and cacheService inside hooks will handle the rest
          StorefrontAPI.fetch(`/collections/${handle}/products`, { limit: '50' }, ENDPOINTS.collectionByHandle(handle)).catch(() => {});
        });
      }
    });
    return () => task.cancel();
  }, [collections]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchHome();
    setRefreshing(false);
  }, [refetchHome]);

  const scrollY = useSharedValue(0);
  const lastScrollY = useRef(0);
  const setTabBarVisible = useUIStore(s => s.setTabBarVisible);

  const updateTabBar = (currentY: number) => {
    const diff = currentY - lastScrollY.current;
    if (Math.abs(diff) > 10) {
      const isVisible = useUIStore.getState().isTabBarVisible;
      if (diff > 0 && currentY > 120) {
        if (isVisible) setTabBarVisible(false);
      } else if (diff < -10 || currentY < 50) {
        if (!isVisible) setTabBarVisible(true);
      }
      lastScrollY.current = currentY;
    }
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      runOnJS(updateTabBar)(event.contentOffset.y);
    },
  });

  const handleQuickAdd = useCallback((product: FlatProduct) => {
    setSelectedProduct(product);
    setModalVisible(true);
  }, []);

  const renderProductGrid = (items: FlatProduct[]) => (
    <View style={styles.gridContainer}>
      {(items || []).map((product) => (
        <View key={product.id} style={styles.gridItem}>
          <ProductCard 
            product={product} 
            onQuickAdd={handleQuickAdd}
          />
        </View>
      ))}
    </View>
  );

  const [isHeroMuted, setIsHeroMuted] = useState(true);

  const toggleHeroMute = useCallback(() => {
    setIsHeroMuted(prev => !prev);
    haptics.buttonTap();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader 
        onPressMenu={() => setMenuVisible(true)}
        onPressCenter={toggleHeroMute}
      />
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={colors.text} 
            colors={[colors.text]}
          />
        }
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* ═══ HERO VIDEO ═══ */}
        <View style={{ position: 'relative' }}>
          <HeroVideo 
            source={heroVideoSrc} 
            isMuted={isHeroMuted}
            onToggleMute={toggleHeroMute}
          />
        </View>

        {/* ═══ CONTENT BELOW HERO ═══ */}
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          {loading && products.length === 0 && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.textExtraLight} />
            </View>
          )}

          {!loading && (products.length === 0 || error) && (
            <View style={styles.errorContainer}>
              <Typography size={10} color={colors.textSecondary} style={styles.errorText}>
                {error || "Unable to load products right now. Please try again shortly."}
              </Typography>
              <TouchableOpacity onPress={refetchHome} style={[styles.retryBtn, { borderColor: colors.borderLight }]}>
                <Typography size={9} color={colors.text} weight="600" style={styles.retryText}>RETRY</Typography>
              </TouchableOpacity>
            </View>
          )}

          {/* ═══ SECTION LABEL: Latest ═══ */}
          <View style={styles.sectionHeader}>
            <View style={styles.headerLeft}>
              <Typography size={6} color={colors.textExtraLight} weight="300" style={styles.sectionTag}>{latestCurationSubtitle}</Typography>
              <Typography size={8} color={colors.text} weight="700" style={styles.sectionTitle}>{latestCurationTitle}</Typography>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('ShopTab')} style={styles.headerRight}>
              <Typography size={7} color={colors.textExtraLight} weight="400">VIEW ALL</Typography>
            </TouchableOpacity>
          </View>
          
          {/* ═══ PRODUCT GRID 1 ═══ */}
          <View style={styles.gridContainer}>
            {(products || []).slice(0, 4).map((product) => (
              <View key={product.id} style={styles.gridItem}>
                <ProductCard product={product} onQuickAdd={handleQuickAdd} />
              </View>
            ))}
          </View>

          {/* ═══ ABOVE-COLLECTION MEDIA ═══ */}
          {renderBelowFold && settings?.media?.collections && (
            <View style={styles.mediaSection}>
               <HeroVideo source={settings.media.collections} height={200} borderRadius={12} />
            </View>
          )}

          {renderBelowFold && (
            <>
              <View style={styles.collectionsSection}>
                <View style={styles.archiveLabel}>
                  <Typography size={7.5} color={colors.textExtraLight} weight="300" style={styles.archiveLabelText}>— {settings?.archive?.title || 'THE ARCHIVE'} —</Typography>
                </View>

                <CollectionCarousel collections={collections} />

                <View style={styles.archiveLabel}>
                  <Typography size={7} color={colors.textExtraLight} weight="300" style={styles.archiveSubtext}>{settings?.archive?.subtitle || 'SUSTAINABLE EVOLUTION'}</Typography>
                </View>
              </View>

              {/* ═══ RING COLLECTION CAROUSEL ═══ */}
               <RingCarouselSection 
                title={ringTitle} 
                handle={ringHandle}
                products={(accessories || []).length > 0 ? (accessories || []).slice(0, 15) : (products || []).slice(12, 20)} 
              />

              {/* ═══ FLIPBOOK SECTION ═══ */}
              <FlipbookSection scrollY={scrollY} />

              {/* ═══ PRODUCT GRID 2 ═══ */}
              {renderProductGrid(products.slice(4, 8))}

              {/* ═══ FEATURED MEDIA / BLUEPRINT ═══ */}
              {settings?.media?.featured ? (
                <View style={styles.blueprintSection}>
                   <HeroVideo source={settings.media.featured} height={520} borderRadius={0} />
                   <View style={styles.blueprintOverlay}>
                     <Typography size={22} weight="600" color="#fff" style={styles.blueprintOverlayTitle}>
                       {(settings?.blueprint?.title || 'THE BLUEPRINT').toUpperCase()}
                     </Typography>
                     <Typography size={9} weight="400" color="rgba(255,255,255,0.7)" style={styles.blueprintOverlaySubtitle}>
                       {(settings?.blueprint?.subtitle || 'TECHNIQUE & MOTION').toUpperCase()}
                     </Typography>
                   </View>
                </View>
              ) : (
                <View style={styles.blueprintSection}>
                   <Image 
                    source={settings?.blueprint?.image ? { uri: settings.blueprint.image } : require('../../assets/load-image-4.jpg')} 
                    style={styles.blueprintImage} 
                    contentFit="cover" 
                    placeholder={require('../../assets/load-image-4.jpg')}
                  />
                   <View style={styles.blueprintOverlay}>
                     <Typography size={22} weight="600" color="#fff" style={styles.blueprintOverlayTitle}>
                       {(settings?.blueprint?.title || 'THE BLUEPRINT').toUpperCase()}
                     </Typography>
                     <Typography size={9} weight="400" color="rgba(255,255,255,0.7)" style={styles.blueprintOverlaySubtitle}>
                       {(settings?.blueprint?.subtitle || 'TECHNIQUE & MOTION').toUpperCase()}
                     </Typography>
                   </View>
                </View>
              )}

              {/* ═══ SPOTLIGHT SECTION ═══ */}
              <SpotlightSection 
                collectionHandle={settings?.spotlight?.collection || "tshirts"} 
                title={settings?.spotlight?.title || "AUTHENTIC STREETWEAR"} 
                subtitle={settings?.spotlight?.subtitle}
                media={settings?.spotlight?.media}
                refreshing={homeLoading}
                fallbackProducts={spotlightProducts}
              />

              {/* ═══ PRODUCT GRID 3 ═══ */}
              {products.length > 12 && renderProductGrid(products.slice(12, 16))}

              {/* ═══ COMMUNITY SECTION ═══ */}
              <CommunitySection community={settings?.community} />

              {/* ═══ GLOBAL STOREFRONT FOOTER ═══ */}
              <StorefrontFooter />
            </>
          )}
        </View>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 120 + insets.bottom }} />
      </Animated.ScrollView>

      {/* Drawers */}
      <MenuDrawer 
        visible={menuVisible} 
        onClose={() => setMenuVisible(false)} 
      />
      {/* Quick Add Modal */}
      <QuickAddModal 
        visible={modalVisible}
        product={selectedProduct}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
});

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    paddingVertical: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    paddingVertical: 100,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
    lineHeight: 16,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 2,
  },
  content: {
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    marginTop: 0,
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 12,
  },
  headerLeft: {
    gap: 2,
  },
  sectionTag: {
    letterSpacing: 4,
    opacity: 0.35,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.75,
  },
  headerRight: {
    paddingBottom: 2,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    marginBottom: 32,
  },
  gridItem: {
    width: Math.floor(width / 2),
    marginBottom: 0,
    backgroundColor: 'transparent',
  },
  collectionsSection: {
    paddingVertical: 24,
  },
  archiveLabel: {
    alignItems: 'center',
    marginBottom: 24,
  },
  archiveLabelText: {
    letterSpacing: 8,
    opacity: 0.22,
  },
  archiveSubtext: {
    fontSize: 7.5,
    fontWeight: '300',
    textTransform: 'uppercase',
    letterSpacing: 5,
    opacity: 0.6,
  },
  mediaSection: {
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  blueprintSection: {
    marginVertical: 32,
    paddingHorizontal: 0,
    position: 'relative',
  },
  blueprintImage: {
    width: '100%',
    height: 460,
    borderRadius: 0,
  },
  blueprintOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 32,
    paddingBottom: 48,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  blueprintOverlayTitle: {
    letterSpacing: 2,
    marginBottom: 6,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  blueprintOverlaySubtitle: {
    letterSpacing: 3,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  footerVideoSection: {
    marginTop: 48,
    paddingHorizontal: 16,
  },
});

