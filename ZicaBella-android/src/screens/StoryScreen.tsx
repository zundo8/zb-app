import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import GlassHeader from '../components/GlassHeader';

const { width, height } = Dimensions.get('window');

export default function StoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader title="OUR STORY" showBack />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Section 1: Hero */}
        <View style={[styles.heroSection, { minHeight: height * 0.7 }]}>
          <View style={[styles.heroBlur, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }]} />
          <Text style={[styles.tag, { color: colors.textExtraLight }]}>THE GENESIS</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            REDEFINING{'\n'}<Text style={{ ...styles.heroTitleItalic, color: colors.textSecondary }}>THE CODE.</Text>
          </Text>
          <Text style={[styles.heroBody, { color: colors.textSecondary }]}>
            Zica Bella was born from a singular, uncompromising vision: to elevate emerging Indian street culture into a global luxury phenomenon.
          </Text>
        </View>

        {/* Section 2: The Founders */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>TWO VISIONARIES.{'\n'}ONE REBELLION.</Text>
          <View style={[styles.line, { backgroundColor: colors.borderLight }]} />
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            Frustrated by the disconnect between fast-fashion imitation and authentic streetwear, the founders of Zica Bella set out to build exactly what they couldn't find—garments with true weight, uncompromising silhouettes, and a narrative grounded in modern Indian youth culture.
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary, marginTop: 16 }]}>
            What started as late-night sketches and a relentless obsession with high-GSM fabrics quickly evolved into a cult-favorite luxury label. Every acid wash, every seam, and every drop is meticulously curated to disrupt the ordinary.
          </Text>

          {/* Founders Glass Panel */}
          <View style={styles.founderGlassWrapper}>
            <BlurView intensity={isDark ? 50 : 80} tint={isDark ? "dark" : "light"} style={[StyleSheet.absoluteFill, { borderRadius: 24 }]} />
            <View style={[styles.founderGlass, { borderColor: colors.glassBorder }]}>
              <View style={[styles.smallLine, { backgroundColor: colors.borderLight }]} />
              <Text style={[styles.archiveText, { color: colors.textExtraLight }]}>ORIGINAL ARCHIVE</Text>
              <Text style={[styles.founderInitials, { color: colors.text }]}>Z. B.</Text>
              <View style={[styles.smallLine, { backgroundColor: colors.borderLight }]} />
            </View>
          </View>
        </View>

        {/* Section 3: Ethos */}
        <View style={styles.section}>
          <Text style={[styles.tag, { color: colors.textExtraLight }]}>OUR ETHOS</Text>
          <Text style={[styles.sectionTitle, { color: colors.text, textAlign: 'center' }]}>ZERO COMPROMISE.{'\n'}MAXIMUM IMPACT.</Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary, textAlign: 'center', marginTop: 24 }]}>
            We believe streetwear isn't just clothing; it's architecture for the human form. By merging heavy-weight luxury Indian cottons with avant-garde draping, we engineer pieces designed to outlast trends and speak volumes in any room.
          </Text>
        </View>

        {/* CTA */}
        <View style={[styles.section, { alignItems: 'center', marginTop: 40 }]}>
          <Text style={[styles.ctaTitle, { color: colors.text }]}>JOIN THE MOVEMENT.</Text>
          <TouchableOpacity 
            style={[styles.ctaButton, { backgroundColor: colors.text }]}
            onPress={() => navigation.navigate('HomeTab')}
          >
            <Text style={[styles.ctaButtonText, { color: colors.background === 'transparent' ? '#000' : colors.background }]}>
              VIEW THE ARCHIVE
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroSection: {
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  heroBlur: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width * 0.75,
    top: -width * 0.2,
  },
  tag: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 24,
    textAlign: 'center',
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 24,
  },
  heroTitleItalic: {
    fontStyle: 'italic',
    fontWeight: '300',
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 24,
    fontWeight: '300',
    textAlign: 'center',
    maxWidth: 300,
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 50,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    lineHeight: 36,
  },
  line: {
    height: 1,
    width: 60,
    marginVertical: 24,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 24,
    fontWeight: '300',
  },
  founderGlassWrapper: {
    marginTop: 40,
    alignSelf: 'center',
    width: width * 0.7,
    aspectRatio: 3 / 4,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  founderGlass: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  smallLine: {
    height: 1,
    width: 40,
    marginVertical: 24,
  },
  archiveText: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 3,
  },
  founderInitials: {
    fontSize: 48,
    fontWeight: '800',
    marginTop: 8,
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 32,
    textAlign: 'center',
  },
  ctaButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
  },
  ctaButtonText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
  },
});
