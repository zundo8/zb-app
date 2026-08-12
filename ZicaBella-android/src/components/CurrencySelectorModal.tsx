import React from 'react';
import { View, StyleSheet, Modal, Pressable, FlatList, TouchableOpacity } from 'react-native';
import { useCurrencyStore, CURRENCIES, Currency } from '../store/currencyStore';
import { Typography } from './Typography';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { GlassBackdrop } from './GlassView';
import { haptics } from '../utils/haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function CurrencySelectorModal({ visible, onClose }: Props) {
  const colors = useColors();
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';
  const { currentCurrency, setCurrency } = useCurrencyStore();

  const handleSelect = (curr: Currency) => {
    setCurrency(curr.code);
    haptics.buttonTap();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <GlassBackdrop intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={[styles.content, { backgroundColor: isDark ? '#141414' : '#1A1A1A' }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.dragIndicator} />
          <Typography weight="700" size={12} color="#FFFFFF" style={styles.title}>
            GLOBAL STORE CURRENCY
          </Typography>
          <FlatList
            data={CURRENCIES}
            keyExtractor={item => item.code}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = currentCurrency.code === item.code;
              return (
                <TouchableOpacity
                  style={[
                    styles.item,
                    isSelected && { backgroundColor: 'rgba(255,255,255,0.08)' }
                  ]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <Typography size={18} style={{ marginRight: 10 }}>{item.flag}</Typography>
                  <Typography size={13} weight="600" color="#FFFFFF" style={{ flex: 1 }}>
                    {item.name.toUpperCase()} ({item.code})
                  </Typography>
                  <Typography size={12} color="rgba(255,255,255,0.5)" weight="700">
                    {item.symbol}
                  </Typography>
                </TouchableOpacity>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '65%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    letterSpacing: 2,
    marginBottom: 16,
    textAlign: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 4,
  },
});
