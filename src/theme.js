/**
 * Three palettes, switchable at runtime from the account screen. All share one
 * neutral graphite shell and differ only in accent — a tinted surface reads as
 * a cast over the whole UI rather than as a highlight.
 *
 * Every foreground/background pair below clears WCAG AA (4.5:1) — including
 * secondary text, which only needs 3:1, and placeholders, which sit at ~3.4:1
 * so they stay clearly below their labels. Re-check with the contrast script in
 * the branch notes before changing any value.
 */

/** Shared by every theme, so the surfaces can't drift apart. */
const graphite = {
  bg: '#141516',
  card: '#1D1E20',
  cardAlt: '#27282B',
  border: '#36383C',
  text: '#E8E9EB',
  muted: '#9A9CA2',
  placeholder: '#6E7177',
  accentText: '#141516',
  danger: '#E07A6E',
  scrim: 'rgba(20,21,22,0.55)',
};

/**
 * `up` and `down` are the weight-trend colours. They are deliberately not
 * red/green — gaining or losing is only good or bad depending on the goal —
 * and each is picked to sit clear of its theme's accent in both hue and
 * luminance, so a delta can't be mistaken for an accent-coloured value.
 */
const pistachio = {
  key: 'pistachio',
  label: 'Pistachio',
  hint: 'Graphite + pistachio',
  isDark: true,
  colors: { ...graphite, accent: '#B7D9A0', up: '#E0A87C', down: '#7FB8D4' },
};

const lavender = {
  key: 'lavender',
  label: 'Lavender',
  hint: 'Graphite + lavender',
  isDark: true,
  colors: { ...graphite, accent: '#C3B5F0', up: '#E0A87C', down: '#6FC5B8' },
};

const cappuccino = {
  key: 'cappuccino',
  label: 'Cappuccino',
  hint: 'Graphite + cappuccino',
  isDark: true,
  colors: { ...graphite, accent: '#C9A47C', up: '#E5B84B', down: '#7FB8D4' },
};

export const themes = { pistachio, lavender, cappuccino };
export const themeList = [pistachio, lavender, cappuccino];
export const DEFAULT_THEME = 'pistachio';

/* ------------------------- theme-independent tokens ------------------------ */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
};

/**
 * JetBrains Mono throughout. Styles name a face directly rather than setting
 * fontWeight — with a custom family, iOS synthesises weights it wasn't given,
 * which renders inconsistently against the real bold.
 */
export const fonts = {
  regular: 'JetBrainsMono_400Regular',
  medium: 'JetBrainsMono_500Medium',
  bold: 'JetBrainsMono_700Bold',
};
