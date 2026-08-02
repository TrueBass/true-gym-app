import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../AuthContext';
import { Button, Card, Empty, Field } from '../components/ui';
import { deletePR, getPRs, savePR } from '../storage';
import { colors, radius, spacing } from '../theme';

export default function PRScreen() {
  const { user } = useAuth();
  const [prs, setPRs] = useState([]);
  const [exercise, setExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getPRs(user.id).then(setPRs);
  }, [user.id]);

  const add = useCallback(async () => {
    setError('');
    const kg = parseFloat(weight.replace(',', '.'));

    if (!exercise.trim()) return setError('Enter an exercise name.');
    if (!Number.isFinite(kg) || kg <= 0) return setError('Enter a weight greater than 0.');

    setPRs(await savePR(user.id, { exercise, weight: kg }));
    setExercise('');
    setWeight('');
  }, [user.id, exercise, weight]);

  const confirmRemove = useCallback(
    (pr) => {
      Alert.alert('Remove PR', `Delete "${pr.exercise}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => setPRs(await deletePR(user.id, pr.id)),
        },
      ]);
    },
    [user.id]
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={prs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Card style={styles.form}>
            <Field
              label="Exercise"
              value={exercise}
              onChangeText={setExercise}
              placeholder="Bench press"
              autoCapitalize="words"
            />
            <Field
              label="Weight (kg)"
              value={weight}
              onChangeText={setWeight}
              placeholder="100"
              keyboardType="decimal-pad"
              onSubmitEditing={add}
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Button title="Save PR" onPress={add} />
            <Text style={styles.hint}>Saving an existing exercise updates its weight.</Text>
          </Card>
        }
        ListEmptyComponent={
          <Empty title="No PRs yet" hint="Add your first personal record above." />
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.exercise} numberOfLines={1}>
                {item.exercise}
              </Text>
              <Text style={styles.date}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.weight}>
              {item.weight}
              <Text style={styles.unit}> kg</Text>
            </Text>
            <Pressable onPress={() => confirmRemove(item)} hitSlop={8} style={styles.remove}>
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </Card>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  form: {
    marginBottom: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  rowMain: {
    flex: 1,
    marginRight: spacing.sm,
  },
  exercise: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  date: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  weight: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '800',
  },
  unit: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  remove: {
    marginLeft: spacing.md,
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
});
