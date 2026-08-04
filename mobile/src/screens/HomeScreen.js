import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FloatingTabBar from '../components/FloatingTabBar';
import IconCanary from '@tabler/icons-react-native/IconCanary';
import { fonts, spacing } from '../theme';
import AccountScreen from './AccountScreen';
import PingScreen from './PingScreen';
import PRScreen from './PRScreen';
import WeightScreen from './WeightScreen';
import { useTheme, useThemedStyles } from '../ThemeContext';

const TABS = [
  { key: 'prs', label: 'PRs', icon: 'barbell', title: 'Personal records', Screen: PRScreen },
  { key: 'weight', label: 'Weight', icon: 'trending-up', title: 'Body weight', Screen: WeightScreen },
  {
    key: 'ping',
    label: 'Pinguin',
    Icon: IconCanary,
    title: 'Pinguin',
    // Sit beside and under the heading, where the screen used to repeat itself.
    TitleIcon: IconCanary,
    subtitle: 'Ping a friend to train with you.',
    Screen: PingScreen,
  },
  { key: 'account', label: 'Account', icon: 'person', title: 'Account', Screen: AccountScreen },
];

export default function HomeScreen() {
  const [tab, setTab] = useState('prs');
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const active = TABS.find((t) => t.key === tab);

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{active.title}</Text>
          {active.TitleIcon && <active.TitleIcon size={30} color={colors.accent} />}
        </View>
        {!!active.subtitle && <Text style={styles.subtitle}>{active.subtitle}</Text>}
      </View>

      <View style={styles.flex}>
        <active.Screen />
      </View>

      <FloatingTabBar tabs={TABS} active={tab} onChange={setTab} />
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.bold,
    color: colors.text,
    fontSize: 24,
  },
  subtitle: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
});
