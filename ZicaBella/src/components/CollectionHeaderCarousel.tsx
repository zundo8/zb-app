import React, { useRef, useEffect } from 'react';
import { 
  View, StyleSheet, TouchableOpacity, 
  Dimensions, ScrollView, Animated as RNAnimated
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { Typography } from './Typography';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width * 0.82;
const ITEM_MARGIN = 12;

interface Collection {
  id: string;
  handle: string;
  title: string;
  image?: { src: string };
}

interface Props {
  currentHandle: string;
  collections: Collection[];
}

export default function CollectionHeaderCarousel({ currentHandle, collections }: Props) {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const activeIndex = collections.findIndex(c => c.handle === currentHandle);
    if (activeIndex !== -1 && scrollRef.current) {
      const scrollX = activeIndex * (ITEM_WIDTH + ITEM_MARGIN);
      // Slight delay to ensure layout is ready
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: scrollX - (width - ITEM_WIDTH) / 2 + ITEM_MARGIN/2, animated: true });
      }, 300);
    }
  }, [currentHandle, collections]);

  return (
    <View style={styles.container}>
      <BlurView intensity={isDark ? 30 : 25} tint={isDark ? 'dark' : 'light'} style={styles.backgroundBlur}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_WIDTH + ITEM_MARGIN}
          decelerationRate="fast"
          contentContainerStyle={styles.scrollContent}
        >
          {collections.map((col) => {
            const isActive = col.handle === currentHandle;
            return (
              <TouchableOpacity
                key={col.handle}
                activeOpacity={0.9}
                onPress={() => {
                  if (!isActive) {
                    navigation.navigate('Collection', { handle: col.handle, title: col.title });
                  }
                }}
                style={[
                  styles.item,
                  { 
                    opacity: isActive ? 1 : 0.5,
                    transform: [{ scale: isActive ? 1 : 0.96 }]
                  }
                ]}
              >
                <View style={[
                  styles.card,
                  { 
                    borderColor: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.05)',
                    shadowOpacity: isActive ? 0.25 : 0.05
                  }
                ]}>
                  {col.image?.src ? (
                    <Image
                      source={{ uri: col.image.src }}
                      style={styles.image}
                      contentFit="cover"
                      transition={1000}
                    />
                  ) : (
                    <View style={[styles.placeholder, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                       <Typography size={6} weight="800" color={colors.textExtraLight} style={{ opacity: 0.2 }}>{col.title.toUpperCase()}</Typography>
                    </View>
                  )}
                  
                  <View style={[styles.overlay, { backgroundColor: isActive ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.4)' }]}>
                    <Typography 
                      rocaston 
                      size={12} 
                      weight="700" 
                      color="white" 
                      style={[styles.title, { textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10 }]}
                    >
                      {col.title.toUpperCase()}
                    </Typography>
                  </View>

                  {isActive && (
                    <View style={styles.shine} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    marginHorizontal: 6,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  backgroundBlur: {
    paddingVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: (width - ITEM_WIDTH) / 2,
  },
  item: {
    width: ITEM_WIDTH,
    marginRight: ITEM_MARGIN,
  },
  card: {
    aspectRatio: 21 / 9,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    letterSpacing: 4.5,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  shine: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});
