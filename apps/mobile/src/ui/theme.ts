import { Platform, StyleSheet, TextStyle, ViewStyle } from 'react-native';

/**
 * Echo design system. Calm, premium, emotionally-intelligent: deep navy base, a soft
 * violet accent, glassy cards, and semantic colors for evidence vs interpretation.
 */
export const colors = {
  bg: '#0A0D14',
  bgElevated: '#0F1320',
  surface: '#161B28',
  surface2: '#1E2536',
  border: '#2A3143',
  borderSoft: 'rgba(255,255,255,0.07)',

  text: '#F3F5FA',
  textDim: '#A9B2C4',
  textMute: '#6C7688',

  accent: '#8B7CF6',
  accent2: '#6366F1',
  accentSoft: 'rgba(139,124,246,0.15)',

  // Semantic (observation kinds / states)
  evidence: '#34D399',
  interpretation: '#FBBF24',
  alternative: '#60A5FA',
  missing: '#94A3B8',
  warn: '#F59E0B',
  danger: '#F87171',
  ok: '#34D399',

  // Chat bubbles
  meBubble: '#3A3470',
  themBubble: '#1C2233',

  gradient: ['#7C6CF0', '#5B6CF0'] as const,
  gradientWarm: ['#8B7CF6', '#C16CF0'] as const,
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

export const type: Record<string, TextStyle> = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: colors.text },
  h1: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3, color: colors.text },
  h2: { fontSize: 18, fontWeight: '700', color: colors.text },
  h3: { fontSize: 15, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  dim: { fontSize: 14, lineHeight: 20, color: colors.textDim },
  small: { fontSize: 12.5, lineHeight: 17, color: colors.textDim },
  micro: { fontSize: 11, fontWeight: '600', color: colors.textMute, letterSpacing: 0.3 },
};

export const shadow = (elev = 8): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: elev,
      shadowOffset: { width: 0, height: elev / 2 },
    },
    default: { elevation: elev },
  })!;

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: space.lg },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: space.md },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    fontSize: 15,
  },
});
