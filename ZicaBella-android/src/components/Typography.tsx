import React from 'react';
import { Text, TextProps, TextStyle, Platform } from 'react-native';
import { useColors } from '../constants/colors';
import { TypographyPresets, TypographyPreset } from '../constants/typography';

interface TypographyProps extends TextProps {
  /** Apply a named typography preset (display, heading, body, caption, button) */
  preset?: TypographyPreset;
  /** Legacy: treat as heading weight */
  heading?: boolean;
  /** Use the Rocaston brand font */
  rocaston?: boolean;
  size?: number;
  color?: string;
  weight?: 'normal' | 'bold' | '300' | '400' | '500' | '600' | '700' | '800';
  style?: TextStyle | TextStyle[];
  letterSpacing?: number;
}

/**
 * Unified text component.
 *
 * Uses the native iOS system font (SF Pro) by default.
 * Pass `rocaston` for the brand wordmark font.
 * Pass `preset` for quick preset styling.
 */
export const Typography: React.FC<TypographyProps> = ({
  children,
  preset,
  heading,
  rocaston,
  size = 14,
  color,
  weight,
  style,
  letterSpacing,
  ...props
}) => {
  const themeColors = useColors();
  const finalColor = color || themeColors.text;

  // Resolve preset styles if provided
  const presetStyle = preset ? (TypographyPresets[preset] || {}) : {};

  // Rocaston is the only custom font we keep; everything else uses system font
  const fontFamily = rocaston ? 'Rocaston' : undefined;

  // Determine fontWeight: explicit weight > heading shortcut > preset > default
  const resolvedWeight: TextStyle['fontWeight'] = weight
    ?? (heading ? '600' : undefined)
    ?? (presetStyle as TextStyle).fontWeight;

  const baseStyle: TextStyle = {
    ...presetStyle,
    fontSize: size ?? (presetStyle as TextStyle).fontSize ?? 14,
    color: finalColor,
    letterSpacing: letterSpacing ?? (presetStyle as any).letterSpacing,
    fontWeight: resolvedWeight,
    ...(fontFamily ? { fontFamily } : {}),
  } as TextStyle;

  // Explicit numeric fallback font — must be a named font, NOT undefined,
  // because React Native inherits fontFamily from parent <Text> nodes.
  const NUMERIC_FONT = 'sans-serif';

  const renderContent = () => {
    if (!rocaston || typeof children !== 'string') return children;

    // Split text into parts of numbers and non-numbers to handle Rocaston font limitation
    const parts = children.split(/(\d+)/g);
    return parts.map((part, i) => {
      const isNumber = /^\d+$/.test(part);
      if (isNumber) {
        // Explicitly override fontFamily so the numeric font is never inherited
        return (
          <Text key={i} style={[
            baseStyle,
            { fontFamily: NUMERIC_FONT, fontWeight: resolvedWeight ?? '400' },
          ]}>
            {part}
          </Text>
        );
      }
      return part;
    });
  };

  return (
    <Text style={[baseStyle, style]} {...props}>
      {renderContent()}
    </Text>
  );
};
