import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { FlatProduct } from '../api/types';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { Typography } from './Typography';
import OptimizedImage from './OptimizedImage';

interface Props {
  title?: string;
  handle?: string;
  products: FlatProduct[];
}

const RingCarouselSection = React.memo(({ title = "ACCESSORIES", handle = "accessories", products }: Props) => {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';

  if (products.length === 0) return null;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.glassCard,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)',
            shadowOpacity: isDark ? 0.35 : 0.1,
          },
        ]}
      >
        <BlurView intensity={isDark ? 48 : 88} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        
        {/* Header */}
        <View style={styles.header}>
          <Typography size={7.5} color={colors.text} weight="500" style={styles.title}>{title}</Typography>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Collection', { handle })}
          >
            <Typography size={6.5} color={colors.textExtraLight} weight="400">VIEW ALL</Typography>
          </TouchableOpacity>
        </View>

        {/* Horizontal Scroll */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          snapToInterval={110} // Width 90 + Gap 20
          decelerationRate="fast"
        >
          {products.map((item) => (
            <TouchableOpacity 
              key={item.id}
              style={styles.itemContainer}
              onPress={() => navigation.navigate('ProductDetail', { handle: item.handle })}
              activeOpacity={0.8}
            >
              <View style={[styles.imageWrapper, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                <OptimizedImage 
                  source={item.featuredImage} 
                  style={styles.image}
                  shopifyWidth={400}
                />
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ width: 10 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  glassCard: {
    borderRadius: 36,
    overflow: 'hidden',
    paddingVertical: 22,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 28,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 8,
    fontWeight: '400',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  viewAll: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 20,
  },
  itemContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export default RingCarouselSection;
