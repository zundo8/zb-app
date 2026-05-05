import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { formatPrice } from '../utils/formatPrice';
import { FlatProduct } from '../api/types';
import { haptics } from '../utils/haptics';
import { BlurView } from 'expo-blur';
import { Typography } from './Typography';

const { width } = Dimensions.get('window');

interface Props {
  product: FlatProduct;
  onQuickAdd?: (product: FlatProduct) => void;
  style?: any;
}

export default function ProductCard({ product, onQuickAdd, style }: Props) {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';
  const [isLoading, setIsLoading] = React.useState(false);

  const handlePress = () => {
    navigation.navigate('ProductDetail', { handle: product.handle });
  };

  const handleQuickAdd = async () => {
    if (!onQuickAdd) return;
    setIsLoading(true);
    haptics.buttonTap();
    // Simulate a brief loading state for "premium" feel
    await new Promise(resolve => setTimeout(resolve, 300));
    onQuickAdd(product);
    setIsLoading(false);
  };

  const isSoldOut = product.isSoldOut;

  return (
    <View
      style={[
        styles.container,
        isSoldOut && styles.soldOut,
        style,
      ]}
    >
      {/* Badges - Sleeker, higher up */}
      <View style={styles.badgeContainer}>
        {isSoldOut ? (
          <View style={styles.soldOutBadge}>
            <Text style={styles.soldOutText}>Sold Out</Text>
          </View>
        ) : product.isOnSale ? (
          <View style={styles.saleBadge}>
            <Text style={styles.saleText}>Sale</Text>
          </View>
        ) : null}
      </View>

      {/* Image - 3/4.2 aspect ratio from Next.js */}
      <TouchableOpacity 
        onPress={handlePress} 
        activeOpacity={0.94} 
        style={styles.imageTapArea}
        accessibilityRole="button"
        accessibilityLabel={`View product ${product.title}`}
      >
        <Image
          source={{ uri: product.featuredImage || undefined }}
          style={styles.image}
          contentFit="cover"
          transition={400}
          accessibilityIgnoresInvertColors
        />
        
        {/* Hover glass overlay feel */}
        {!isSoldOut && (
          <View style={styles.imageOverlay} />
        )}
      </TouchableOpacity>

      {/* Info Floor - clean typography matches Next.js */}
      <View style={styles.infoRow}>
        <View style={styles.textContainer}>
          <Typography 
            size={8} 
            weight="600" 
            color={colors.textLight} 
            numberOfLines={1} 
            style={styles.productTitle}
          >
            {product.title.toUpperCase()}
          </Typography>
          <View style={styles.priceRow}>
            <Typography 
              size={9.5} 
              weight="500" 
              color={colors.textSecondary} 
            >
              {formatPrice(product.price)}
            </Typography>
            {product.isOnSale && product.compareAtPrice && (
              <Typography 
                size={8} 
                weight="300" 
                color={colors.textExtraLight} 
                style={{ textDecorationLine: 'line-through' }}
              >
                {formatPrice(product.compareAtPrice)}
              </Typography>
            )}
          </View>
        </View>

        {!isSoldOut && onQuickAdd && (
          <TouchableOpacity
            onPress={handleQuickAdd}
            style={styles.quickAddBtn}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Ionicons name="add" size={16} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  soldOut: {
    opacity: 0.7,
  },
  badgeContainer: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 10,
    gap: 4,
  },
  soldOutBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  soldOutText: {
    fontSize: 6,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0,
    color: '#FFF',
  },
  saleBadge: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  saleText: {
    color: '#FFFFFF',
    fontSize: 6,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  imageTapArea: {
    width: '100%',
    aspectRatio: 3 / 4.8, // Taller for premium feel
    borderRadius: 6, // Reduced radius per Next.js
    overflow: 'hidden',
    backgroundColor: 'rgba(128,128,128,0.05)',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  productTitle: {
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.45,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickAddBtn: {
    width: 20,
    height: 20,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
});

