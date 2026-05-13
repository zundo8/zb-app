import React from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, 
  Dimensions, Pressable, FlatList 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWishlistStore } from '../store/wishlistStore';
import { useCartStore } from '../store/cartStore';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { formatPrice } from '../utils/formatPrice';
import { useNavigation } from '@react-navigation/native';
import QuickAddModal from './QuickAddModal';

const { width } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function WishlistDrawer({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';
  const { wishlist, removeWishlist } = useWishlistStore();
  const { addItem } = useCartStore();

  const [selectedProduct, setSelectedProduct] = React.useState<any>(null);
  const [quickAddVisible, setQuickAddVisible] = React.useState(false);

  const handleQuickAdd = (p: any) => {
    setSelectedProduct(p);
    setQuickAddVisible(true);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <BlurView intensity={isDark ? 40 : 15} tint={isDark ? 'dark' : 'default'} style={StyleSheet.absoluteFill} />
        </Pressable>

        <View style={[styles.drawer, { 
          paddingBottom: insets.bottom + 20,
          backgroundColor: isDark ? 'rgba(5,7,12,0.8)' : 'rgba(255,255,255,0.8)',
          borderColor: colors.borderLight
        }]}>
          <BlurView intensity={isDark ? 30 : 100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          
          <View style={[styles.header, { paddingTop: 30 }]}>
            <View style={styles.headerLeft}>
              <Ionicons name="bookmark-outline" size={18} color={colors.text} />
              <Text style={[styles.drawerTitle, { color: colors.text }]}>ZICA WISHLIST</Text>
              <View style={[styles.badge, { backgroundColor: colors.borderLight }]}>
                <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{wishlist.length}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.borderLight }]}>
              <Ionicons name="close" size={20} color={colors.text} style={{ opacity: 0.6 }} />
            </TouchableOpacity>
          </View>

          {wishlist.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bookmark-outline" size={80} color={colors.textExtraLight} style={{ opacity: 0.3 }} />
              <Text style={[styles.emptyText, { color: colors.textExtraLight }]}>WISHLIST IS EMPTY</Text>
              <TouchableOpacity onPress={onClose} style={styles.browseBtn}>
                <Text style={[styles.browseText, { color: colors.textSecondary }]}>KEEP BROWSING</Text>
                <View style={[styles.browseUnderline, { backgroundColor: colors.borderLight }]} />
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={wishlist}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <View style={[styles.itemRow, { borderBottomColor: colors.borderLight }]}>
                  <TouchableOpacity 
                    style={styles.itemInfo} 
                    onPress={() => {
                      onClose();
                      navigation.navigate('ProductDetail', { handle: item.handle });
                    }}
                  >
                    <Image source={{ uri: item.featuredImage || undefined }} style={[styles.itemImage, { backgroundColor: colors.surface }]} contentFit="cover" />
                    <View style={styles.textCol}>
                      <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                      <Text style={[styles.itemPrice, { color: colors.textExtraLight }]}>{formatPrice(item.price)}</Text>
                    </View>
                  </TouchableOpacity>
                  
                  <View style={styles.actions}>
                    <TouchableOpacity onPress={() => handleQuickAdd(item)} style={styles.actionIcon}>
                      <Ionicons name="bag-handle-outline" size={18} color={colors.text} style={{ opacity: 0.5 }} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeWishlist(item.id)} style={styles.actionIcon}>
                      <Ionicons name="trash-outline" size={18} color={colors.iosRed} style={{ opacity: 0.6 }} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>

        <QuickAddModal 
          visible={quickAddVisible}
          product={selectedProduct}
          onClose={() => setQuickAddVisible(false)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  drawer: {
    height: '85%',
    borderTopLeftRadius: 44,
    borderTopRightRadius: 44,
    overflow: 'hidden',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drawerTitle: {
    fontSize: 12,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemImage: {
    width: 54,
    height: 54,
    borderRadius: 14,
  },
  textCol: {
    marginLeft: 12,
    flex: 1,
  },
  itemTitle: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  itemPrice: {
    fontSize: 10,
    fontWeight: '400',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionIcon: {
    padding: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 4,
  },
  browseBtn: {
    alignItems: 'center',
    marginTop: 8,
  },
  browseText: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  browseUnderline: {
    width: '100%',
    height: 1,
    marginTop: 6,
  },
});
