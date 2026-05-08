import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../constants/colors';
import { haptics } from '../utils/haptics';
import { Typography } from './Typography';

interface Props {
  quantity: number;
  onUpdate: (quantity: number) => void;
  min?: number;
  max?: number;
}

export default function QuantityControl({ quantity, onUpdate, min = 1, max = 99 }: Props) {
  const colors = useColors();
  const decrease = () => {
    if (quantity > min) {
      haptics.quantityChange();
      onUpdate(quantity - 1);
    } else if (min === 0 && quantity === 1) {
      // If we are at 1 and min is 0, one more decrease removes it
      haptics.buttonTap();
      onUpdate(0);
    }
  };

  const increase = () => {
    if (quantity < max) {
      haptics.quantityChange();
      onUpdate(quantity + 1);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <TouchableOpacity
        onPress={decrease}
        style={styles.button}
        disabled={quantity < min}
        activeOpacity={0.7}
      >
        <Ionicons 
          name={quantity === 1 && min === 0 ? "trash-outline" : "remove"} 
          size={quantity === 1 && min === 0 ? 12 : 14} 
          color={quantity <= min && min !== 0 ? colors.borderLight : colors.textLight} 
        />
      </TouchableOpacity>
      <Typography weight="600" size={10} color={colors.foreground}>{quantity}</Typography>
      <TouchableOpacity
        onPress={increase}
        style={styles.button}
        disabled={quantity >= max}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={14} color={quantity >= max ? colors.borderLight : colors.textLight} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  button: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
