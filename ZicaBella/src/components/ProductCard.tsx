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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

import { resolveImageUrl, resolveImageArray } from '../utils/imageUtils';

interface Props {
  product: FlatProduct;
  onQuickAdd?: (product: FlatProduct) => void;
  style?: any;
  compact?: boolean;
  isLarge?: boolean;
}

const ProductCard = React.memo(({ product, onQuickAdd, style, compact, isLarge }: Props) => {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Determine actual width based on layout mode
  const currentCardWidth = useMemo(() => {
    if (isLarge) return SCREEN_WIDTH;
    if (compact) return SCREEN_WIDTH / 4;
    return style?.width || SCREEN_WIDTH / 2;
  }, [isLarge, compact, style?.width]);

  const images = useMemo(() => {
    // 1. Try images array
    if (product?.images && Array.isArray(product.images) && product.images.length > 0) {
      return resolveImageArray(product.images);
    }
    // 2. Try featuredImage
    if (product?.featuredImage) {
      const feat = resolveImageUrl(product.featuredImage);
      if (feat) return [feat];
    }
    // 3. Try any image field (back-compat)
    const fallback = resolveImageUrl((product as any).image);
    if (fallback) return [fallback];
    
    return [];
  }, [product?.images, product?.featuredImage, (product as any).image]);

  const handlePress = useCallback(() => {
    if (product?.handle) {
      navigation.navigate('ProductDetail', { handle: product.handle });
    }
  }, [navigation, product?.handle]);

  const handleQuickAdd = useCallback(async () => {
    if (!onQuickAdd) return;
    setIsLoading(true);
    haptics.buttonTap();
    await new Promise(resolve => setTimeout(resolve, 300));
    onQuickAdd(product);
    setIsLoading(false);
  }, [onQuickAdd, product]);

  const isSoldOut = product.isSoldOut;
  const [hasInteracted, setHasInteracted] = useState(false);

  const onScrollBegin = useCallback(() => {
    if (!hasInteracted) {
      setHasInteracted(true);
      haptics.buttonTap(); // Subtle feedback for activation
    }
  }, [hasInteracted]);

  return (
    <View style={[styles.container, { width: currentCardWidth }, isSoldOut && styles.soldOut, style]}>
      {/* Badges */}
      <View style={styles.badgeContainer}>
        {isSoldOut ? (
          <View style={styles.soldOutBadge}><Text style={styles.soldOutText}>Sold Out</Text></View>
        ) : product.isOnSale ? (
          <View style={styles.saleBadge}><Text style={styles.saleText}>Sale</Text></View>
        ) : null}
      </View>

      {/* Image area */}
      <View style={[styles.imageTapArea, { width: currentCardWidth }]}>
        {images.length > 1 ? (
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            scrollEventThrottle={32}
            decelerationRate="fast"
            snapToInterval={currentCardWidth}
            snapToAlignment="center"
            onScrollBeginDrag={onScrollBegin}
          >
            {images.map((img, index) => {
              // Only load the first image initially. Load others only after user interacts.
              const shouldRenderImage = index === 0 || hasInteracted;
              
              return (
                <TouchableOpacity 
                  key={`${product.id}-img-${index}`}
                  activeOpacity={0.85} 
                  onPress={handlePress}
                  style={{ width: currentCardWidth, height: '100%' }}
                >
                  {shouldRenderImage ? (
                    <Image
                      source={{ uri: String(img || '') }}
                      style={styles.image}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={200}
                      recyclingKey={String(img || '')}
                    />
                  ) : (
                    <View style={[styles.image, { backgroundColor: isDark ? '#111' : '#f9f9f9' }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <TouchableOpacity onPress={handlePress} activeOpacity={0.95} style={StyleSheet.absoluteFill}>
            <Image
              source={{ uri: String(images[0] || '') }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
              recyclingKey={String(images[0] || '')}
            />
          </TouchableOpacity>
        )}
        {!isSoldOut && <View pointerEvents="none" style={styles.imageOverlay} />}
      </View>

      {/* Info Floor */}
      {!compact && (
        <View style={styles.infoRow}>
          <View style={styles.textContainer}>
            <Typography size={isLarge ? 9.5 : 8} weight="500" color={colors.text} numberOfLines={1} ellipsizeMode="tail" style={styles.productTitle}>
              {String(product?.title || '').toUpperCase()}
            </Typography>
            <View style={styles.priceRow}>
              <Typography size={isLarge ? 11 : 9} weight="400" color={colors.textSecondary}>
                {formatPrice(product.price)}
              </Typography>
              {product.isOnSale && product.compareAtPrice && (
                <Typography size={isLarge ? 9 : 8} weight="300" color={colors.textExtraLight} style={styles.comparePrice}>
                  {formatPrice(product.compareAtPrice)}
                </Typography>
              )}
            </View>
          </View>
          {!isSoldOut && onQuickAdd && (
            <TouchableOpacity onPress={handleQuickAdd} style={styles.quickAddBtn} activeOpacity={0.7} disabled={isLoading}>
              {isLoading ? <ActivityIndicator size="small" color={colors.textSecondary} /> : <Ionicons name="add" size={14} color={colors.text} />}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { backgroundColor: 'transparent' },
  soldOut: { opacity: 0.7 },
  badgeContainer: { position: 'absolute', top: 6, left: 6, zIndex: 10, gap: 4 },
  soldOutBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  soldOutText: { fontSize: 6, fontWeight: '700', textTransform: 'uppercase', color: '#FFF' },
  saleBadge: { backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2 },
  saleText: { color: '#FFFFFF', fontSize: 6, fontWeight: '700', textTransform: 'uppercase' },
  imageTapArea: { aspectRatio: 3 / 5.2, overflow: 'hidden', backgroundColor: 'transparent', marginBottom: 4 },
  image: { width: '100%', height: '100%' },
  imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.02)' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8 },
  textContainer: { flex: 1, gap: 1 },
  productTitle: { letterSpacing: 3, textTransform: 'uppercase', opacity: 0.8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  comparePrice: { textDecorationLine: 'line-through' },
  quickAddBtn: { width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
});

export default ProductCard;
