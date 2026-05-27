export const fonts = {
  // System fonts as used in the web app
  heading: undefined, // Uses system font (SF Pro) on iOS by default
  body: undefined,    // Uses system font on iOS by default
  // If you load custom fonts via expo-font, set them here:
  // heading: 'HeadingPro',
  // body: 'Poppins',
};

export const fontSizes = {
  micro: 6,
  tiny: 7,
  xxs: 8,
  xs: 10,
  sm: 11,
  base: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 21,
  title: 26,
};

export const fontWeights = {
  thin: '100' as const,
  extralight: '200' as const,
  light: '300' as const,
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};
