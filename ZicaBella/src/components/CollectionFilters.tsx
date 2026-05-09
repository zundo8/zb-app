import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';

interface Props {
  allSizes: string[];
  selectedSize: string | null;
  onSelectSize: (size: string | null) => void;
  sortBy: string;
  onSelectSort: (sort: string) => void;
  viewMode: 'grid' | 'grid4' | 'large';
  onToggleView: () => void;
  isTabBarVisible?: boolean;
  isSizeOpen: boolean;
  setIsSizeOpen: (open: boolean) => void;
  compact?: boolean;
}

export default function CollectionFilters({
  allSizes,
  selectedSize,
  onSelectSize,
  sortBy,
  onSelectSort,
  viewMode,
  onToggleView,
  isTabBarVisible = true,
  isSizeOpen,
  setIsSizeOpen,
  compact = false,
}: Props) {
  const colors = useColors();
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';

  return (
    <View style={styles.container}>
      <View style={[styles.pillWrapper, { borderColor: colors.borderLight }]}>
        <BlurView intensity={isDark ? 5 : 10} tint={isDark ? 'dark' : 'light'} style={styles.pill}>
          {/* Sort Button */}
          <TouchableOpacity 
            style={[styles.filterBtn, compact && styles.compactBtn]} 
            onPress={() => {
              const sorts = ['featured', 'newest', 'price-asc', 'price-desc'];
              const next = sorts[(sorts.indexOf(sortBy) + 1) % sorts.length];
              onSelectSort(next);
            }}
          >
            {!compact ? (
              <Text style={[styles.filterText, { color: colors.text }]}>
                {sortBy.replace('-', ' ').toUpperCase()}
              </Text>
            ) : (
              <Ionicons name="swap-vertical" size={12} color={colors.text} />
            )}
            {!compact && <Ionicons name="chevron-down" size={10} color={colors.textExtraLight} />}
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Size Button */}
          <TouchableOpacity 
            style={[styles.filterBtn, compact && styles.compactBtn]}
            onPress={() => {
              if (allSizes.length > 0) setIsSizeOpen(!isSizeOpen);
            }}
          >
            <View style={styles.sizeLabelRow}>
              {!compact ? (
                <Text style={[styles.filterText, { color: colors.text }]}>
                  {selectedSize || 'SIZE'}
                </Text>
              ) : (
                <Ionicons name="options-outline" size={12} color={colors.text} />
              )}
              {selectedSize && <View style={[styles.activeDot, { backgroundColor: colors.iosBlue }]} />}
            </View>
            {!compact && <Ionicons name="chevron-down" size={10} color={colors.textExtraLight} />}
          </TouchableOpacity>

          {/* View Toggle */}
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <TouchableOpacity style={styles.viewToggle} onPress={onToggleView}>
            <Ionicons 
              name={
                viewMode === 'grid' ? 'grid-outline' : 
                viewMode === 'grid4' ? 'apps-outline' :
                'square-outline'
              } 
              size={13} 
              color={colors.text} 
              style={{ opacity: 0.8 }}
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
          <View style={[styles.dropdownContainer, { borderColor: colors.borderLight }]}>
            <BlurView intensity={isDark ? 80 : 90} tint={isDark ? 'dark' : 'light'} style={styles.dropdownInner}>
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
    zIndex: 100,
    marginBottom: 4,
    marginTop: 4,
  },
  pillWrapper: {
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    height: 32,
  },
  compactBtn: {
    paddingHorizontal: 12,
    width: 44,
    justifyContent: 'center',
  },
  sizeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  filterText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  divider: {
    width: 1,
    height: 12,
    opacity: 0.2,
  },
  viewToggle: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
    height: 28,
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 54,
    width: '100%',
    alignItems: 'center',
    zIndex: 999,
  },
  dropdownContainer: {
    width: 220,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
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
