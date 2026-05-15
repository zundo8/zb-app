import React, { useEffect, useState } from 'react';
import { 
  View, StyleSheet, TouchableOpacity, ScrollView, 
  ActivityIndicator, Dimensions, Animated, Share, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import RenderHTML from 'react-native-render-html';
import { BlurView } from 'expo-blur';
import { useColors } from '../constants/colors';
import { RootStackParamList } from '../navigation/types';
import { Typography } from '../components/Typography';
import { useThemeStore } from '../store/themeStore';
import { config } from '../constants/config';
import { haptics } from '../utils/haptics';

const { width } = Dimensions.get('window');

export default function PolicyScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Policy'>>();
  const colors = useColors();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';
  
  const { handle, url, title: initialTitle } = route.params;
  
  const [loading, setLoading] = useState(!!handle);
  const [content, setContent] = useState<string | null>(null);
  const [title, setTitle] = useState(initialTitle || 'Policy');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const scrollY = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (handle) {
      fetchPolicy();
    }
  }, [handle]);

  const fetchPolicy = async () => {
    try {
      setLoading(true);
      setError(false);
      
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 12000);
      
      const res = await fetch(`${config.appUrl}/api/app/policies?handle=${handle}&t=${Date.now()}`, {
        signal: controller.signal
      });
      clearTimeout(id);
      
      if (res.ok) {
        const data = await res.json();
        if (data && data.content) {
          setContent(data.content);
          setTitle(data.title || initialTitle);
          setUpdatedAt(data.updatedAt);
        } else {
          setError(true);
        }
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Failed to fetch policy:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    haptics.buttonTap();
    try {
      await Share.share({
        message: `Check out Zica Bella's ${title}: ${url || `${config.appUrl}/policies/${handle}`}`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleOpenWeb = () => {
    haptics.buttonTap();
    const fallbackUrl = url || `https://app.zicabella.com/policies/${handle}`;
    navigation.navigate('Policy', { url: fallbackUrl, title });
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const titleScale = scrollY.interpolate({
    inputRange: [-100, 0, 100],
    outputRange: [1.2, 1, 0.8],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── ETHEREAL HEADER ── */}
      <Animated.View style={[
        styles.header, 
        { 
          paddingTop: insets.top,
          height: insets.top + 60,
          backgroundColor: colors.background,
          borderBottomColor: colors.borderExtraLight,
          opacity: headerOpacity,
          borderBottomWidth: 1,
        }
      ]}>
        <View style={styles.headerContent}>
           <Typography size={10} weight="700" color={colors.text} style={{ letterSpacing: 1 }}>
             {title.toUpperCase()}
           </Typography>
        </View>
      </Animated.View>

      {/* ── TOP CONTROLS ── */}
      <View style={[styles.controls, { top: insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={[styles.controlBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={handleShare}
          style={[styles.controlBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
        >
          <Ionicons name="share-outline" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView 
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 80, paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* BIG TITLE */}
        <Animated.View style={{ transform: [{ scale: titleScale }], marginBottom: 40 }}>
           <Typography size={7} weight="800" color={colors.textLight} style={{ letterSpacing: 4, marginBottom: 8, opacity: 0.4 }}>
             LEGAL ARCHIVE
           </Typography>
           <Typography heading size={32} weight="700" color={colors.text}>
             {title}
           </Typography>
           {updatedAt && (
             <Typography size={9} color={colors.textExtraLight} style={{ marginTop: 12, letterSpacing: 1 }}>
               LAST UPDATED: {new Date(updatedAt).toLocaleDateString(undefined, { dateStyle: 'long' }).toUpperCase()}
             </Typography>
           )}
        </Animated.View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.textExtraLight} style={{ marginBottom: 16 }} />
            <Typography color={colors.textMuted} style={{ textAlign: 'center', marginBottom: 24 }}>
              Unable to load live policy data.
            </Typography>
            <TouchableOpacity 
              onPress={handleOpenWeb}
              style={[styles.fallbackBtn, { borderColor: colors.borderLight }]}
            >
              <Typography size={9} weight="600" color={colors.text}>VIEW ONLINE VERSION</Typography>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={fetchPolicy}
              style={{ marginTop: 20 }}
            >
              <Typography size={8} color={colors.textExtraLight}>RETRY SYNC</Typography>
            </TouchableOpacity>
          </View>
        ) : content ? (
          <RenderHTML
            contentWidth={width - 40}
            source={{ html: content.replace(/\n/g, '<br/>') }}
            tagsStyles={{
              body: {
                color: colors.text,
                fontSize: 15,
                lineHeight: 24,
                fontFamily: Platform.OS === 'ios' ? 'System' : 'serif',
              },
              h1: { fontSize: 24, fontWeight: '700', marginBottom: 16, marginTop: 24, color: colors.text },
              h2: { fontSize: 20, fontWeight: '700', marginBottom: 14, marginTop: 20, color: colors.text },
              h3: { fontSize: 18, fontWeight: '600', marginBottom: 12, marginTop: 18, color: colors.text },
              p: { marginBottom: 16, color: colors.textSecondary },
              li: { marginBottom: 8, color: colors.textSecondary },
              strong: { fontWeight: '700', color: colors.text },
            }}
          />
        ) : (
          <View style={styles.errorContainer}>
            <Typography color={colors.textMuted}>Policy content is currently empty.</Typography>
          </View>
        )}
      </Animated.ScrollView>
      
      {/* ── SYSTEM WATERMARK ── */}
      <View style={[styles.watermark, { bottom: insets.bottom + 20 }]}>
         <Typography size={6} weight="800" color={colors.textExtraLight} style={{ opacity: 0.1, letterSpacing: 8 }}>
           ZICA BELLA SECURITY PROTOCOL
         </Typography>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 60,
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  loadingContainer: {
    paddingVertical: 100,
    alignItems: 'center',
  },
  errorContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  fallbackBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 1,
  },
  watermark: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  }
});
