import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../ThemeContext';
import FormSheet from '../components/FormSheet';
import { AVATARS } from '../avatars';
import { fonts, radius, spacing } from '../theme';

export default function AvatarScreen({ selected, onSelect, onClose }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <FormSheet
      title="Pick your avatar"
      description="Nine of them, roughly worst to best. Purely for fun — nothing in the app changes."
      onClose={onClose}
    >
      <View style={styles.grid}>
        {AVATARS.map((avatar) => {
          const active = avatar.key === selected;
          return (
            <Pressable
              key={avatar.key}
              onPress={() => onSelect(avatar.key)}
              style={({ pressed }) => [
                styles.cell,
                active && styles.cellActive,
                pressed && styles.cellPressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${avatar.label}. ${avatar.blurb}`}
            >
              <Text style={styles.level}>{avatar.level}</Text>
              <avatar.Icon size={34} color={active ? colors.accent : colors.muted} />
              <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
                {avatar.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.blurb}>
        {AVATARS.find((a) => a.key === selected)?.blurb ?? 'Tap one to choose it.'}
      </Text>
    </FormSheet>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    // Three across, whatever the screen width.
    cell: {
      width: '31%',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
    },
    cellActive: {
      borderColor: colors.accent,
      backgroundColor: colors.cardAlt,
    },
    cellPressed: {
      opacity: 0.6,
    },
    level: {
      fontFamily: fonts.bold,
      color: colors.border,
      fontSize: 11,
      marginBottom: 2,
    },
    label: {
      fontFamily: fonts.medium,
      color: colors.muted,
      fontSize: 11,
      marginTop: spacing.xs,
    },
    labelActive: {
      color: colors.accent,
    },
    blurb: {
      fontFamily: fonts.regular,
      color: colors.muted,
      fontSize: 13,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
  });
