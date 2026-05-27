import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import RenderHTML from 'react-native-render-html';
import GlassHeader from '../../components/GlassHeader';
import { useColors } from '../../constants/colors';
import { useThemeStore } from '../../store/themeStore';
import { config } from '../../constants/config';
import { Typography } from '../../components/Typography';

const { width } = Dimensions.get('window');

export default function PrivacyAndTermsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const colors = useColors();
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const type = route.params?.type || 'privacy'; 
  
  const handle = type === 'privacy' ? 'privacy-policy' : 'terms-of-service';
  const title = type === 'privacy' ? 'PRIVACY POLICY' : 'TERMS OF SERVICE';

  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    fetchPolicy();
  }, [handle]);

  const fetchPolicy = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${config.appUrl}/api/app/policies?handle=${handle}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.content) {
          setContent(data.content);
        }
      }
    } catch (err) {
      console.error("Failed to fetch policy:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader title={title} showBack />
      
      <ScrollView 
        contentContainerStyle={{ 
          paddingTop: insets.top + 80, 
          paddingHorizontal: 24, 
          paddingBottom: insets.bottom + 40 
        }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} size="large" style={{ marginTop: 40 }} />
        ) : content ? (
          <RenderHTML
            contentWidth={width - 48}
            source={{ html: content }}
            tagsStyles={{
              body: { color: colors.text, fontSize: 14, lineHeight: 22 },
              h1: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 16 },
              p: { marginBottom: 16, color: colors.textSecondary },
              li: { marginBottom: 8, color: colors.textSecondary },
            }}
          />
        ) : (
          <Typography color={colors.textMuted} style={{ textAlign: 'center', marginTop: 40 }}>
            Unable to load {title.toLowerCase()}.
          </Typography>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
