import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { useColors } from '../constants/colors';
import { useCollections, useProducts } from '../hooks/useProducts';
import { Typography } from '../components/Typography';
import GlassHeader from '../components/GlassHeader';
import { useUIStore } from '../store/uiStore';
import { haptics } from '../utils/haptics';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 40) / 2;

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const { collections, loading, refetch } = useCollections(30, 'page');
  const { products: latestProducts } = useProducts(24);
  const setMenuOpen = useUIStore(s => s.setMenuOpen);
  const [heroImage, setHeroImage] = React.useState<string | undefined>(undefined);

  const onRefresh = React.useCallback(async () => {
    await refetch();
  }, [refetch]);

  const setTabBarVisible = useUIStore(s => s.setTabBarVisible);

  useFocusEffect(
    React.useCallback(() => {
      setTabBarVisible(true);
      
      // Pick a random image from latest products each time we enter
      if (latestProducts.length > 0) {
        const randomIndex = Math.floor(Math.random() * latestProducts.length);
        setHeroImage(latestProducts[randomIndex].featuredImage);
      }
    }, [setTabBarVisible, latestProducts])
  );

  const renderCategoryTile = (item: any, isFullWidth = false) => (
    <TouchableOpacity
      key={item.id || item.handle}
      onPress={() => navigation.navigate('Collection', { handle: item.handle, title: item.title })}
      style={[
        styles.tile,
        isFullWidth ? styles.fullWidthTile : styles.halfWidthTile,
        { borderColor: colors.borderLight }
      ]}
      activeOpacity={0.9}
    >
      <Image
        source={item.image || 'https://app.zicabella.com/placeholder-collection.jpg'}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={300}
      />
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />
      
      <View style={styles.tileOverlay}>
         <Typography heading size={14} color="#FFF" style={styles.tileTitle}>
           {item.title.toUpperCase()}
         </Typography>
         <View style={styles.shopNowLine} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader 
        title="SHOP" 
        onPressMenu={() => {
          haptics.buttonTap();
          setMenuOpen(true);
        }}
      />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
          paddingTop: insets.top + 60,
          paddingBottom: 120 + insets.bottom,
          paddingHorizontal: 16,
        }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.text} />
        }
      >
        <Typography size={7} color={colors.textExtraLight} weight="300" style={styles.sectionTag}>
          EXPLORE THE ARCHIVE
        </Typography>
        <Typography size={24} weight="700" color={colors.text} style={styles.mainTitle}>
          COLLECTIONS
        </Typography>

        {/* All Products Tile */}
        {renderCategoryTile({
          id: 'all',
          handle: 'all',
          title: 'All Products',
          image: heroImage || latestProducts[0]?.featuredImage || 'https://app.zicabella.com/all-products-hero.jpg'
        }, true)}

        {loading && collections.length === 0 ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : (
          <View style={styles.grid}>
            {collections.filter(c => c.handle !== 'all').map(item => renderCategoryTile(item))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTag: {
    letterSpacing: 4,
    marginBottom: 8,
    marginTop: 20,
  },
  mainTitle: {
    letterSpacing: 1,
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  tile: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
  },
  fullWidthTile: {
    width: '100%',
    height: 180,
    marginBottom: 16,
  },
  halfWidthTile: {
    width: COLUMN_WIDTH,
    height: 240,
  },
  tileOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tileTitle: {
    letterSpacing: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  shopNowLine: {
    width: 30,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginTop: 12,
  },
  loading: {
    paddingVertical: 100,
    alignItems: 'center',
  }
});
