import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { useThemedStyles } from '../ThemeContext';
import FormSheet from '../components/FormSheet';
import { Button, Field } from '../components/ui';
import { fonts, spacing } from '../theme';

const REMOVED = ['Your account and login details', 'Every personal record', 'Your whole weight history'];

export default function DeleteAccountScreen({ onClose }) {
  const { deleteAccount } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function confirm() {
    if (!password) return setError('Enter your password to confirm.');
    setError('');

    Alert.alert('Delete account', 'This cannot be undone. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  }

  async function run() {
    setBusy(true);
    try {
      await deleteAccount(password);
      // No cleanup needed — clearing the session unmounts this screen with its parent.
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <FormSheet
      title="Delete account"
      description="This permanently deletes everything below. It cannot be undone, and there is no way to recover the data afterwards."
      onClose={onClose}
    >
      <View style={styles.list}>
        {REMOVED.map((item) => (
          <View key={item} style={styles.listRow}>
            <Text style={styles.bullet}>—</Text>
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>

      <Field
        label="Confirm password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError('');
        }}
        placeholder="Your password"
        secureTextEntry
        autoCapitalize="none"
      />

      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button title="Delete my account" onPress={confirm} loading={busy} variant="danger" />
      <Button title="Cancel" onPress={onClose} variant="ghost" style={styles.cancel} />
    </FormSheet>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    list: {
      borderLeftWidth: 2,
      borderLeftColor: colors.danger,
      paddingLeft: spacing.md,
      marginBottom: spacing.lg,
    },
    listRow: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
    },
    bullet: {
      fontFamily: fonts.regular,
      color: colors.danger,
      fontSize: 13,
      marginRight: spacing.sm,
    },
    listText: {
      flex: 1,
      fontFamily: fonts.regular,
      color: colors.text,
      fontSize: 13,
      lineHeight: 19,
    },
    error: {
      fontFamily: fonts.medium,
      color: colors.danger,
      fontSize: 13,
      marginBottom: spacing.md,
    },
    cancel: {
      marginTop: spacing.sm,
    },
  });
