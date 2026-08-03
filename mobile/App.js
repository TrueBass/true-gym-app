// Imported per weight, not from the package root — the root re-exports all 16
// faces and Metro bundles every one of them (~1.9 MB of unused .ttf).
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/AuthContext';
import { DataProvider } from './src/DataContext';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';

function Root() {
  const { user, loading } = useAuth();
  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right']}>
      {/* Status bar contrast is inverse of the page, so it tracks the theme. */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : user ? (
        <HomeScreen />
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
