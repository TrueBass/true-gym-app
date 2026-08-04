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
import { useData } from '../DataContext';
import { useThemedStyles } from '../ThemeContext';
import { Button, Field } from '../components/ui';
import { fonts, spacing } from '../theme';

const MIN_HEIGHT_CM = 50;
const MAX_HEIGHT_CM = 300;

const num = (value) => parseFloat(String(value).replace(',', '.'));
const round1 = (value) => Math.round(value * 10) / 10;

/** Standard BMI, kg over metres squared. */
const bmiOf = (kg, cm) => round1(kg / (cm / 100) ** 2);

function bmiBand(bmi) {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'a healthy range';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

/**
 * The two screens after the credentials. Both are skippable — every field here
 * is optional to the app working, and a wall between signing up and using it
 * costs accounts.
 *
 * The starting weight is not stored on the account: it goes to the weight log
 * like any other reading, so the history begins the day you signed up.
 */
export default function OnboardingScreen({ onDone }) {
  const { updateProfile } = useAuth();
  const { addWeight } = useData();
  const styles = useThemedStyles(makeStyles);

  const [step, setStep] = useState(1);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const heightCm = num(height);
  const weightKg = num(weight);
  const goalKg = num(goal);

  const bothOnStepOne = Number.isFinite(heightCm) && Number.isFinite(weightKg) && weightKg > 0;
  const bmi =
    bothOnStepOne && heightCm >= MIN_HEIGHT_CM && heightCm <= MAX_HEIGHT_CM
      ? bmiOf(weightKg, heightCm)
      : null;

  const current = weightKg || null;
  const goalDelta = Number.isFinite(goalKg) && current ? round1(goalKg - current) : null;

  const edit = (setter) => (value) => {
    setter(value);
    setError('');
  };

  async function submitBody() {
    if (!Number.isFinite(heightCm) || heightCm < MIN_HEIGHT_CM || heightCm > MAX_HEIGHT_CM) {
      return setError(`Enter a height in centimetres, between ${MIN_HEIGHT_CM} and ${MAX_HEIGHT_CM}.`);
    }
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      return setError('Enter a weight greater than 0.');
    }

    setBusy(true);
    try {
      await updateProfile({ heightCm });
      await addWeight(weightKg);
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitGoal() {
    if (!Number.isFinite(goalKg) || goalKg <= 0) {
      return setError('Enter a weight greater than 0.');
    }

    setBusy(true);
    try {
      await updateProfile({ goalWeightKg: goalKg });
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.step}>Step {step} of 2</Text>

        {step === 1 ? (
          <>
            <Text style={styles.title}>About you</Text>
            <Text style={styles.blurb}>You can fill these in later from the Account tab.</Text>

            <Field
              label="Height (cm)"
              value={height}
              onChangeText={edit(setHeight)}
              placeholder="180"
              keyboardType="decimal-pad"
              autoFocus
            />
            <Field
              label="Current weight (kg)"
              value={weight}
              onChangeText={edit(setWeight)}
              placeholder="78.5"
              keyboardType="decimal-pad"
              onSubmitEditing={submitBody}
            />

            {!!bmi && (
              <Text style={styles.derived}>
                That's a BMI of <Text style={styles.derivedValue}>{bmi}</Text> — {bmiBand(bmi)}.
              </Text>
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}
            <Button title="Continue" onPress={submitBody} loading={busy} />
          </>
        ) : (
          <>
            <Text style={styles.title}>Your goal</Text>
            <Text style={styles.blurb}>
              Something to aim at. You can change it whenever you like.
            </Text>

            <Field
              label="Goal weight (kg)"
              value={goal}
              onChangeText={edit(setGoal)}
              placeholder="75"
              keyboardType="decimal-pad"
              autoFocus
              onSubmitEditing={submitGoal}
            />

            {goalDelta !== null && (
              <Text style={styles.derived}>
                {goalDelta === 0 ? (
                  'Holding steady at where you are now.'
                ) : (
                  <>
                    <Text style={styles.derivedValue}>{Math.abs(goalDelta)} kg</Text>
                    {goalDelta < 0 ? ' to lose' : ' to gain'} from {current} kg.
                  </>
                )}
              </Text>
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}
            <Button title="Finish" onPress={submitGoal} loading={busy} />
          </>
        )}

        <Pressable onPress={onDone} style={styles.skip} hitSlop={8} disabled={busy}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    step: {
      fontFamily: fonts.medium,
      color: colors.muted,
      fontSize: 12,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    title: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 28,
      marginBottom: spacing.lg,
    },
    blurb: {
      fontFamily: fonts.regular,
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: -spacing.sm,
      marginBottom: spacing.lg,
    },
    derived: {
      fontFamily: fonts.regular,
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: spacing.md,
    },
    derivedValue: {
      fontFamily: fonts.bold,
      color: colors.accent,
    },
    error: {
      fontFamily: fonts.regular,
      color: colors.danger,
      fontSize: 14,
      marginBottom: spacing.md,
    },
    skip: {
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    skipText: {
      fontFamily: fonts.medium,
      color: colors.muted,
      fontSize: 14,
    },
  });
