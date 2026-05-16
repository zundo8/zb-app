import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import GlassHeader from '../components/GlassHeader';

const BLOGS = [
  { id: '1', title: 'The Anatomy of a Perfect Oversized Tee', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800' },
  { id: '2', title: 'Why High GSM Cotton is the Future of Streetwear', image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&q=80&w=800' },
  { id: '3', title: 'Acid Wash: A Resurgence in Modern Fashion', image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&q=80&w=800' },
];

export default function BlogsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader title="EDITORIALS" showBack />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: 100 }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>THE ARCHIVE</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Thoughts, culture, and design ethos.</Text>
        </View>

        <View style={styles.grid}>
          {BLOGS.map((blog) => (
            <TouchableOpacity key={blog.id} activeOpacity={0.8} style={styles.cardWrapper}>
              <View style={[styles.card, { borderColor: 'rgba(255,255,255,0.05)' }]}>
                <Image source={{ uri: blog.image }} style={styles.image} contentFit="cover" />
                <BlurView intensity={isDark ? 50 : 80} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{blog.title}</Text>
                  <Text style={[styles.readMore, { color: colors.textExtraLight }]}>READ MORE →</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '300',
  },
  grid: {
    paddingHorizontal: 16,
    gap: 16,
  },
  cardWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
  },
  card: {
    flex: 1,
    borderWidth: 1,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  cardContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'flex-end',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  readMore: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
  },
});
