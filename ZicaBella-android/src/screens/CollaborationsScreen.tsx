import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import GlassHeader from '../components/GlassHeader';

const COLLABS = [
  { id: '1', name: 'ZICA x VEXEE', role: 'Limited Footwear Drop' },
  { id: '2', name: 'ZICA x ROGUE', role: 'Winter Outerwear Collection' },
];

export default function CollaborationsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader title="COLLABORATIONS" showBack />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: 100 }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>SHARED{'\n'}VISIONS</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Where our ethos meets global talent.</Text>
        </View>

        <View style={styles.list}>
          {COLLABS.map((collab) => (
            <View key={collab.id} style={styles.itemWrapper}>
              <BlurView intensity={isDark ? 40 : 80} tint={isDark ? "dark" : "light"} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
              <TouchableOpacity activeOpacity={0.8} style={[styles.item, { borderColor: 'rgba(255,255,255,0.05)' }]}>
                <Text style={[styles.collabName, { color: colors.text }]}>{collab.name}</Text>
                <Text style={[styles.collabRole, { color: colors.textExtraLight }]}>{collab.role}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={[styles.inquiryBox, { borderColor: colors.borderLight }]}>
          <Text style={[styles.inquiryTitle, { color: colors.text }]}>PARTNER WITH US</Text>
          <Text style={[styles.inquiryText, { color: colors.textSecondary }]}>We are always looking for visionary artists and brands to push boundaries with.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 2,
    lineHeight: 38,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '300',
  },
  list: {
    paddingHorizontal: 16,
    gap: 16,
  },
  itemWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  item: {
    padding: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  collabName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 4,
    marginBottom: 8,
  },
  collabRole: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  inquiryBox: {
    margin: 24,
    marginTop: 48,
    padding: 32,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
  },
  inquiryTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 12,
  },
  inquiryText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '300',
  },
});
