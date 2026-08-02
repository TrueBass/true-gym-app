import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../AuthContext';
import { useTabBarInset } from '../components/FloatingTabBar';
import { Button, Card, Field } from '../components/ui';
import { colors, radius, spacing } from '../theme';

/** Inline status line for a section — cleared whenever its form is edited again. */
function Status({ error, success }) {
  if (!error && !success) return null;
  return <Text style={[styles.status, error ? styles.error : styles.success]}>{error || success}</Text>;
}

function EmailSection() {
  const { user, changeEmail } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState({});
  const [busy, setBusy] = useState(false);

  const edit = (setter) => (value) => {
    setter(value);
    setState({});
  };

  async function submit() {
    if (!newEmail.trim()) return setState({ error: 'Enter a new email.' });
    if (!password) return setState({ error: 'Enter your current password.' });

    setBusy(true);
    try {
      await changeEmail({ newEmail, currentPassword: password });
      setState({ success: 'Email updated.' });
      setNewEmail('');
      setPassword('');
    } catch (e) {
      setState({ error: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Change email</Text>
      <Text style={styles.current}>Currently {user.email}</Text>

      <Field
        label="New email"
        value={newEmail}
        onChangeText={edit(setNewEmail)}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      <Field
        label="Current password"
        value={password}
        onChangeText={edit(setPassword)}
        placeholder="••••••"
        secureTextEntry
        autoCapitalize="none"
      />

      <Status {...state} />
      <Button title="Update email" onPress={submit} loading={busy} />
    </Card>
  );
}

function PasswordSection() {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState({});
  const [busy, setBusy] = useState(false);

  const edit = (setter) => (value) => {
    setter(value);
    setState({});
  };

  async function submit() {
    if (!current) return setState({ error: 'Enter your current password.' });
    if (next.length < 6) return setState({ error: 'New password must be at least 6 characters.' });
    if (next !== confirm) return setState({ error: 'New passwords do not match.' });
    if (next === current) return setState({ error: 'New password must be different.' });

    setBusy(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      setState({ success: 'Password updated.' });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (e) {
      setState({ error: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Change password</Text>

      <Field
        label="Current password"
        value={current}
        onChangeText={edit(setCurrent)}
        placeholder="••••••"
        secureTextEntry
        autoCapitalize="none"
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
      />

      <Status {...state} />
      <Button title="Update password" onPress={submit} loading={busy} />
    </Card>
  );
}

function DangerSection() {
  const { deleteAccount } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function confirm() {
    if (!password) return setError('Enter your password to confirm.');
    setError('');

    Alert.alert(
      'Delete account',
      'This permanently deletes your account, your PRs and your weight history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: run },
      ]
    );
  }

  async function run() {
    setBusy(true);
    try {
      await deleteAccount(password);
      // No cleanup needed — clearing the session unmounts this screen.
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Card style={[styles.section, styles.danger]}>
      <Text style={styles.sectionTitle}>Delete account</Text>
      <Text style={styles.dangerText}>
        Permanently removes your account, PRs and weight history. This cannot be undone.
      </Text>

      <Field
        label="Confirm password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError('');
        }}
        placeholder="••••••"
        secureTextEntry
        autoCapitalize="none"
      />

      {!!error && <Text style={[styles.status, styles.error]}>{error}</Text>}
      <Button title="Delete my account" onPress={confirm} loading={busy} variant="danger" />
    </Card>
  );
}

export default function AccountScreen() {
  const { user, logOut } = useAuth();
  const tabBarInset = useTabBarInset();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarInset }]}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user.name || user.email)[0].toUpperCase()}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>
              {user.name || 'Athlete'}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {user.email}
            </Text>
          </View>
        </Card>

        <EmailSection />
        <PasswordSection />

        <Button title="Log out" onPress={logOut} variant="ghost" style={styles.logout} />

        <DangerSection />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    padding: spacing.md,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.accentText,
    fontSize: 20,
    fontWeight: '800',
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  email: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  current: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  status: {
    fontSize: 14,
    marginBottom: spacing.md,
  },
  error: {
    color: colors.danger,
  },
  success: {
    color: colors.accent,
  },
  logout: {
    marginBottom: spacing.lg,
  },
  danger: {
    borderColor: colors.danger,
  },
  dangerText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
});
