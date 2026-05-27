import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Typography } from './Typography';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface SizeChartModalProps {
  visible: boolean;
  onClose: () => void;
  imageUrl?: string;
}

export function SizeChartModal({ visible, onClose, imageUrl }: SizeChartModalProps) {
  const colors = useColors();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        
        <View style={[styles.content, { backgroundColor: colors.background, borderColor: colors.borderLight }]}>
          <View style={styles.header}>
            <View>
              <Typography size={10} weight="700" color={colors.text}>SIZING REFERENCE</Typography>
              <Typography size={7} color={colors.textExtraLight} style={{ marginTop: 2, letterSpacing: 1 }}>ARCHIVAL MEASUREMENTS</Typography>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {imageUrl ? (
              <Image 
                source={{ uri: imageUrl }} 
                style={styles.chartImage}
                contentFit="contain"
              />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="scan-outline" size={32} color={colors.textExtraLight} />
                <Typography size={9} color={colors.textExtraLight} style={{ marginTop: 16, textAlign: 'center' }}>
                  Size guide for this artefact is being processed. Please contact support for help.
                </Typography>
              </View>
            )}
            
            <View style={[styles.footer, { borderTopColor: colors.borderExtraLight }]}>
              <Typography size={8} color={colors.textExtraLight} style={{ lineHeight: 14 }}>
                All measurements are in inches unless otherwise specified. Fit may vary between different architectural silhouettes.
              </Typography>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxHeight: SCREEN_H * 0.7,
    borderRadius: 32,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  chartImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
  },
  placeholder: {
    aspectRatio: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.5,
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
  }
});
