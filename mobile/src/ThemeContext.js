import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getThemePreference, setThemePreference } from './storage';
import { DEFAULT_THEME, themes } from './theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [key, setKey] = useState(DEFAULT_THEME);

  useEffect(() => {
    getThemePreference().then((stored) => {
      if (stored && themes[stored]) setKey(stored);
    });
  }, []);

  const selectTheme = useCallback((next) => {
    if (!themes[next]) return;
    setKey(next);
    // Fire-and-forget: the UI already reflects the change, and a failed write
    // only costs the preference on next launch.
    setThemePreference(next);
  }, []);

  const value = useMemo(() => ({ ...themes[key], selectTheme }), [key, selectTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside a ThemeProvider');
  return ctx;
}

/**
 * Builds a StyleSheet from the active palette, rebuilding only when the theme
 * changes. `factory` must be defined at module scope so its identity is stable.
 */
export function useThemedStyles(factory) {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
