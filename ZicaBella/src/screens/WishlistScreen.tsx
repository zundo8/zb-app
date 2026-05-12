import React from 'react';
import { View, StyleSheet, FlatList, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../constants/colors';
import { useBookmarkStore } from '../store/bookmarkStore';
import GlassHeader from '../components/GlassHeader';
import ProductCard from '../components/ProductCard';
import { Typography } from '../components/Typography';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useThemeStore } from '../store/themeStore';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

export default function WishlistScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  const navigation = useNavigation<any>();
  const { bookmarks, removeBookmark } = useBookmarkStore();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader title="WISHLIST" showBack />
      
      <FlatList 
        data={bookmarks}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingTop: insets.top + 70, paddingBottom: 120 }
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Typography heading size={24} weight="700" color={colors.text} style={styles.title}>WISHLIST</Typography>
            <Typography size={12} weight="300" color={colors.textSecondary}>Your curated selection of Zica Bella pieces.</Typography>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <BlurView intensity={isDark ? 40 : 80} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
              <Ionicons name="bookmark-outline" size={32} color={colors.textExtraLight} />
            </View>
            <Typography heading size={12} weight="600" color={colors.text} style={styles.emptyTitle}>YOUR WISHLIST IS EMPTY</Typography>
            <Typography size={11} weight="300" color={colors.textSecondary} style={styles.emptyText}>
              Explore the archive to build your collection.
            </Typography>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <ProductCard 
              product={item} 
              style={{ width: COLUMN_WIDTH }}
              onRemove={removeBookmark}
            />
          </View>
        )}
        removeClippedSubviews={true}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 20,
  },
  title: {
    letterSpacing: 4,
    marginBottom: 4,
  },
  columnWrapper: {
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: COLUMN_WIDTH,
    marginBottom: 16,
  },
  card: {
    width: '100%',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 60,
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 24,
  },
  emptyTitle: {
    letterSpacing: 2,
    marginBottom: 12,
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
