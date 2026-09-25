import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fonts, radius, spacing } from '../theme';
import { useTheme, useThemedStyles } from '../ThemeContext';

/**
 * Any field asked to hide what's typed gets an eye to show it again. Kept here
 * rather than at each password field so every one behaves the same, and so the
 * next one added gets it without anybody remembering to.
 *
 * Revealing is per-field and resets when the screen closes: it's for checking
 * a typo on the spot, not a setting.
 */
export function Field({ label, style, ...props }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [revealed, setRevealed] = useState(false);
  const isPassword = !!props.secureTextEntry;

  return (
    <View style={[styles.fieldWrap, style]}>
      {!!label && <Text style={styles.label}>{label}</Text>}

      <View>
        <TextInput
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.accent}
          // Autocorrecting a password is never right, and on Android a field
          // that is corrected can lose its text the moment secureTextEntry
          // flips. Before the spread, so a screen can still override.
          {...(isPassword ? { autoCorrect: false, spellCheck: false } : null)}
          {...props}
          secureTextEntry={isPassword && !revealed}
          style={[
            styles.input,
            props.multiline && styles.inputMultiline,
            isPassword && styles.inputRevealable,
          ]}
        />

        {isPassword && (
          <Pressable
            onPress={() => setRevealed((on) => !on)}
            hitSlop={8}
            style={({ pressed }) => [styles.reveal, pressed && styles.revealPressed]}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={revealed ? colors.accent : colors.muted}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';
  const off = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        isGhost && styles.buttonGhost,
        isDanger && styles.buttonDanger,
        off && styles.buttonOff,
        pressed && !off && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost || isDanger ? colors.text : colors.accentText} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isGhost && styles.buttonTextGhost,
            isDanger && styles.buttonTextDanger,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Shown when the app can't reach the API. Carries the message the request layer
 * produced — which names the address for an unreachable server — plus a way to
 * try again without leaving the screen.
 */
export function Notice({ message, onRetry }) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{message}</Text>
      {!!onRetry && <Button title="Try again" onPress={onRetry} variant="ghost" />}
    </View>
  );
}

export function Card({ children, style }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Empty({ title, hint }) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!hint && <Text style={styles.emptyHint}>{hint}</Text>}
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
  fieldWrap: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  input: {
    fontFamily: fonts.regular,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  // Room for the eye, so a long password doesn't run underneath it.
  inputRevealable: {
    paddingRight: 48,
  },
  reveal: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealPressed: {
    opacity: 0.6,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDanger: {
    backgroundColor: colors.danger,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonOff: {
    opacity: 0.45,
  },
  buttonText: {
    fontFamily: fonts.bold,
    color: colors.accentText,
    fontSize: 16,
  },
  buttonTextGhost: {
    color: colors.text,
  },
  buttonTextDanger: {
    color: colors.text,
  },
  notice: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noticeText: {
    fontFamily: fonts.regular,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.medium,
    color: colors.text,
    fontSize: 16,
  },
  emptyHint: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 14,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
