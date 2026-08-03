import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useTheme, useThemedStyles } from '../ThemeContext';
import { useTabBarInset } from '../components/FloatingTabBar';
import { Button, Card, Empty, Field } from '../components/ui';
import { addWeight, deleteWeight, getWeights } from '../storage';
import { fonts, radius, spacing } from '../theme';

/** Below this, a change is noise from scale variance rather than a real trend. */
const FLAT_THRESHOLD_KG = 0.2;

function trendOf(deltaKg, colors) {
  if (deltaKg > FLAT_THRESHOLD_KG) return { label: 'Gaining', color: colors.up, arrow: '▲' };
  if (deltaKg < -FLAT_THRESHOLD_KG) return { label: 'Losing', color: colors.down, arrow: '▼' };
  return { label: 'Holding', color: colors.muted, arrow: '=' };
}

const formatKg = (kg) => (Math.round(kg * 10) / 10).toFixed(1);
const signed = (kg) => `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${formatKg(Math.abs(kg))}`;

function Sparkline({ entries }) {
  const styles = useThemedStyles(makeStyles);
  // Entries arrive newest-first; the chart reads left-to-right as oldest-to-newest.
  const points = useMemo(() => entries.slice(0, 20).reverse(), [entries]);
  if (points.length < 2) return null;

  const values = points.map((e) => e.kg);
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;

  return (
    <View style={styles.spark}>
      {points.map((entry) => (
        <View
          key={entry.id}
          style={[styles.sparkBar, { height: 8 + ((entry.kg - min) / range) * 48 }]}
        />
      ))}
    </View>
  );
}

export default function WeightScreen() {
  const { user } = useAuth();
  const tabBarInset = useTabBarInset();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [entries, setEntries] = useState([]);
  const [kg, setKg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getWeights(user.id).then(setEntries);
  }, [user.id]);

  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const latest = entries[0];
    const previous = entries[1];
    const first = entries[entries.length - 1];

    return {
      latest,
      sinceLast: previous ? latest.kg - previous.kg : null,
      sinceStart: latest.kg - first.kg,
    };
  }, [entries]);

  const add = useCallback(async () => {
    setError('');
    const value = parseFloat(kg.replace(',', '.'));

    if (!Number.isFinite(value) || value <= 0) return setError('Enter a weight greater than 0.');

    setEntries(await addWeight(user.id, value));
    setKg('');
  }, [user.id, kg]);

  const confirmRemove = useCallback(
    (entry) => {
      Alert.alert('Remove entry', `Delete ${formatKg(entry.kg)} kg?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => setEntries(await deleteWeight(user.id, entry.id)),
        },
      ]);
    },
    [user.id]
  );

  const overall = stats ? trendOf(stats.sinceStart, colors) : null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarInset }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {stats && (
              <Card style={styles.summary}>
                <Text style={styles.summaryLabel}>Current weight</Text>
                <View style={styles.currentRow}>
                  <Text style={styles.current}>
                    {formatKg(stats.latest.kg)}
                    <Text style={styles.currentUnit}> kg</Text>
                  </Text>
                  <View style={[styles.badge, { borderColor: overall.color }]}>
                    <Text style={[styles.badgeText, { color: overall.color }]}>
                      {overall.arrow} {overall.label}
                    </Text>
                  </View>
                </View>

                <Sparkline entries={entries} />

                <View style={styles.deltas}>
                  <Delta
                    label="Since last entry"
                    value={stats.sinceLast}
                    empty="First entry"
                  />
                  <View style={styles.divider} />
                  <Delta label="Since start" value={stats.sinceStart} />
                </View>
              </Card>
            )}

            <Card style={styles.form}>
              <Field
                label="Log weight (kg)"
                value={kg}
                onChangeText={setKg}
                placeholder="78.5"
                keyboardType="decimal-pad"
                onSubmitEditing={add}
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Button title="Add entry" onPress={add} />
            </Card>

            {entries.length > 0 && <Text style={styles.sectionTitle}>History</Text>}
          </>
        }
        ListEmptyComponent={
          <Empty title="No entries yet" hint="Log your weight to start tracking your trend." />
        }
        renderItem={({ item, index }) => {
          const previous = entries[index + 1];
          const delta = previous ? item.kg - previous.kg : null;
          const trend = delta === null ? null : trendOf(delta, colors);

          return (
            <Card style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowWeight}>
                  {formatKg(item.kg)}
                  <Text style={styles.unit}> kg</Text>
                </Text>
                <Text style={styles.date}>
                  {new Date(item.date).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>

              {trend && (
                <Text style={[styles.rowDelta, { color: trend.color }]}>{signed(delta)} kg</Text>
              )}

              <Pressable onPress={() => confirmRemove(item)} hitSlop={8} style={styles.remove}>
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </Card>
          );
        }}
      />
    </KeyboardAvoidingView>
  );
}

function Delta({ label, value, empty }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const trend = value === null ? null : trendOf(value, colors);

  return (
    <View style={styles.delta}>
      <Text style={styles.deltaLabel}>{label}</Text>
      <Text style={[styles.deltaValue, { color: trend ? trend.color : colors.muted }]}>
        {trend ? `${signed(value)} kg` : empty}
      </Text>
    </View>
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
  summary: {
    marginBottom: spacing.md,
  },
  summaryLabel: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  current: {
    fontFamily: fonts.bold,
    color: colors.text,
    fontSize: 40,
  },
  currentUnit: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 16,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  spark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 56,
    gap: 3,
    marginTop: spacing.md,
  },
  sparkBar: {
    flex: 1,
    backgroundColor: colors.accent,
    opacity: 0.55,
    borderRadius: 2,
  },
  deltas: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  delta: {
    flex: 1,
  },
  deltaLabel: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 12,
  },
  deltaValue: {
    fontFamily: fonts.bold,
    fontSize: 17,
    marginTop: 2,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
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
  sectionTitle: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  rowMain: {
    flex: 1,
  },
  rowWeight: {
    fontFamily: fonts.bold,
    color: colors.text,
    fontSize: 17,
  },
  unit: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 13,
  },
  date: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  rowDelta: {
    fontFamily: fonts.bold,
    fontSize: 14,
    marginLeft: spacing.sm,
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
    fontFamily: fonts.bold,
    color: colors.muted,
    fontSize: 14,
  },
});
