import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, Pressable, StyleSheet } from 'react-native';
import { useThemedStyles } from '../ThemeContext';
import { useTabBarInset } from './FloatingTabBar';
import { spacing } from '../theme';

const SIZE = 56;

/**
 * What a list underneath must add to its bottom padding, on top of the tab
 * bar's own inset, so its last row can be scrolled out from under the button.
 */
export const FAB_CLEARANCE = SIZE + spacing.md;

/**
 * A screen's one primary action, parked over the bottom-right of its list.
 *
 * It sits on the inset the list already reserves for the floating tab bar, so
 * the two never overlap however tall the safe area is. And it leaves when the
 * keyboard arrives, for the reason the tab bar does: the keyboard means the
 * user is typing somewhere, and a button hovering over that is only in the way.
 */
export default function FloatingActionButton({ onPress, accessibilityLabel, children }) {
  const styles = useThemedStyles(makeStyles);
  const inset = useTabBarInset();
  const shift = useRef(new Animated.Value(0)).current;
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const animate = (toValue) =>
      Animated.timing(shift, { toValue, duration: 220, useNativeDriver: true }).start();

    const subs = [
      Keyboard.addListener(showEvent, () => {
        setTyping(true);
        animate(1);
      }),
      Keyboard.addListener(hideEvent, () => {
        setTyping(false);
        animate(0);
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [shift]);

  return (
    <Animated.View
      // Faded out is not the same as gone: without this it would still take
      // the taps that land where it used to be.
      pointerEvents={typing ? 'none' : 'auto'}
      style={[
        styles.wrap,
        { bottom: inset },
        {
          opacity: shift.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [
            { scale: shift.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] }) },
          ],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      right: spacing.md,
    },
    button: {
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      // Same lift as the tab bar, so the two read as one layer above the list.
      shadowColor: '#000',
      shadowOpacity: 0.45,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    pressed: {
      opacity: 0.8,
      transform: [{ scale: 0.96 }],
    },
  });
