import React from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { Typography } from './Typography';
import FooterLogo from './FooterLogo3D';
import { config } from '../constants/config';
import { useAdminSettings } from '../hooks/useAdminFeatures';
import HeroVideo from './HeroVideo';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const SOCIALS = [
  { icon: 'logo-instagram', url: 'https://instagram.com/zicabella' },
  { icon: 'disc-outline', url: 'https://apple.co/zicabella' },
  { icon: 'musical-notes-outline', url: 'https://spotify.com/zicabella' },
  { icon: 'logo-youtube', url: 'https://youtube.com/zicabella' },
];

export default function StorefrontFooter() {
  const colors = useColors();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';
  const { settings } = useAdminSettings();
  const navigation = useNavigation<any>();

  const footerVideo = settings?.footerVideo;

  return (
    <View style={[styles.container, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' }]}>
      {/* SVG LOGO - Matches web footer w-14 h-14 */}
      <View style={styles.logoWrapper}>
        <FooterLogo />
      </View>

      {/* BRANDING: Exact web parity */}
      <Typography rocaston size={18} color={colors.text} style={styles.brandName}>
        ZICA BELLA
      </Typography>
      
      <Typography size={7} color={colors.textExtraLight} weight="300" style={styles.estLabel}>
        EST. 2024
      </Typography>

      {/* FOOTER VIDEO (From Next.js parity) */}
      {footerVideo && (
        <View style={styles.videoSection}>
          <HeroVideo source={footerVideo} height={200} borderRadius={24} />
          <View style={[styles.videoOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.05)' }]} />
        </View>
      )}

      {/* SOCIAL LINKS: w-[16px] h-[16px] sizing */}
      <View style={styles.socialRow}>
        {SOCIALS.map((soc, i) => (
          <TouchableOpacity 
            key={i} 
            onPress={() => Linking.openURL(soc.url)}
            style={styles.socialIcon}
            activeOpacity={0.6}
          >
            <Ionicons name={soc.icon as any} size={15} color={colors.textExtraLight} style={{ opacity: 0.35 }} />
          </TouchableOpacity>
        ))}
      </View>

      {/* POLICIES: text-[6px] font-medium uppercase tracking-[0.25em] */}
      <View style={styles.policyRow}>
        {[
          { label: 'CONTACT', url: config.contactPage },
          { label: 'PRIVACY', url: config.policies.privacy },
          { label: 'REFUND', url: config.policies.refund },
          { label: 'TERMS', url: config.policies.terms },
        ].map((policy, index) => (
          <React.Fragment key={policy.label}>
            <TouchableOpacity 
              onPress={() => navigation.navigate('Policy', { url: policy.url, title: policy.label })}
            >
              <Typography size={6.2} weight="500" color={colors.textExtraLight} style={styles.policyText}>
                {policy.label}
              </Typography>
            </TouchableOpacity>
            {index < 3 && <View style={[styles.dot, { backgroundColor: colors.textExtraLight }]} />}
          </React.Fragment>
        ))}
      </View>

      {/* COPYRIGHT: text-[6px] uppercase tracking-[0.3em] */}
      <Typography size={6.2} weight="300" color={colors.textExtraLight} style={styles.copyright}>
        © 2026 ZICA BELLA · LUXURY STREETWEAR
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  logoWrapper: {
    marginBottom: 8,
    marginTop: 0,
    alignItems: 'center',
  },
  brandName: {
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  estLabel: {
    letterSpacing: 5,
    opacity: 0.25,
    marginBottom: 24,
  },
  videoSection: {
    width: '100%',
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 32,
  },
  socialIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  policyText: {
    letterSpacing: 3,
    opacity: 0.45,
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    opacity: 0.15,
  },
  copyright: {
    letterSpacing: 3,
    opacity: 0.2,
    textAlign: 'center',
  },
});
