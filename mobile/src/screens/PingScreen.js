import IconHistory from '@tabler/icons-react-native/IconHistory';
import IconThumbDown from '@tabler/icons-react-native/IconThumbDown';
import IconThumbUp from '@tabler/icons-react-native/IconThumbUp';
import IconX from '@tabler/icons-react-native/IconX';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  RefreshControl,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { useTabBarInset } from '../components/FloatingTabBar';
import { Button, Card, Empty, Field, Notice } from '../components/ui';
import { useData } from '../DataContext';
import { AVATARS } from '../avatars';
import { fonts, radius, spacing } from '../theme';

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

/** Keeps the chosen clock time while moving it onto a different day. */
function withDate(time, day) {
  const next = new Date(day);
  next.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return next;
}

const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

/** "6 Aug" — day and month, never a weekday or a year. */
const formatDayMonth = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

const formatTime = (d) =>
  d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

function formatDay(d) {
  const today = new Date();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, new Date(today.getTime() + DAY_MS))) return 'Tomorrow';
  return formatDayMonth(d);
}

/** Default to the next round half-hour, which is nearly always what you want. */
function nextHalfHour() {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30);
  return d;
}

/**
 * Modal's `slide` animates the whole modal, so the full-screen scrim slides up
 * too and you see its top edge sweep across the screen. Animating separately
 * lets the scrim fade in place while only the panel travels.
 */
function PickerSheet({ title, children, onClose, insetBottom, styles }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [height, setHeight] = useState(360);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const close = () =>
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => finished && onClose());

  return (
    <Modal transparent animationType="none" visible onRequestClose={close}>
      <Animated.View style={[styles.pickerScrim, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      </Animated.View>

      <Animated.View
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        style={[
          styles.pickerSheet,
          {
            paddingBottom: insetBottom,
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) },
            ],
          },
        ]}
      >
        <Text style={styles.pickerTitle}>{title}</Text>
        {children}
        <Button title="Done" onPress={close} />
      </Animated.View>
    </Modal>
  );
}

/**
 * Day wheel. iOS's own date wheel always renders a weekday and a year, neither
 * of which can be switched off — so the options are built here and handed to a
 * plain Picker, which is still a native UIPickerView on iOS.
 */
function DayWheel({ value, onSelect, colors, styles }) {
  const days = useMemo(() => {
    const base = startOfDay(new Date());
    return Array.from({ length: 30 }, (_, i) => new Date(base.getTime() + i * DAY_MS));
  }, []);

  const selectedIndex = Math.max(
    0,
    days.findIndex((d) => sameDay(d, value))
  );

  return (
    <Picker
      selectedValue={selectedIndex}
      onValueChange={(index) => onSelect(days[index])}
      itemStyle={[styles.wheelItem, { color: colors.text }]}
      dropdownIconColor={colors.text}
    >
      {days.map((day, index) => (
        <Picker.Item key={day.toDateString()} label={formatDay(day)} value={index} />
      ))}
    </Picker>
  );
}

export default function PingScreen() {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tabBarInset = useTabBarInset();
  const insets = useSafeAreaInsets();
  const { received, sent, loading, error: loadError, refresh, sendPing, respondToPing, cancelPing } =
    useData();

  const [tab, setTab] = useState('received');
  const [target, setTarget] = useState('');
  const [when, setWhen] = useState(nextHalfHour);
  const [picker, setPicker] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  /**
   * Who to offer as a shortcut. There is no friends endpoint — the people you
   * train with are simply the ones already on your pings, most recent first.
   */
  const recent = useMemo(() => {
    const seen = new Map();
    for (const ping of [...sent, ...received].sort((a, b) => b.sentAt - a.sentAt)) {
      if (!seen.has(ping.user.id)) seen.set(ping.user.id, ping.user);
    }
    return [...seen.values()].slice(0, 8);
  }, [sent, received]);

  const pendingCount = received.filter((p) => p.status === 'pending').length;

  /**
   * `direction` is added on merge: PingOut always describes the other person, so
   * a combined list otherwise can't say whether you sent or were sent.
   */
  const rows = useMemo(() => {
    const inbound = received.map((p) => ({ ...p, direction: 'in' }));
    const outbound = sent.map((p) => ({ ...p, direction: 'out' }));
    const everything = [...inbound, ...outbound].sort((a, b) => b.at - a.at);

    if (tab === 'received') return inbound;
    if (tab === 'accepted') return everything.filter((p) => p.status === 'accepted');
    return everything;
  }, [tab, received, sent]);

  const send = useCallback(async () => {
    setError('');
    setNotice('');
    if (!target.trim()) return setError('Enter a username.');
    if (when.getTime() < Date.now() - 60_000) return setError('That time has already passed.');

    setBusy(true);
    try {
      const ping = await sendPing({ username: target, at: when.getTime() });
      setTarget('');
      setNotice(`Pinged @${ping.user.username}.`);
      setTab('all');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [sendPing, target, when]);

  const answer = useCallback(
    (ping, status) => respondToPing(ping.id, status).catch((e) => setError(e.message)),
    [respondToPing]
  );

  const withdraw = useCallback(
    (ping) => cancelPing(ping.id).catch((e) => setError(e.message)),
    [cancelPing]
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarInset }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.muted} />
        }
        ListHeaderComponent={
          <>
            {!!loadError && <Notice message={loadError} onRetry={refresh} />}

            <Card style={styles.form}>
              <Field
                label="Who"
                value={target}
                onChangeText={(v) => {
                  setTarget(v);
                  setError('');
                  setNotice('');
                }}
                placeholder="@username"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {recent.length > 0 && (
                <View style={styles.chips}>
                  {recent.map((person) => {
                    const active = person.username.toLowerCase() === target.trim().toLowerCase();
                    return (
                      <Pressable
                        key={person.id}
                        onPress={() => setTarget(person.username)}
                        style={({ pressed }) => [
                          styles.chip,
                          active && styles.chipActive,
                          pressed && styles.chipPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Ping @${person.username}`}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {person.username}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <View style={styles.whenRow}>
                <Pressable
                  onPress={() => setPicker('day')}
                  style={({ pressed }) => [styles.whenButton, pressed && styles.chipPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Day, ${formatDay(when)}`}
                >
                  <Ionicons name="calendar-outline" size={17} color={colors.muted} />
                  <Text style={styles.whenText}>{formatDay(when)}</Text>
                </Pressable>

                <Pressable
                  onPress={() => setPicker('time')}
                  style={({ pressed }) => [styles.whenButton, pressed && styles.chipPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Time, ${formatTime(when)}`}
                >
                  <Ionicons name="time-outline" size={17} color={colors.muted} />
                  <Text style={styles.whenText}>{formatTime(when)}</Text>
                </Pressable>
              </View>

              {!!error && <Text style={styles.error}>{error}</Text>}
              {!!notice && <Text style={styles.sent}>{notice}</Text>}
              <Button title="Send ping" onPress={send} loading={busy} />
            </Card>

            {/* Two lists, one at a time — they were competing for the same
                scroll, and the API serves them from separate endpoints. */}
            <View style={styles.tabs}>
              {[
                ['received', 'Received', pendingCount],
                ['accepted', 'Accepted', 0],
              ].map(([key, label, badge]) => {
                const active = tab === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setTab(key)}
                    style={({ pressed }) => [
                      styles.tab,
                      active && styles.tabActive,
                      pressed && styles.chipPressed,
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
                    {badge > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{badge}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}

              {/* Everything, both directions — no label, the icon says enough. */}
              <Pressable
                onPress={() => setTab('all')}
                style={({ pressed }) => [
                  styles.tab,
                  styles.tabSquare,
                  tab === 'all' && styles.tabActive,
                  pressed && styles.chipPressed,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === 'all' }}
                accessibilityLabel="All pings"
              >
                <IconHistory size={18} color={tab === 'all' ? colors.accent : colors.muted} />
              </Pressable>
            </View>

          </>
        }
        ListEmptyComponent={
          <Empty
            title={
              tab === 'received'
                ? 'Nothing received'
                : tab === 'accepted'
                  ? 'Nothing accepted yet'
                  : 'No pings yet'
            }
            hint={
              tab === 'received'
                ? 'Invitations from other people land here.'
                : tab === 'accepted'
                  ? 'Sessions both of you agreed to show up here.'
                  : "Invite someone above and it'll show up here."
            }
          />
        }
        renderItem={({ item }) => {
          const at = new Date(item.at);
          const past = at.getTime() < Date.now();
          const avatar = AVATARS.find((a) => a.key === item.user.avatar);
          const inbound = (item.direction ?? 'in') === 'in';
          const answerable = inbound && item.status === 'pending';

          return (
            <Card style={styles.row}>
              {avatar ? (
                <avatar.Icon size={20} color={colors.muted} style={styles.rowAvatar} />
              ) : null}

              <View style={styles.rowMain}>
                <Text style={styles.rowName} numberOfLines={1}>
                  @{item.user.username}
                </Text>
                <Text style={styles.rowWhen}>
                  {tab === 'received' ? '' : `${inbound ? 'from' : 'to'} · `}
                  {formatDay(at)} · {formatTime(at)}
                </Text>
              </View>

              {answerable ? (
                <View style={styles.answer}>
                  <Pressable
                    onPress={() => answer(item, 'accepted')}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.answerButton,
                      styles.answerAccept,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Accept ping from ${item.user.username}`}
                  >
                    <IconThumbUp size={17} color={colors.accentText} />
                  </Pressable>

                  <Pressable
                    onPress={() => answer(item, 'declined')}
                    hitSlop={8}
                    style={({ pressed }) => [styles.answerButton, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Decline ping from ${item.user.username}`}
                  >
                    <IconThumbDown size={17} color={colors.muted} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.answer}>
                  <Text
                    style={[
                      styles.rowState,
                      (item.status === 'declined' || (item.status === 'pending' && past)) &&
                        styles.rowStatePast,
                    ]}
                  >
                    {item.status === 'pending' ? (past ? 'expired' : 'pending') : item.status}
                  </Text>

                  {/* Withdrawing is the sender's move; a recipient declines. */}
                  {!inbound && item.status === 'pending' && !past && (
                    <Pressable
                      onPress={() => withdraw(item)}
                      hitSlop={8}
                      style={({ pressed }) => [styles.answerButton, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`Withdraw ping to ${item.user.username}`}
                    >
                      <IconX size={16} color={colors.muted} />
                    </Pressable>
                  )}
                </View>
              )}
            </Card>
          );
        }}
      />

      {/* iOS renders the picker inline, which the floating tab bar sits on top of.
          A modal lifts it clear of the bar; Android's picker is already a dialog. */}
      {picker === 'day' && (
        <PickerSheet
          title="Which day?"
          onClose={() => setPicker(null)}
          styles={styles}
          insetBottom={Math.max(insets.bottom, spacing.md)}
        >
          <DayWheel
            value={when}
            colors={colors}
            styles={styles}
            onSelect={(day) => {
              setWhen(withDate(when, day));
              setError('');
            }}
          />
        </PickerSheet>
      )}

      {picker === 'time' && Platform.OS === 'ios' && (
        <PickerSheet
          title="What time?"
          onClose={() => setPicker(null)}
          styles={styles}
          insetBottom={Math.max(insets.bottom, spacing.md)}
        >
          <DateTimePicker
            value={when}
            mode="time"
            display="spinner"
            themeVariant={isDark ? 'dark' : 'light'}
            onChange={(event, selected) => {
              if (event.type === 'dismissed' || !selected) return;
              setWhen(withDate(selected, when));
              setError('');
            }}
          />
        </PickerSheet>
      )}

      {picker === 'time' && Platform.OS === 'android' && (
        <DateTimePicker
          value={when}
          mode="time"
          display="default"
          onChange={(event, selected) => {
            setPicker(null);
            if (event.type === 'dismissed' || !selected) return;
            setWhen(withDate(selected, when));
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
    form: {
      marginBottom: spacing.lg,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardAlt,
    },
    chipActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accent,
    },
    chipPressed: {
      opacity: 0.7,
    },
    chipText: {
      fontFamily: fonts.medium,
      color: colors.text,
      fontSize: 13,
    },
    chipTextActive: {
      color: colors.accentText,
    },
    whenRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    whenButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: 14,
    },
    whenText: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 15,
    },
    wheelItem: {
      fontFamily: fonts.medium,
      fontSize: 20,
    },
    pickerScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    pickerSheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
    pickerTitle: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 16,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    sent: {
      fontFamily: fonts.medium,
      color: colors.accent,
      fontSize: 13,
      marginBottom: spacing.md,
    },
    answer: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    answerButton: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    answerAccept: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    pressed: {
      opacity: 0.6,
    },
    error: {
      fontFamily: fonts.medium,
      color: colors.danger,
      fontSize: 13,
      marginBottom: spacing.md,
    },
    tabs: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: 10,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    // A fixed square, so the two labelled tabs share the remaining width.
    tabSquare: {
      flex: 0,
      width: 46,
    },
    tabActive: {
      borderColor: colors.accent,
      backgroundColor: colors.cardAlt,
    },
    tabText: {
      fontFamily: fonts.medium,
      color: colors.muted,
      fontSize: 14,
    },
    tabTextActive: {
      color: colors.accent,
    },
    // Only ever on Received, and only when something is waiting.
    badge: {
      minWidth: 20,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 10,
      backgroundColor: colors.accent,
      alignItems: 'center',
    },
    badgeText: {
      fontFamily: fonts.bold,
      color: colors.accentText,
      fontSize: 11,
    },
    rowAvatar: {
      marginRight: spacing.sm,
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
    rowName: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 15,
    },
    rowWhen: {
      fontFamily: fonts.regular,
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    rowState: {
      fontFamily: fonts.medium,
      color: colors.accent,
      fontSize: 12,
    },
    rowStatePast: {
      color: colors.muted,
    },
  });
