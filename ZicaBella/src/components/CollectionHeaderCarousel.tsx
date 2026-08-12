import React, { useRef, useEffect } from 'react';
import { 
  View, StyleSheet, TouchableOpacity, 
  Dimensions, Platform
} from 'react-native';
import { GlassView } from './GlassView';
import Carousel from 'react-native-reanimated-carousel';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { Typography } from './Typography';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width * 0.55;
const ITEM_HEIGHT = 44;

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
  const carouselRef = useRef<any>(null);

  const activeIndex = collections.findIndex(c => c.handle === currentHandle);

  useEffect(() => {
    if (activeIndex !== -1 && carouselRef.current) {
      carouselRef.current?.scrollTo({ index: activeIndex, animated: true });
    }
  }, [activeIndex]);

  const renderItem = ({ item }: { item: Collection }) => {
    const isActive = item.handle === currentHandle;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          if (!isActive) {
            navigation.navigate('Collection', { handle: item.handle, title: item.title });
          }
        }}
        style={styles.itemWrapper}
      >
        <View style={[
          styles.pillContainer,
          { 
            borderColor: isActive 
              ? (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.15)') 
              : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
          }
        ]}>
          <GlassView 
            intensity={isActive ? (isDark ? 50 : 70) : (isDark ? 15 : 25)} 
            tint={isDark ? 'dark' : 'light'} 
            style={[
              styles.blur,
              { 
                backgroundColor: isActive 
                  ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.4)') 
                  : 'transparent'
              }
            ]}
          >
            <Typography 
              size={8.5} 
              weight={isActive ? "700" : "500"} 
              color={colors.text} 
              style={[
                styles.pillText,
                { opacity: isActive ? 1 : 0.5 }
              ]}
              numberOfLines={1}
            >
              {item.title.toUpperCase()}
            </Typography>
          </GlassView>
        </View>
      </TouchableOpacity>
    );
  };

  if (!collections || collections.length === 0) return null;

  return (
    <View style={styles.container}>
      <Carousel
        ref={carouselRef}
        width={ITEM_WIDTH}
        height={ITEM_HEIGHT}
        data={collections}
        renderItem={renderItem}
        defaultIndex={activeIndex !== -1 ? activeIndex : 0}
        style={styles.carousel}
        loop={false}
        autoPlay={false}
        mode="parallax"
        modeConfig={{
          parallaxScrollingScale: 0.88,
          parallaxScrollingOffset: 45,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    marginVertical: 8,
  },
  carousel: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemWrapper: {
    width: '100%',
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  pillContainer: {
    height: 40,
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
  },
  blur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  pillText: {
    letterSpacing: 3,
    fontSize: 9,
  },
});
