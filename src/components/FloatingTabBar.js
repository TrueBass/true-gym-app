import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useEffect, useRef } from 'react';
import { Animated, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '../theme';

const BAR_HEIGHT = 62;
const BAR_MARGIN = spacing.md;

/**
 * Space a scrolling screen must reserve at its bottom so the last row isn't
 * trapped under the floating bar.
 */
export function useTabBarInset() {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + BAR_MARGIN * 2 + Math.max(insets.bottom, spacing.sm);
}

function TabItem({ tab, isActive, onPress }) {
  const scale = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isActive ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [isActive, scale]);

  const iconStyle = {
    transform: [{ scale: scale.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={tab.label}
    >
      <Animated.View style={iconStyle}>
        <Ionicons
          name={isActive ? tab.icon : `${tab.icon}-outline`}
          size={22}
          color={isActive ? colors.accent : colors.muted}
        />
      </Animated.View>
      <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
    </Pressable>
  );
}

export default function FloatingTabBar({ tabs, active, onChange }) {
  const insets = useSafeAreaInsets();
  const shift = useRef(new Animated.Value(0)).current;

  // The bar floats above content, so an open keyboard would otherwise cover it.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const animate = (toValue) =>
      Animated.timing(shift, { toValue, duration: 220, useNativeDriver: true }).start();

    const subs = [
      Keyboard.addListener(showEvent, () => animate(1)),
      Keyboard.addListener(hideEvent, () => animate(0)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [shift]);

  const bottom = Math.max(insets.bottom, spacing.sm);
  const hidden = {
    opacity: shift.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [
      {
        translateY: shift.interpolate({
          inputRange: [0, 1],
          outputRange: [0, BAR_HEIGHT + bottom + BAR_MARGIN],
        }),
      },
    ],
  };

  return (
    <Animated.View style={[styles.wrap, { bottom }, hidden]} pointerEvents="box-none">
      <View style={styles.bar}>
        <BlurView
          intensity={28}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        {/* Tint over the blur: guarantees label contrast whatever scrolls beneath. */}
        <View style={styles.tint} />

        {tabs.map((tab) => (
          <TabItem
            key={tab.key}
            tab={tab}
            isActive={tab.key === active}
            onPress={() => onChange(tab.key)}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: BAR_MARGIN,
    right: BAR_MARGIN,
  },
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    // Lifts the bar off the content behind it.
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12,13,16,0.55)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    // Fills the bar height so the tap area clears the 44pt minimum.
    alignSelf: 'stretch',
  },
  tabPressed: {
    opacity: 0.6,
  },
  label: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 11,
  },
  labelActive: {
    color: colors.accent,
  },
});
