import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useAuth } from '../AuthContext';
import { useThemedStyles } from '../ThemeContext';
import FormSheet from '../components/FormSheet';
import { Button, Field } from '../components/ui';
import { fonts, spacing } from '../theme';

export default function ChangePasswordScreen({ onClose, onDone }) {
  const { changePassword } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const edit = (setter) => (value) => {
    setter(value);
    setError('');
  };

  async function submit() {
    if (!current) return setError('Enter your current password.');
    if (next.length < 6) return setError('New password must be at least 6 characters.');
    if (next !== confirm) return setError('New passwords do not match.');
    if (next === current) return setError('New password must be different.');

    setBusy(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      onDone('Password updated.');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <FormSheet
      title="Change password"
      description="At least 6 characters. You'll stay logged in on this device."
      onClose={onClose}
    >
      <Field
        label="Current password"
        value={current}
        onChangeText={edit(setCurrent)}
        placeholder="Your password"
        secureTextEntry
        autoCapitalize="none"
        autoFocus
      />
      <Field
        label="New password"
        value={next}
        onChangeText={edit(setNext)}
        placeholder="At least 6 characters"
        secureTextEntry
        autoCapitalize="none"
      />
      <Field
        label="Confirm new password"
        value={confirm}
        onChangeText={edit(setConfirm)}
        placeholder="Repeat new password"
        secureTextEntry
        autoCapitalize="none"
        onSubmitEditing={submit}
        returnKeyType="go"
      />

      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button title="Update password" onPress={submit} loading={busy} />
    </FormSheet>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    error: {
      fontFamily: fonts.medium,
      color: colors.danger,
      fontSize: 13,
      marginBottom: spacing.md,
    },
  });
