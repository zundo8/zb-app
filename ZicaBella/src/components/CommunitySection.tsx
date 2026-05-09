import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Linking } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { Typography } from './Typography';
import { useFeaturedUsers } from '../hooks/useAdminFeatures';

const { width } = Dimensions.get('window');

type CommunityConfig = {
  title?: string | null;
  subtitle?: string | null;
  show?: boolean | null;
} | null;

type FeaturedLook = {
  id: string;
  imageUrl: string;
  name: string;
  instagramUrl?: string | null;
  styleDescription?: string | null;
};

const DEFAULT_LOOKS: FeaturedLook[] = [
  { id: '1', imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1000', name: 'DUSKYN' },
  { id: '2', imageUrl: 'https://images.unsplash.com/photo-1539109132314-dc477555d656?q=80&w=1000', name: 'MEGHAN' },
  { id: '3', imageUrl: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?q=80&w=1000', name: 'ARAV' },
];

function openInstagramLink(raw: string): void {
  const trimmed = raw.trim();
  if (!trimmed) return;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
    void Linking.openURL(trimmed);
  } catch {
    /* ignore malformed URLs */
  }
}

interface Props {
  community?: CommunityConfig;
  title?: string;
  subtitle?: string;
}

export default function CommunitySection({ community, title, subtitle }: Props) {
  const colors = useColors();
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';
  const { users } = useFeaturedUsers();

  const showSection = community?.show !== false;
  if (!showSection) return null;

  const displayTitle = (title ?? community?.title ?? 'FEATURED LOOKS').toUpperCase();
  const displaySubtitle = (subtitle ?? community?.subtitle ?? 'COMMUNITY').toUpperCase();

  const displayUsers: FeaturedLook[] =
    users && users.length > 0
      ? users.map((u: any) => ({
          id: u.id,
          imageUrl: u.imageUrl,
          name: u.name,
          instagramUrl: u.instagramUrl ?? null,
          styleDescription: u.styleDescription ?? null,
        }))
      : DEFAULT_LOOKS;

  const onCardPress = useCallback((look: FeaturedLook) => {
    if (look.instagramUrl) {
      openInstagramLink(look.instagramUrl);
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography size={7} color={colors.textLight} weight="300" style={styles.subtitle}>
          {displaySubtitle}
        </Typography>
        <Typography heading size={10} color={colors.foreground} weight="700" style={styles.title}>
          {displayTitle}
        </Typography>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        snapToInterval={width * 0.72 + 16}
        decelerationRate="fast"
        scrollEventThrottle={16}
      >
        {displayUsers.map((look) => {
            const hasIg = !!look.instagramUrl?.trim();
            return (
              <TouchableOpacity
                key={look.id}
                style={[
                  styles.item,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  },
                ]}
                activeOpacity={hasIg ? 0.92 : 1}
                onPress={() => onCardPress(look)}
                disabled={!hasIg}
                accessibilityRole={hasIg ? 'link' : 'image'}
                accessibilityHint={hasIg ? 'Opens this look on Instagram' : undefined}
              >
                <Image
                  source={{ uri: look.imageUrl }}
                  style={styles.image}
                  contentFit="cover"
                  transition={800}
                />
                <View style={styles.labelContainer}>
                  <BlurView
                    intensity={isDark ? 40 : 60}
                    tint={isDark ? 'dark' : 'light'}
                    style={[
                      styles.glassLabel,
                      { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' },
                    ]}
                  >
                    <Typography size={6.5} color={colors.text} weight="700" style={styles.labelText}>
                      @{look.name ? look.name.toUpperCase().slice(0, 14) : 'USER'}
                      {hasIg ? ' · IG' : ''}
                    </Typography>
                  </BlurView>
                </View>
              </TouchableOpacity>
            );
          })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 64,
    marginBottom: 40,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  subtitle: {
    letterSpacing: 4.5,
    opacity: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    letterSpacing: 4.2,
    textTransform: 'uppercase',
  },
  list: {
    paddingHorizontal: 12,
    paddingRight: 24,
    gap: 12,
  },
  item: {
    width: width * 0.82,
    aspectRatio: 3 / 4.9,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  descriptionOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 56,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  descriptionText: {
    opacity: 0.9,
    lineHeight: 14,
  },
  labelContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
  },
  glassLabel: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  labelText: {
    letterSpacing: 1.2,
  },
});
