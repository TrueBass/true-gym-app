import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { colors, radius, spacing } from '../theme';
import PRScreen from './PRScreen';
import WeightScreen from './WeightScreen';

const TABS = [
  { key: 'prs', label: 'PRs', Screen: PRScreen },
  { key: 'weight', label: 'Weight', Screen: WeightScreen },
];

export default function HomeScreen() {
  const { user, logOut } = useAuth();
  const [tab, setTab] = useState('prs');

  const { Screen } = TABS.find((t) => t.key === tab);

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.greeting}>Hey, {user.name || 'athlete'}</Text>
          <Text style={styles.email} numberOfLines={1}>
            {user.email}
          </Text>
        </View>
        <Pressable onPress={logOut} hitSlop={8} style={styles.logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {TABS.map(({ key, label }) => {
          const active = key === tab;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Screen />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  greeting: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  email: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  logout: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  logoutText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 4,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: colors.accentText,
  },
});
