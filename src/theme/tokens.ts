/**
 * Design tokens. Direction: "warm paper + playful clay" for parents, three
 * distinct child worlds (soft pastel clay, saturated jungle, dark tech base).
 * Fredoka (rounded display) + Nunito (friendly, very legible body text).
 */
export const fonts = {
  display: 'Fredoka_600SemiBold',
  displayBold: 'Fredoka_700Bold',
  body: 'Nunito_500Medium',
  bodySemi: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyBlack: 'Nunito_800ExtraBold',
} as const;

export const fontSources = {
  Fredoka_600SemiBold: require('@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf'),
  Fredoka_700Bold: require('@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf'),
  Nunito_500Medium: require('@expo-google-fonts/nunito/500Medium/Nunito_500Medium.ttf'),
  Nunito_600SemiBold: require('@expo-google-fonts/nunito/600SemiBold/Nunito_600SemiBold.ttf'),
  Nunito_700Bold: require('@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf'),
  Nunito_800ExtraBold: require('@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf'),
};

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const type = {
  hero: { fontFamily: fonts.displayBold, fontSize: 40, lineHeight: 44 },
  display: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 34 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28 },
  heading: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 18, letterSpacing: 0.2 },
  caption: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 17 },
  overline: { fontFamily: fonts.bodyBlack, fontSize: 12, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  childTitle: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 32 },
  childBig: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 26 },
} as const;

/** Parent area palette: warm paper, deep ink, violet primary, semantic star/spark colors. */
export const palette = {
  bg: '#FBF7F0',
  bgDeep: '#F3ECE0',
  surface: '#FFFFFF',
  surfaceSunk: '#F6F1E8',
  ink: '#1F1A2E',
  inkSoft: '#5B5570',
  inkFaint: '#8C8699',
  line: '#E8DFD1',
  primary: '#5B3FD9',
  primaryPressed: '#4A31BD',
  primarySoft: '#ECE7FF',
  onPrimary: '#FFFFFF',
  star: '#F2A900',
  starSoft: '#FFF3C9',
  spark: '#FF6B1A',
  sparkSoft: '#FFE6D5',
  success: '#17845A',
  successSoft: '#DDF4E9',
  danger: '#C93838',
  dangerSoft: '#FCE3E3',
  plus: '#0F8C86',
  plusSoft: '#D7F3F1',
  shadow: '#2B1F47',
} as const;

export type Palette = typeof palette;

export const shadow = {
  card: {
    shadowColor: palette.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  lifted: {
    shadowColor: palette.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
} as const;

export const BRANCH_COLORS = {
  kropp: '#4FA3E0',
  mat: '#F28C38',
  hem: '#8A6FE8',
  tid: '#5B6CD9',
  ute: '#3FAE6A',
  pengar: '#E0B323',
  kanslor: '#EB5E8E',
  omtanke: '#26A69A',
  mod: '#E2533B',
} as const;

/** Minimum touch target for the child view (spec 9: at least 64 pt). */
export const CHILD_TOUCH = 64;
