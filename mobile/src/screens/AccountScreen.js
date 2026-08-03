import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
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
import { useTheme, useThemedStyles } from '../ThemeContext';
import { useTabBarInset } from '../components/FloatingTabBar';
import { Button, Card } from '../components/ui';
import { fonts, radius, spacing, themeList } from '../theme';
import ChangeEmailScreen from './ChangeEmailScreen';
import ChangePasswordScreen from './ChangePasswordScreen';
import EditProfileScreen from './EditProfileScreen';
import DeleteAccountScreen from './DeleteAccountScreen';

/** Compact tappable row: what it is, its current value, and a disclosure arrow. */
function SettingRow({ icon, label, value, onPress, last, tone }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
    >
      <Ionicons
        name={icon}
        size={18}
        color={tone === 'danger' ? colors.danger : colors.muted}
        style={styles.rowIcon}
      />

      <View style={styles.rowMain}>
        <Text style={[styles.rowLabel, tone === 'danger' && styles.rowLabelDanger]}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

/** Swatch trio previewing a palette without having to switch to it. */
function Swatches({ palette }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.swatches, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <View style={[styles.swatch, { backgroundColor: palette.card }]} />
      <View style={[styles.swatch, styles.swatchAccent, { backgroundColor: palette.accent }]} />
      <View style={[styles.swatch, { backgroundColor: palette.muted }]} />
    </View>
  );
}

function ThemeSection() {
  const { key: activeKey, selectTheme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Theme</Text>

      {themeList.map((option) => {
        const selected = option.key === activeKey;
        return (
          <Pressable
            key={option.key}
            onPress={() => selectTheme(option.key)}
            style={({ pressed }) => [
              styles.themeRow,
              selected && styles.themeRowSelected,
              pressed && styles.themeRowPressed,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${option.label} theme`}
          >
            <Swatches palette={option.colors} />

            <View style={styles.themeMeta}>
              <Text style={styles.themeLabel}>{option.label}</Text>
              <Text style={styles.themeHint}>{option.hint}</Text>
            </View>

            <View style={[styles.radio, selected && styles.radioOn]}>
              {selected && <View style={styles.radioDot} />}
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

export default function AccountScreen() {
  const { user, logOut } = useAuth();
  const tabBarInset = useTabBarInset();
  const styles = useThemedStyles(makeStyles);
  const [sheet, setSheet] = useState(null);
  const [flash, setFlash] = useState('');

  // Confirmation lives here rather than in the sheet, so the sheet can close
  // immediately on success instead of holding the user on a done screen.
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  // Either value can be missing, so the row says what is actually known.
  const profileSummary =
    [
      user.heightCm == null ? null : `${user.heightCm} cm`,
      user.goalWeightKg == null ? null : `goal ${user.goalWeightKg} kg`,
    ]
      .filter(Boolean)
      .join(' · ') || 'Not set';

  const close = () => setSheet(null);
  const done = (message) => {
    setSheet(null);
    setFlash(message);
  };

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
            <Text style={styles.avatarText}>{(user.username || user.email)[0].toUpperCase()}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>
              @{user.username}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {user.email}
            </Text>
          </View>
        </Card>

        {!!flash && <Text style={styles.flash}>{flash}</Text>}

        <Card style={[styles.section, styles.rows]}>
          <SettingRow
            icon="body-outline"
            label="Height & goal"
            value={profileSummary}
            onPress={() => setSheet('profile')}
          />
          <SettingRow
            icon="mail-outline"
            label="Email"
            value={user.email}
            onPress={() => setSheet('email')}
          />
          <SettingRow
            icon="lock-closed-outline"
            label="Password"
            value="••••••••"
            onPress={() => setSheet('password')}
            last
          />
        </Card>

        <ThemeSection />

        <Button title="Log out" onPress={logOut} variant="ghost" style={styles.logout} />

        <Card style={[styles.section, styles.rows]}>
          <SettingRow
            icon="trash-outline"
            label="Delete account"
            value="Remove your account and all data"
            onPress={() => setSheet('delete')}
            tone="danger"
            last
          />
        </Card>
      </ScrollView>

      {sheet === 'profile' && <EditProfileScreen onClose={close} onDone={done} />}
      {sheet === 'email' && <ChangeEmailScreen onClose={close} onDone={done} />}
      {sheet === 'password' && <ChangePasswordScreen onClose={close} onDone={done} />}
      {sheet === 'delete' && <DeleteAccountScreen onClose={close} />}
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
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
      fontFamily: fonts.bold,
      color: colors.accentText,
      fontSize: 20,
    },
    name: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 18,
    },
    email: {
      fontFamily: fonts.regular,
      color: colors.muted,
      fontSize: 13,
      marginTop: 2,
    },
    flash: {
      fontFamily: fonts.medium,
      color: colors.accent,
      fontSize: 13,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    section: {
      marginBottom: spacing.md,
    },
    sectionTitle: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 16,
      marginBottom: spacing.sm,
    },
    /* Rows manage their own padding so dividers can run edge to edge. */
    rows: {
      paddingVertical: 0,
      paddingHorizontal: 0,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: spacing.md,
      minHeight: 56,
    },
    rowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowPressed: {
      backgroundColor: colors.cardAlt,
    },
    rowIcon: {
      marginRight: spacing.md,
    },
    rowMain: {
      flex: 1,
      marginRight: spacing.sm,
    },
    rowLabel: {
      fontFamily: fonts.medium,
      color: colors.text,
      fontSize: 15,
    },
    rowLabelDanger: {
      color: colors.danger,
    },
    rowValue: {
      fontFamily: fonts.regular,
      color: colors.muted,
      fontSize: 13,
      marginTop: 2,
    },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      marginTop: spacing.sm,
    },
    themeRowSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.cardAlt,
    },
    themeRowPressed: {
      opacity: 0.7,
    },
    swatches: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      padding: 5,
      borderWidth: 1,
      borderRadius: radius.sm,
      marginRight: spacing.md,
    },
    swatch: {
      width: 12,
      height: 22,
      borderRadius: 2,
    },
    // The three themes share their surfaces, so the accent is what distinguishes
    // them — give it the room.
    swatchAccent: {
      width: 22,
    },
    themeMeta: {
      flex: 1,
    },
    themeLabel: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 15,
    },
    themeHint: {
      fontFamily: fonts.regular,
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: {
      borderColor: colors.accent,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.accent,
    },
    logout: {
      marginBottom: spacing.lg,
    },
  });
