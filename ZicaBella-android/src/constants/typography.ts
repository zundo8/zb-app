/**
 * Shared typography presets for Zica Bella iOS app.
 *
 * Uses the native SF Pro system font on iOS (fontFamily left undefined).
 * All weights are string literals as required by iOS.
 *
 * Usage:
 *   import { TypographyPresets } from '../constants/typography';
 *   <Text style={TypographyPresets.heading}>HEADING</Text>
 *
 * Or use the <Typography> component which integrates these presets.
 */

import { TextStyle } from 'react-native';

export const TypographyPresets = {
  /** Hero / display text — large, semi-bold */
  display: {
    fontSize: 32,
    fontWeight: '600' as const,
    letterSpacing: -0.5,
  } satisfies TextStyle,

  /** Section headings */
  heading: {
    fontSize: 20,
    fontWeight: '600' as const,
  } satisfies TextStyle,

  /** Body copy */
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  } satisfies TextStyle,

  /** Small labels, captions */
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  } satisfies TextStyle,

  /** Button labels */
  button: {
    fontSize: 15,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  } satisfies TextStyle,
} as const;

export type TypographyPreset = keyof typeof TypographyPresets;
