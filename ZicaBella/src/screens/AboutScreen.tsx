import React, { useEffect, useState } from 'react';
import { 
  View, StyleSheet, ScrollView, 
  ActivityIndicator, Dimensions, Animated, Platform,
  TouchableOpacity
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

const prepareHtml = (htmlContent: string | null, colors: any, isDark: boolean) => {
  if (!htmlContent) return '';
  let processed = htmlContent;
  processed = processed.replace(/color:\s*(#ffffff|#fff|white|rgb\(255,\s*255,\s*255\))/gi, `color: ${colors.text}`);
  processed = processed.replace(/border-left:\s*2px\s*solid\s*(#ffffff|#fff|white)/gi, `border-left: 2px solid ${colors.text}`);
  if (!isDark) {
    processed = processed.replace(/rgba\(255,\s*255,\s*255,\s*0\.03\)/gi, 'rgba(0, 0, 0, 0.02)');
    processed = processed.replace(/rgba\(255,\s*255,\s*255,\s*0\.08\)/gi, 'rgba(0, 0, 0, 0.06)');
  } else {
    processed = processed.replace(/rgba\(255,\s*255,\s*255,\s*0\.03\)/gi, 'rgba(255, 255, 255, 0.03)');
    processed = processed.replace(/rgba\(255,\s*255,\s*255,\s*0\.08\)/gi, 'rgba(255, 255, 255, 0.08)');
  }
  return processed;
};

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const navigation = useNavigation<any>();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';
  const version = Constants.expoConfig?.version || '1.0.5';
  
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string | null>(null);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const heroFade = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(heroFade, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
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

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* BACK BUTTON */}
      <TouchableOpacity 
        onPress={() => {
          haptics.buttonTap();
          navigation.goBack();
        }}
        style={[
          styles.backButton, 
          { 
            top: insets.top + 10,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' 
          }
        ]}
      >
        <Ionicons name="arrow-back" size={20} color={colors.text} />
      </TouchableOpacity>

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
          <Animated.View style={[styles.heroOverlay, { paddingTop: 60, opacity: heroFade }]}>
            <Typography rocaston size={44} color={colors.text} style={styles.heroTitle}>
              ZICA BELLA
            </Typography>
            <View style={[styles.badge, { backgroundColor: colors.foreground }]}>
              <Typography size={7} weight="800" color={colors.background} style={{ letterSpacing: 2 }}>ARCHIVAL VISION</Typography>
            </View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.contentPadding, { opacity: fadeAnim }]}>
          {loading ? (
            <ActivityIndicator color={colors.text} style={{ marginTop: 40 }} />
          ) : content ? (
            <RenderHTML
              contentWidth={width - 48}
              source={{ html: prepareHtml(content, colors, isDark) }}
              tagsStyles={{
                body: { color: colors.text, fontSize: 14, lineHeight: 22, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
                h1: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 16, marginTop: 24, letterSpacing: 0.5 },
                h2: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 28, marginBottom: 12, letterSpacing: 0.3 },
                p: { marginBottom: 16, color: colors.textSecondary, lineHeight: 22 },
                strong: { fontWeight: '700', color: colors.text },
                ul: { marginBottom: 16, paddingLeft: 20 },
                li: { color: colors.textSecondary, marginBottom: 8, lineHeight: 20 },
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
        </Animated.View>
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
  },
  backButton: {
    position: 'absolute',
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  }
});
