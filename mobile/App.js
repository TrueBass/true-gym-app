// Imported per weight, not from the package root — the root re-exports all 16
// faces and Metro bundles every one of them (~1.9 MB of unused .ttf).
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/AuthContext';
import * as storage from './src/storage';
import { DataProvider } from './src/DataContext';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';

function Root() {
  const { user, loading } = useAuth();
  const { colors, isDark } = useTheme();

  /**
   * Decided once, when an account arrives — not derived from `user` on every
   * render. Step 1 saves the height, and a live condition reading
   * `user.heightCm == null` would flip false at that moment and swap this
   * screen out before step 2 could ask for the goal.
   *
   * `undefined` while the check runs, so nothing flashes either way.
   */
  const [needsOnboarding, setNeedsOnboarding] = useState(undefined);

  useEffect(() => {
    if (!user) return setNeedsOnboarding(undefined);
    let cancelled = false;
    storage.isOnboarded(user.id).then((done) => {
      if (!cancelled) setNeedsOnboarding(!done && user.heightCm == null);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const finishOnboarding = () =>
    storage.setOnboarded(user.id).then(() => setNeedsOnboarding(false));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right']}>
      {/* Status bar contrast is inverse of the page, so it tracks the theme. */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : needsOnboarding ? (
        <OnboardingScreen onDone={finishOnboarding} />
      ) : user && needsOnboarding === false ? (
        <HomeScreen />
      ) : user ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <AuthScreen />
      )}
    </SafeAreaView>
  );
}

function Boot() {
  const { colors } = useTheme();
  return <View style={[styles.boot, { backgroundColor: colors.bg }]} />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {/* Every text style names a JetBrains Mono face, so hold the first frame
            until they resolve — otherwise the UI flashes in the system font. */}
        {fontsLoaded ? (
          <AuthProvider>
            <DataProvider>
              <Root />
            </DataProvider>
          </AuthProvider>
        ) : (
          <Boot />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  boot: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
