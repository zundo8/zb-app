import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { formatPrice } from '../utils/formatPrice';
import { FlatProduct } from '../api/types';
import { haptics } from '../utils/haptics';
import { Typography } from './Typography';

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.floor(width / 2);

interface Props {
  product: FlatProduct;
  onQuickAdd?: (product: FlatProduct) => void;
  style?: any;
  compact?: boolean;
}

const ProductCard = React.memo(({ product, onQuickAdd, style, compact }: Props) => {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const baseImages = useMemo(() => {
    const rawImages = product.images && product.images.length > 0 
      ? product.images 
      : product.featuredImage ? [product.featuredImage] : [];
    return rawImages.slice(0, 5);
  }, [product.images, product.featuredImage]);

  // Triple the images for infinite loop effect
  const images = useMemo(() => {
    if (baseImages.length <= 1) return baseImages;
    return [...baseImages, ...baseImages, ...baseImages];
  }, [baseImages]);

  useEffect(() => {
    // Initial scroll to the middle set for infinite effect
    if (images.length > baseImages.length && scrollViewRef.current) {
      const initialOffset = baseImages.length * CARD_WIDTH;
      scrollViewRef.current.scrollTo({ x: initialOffset, animated: false });
    }
  }, [images.length, baseImages.length]);

  const handleScroll = (event: any) => {
    if (baseImages.length <= 1) return;
    const x = event.nativeEvent.contentOffset.x;
    const singleSetWidth = baseImages.length * CARD_WIDTH;

    // Seamless loop jump
    if (x >= singleSetWidth * 2) {
      scrollViewRef.current?.scrollTo({ x: x - singleSetWidth, animated: false });
    } else if (x <= 0) {
      scrollViewRef.current?.scrollTo({ x: x + singleSetWidth, animated: false });
    }
  };

  const handlePress = useCallback(() => {
    navigation.navigate('ProductDetail', { handle: product.handle });
  }, [navigation, product.handle]);

  const handleQuickAdd = useCallback(async () => {
    if (!onQuickAdd) return;
    setIsLoading(true);
    haptics.buttonTap();
    await new Promise(resolve => setTimeout(resolve, 300));
    onQuickAdd(product);
    setIsLoading(false);
  }, [onQuickAdd, product]);

  const isSoldOut = product.isSoldOut;

  return (
    <View style={[styles.container, isSoldOut && styles.soldOut, style]}>
      {/* Badges */}
      <View style={styles.badgeContainer}>
        {isSoldOut ? (
          <View style={styles.soldOutBadge}><Text style={styles.soldOutText}>Sold Out</Text></View>
        ) : product.isOnSale ? (
          <View style={styles.saleBadge}><Text style={styles.saleText}>Sale</Text></View>
        ) : null}
      </View>

      {/* Image area */}
      <View style={styles.imageTapArea}>
        {images.length > 1 ? (
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={true}
            onMomentumScrollEnd={handleScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={CARD_WIDTH}
            snapToAlignment="center"
          >
            {images.map((img, index) => (
              <TouchableOpacity 
                key={`${product.id}-img-${index}`}
                activeOpacity={0.85} 
                onPress={handlePress}
                style={{ width: CARD_WIDTH, height: '100%' }}
              >
                <Image
                  source={{ uri: img || undefined }}
                  style={styles.image}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <TouchableOpacity onPress={handlePress} activeOpacity={0.95} style={StyleSheet.absoluteFill}>
            <Image
              source={{ uri: images[0] || undefined }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          </TouchableOpacity>
        )}
        {!isSoldOut && <View pointerEvents="none" style={styles.imageOverlay} />}
      </View>

      {/* Info Floor */}
      {!compact && (
        <View style={styles.infoRow}>
          <View style={styles.textContainer}>
            <Typography size={7.5} weight="400" color={colors.textLight} numberOfLines={1} style={styles.productTitle}>
              {product.title.toUpperCase()}
            </Typography>
            <View style={styles.priceRow}>
              <Typography size={9} weight="400" color={colors.textSecondary}>
                {formatPrice(product.price)}
              </Typography>
              {product.isOnSale && product.compareAtPrice && (
                <Typography size={8} weight="300" color={colors.textExtraLight} style={styles.comparePrice}>
                  {formatPrice(product.compareAtPrice)}
                </Typography>
              )}
            </View>
          </View>
          {!isSoldOut && onQuickAdd && (
            <TouchableOpacity onPress={handleQuickAdd} style={styles.quickAddBtn} activeOpacity={0.7} disabled={isLoading}>
              {isLoading ? <ActivityIndicator size="small" color={colors.textSecondary} /> : <Ionicons name="add" size={16} color={colors.textSecondary} />}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    backgroundColor: 'transparent',
  },
  soldOut: { opacity: 0.7 },
  badgeContainer: { position: 'absolute', top: 6, left: 6, zIndex: 10, gap: 4 },
  soldOutBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  soldOutText: { fontSize: 6, fontWeight: '700', textTransform: 'uppercase', color: '#FFF' },
  saleBadge: { backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2 },
  saleText: { color: '#FFFFFF', fontSize: 6, fontWeight: '700', textTransform: 'uppercase' },
  imageTapArea: { width: CARD_WIDTH, aspectRatio: 3 / 4.8, overflow: 'hidden', backgroundColor: 'transparent', marginBottom: 8 },
  image: { width: '100%', height: '100%' },
  imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.02)' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 12 },
  textContainer: { flex: 1, gap: 2 },
  productTitle: { letterSpacing: 2.2, textTransform: 'uppercase', opacity: 0.5 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  comparePrice: { textDecorationLine: 'line-through' },
  quickAddBtn: { width: 20, height: 20, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
});

export default ProductCard;
