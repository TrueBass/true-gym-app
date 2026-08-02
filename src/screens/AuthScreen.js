import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../AuthContext';
import { Button, Field } from '../components/ui';
import { colors, spacing } from '../theme';

export default function AuthScreen() {
  const { signUp, logIn } = useAuth();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';

  function switchMode() {
    setMode(isSignup ? 'login' : 'signup');
    setError('');
    setPassword('');
  }

  async function submit() {
    setError('');

    if (isSignup && !name.trim()) return setError('Please enter your name.');
    if (!email.trim()) return setError('Please enter your email.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');

    setBusy(true);
    try {
      await (isSignup ? signUp({ name, email, password }) : logIn({ email, password }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>TRUE GYM</Text>
          <Text style={styles.tagline}>
            {isSignup ? 'Create an account to start tracking.' : 'Welcome back.'}
          </Text>
        </View>

        {isSignup && (
          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Alex"
            autoCapitalize="words"
            autoComplete="name"
          />
        )}

        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
        />

        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          autoCapitalize="none"
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button
          title={isSignup ? 'Sign up' : 'Log in'}
          onPress={submit}
          loading={busy}
          style={styles.submit}
        />

        <Pressable onPress={switchMode} style={styles.switch} hitSlop={8}>
          <Text style={styles.switchText}>
            {isSignup ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={styles.switchLink}>{isSignup ? 'Log in' : 'Sign up'}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  logo: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 2,
  },
  tagline: {
    color: colors.muted,
    fontSize: 15,
    marginTop: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  submit: {
    marginTop: spacing.sm,
  },
  switch: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  switchText: {
    color: colors.muted,
    fontSize: 14,
  },
  switchLink: {
    color: colors.accent,
    fontWeight: '700',
  },
});
