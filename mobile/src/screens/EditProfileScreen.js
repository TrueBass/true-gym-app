import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useAuth } from '../AuthContext';
import { useData } from '../DataContext';
import { useThemedStyles } from '../ThemeContext';
import FormSheet from '../components/FormSheet';
import { Button, Field } from '../components/ui';
import { fonts, spacing } from '../theme';

const MIN_HEIGHT_CM = 50;
const MAX_HEIGHT_CM = 300;

const num = (value) => parseFloat(String(value).replace(',', '.'));
const round1 = (value) => Math.round(value * 10) / 10;

export default function EditProfileScreen({ onClose, onDone }) {
  const { user, updateProfile } = useAuth();
  const { weights } = useData();
  const styles = useThemedStyles(makeStyles);

  const [height, setHeight] = useState(user.heightCm == null ? '' : String(user.heightCm));
  const [goal, setGoal] = useState(user.goalWeightKg == null ? '' : String(user.goalWeightKg));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const edit = (setter) => (value) => {
    setter(value);
    setError('');
  };

  const latest = weights[0]?.kg ?? null;
  const heightCm = num(height);
  const bmi =
    latest && Number.isFinite(heightCm) && heightCm >= MIN_HEIGHT_CM
      ? round1(latest / (heightCm / 100) ** 2)
      : null;

  async function submit() {
    // Blank means "clear it" — the endpoint tells an omitted field from a null one.
    const nextHeight = height.trim() === '' ? null : heightCm;
    const nextGoal = goal.trim() === '' ? null : num(goal);

    if (nextHeight !== null && (!Number.isFinite(nextHeight) || nextHeight < MIN_HEIGHT_CM || nextHeight > MAX_HEIGHT_CM)) {
      return setError(`Enter a height in centimetres, between ${MIN_HEIGHT_CM} and ${MAX_HEIGHT_CM}.`);
    }
    if (nextGoal !== null && (!Number.isFinite(nextGoal) || nextGoal <= 0)) {
      return setError('Enter a weight greater than 0.');
    }

    setBusy(true);
    try {
      await updateProfile({ heightCm: nextHeight, goalWeightKg: nextGoal });
      onDone('Profile updated.');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <FormSheet
      title="Height & goal"
      description="Used for BMI and to show how far you are from your target. Leave a field empty to clear it."
      onClose={onClose}
    >
      <Field
        label="Height (cm)"
        value={height}
        onChangeText={edit(setHeight)}
        placeholder="180"
        keyboardType="decimal-pad"
      />
      <Field
        label="Goal weight (kg)"
        value={goal}
        onChangeText={edit(setGoal)}
        placeholder="75"
        keyboardType="decimal-pad"
        onSubmitEditing={submit}
      />

      {!!bmi && (
        <Text style={styles.derived}>
          At your latest weight of {latest} kg, that's a BMI of{' '}
          <Text style={styles.derivedValue}>{bmi}</Text>.
        </Text>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button title="Save" onPress={submit} loading={busy} />
    </FormSheet>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    derived: {
      fontFamily: fonts.regular,
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: spacing.md,
    },
    derivedValue: {
      fontFamily: fonts.bold,
      color: colors.accent,
    },
    error: {
      fontFamily: fonts.medium,
      color: colors.danger,
      fontSize: 13,
      marginBottom: spacing.md,
    },
  });
