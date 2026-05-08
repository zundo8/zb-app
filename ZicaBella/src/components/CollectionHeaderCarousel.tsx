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
      // Approximate width of a pill is 100-150px
      const scrollX = activeIndex * 120; 
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: scrollX - width/2 + 60, animated: true });
      }, 300);
    }
  }, [currentHandle, collections]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {collections.map((col) => {
          const isActive = col.handle === currentHandle;
          return (
            <TouchableOpacity
              key={col.handle}
              activeOpacity={0.7}
              onPress={() => {
                if (!isActive) {
                  navigation.navigate('Collection', { handle: col.handle, title: col.title });
                }
              }}
              style={[
                styles.pill,
                { 
                  backgroundColor: isActive ? colors.text : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'),
                  borderColor: isActive ? colors.text : colors.borderLight,
                },
                isActive && styles.activePill
              ]}
            >
              <Typography 
                size={7} 
                weight={isActive ? "700" : "400"} 
                color={isActive ? colors.background : colors.text} 
                style={styles.pillText}
              >
                {col.title.toUpperCase()}
              </Typography>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    letterSpacing: 1.8,
  },
  activePill: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
});
