import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useAuth } from '../AuthContext';
import { useThemedStyles } from '../ThemeContext';
import FormSheet from '../components/FormSheet';
import { Button, Field } from '../components/ui';
import { fonts, spacing } from '../theme';

export default function ChangeEmailScreen({ onClose, onDone }) {
  const { user, changeEmail } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const edit = (setter) => (value) => {
    setter(value);
    setError('');
  };

  async function submit() {
    if (!newEmail.trim()) return setError('Enter a new email.');
    if (!password) return setError('Enter your current password.');

    setBusy(true);
    try {
      await changeEmail({ newEmail, currentPassword: password });
      onDone('Email updated.');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <FormSheet
      title="Change email"
      description="You'll use this address to log in from now on."
      onClose={onClose}
    >
      <Text style={styles.current}>Current: {user.email}</Text>

      <Field
        label="New email"
        value={newEmail}
        onChangeText={edit(setNewEmail)}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoFocus
      />
      <Field
        label="Current password"
        value={password}
        onChangeText={edit(setPassword)}
        placeholder="Your password"
        secureTextEntry
        autoCapitalize="none"
        onSubmitEditing={submit}
        returnKeyType="go"
      />

      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button title="Update email" onPress={submit} loading={busy} />
    </FormSheet>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    current: {
      fontFamily: fonts.regular,
      color: colors.muted,
      fontSize: 13,
      marginBottom: spacing.lg,
    },
    error: {
      fontFamily: fonts.medium,
      color: colors.danger,
      fontSize: 13,
      marginBottom: spacing.md,
    },
  });
