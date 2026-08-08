import IconCheck from '@tabler/icons-react-native/IconCheck';
import IconPlus from '@tabler/icons-react-native/IconPlus';
import IconX from '@tabler/icons-react-native/IconX';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useData } from '../DataContext';
import { useTheme, useThemedStyles } from '../ThemeContext';
import FloatingActionButton, { FAB_CLEARANCE } from '../components/FloatingActionButton';
import { useTabBarInset } from '../components/FloatingTabBar';
import FormSheet from '../components/FormSheet';
import { Button, Card, Empty, Field, Notice } from '../components/ui';
import { fonts, radius, spacing } from '../theme';

/**
 * A record row. Tapping the weight turns it into an input in place — the common
 * edit is "I lifted more", and that shouldn't need a form. The exercise name is
 * not editable: renaming is rare, and delete-and-re-add avoids a rename
 * colliding with an existing record.
 */
function PRRow({ item, onSave, onOpen, onRemove, styles }) {
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
      {/* The name opens the record in a sheet. Same edit as tapping the weight,
          reached the way someone who didn't discover that would look for it. */}
      <Pressable
        onPress={() => onOpen(item)}
        style={({ pressed }) => [styles.rowMain, pressed && styles.rowMainPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${item.exercise}, open`}
      >
        <Text style={styles.exercise} numberOfLines={1}>
          {item.exercise}
        </Text>
        <Text style={styles.date}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
      </Pressable>

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

/**
 * One record, in a sheet. The add form used to sit above the list taking up a
 * third of the screen to do something done once a session; the same fields now
 * open on demand, and open on an existing record when a row is tapped.
 *
 * Editing does not offer the exercise name. Saving is idempotent by name, so a
 * renamed record would be saved as a second one and leave the first behind —
 * deleting and re-adding is the honest way to rename, and rare enough to ask
 * for. That is also why the name can be the sheet's title here.
 *
 * The draft lives in this component, so closing discards it and opening always
 * starts from the record rather than from whatever was abandoned last time.
 */
function PRSheet({ pr, onSave, onClose }) {
  const styles = useThemedStyles(makeStyles);
  const [exercise, setExercise] = useState('');
  const [weight, setWeight] = useState(pr ? String(pr.weight) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const name = pr ? pr.exercise : exercise;

  async function save() {
    setError('');
    const kg = parseFloat(weight.replace(',', '.'));

    if (!name.trim()) return setError('Enter an exercise name.');
    if (!Number.isFinite(kg) || kg <= 0) return setError('Enter a weight greater than 0.');

    setBusy(true);
    try {
      await onSave({ exercise: name, weight: kg });
      onClose();
    } catch (e) {
      // Left open, with the draft intact — the usual cause is the server being
      // unreachable, and retyping it would be the wrong thing to ask for.
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <FormSheet
      title={pr ? pr.exercise : 'New PR'}
      description={
        pr
          ? `Last set ${new Date(pr.updatedAt).toLocaleDateString()}.`
          : 'Saving an exercise you already have replaces its weight.'
      }
      onClose={onClose}
    >
      {!pr && (
        <Field
          label="Exercise"
          value={exercise}
          onChangeText={setExercise}
          placeholder="Bench press"
          autoCapitalize="words"
          autoFocus
        />
      )}
      <Field
        label="Weight (kg)"
        value={weight}
        onChangeText={setWeight}
        placeholder="100"
        keyboardType="decimal-pad"
        onSubmitEditing={save}
        autoFocus={!!pr}
        selectTextOnFocus={!!pr}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button title="Save PR" onPress={save} loading={busy} />
    </FormSheet>
  );
}

export default function PRScreen() {
  const tabBarInset = useTabBarInset();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { prs, loading, error: loadError, refresh, savePR, deletePR } = useData();
  // 'new', or the record being opened. One sheet, so never both at once.
  const [sheet, setSheet] = useState(null);
  const [error, setError] = useState('');

  const updateWeight = useCallback(
    async (pr, kg) => {
      try {
        await savePR({ exercise: pr.exercise, weight: kg });
      } catch (e) {
        setError(e.message);
      }
    },
    [savePR]
  );

  const confirmRemove = useCallback(
    (pr) => {
      Alert.alert('Remove PR', `Delete "${pr.exercise}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deletePR(pr.id).catch((e) => setError(e.message)),
        },
      ]);
    },
    [deletePR]
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={prs}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarInset + FAB_CLEARANCE }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.muted} />
        }
        ListHeaderComponent={
          <>
            {!!loadError && <Notice message={loadError} onRetry={refresh} />}
            {/* Whatever a row's own buttons couldn't report themselves. */}
            {!!error && <Notice message={error} />}
          </>
        }
        ListEmptyComponent={
          <Empty title="No PRs yet" hint="Add your first personal record with the + button." />
        }
        renderItem={({ item }) => (
          <PRRow
            item={item}
            onSave={updateWeight}
            onOpen={setSheet}
            onRemove={confirmRemove}
            styles={styles}
          />
        )}
      />

      <FloatingActionButton onPress={() => setSheet('new')} accessibilityLabel="Add a PR">
        <IconPlus size={26} color={colors.accentText} />
      </FloatingActionButton>

      {sheet && (
        <PRSheet
          pr={sheet === 'new' ? null : sheet}
          onSave={savePR}
          onClose={() => {
            setSheet(null);
            setError('');
          }}
        />
      )}
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
  error: {
    fontFamily: fonts.regular,
    color: colors.danger,
    fontSize: 14,
    marginBottom: spacing.md,
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
  rowMainPressed: {
    opacity: 0.6,
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
