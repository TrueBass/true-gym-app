import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FloatingTabBar from '../components/FloatingTabBar';
import { fonts, spacing } from '../theme';
import AccountScreen from './AccountScreen';
import PRScreen from './PRScreen';
import WeightScreen from './WeightScreen';
import { useThemedStyles } from '../ThemeContext';

const TABS = [
  { key: 'prs', label: 'PRs', icon: 'barbell', title: 'Personal records', Screen: PRScreen },
  { key: 'weight', label: 'Weight', icon: 'trending-up', title: 'Body weight', Screen: WeightScreen },
  { key: 'account', label: 'Account', icon: 'person', title: 'Account', Screen: AccountScreen },
];

export default function HomeScreen() {
  const [tab, setTab] = useState('prs');
  const styles = useThemedStyles(makeStyles);

  const active = TABS.find((t) => t.key === tab);

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>{active.title}</Text>

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
  title: {
    fontFamily: fonts.bold,
    color: colors.text,
    fontSize: 24,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
