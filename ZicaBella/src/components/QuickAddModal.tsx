import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, 
  Dimensions, Pressable 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../store/cartStore';
import { FlatProduct } from '../api/types';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { formatPrice } from '../utils/formatPrice';
import { haptics } from '../utils/haptics';
import { useUIStore } from '../store/uiStore';

interface Props {
  visible: boolean;
  product: FlatProduct | null;
  initialSize?: string;
  onClose: () => void;
}

export default function QuickAddModal({ visible, product, initialSize, onClose }: Props) {
  const { addItem } = useCartStore();
  const setCartOpen = useUIStore(s => s.setCartOpen);
  const colors = useColors();
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';
  
  const [selectedSize, setSelectedSize] = useState<string | null>(initialSize || null);
  const [added, setAdded] = useState(false);

  const sizes = product?.variants
    ?.map((v) => ({ size: v.size ?? "One Size", variantId: String(v.id) }))
    .filter((v, i, a) => a.findIndex((x) => x.size === v.size) === i) || [];

  const price = product?.price || 0;
  const image = product?.featuredImage;

  // Auto-select if single size
  useEffect(() => {
    if (sizes.length === 1) setSelectedSize(sizes[0].size);
  }, [sizes.length]);

  if (!product) return null;

  const handleAdd = () => {
    if (sizes.length > 1 && !selectedSize) return;
    
    const variant = sizes.find((s) => s.size === (selectedSize ?? sizes[0]?.size));
    
    addItem({
      productId: product.id,
      variantId: variant?.variantId || product.variants[0].id,
      title: product.title,
      size: selectedSize,
      handle: product.handle,
      price: product.price,
      image: product.featuredImage || '',
    });

    haptics.success();
    setAdded(true);
    
    setTimeout(() => {
      setAdded(false);
      onClose();
      // Auto-open cart after modal closes
      setTimeout(() => setCartOpen(true), 300);
    }, 900);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={isDark ? 40 : 20} tint={isDark ? 'dark' : 'default'} style={StyleSheet.absoluteFill} />
        
        <Pressable style={[styles.sheet, { borderColor: colors.borderLight }]} onPress={(e) => e.stopPropagation()}>
          <BlurView intensity={isDark ? 30 : 100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          
          {/* Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: colors.textMuted }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.productInfo}>
              <Image source={{ uri: image || undefined }} style={[styles.previewImage, { backgroundColor: colors.surface }]} contentFit="cover" />
              <View style={styles.textInfo}>
                <Text style={[styles.productTitle, { color: colors.text }]} numberOfLines={1}>{product.title}</Text>
                <Text style={[styles.productPrice, { color: colors.textExtraLight }]}>{formatPrice(price)}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.text} style={{ opacity: 0.3 }} />
            </TouchableOpacity>
          </View>

          {/* Size Selection */}
          {sizes.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionLabel, { color: colors.textExtraLight }]}>SELECT SIZE</Text>
                <TouchableOpacity>
                  <Text style={[styles.guideLink, { color: colors.textSecondary }]}>GUIDE</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.sizeRow}>
                {sizes.map(({ size }) => {
                  const isActive = selectedSize === size;
                  return (
                    <TouchableOpacity
                      key={size}
                      onPress={() => {
                        setSelectedSize(size);
                        haptics.buttonTap();
                      }}
                      style={[
                        styles.sizeBox,
                        { borderColor: colors.borderLight },
                        isActive && { backgroundColor: '#000', borderColor: '#000' }
                      ]}
                    >
                      <Text style={[
                        styles.sizeBoxText,
                        { color: isActive ? '#FFF' : colors.textSecondary }
                      ]}>{size}</Text>
                    </TouchableOpacity>
                  );
                })}
                {/* Fill empty spots to maintain 6-item symmetry if needed, or just justify-between */}
              </View>
            </View>
          )}

          {/* Add Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleAdd}
              disabled={added || (sizes.length > 1 && !selectedSize)}
              style={[
                styles.addBtn,
                { backgroundColor: added ? colors.iosGreen : '#000' },
                (sizes.length > 1 && !selectedSize) && styles.addBtnDisabled
              ]}
              activeOpacity={0.8}
            >
              {added ? (
                <Text style={styles.addBtnText}>Added to Bag</Text>
              ) : (
                <View style={styles.btnContent}>
                  <Ionicons name="bag-outline" size={16} color="#FFF" />
                  <Text style={styles.addBtnText}>Add to Bag</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: 'hidden',
    paddingBottom: 50,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  textInfo: {
    marginLeft: 12,
    flex: 1,
  },
  productTitle: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 11,
    fontWeight: '300',
    opacity: 0.6,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 7.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 4,
  },
  guideLink: {
    fontSize: 7.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textDecorationLine: 'underline',
  },
  sizeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  sizeBox: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sizeBoxText: {
    fontSize: 10,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 24,
  },
  addBtn: {
    height: 60,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addBtnDisabled: {
    opacity: 0.3,
  },
  addBtnText: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 4,
    fontWeight: '700',
    color: '#FFF',
  },
});
