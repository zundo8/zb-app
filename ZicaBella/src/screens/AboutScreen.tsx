import React, { useEffect, useState } from 'react';
import { 
  View, StyleSheet, ScrollView, 
  ActivityIndicator, Dimensions, Animated, Platform,
  ImageBackground
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import RenderHTML from 'react-native-render-html';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import Constants from 'expo-constants';

import { useColors } from '../constants/colors';
import { Typography } from '../components/Typography';
import { useThemeStore } from '../store/themeStore';
import { config } from '../constants/config';
import { haptics } from '../utils/haptics';

const { width } = Dimensions.get('window');

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';
  const version = Constants.expoConfig?.version || '1.0.5';
  
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    fetchAboutContent();
  }, []);

  const fetchAboutContent = async () => {
    try {
      const res = await fetch(`${config.appUrl}/api/app/policies?handle=about-us`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.content) {
          setContent(data.content);
        }
      }
    } catch (err) {
      console.error("Failed to fetch about content:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* BRAND HERO */}
        <View style={styles.hero}>
          <Image 
            source={require('../../assets/load-image-4.jpg')} 
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <BlurView intensity={isDark ? 30 : 50} tint={theme} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroOverlay, { paddingTop: 60 }]}>
            <Typography heading size={42} weight="800" color={colors.text} style={styles.heroTitle}>
              ZICA{"\n"}BELLA
            </Typography>
            <View style={[styles.badge, { backgroundColor: colors.foreground }]}>
              <Typography size={7} weight="800" color={colors.background} style={{ letterSpacing: 2 }}>ARCHIVAL VISION</Typography>
            </View>
          </View>
        </View>

        <View style={styles.contentPadding}>
          {loading ? (
            <ActivityIndicator color={colors.text} style={{ marginTop: 40 }} />
          ) : content ? (
            <RenderHTML
              contentWidth={width - 40}
              source={{ html: content }}
              tagsStyles={{
                body: { color: colors.text, fontSize: 16, lineHeight: 26 },
                h1: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 20 },
                h2: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 30, marginBottom: 15 },
                p: { marginBottom: 20, color: colors.textSecondary },
                strong: { fontWeight: '700', color: colors.text },
              }}
            />
          ) : (
            <View style={styles.fallbackContent}>
               <Typography heading size={20} weight="700" color={colors.text} style={{ marginBottom: 16 }}>
                 ELEVATING THE EVERYDAY
               </Typography>
               <Typography size={14} color={colors.textSecondary} style={{ lineHeight: 22 }}>
                 Zica Bella is a forward-thinking fashion house dedicated to the intersection of avant-garde technique and timeless streetwear silhouettes.
                 {"\n\n"}
                 Our "Archival Vision" philosophy drives us to create pieces that aren't just worn, but collected. We believe in sustainable evolution, limited drops, and uncompromising quality.
               </Typography>
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: colors.borderExtraLight }]} />

          <View style={styles.footer}>
            <Typography size={8} weight="700" color={colors.textExtraLight} style={{ letterSpacing: 1, marginBottom: 4 }}>
              VERSION {version}
            </Typography>
            <Typography size={8} color={colors.textExtraLight} style={{ opacity: 0.5 }}>
              © 2025 ZICA BELLA PRIVATE LIMITED. ALL RIGHTS RESERVED.
            </Typography>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { },
  hero: {
    width: '100%',
    height: 340,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    textAlign: 'center',
    letterSpacing: -2,
    lineHeight: 40,
  },
  badge: {
    marginTop: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  contentPadding: {
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  fallbackContent: {
    paddingBottom: 40,
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 40,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 40,
  }
});
