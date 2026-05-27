import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useColors } from '../constants/colors';
import { FlatVariant } from '../api/types';

interface Props {
  variants: FlatVariant[];
  selectedSize: string | null;
  onSelect: (size: string, variantId: string) => void;
}

export default function SizeSelector({ variants, selectedSize, onSelect }: Props) {
  const colors = useColors();
  // Get unique sizes
  const sizes = variants
    .filter(v => v.size)
    .reduce<{ size: string; variantId: string; available: boolean }[]>((acc, v) => {
      if (!acc.find(s => s.size === v.size)) {
        acc.push({ size: v.size!, variantId: v.id, available: v.availableForSale });
      }
      return acc;
    }, []);

  if (sizes.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textLight }]}>Size</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {sizes.map((s) => (
          <TouchableOpacity
            key={s.size}
            onPress={() => s.available && onSelect(s.size, s.variantId)}
            disabled={!s.available}
            style={[
              styles.sizeButton,
              { borderColor: colors.borderLight },
              selectedSize === s.size && { backgroundColor: colors.foreground, borderColor: colors.foreground },
              !s.available && styles.sizeButtonDisabled,
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.sizeText,
                { color: colors.text },
                selectedSize === s.size && { color: colors.background },
                !s.available && { color: colors.soldOut },
              ]}
            >
              {s.size}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  label: {
    fontSize: 8,
    fontWeight: '300',
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 10,
  },
  list: {
    gap: 8,
  },
  sizeButton: {
    minWidth: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  sizeButtonDisabled: {
    opacity: 0.3,
    borderStyle: 'dashed',
  },
  sizeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
