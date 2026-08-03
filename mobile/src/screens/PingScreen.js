import IconCanary from '@tabler/icons-react-native/IconCanary';
import IconX from '@tabler/icons-react-native/IconX';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { useTabBarInset } from '../components/FloatingTabBar';
import { Button, Card, Empty, Field } from '../components/ui';
import { dismissInboxPing, getFriends, getInbox, getPings, removeFriend, sendPing } from '../storage';
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
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tabBarInset = useTabBarInset();
  const insets = useSafeAreaInsets();

  const [target, setTarget] = useState('');
  const [when, setWhen] = useState(nextHalfHour);
  const [picker, setPicker] = useState(null);
  const [friends, setFriends] = useState([]);
  const [pings, setPings] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');

  useEffect(() => {
    getFriends(user.id).then(setFriends);
    getPings(user.id).then(setPings);
    getInbox(user.id).then(setInbox);
  }, [user.id]);

  const send = useCallback(async () => {
    setError('');
    setSent('');
    if (!target.trim()) return setError('Enter a username.');
    if (when.getTime() < Date.now() - 60_000) return setError('That time has already passed.');

    setBusy(true);
    try {
      const result = await sendPing(user.id, { username: target, at: when.getTime() });
      setFriends(result.friends);
      setPings(result.pings);
      setTarget('');
      setSent(`Pinged @${result.recipient.username}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [user.id, target, when]);

  const confirmRemoveFriend = useCallback(
    (friend) => {
      Alert.alert('Remove friend', `Remove @${friend.username} from your list?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => setFriends(await removeFriend(user.id, friend.id)),
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
        data={pings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarInset }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <IconCanary size={40} color={colors.accent} />
              <View style={styles.heroText}>
                <Text style={styles.heroTitle}>PingUIn</Text>
                <Text style={styles.heroHint}>Ping a friend to train with you.</Text>
              </View>
            </View>

            <Card style={styles.form}>
              <Field
                label="Who"
                value={target}
                onChangeText={(v) => {
                  setTarget(v);
                  setError('');
                  setSent('');
                }}
                placeholder="@username"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {friends.length > 0 && (
                <View style={styles.chips}>
                  {friends.slice(0, 8).map((friend) => {
                    const active = friend.username.toLowerCase() === target.trim().toLowerCase();
                    return (
                      <Pressable
                        key={friend.id}
                        onPress={() => setTarget(friend.username)}
                        onLongPress={() => confirmRemoveFriend(friend)}
                        style={({ pressed }) => [
                          styles.chip,
                          active && styles.chipActive,
                          pressed && styles.chipPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Ping @${friend.username}`}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {friend.username}
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
              {!!sent && <Text style={styles.sent}>{sent}</Text>}
              <Button title="Send ping" onPress={send} loading={busy} />
            </Card>

            {inbox.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Inbox</Text>
                {inbox.map((item) => {
                  const at = new Date(item.at);
                  return (
                    <Card key={item.id} style={styles.row}>
                      <View style={styles.rowMain}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          @{item.fromUsername}
                        </Text>
                        <Text style={styles.rowWhen}>
                          invited you · {formatDay(at)} · {formatTime(at)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={async () => setInbox(await dismissInboxPing(user.id, item.id))}
                        hitSlop={10}
                        style={styles.dismiss}
                        accessibilityLabel="Dismiss"
                      >
                        <IconX size={16} color={colors.muted} />
                      </Pressable>
                    </Card>
                  );
                })}
              </>
            )}

            {pings.length > 0 && <Text style={styles.sectionTitle}>Sent</Text>}
          </>
        }
        ListEmptyComponent={
          <Empty title="No pings yet" hint="Invite a friend to train and it'll show up here." />
        }
        renderItem={({ item }) => {
          const at = new Date(item.at);
          const past = at.getTime() < Date.now();
          return (
            <Card style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowName} numberOfLines={1}>
                  @{item.username}
                </Text>
                <Text style={styles.rowWhen}>
                  {formatDay(at)} · {formatTime(at)}
                </Text>
              </View>
              <Text style={[styles.rowState, past && styles.rowStatePast]}>
                {past ? 'past' : 'upcoming'}
              </Text>
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
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    heroText: {
      flex: 1,
    },
    heroTitle: {
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 20,
    },
    heroHint: {
      fontFamily: fonts.regular,
      color: colors.muted,
      fontSize: 13,
      marginTop: 2,
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
    dismiss: {
      width: 26,
      height: 26,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    error: {
      fontFamily: fonts.medium,
      color: colors.danger,
      fontSize: 13,
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
