import { Platform, type TextStyle } from 'react-native'

/**
 * HRFlow Pro mobile design tokens.
 * Palette follows apps/web-admin/DESIGN.md (warm parchment, ink, clay accent).
 * Contrast notes (WCAG 2.2, measured against `background`):
 * - ink 17:1, muted 6.1:1, accentStrong 7.6:1 (white on accentStrong 8.2:1)
 * - accent (#c96442) is 3.5:1, so it is used only for icons, borders and
 *   decoration, never for body text or as a filled-button background.
 */
export const colors = {
  background: '#f5f4ed',
  surface: 'rgba(250,249,245,0.96)',
  surfaceMuted: 'rgba(240,238,230,0.94)',
  surfaceRaised: '#ffffff',
  border: 'rgba(232,230,220,0.96)',
  /** Input and control outlines: 3.5:1 against white for non-text contrast. */
  borderStrong: '#8a8880',
  accent: '#c96442',
  accentStrong: '#7c3d28',
  accentSoft: '#f3e3da',
  accentAlt: '#e4eadc',
  ink: '#141413',
  muted: '#5e5d59',
  onAccent: '#ffffff',

  success: '#2f5d34',
  successSoft: '#e4eadc',
  warning: '#7a4a0e',
  warningSoft: '#f6e7c8',
  danger: '#8f2a1c',
  dangerSoft: '#f6dfd8',
  neutral: '#5e5d59',
  neutralSoft: '#ebe9e0',

  shadow: '#3d2a1e',
  overlay: 'rgba(20,20,19,0.35)',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const

export const fonts = {
  serif: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'Georgia, "Times New Roman", serif',
  }),
  sans: Platform.select({
    ios: undefined,
    android: undefined,
    default: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  }),
} as const

export const fontSizes = {
  caption: 13,
  label: 14,
  body: 16,
  heading: 18,
  title: 22,
  display: 30,
} as const

type TypeToken = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'fontWeight' | 'lineHeight' | 'color' | 'letterSpacing'>

export const type: Record<
  'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'label' | 'caption',
  TypeToken
> = {
  display: { fontFamily: fonts.serif, fontSize: fontSizes.display, lineHeight: 36, fontWeight: '400', color: colors.ink },
  title: { fontFamily: fonts.serif, fontSize: fontSizes.title, lineHeight: 28, fontWeight: '400', color: colors.ink },
  heading: { fontFamily: fonts.sans, fontSize: fontSizes.heading, lineHeight: 24, fontWeight: '600', color: colors.ink },
  body: { fontFamily: fonts.sans, fontSize: fontSizes.body, lineHeight: 22, fontWeight: '400', color: colors.ink },
  bodyStrong: { fontFamily: fonts.sans, fontSize: fontSizes.body, lineHeight: 22, fontWeight: '600', color: colors.ink },
  label: { fontFamily: fonts.sans, fontSize: fontSizes.label, lineHeight: 20, fontWeight: '500', color: colors.muted },
  caption: { fontFamily: fonts.sans, fontSize: fontSizes.caption, lineHeight: 18, fontWeight: '400', color: colors.muted },
}

/** Minimum touch target (iOS HIG 44pt, Android 48dp is met with hitSlop). */
export const touchTarget = 44

export const shadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(61,42,30,0.06)' } as object,
  default: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
})
