import IconCheck from '@tabler/icons-react-native/IconCheck';
import IconX from '@tabler/icons-react-native/IconX';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../AuthContext';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { useTabBarInset } from '../components/FloatingTabBar';
import { Button, Card, Empty, Field } from '../components/ui';
import { deletePR, getPRs, savePR } from '../storage';
import { fonts, radius, spacing } from '../theme';

/**
 * A record row. Tapping the weight turns it into an input in place — the common
 * edit is "I lifted more", and that shouldn't need a form. The exercise name is
 * not editable: renaming is rare, and delete-and-re-add avoids a rename
 * colliding with an existing record.
 */
function PRRow({ item, onSave, onRemove, styles }) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const cancelTimer = useRef(null);

  useEffect(() => () => clearTimeout(cancelTimer.current), []);

  const kg = parseFloat(draft.replace(',', '.'));
  const canSave = editing && Number.isFinite(kg) && kg > 0 && kg !== item.weight;

  function startEditing() {
    setDraft(String(item.weight));
    setEditing(true);
  }

  /**
   * Leaving the field means "tapped away", which discards. Deferred by a beat
   * because tapping the tick blurs the input on its way in — without the delay
   * the row would close before the press ever landed.
   */
  function scheduleCancel() {
    cancelTimer.current = setTimeout(() => setEditing(false), 150);
  }

  function commit() {
    clearTimeout(cancelTimer.current);
    setEditing(false);
    if (canSave) onSave(item, kg);
  }

  return (
    <Card style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.exercise} numberOfLines={1}>
          {item.exercise}
        </Text>
        <Text style={styles.date}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
      </View>

      {editing ? (
        <View style={styles.weightEditing}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
            onSubmitEditing={commit}
            onBlur={scheduleCancel}
            selectionColor={colors.accent}
            style={styles.weightInput}
          />
          <Text style={styles.unit}> kg</Text>
        </View>
      ) : (
        <Pressable
          onPress={startEditing}
          hitSlop={10}
          style={({ pressed }) => [styles.weightTap, pressed && styles.weightTapPressed]}
          accessibilityRole="button"
          accessibilityLabel={`${item.weight} kilograms, tap to edit`}
        >
          <Text style={styles.weight}>
            {item.weight}
            <Text style={styles.unit}> kg</Text>
          </Text>
        </Pressable>
      )}

      {/* The remove button becomes the confirm while editing — same spot, so
          the thumb is already there, and the row visibly changes state. */}
      {editing ? (
        <Pressable
          onPress={commit}
          hitSlop={8}
          style={[styles.action, canSave && styles.actionConfirm]}
          accessibilityRole="button"
          accessibilityLabel="Save weight"
        >
          <IconCheck size={16} color={canSave ? colors.accentText : colors.muted} />
        </Pressable>
      ) : (
        <Pressable
          onPress={() => onRemove(item)}
          hitSlop={8}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.exercise}`}
        >
          <IconX size={16} color={colors.muted} />
        </Pressable>
      )}
    </Card>
  );
}

export default function PRScreen() {
  const { user } = useAuth();
  const tabBarInset = useTabBarInset();
  const styles = useThemedStyles(makeStyles);
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

  const updateWeight = useCallback(
    async (pr, kg) => setPRs(await savePR(user.id, { exercise: pr.exercise, weight: kg })),
    [user.id]
  );

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
        contentContainerStyle={[styles.list, { paddingBottom: tabBarInset }]}
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
            <Text style={styles.hint}>Tap a weight to edit it.</Text>
          </Card>
        }
        ListEmptyComponent={
          <Empty title="No PRs yet" hint="Add your first personal record above." />
        }
        renderItem={({ item }) => (
          <PRRow
            item={item}
            onSave={updateWeight}
            onRemove={confirmRemove}
            styles={styles}
          />
        )}
      />

    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
  flex: {
    flex: 1,
  },
  list: {
    padding: spacing.md,
  },
  form: {
    marginBottom: spacing.lg,
  },
  error: {
    fontFamily: fonts.regular,
    color: colors.danger,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  hint: {
    fontFamily: fonts.regular,
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
    fontFamily: fonts.medium,
    color: colors.text,
    fontSize: 16,
  },
  date: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  weightTap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 1,
  },
  weightTapPressed: {
    opacity: 0.6,
  },
  weight: {
    fontFamily: fonts.bold,
    color: colors.accent,
    fontSize: 20,
  },
  weightEditing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
  },
  weightInput: {
    fontFamily: fonts.bold,
    color: colors.accent,
    fontSize: 20,
    minWidth: 52,
    textAlign: 'right',
    padding: 0,
  },
  unit: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 13,
  },
  action: {
    marginLeft: spacing.md,
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionConfirm: {
    backgroundColor: colors.accent,
  },
});
