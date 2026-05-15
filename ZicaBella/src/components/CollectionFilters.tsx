import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';

interface Props {
  allSizes: string[];
  selectedSize: string | null;
  onSelectSize: (size: string | null) => void;
  allColors: string[];
  selectedColor: string | null;
  onSelectColor: (color: string | null) => void;
  sortBy: string;
  onSelectSort: (sort: string) => void;
  viewMode: 'grid' | 'grid4' | 'large';
  onToggleView: () => void;
  isTabBarVisible?: boolean;
  isSizeOpen: boolean;
  setIsSizeOpen: (open: boolean) => void;
  isColorOpen: boolean;
  setIsColorOpen: (open: boolean) => void;
  compact?: boolean;
}

export default function CollectionFilters({
  allSizes,
  selectedSize,
  onSelectSize,
  allColors,
  selectedColor,
  onSelectColor,
  sortBy,
  onSelectSort,
  viewMode,
  onToggleView,
  isTabBarVisible = true,
  isSizeOpen,
  setIsSizeOpen,
  isColorOpen,
  setIsColorOpen,
  compact = false,
}: Props) {
  const colors = useColors();
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';

  return (
    <View style={styles.container}>
      <View style={[styles.pillWrapper, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
        <BlurView intensity={isDark ? 25 : 40} tint={isDark ? 'dark' : 'light'} style={styles.pill}>
          {/* Sort Button */}
          <TouchableOpacity 
            style={[styles.filterBtn, compact && styles.compactBtn]} 
            onPress={() => {
              const sorts = ['featured', 'newest', 'price-asc', 'price-desc'];
              const next = sorts[(sorts.indexOf(sortBy) + 1) % sorts.length];
              onSelectSort(next);
            }}
          >
            <Ionicons name="swap-vertical" size={16} color={colors.text} />
            {!compact && (
              <Text style={[styles.filterText, { color: colors.text }]}>
                {sortBy === 'featured' ? 'SORT' : sortBy.replace('-', ' ').toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
          
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Color Button */}
          <TouchableOpacity 
            style={[styles.filterBtn, compact && styles.compactBtn]}
            onPress={() => {
              setIsColorOpen(!isColorOpen);
              setIsSizeOpen(false);
            }}
          >
            <View style={styles.iconWrapper}>
              <Ionicons name="color-palette-outline" size={16} color={colors.text} />
              {selectedColor && <View style={[styles.activeDot, { backgroundColor: colors.iosBlue }]} />}
            </View>
            {!compact && (
              <Text style={[styles.filterText, { color: colors.text }]}>
                {selectedColor || 'COLOR'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Size Button */}
          <TouchableOpacity 
            style={[styles.filterBtn, compact && styles.compactBtn]}
            onPress={() => {
              setIsSizeOpen(!isSizeOpen);
              setIsColorOpen(false);
            }}
          >
            <View style={styles.iconWrapper}>
              <Ionicons name="resize-outline" size={16} color={colors.text} />
              {selectedSize && <View style={[styles.activeDot, { backgroundColor: colors.iosBlue }]} />}
            </View>
            {!compact && (
              <Text style={[styles.filterText, { color: colors.text }]}>
                {selectedSize || 'SIZE'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* View Toggle */}
          <TouchableOpacity style={styles.viewToggle} onPress={onToggleView}>
            <Ionicons 
              name={
                viewMode === 'grid' ? 'grid-outline' : 
                viewMode === 'grid4' ? 'apps-outline' :
                'square-outline'
              } 
              size={16} 
              color={colors.text} 
            />
          </TouchableOpacity>
        </BlurView>
      </View>

      {/* Dropdown for Sizes */}
      {isSizeOpen && (
        <View style={styles.dropdownOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={() => setIsSizeOpen(false)} 
          />
          <View style={[styles.dropdownContainer, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
            <BlurView intensity={isDark ? 80 : 90} tint={isDark ? 'dark' : 'light'} style={styles.dropdownInner}>
              <ScrollView style={{ maxHeight: 250 }}>
                <TouchableOpacity 
                  style={styles.dropdownOption}
                  onPress={() => { onSelectSize(null); setIsSizeOpen(false); }}
                >
                  <Text style={[styles.dropdownOptionText, { color: colors.text, opacity: !selectedSize ? 1 : 0.6 }]}>
                    ANY SIZE
                  </Text>
                </TouchableOpacity>
                {allSizes.map(size => (
                  <TouchableOpacity 
                    key={size}
                    style={styles.dropdownOption}
                    onPress={() => { onSelectSize(size); setIsSizeOpen(false); }}
                  >
                    <Text style={[styles.dropdownOptionText, { color: colors.text }]}>
                      {size}
                    </Text>
                    {selectedSize === size && (
                      <Ionicons name="checkmark" size={12} color={colors.text} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </BlurView>
          </View>
        </View>
      )}

      {/* Dropdown for Colors */}
      {isColorOpen && (
        <View style={styles.dropdownOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={() => setIsColorOpen(false)} 
          />
          <View style={[styles.dropdownContainer, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
            <BlurView intensity={isDark ? 80 : 90} tint={isDark ? 'dark' : 'light'} style={styles.dropdownInner}>
              <ScrollView style={{ maxHeight: 250 }}>
                <TouchableOpacity 
                  style={styles.dropdownOption}
                  onPress={() => { onSelectColor(null); setIsColorOpen(false); }}
                >
                  <Text style={[styles.dropdownOptionText, { color: colors.text, opacity: !selectedColor ? 1 : 0.6 }]}>
                    ANY COLOR
                  </Text>
                </TouchableOpacity>
                {allColors.map(color => (
                  <TouchableOpacity 
                    key={color}
                    style={styles.dropdownOption}
                    onPress={() => { onSelectColor(color); setIsColorOpen(false); }}
                  >
                    <Text style={[styles.dropdownOptionText, { color: colors.text }]}>
                      {color}
                    </Text>
                    {selectedColor === color && (
                      <Ionicons name="checkmark" size={12} color={colors.text} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </BlurView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    zIndex: 2000,
    elevation: 2000,
    marginBottom: 8,
    marginTop: 4,
  },
  pillWrapper: {
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 36,
  },
  compactBtn: {
    paddingHorizontal: 10,
    width: 46,
    justifyContent: 'center',
  },
  iconWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    position: 'absolute',
    top: -2,
    right: -4,
  },
  filterText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  divider: {
    width: 1,
    height: 14,
    opacity: 0.1,
  },
  viewToggle: {
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    height: 36,
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 58,
    width: '100%',
    alignItems: 'center',
    zIndex: 2001,
    elevation: 2001,
  },
  dropdownContainer: {
    width: 240,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 15,
  },
  dropdownInner: {
    paddingVertical: 12,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  dropdownOptionText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
