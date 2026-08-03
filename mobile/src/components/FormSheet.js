import Ionicons from '@expo/vector-icons/Ionicons';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { fonts, radius, spacing } from '../theme';

/**
 * A settings sub-screen presented over the app. The project has no navigation
 * library, so this uses a Modal — on iOS `pageSheet` gives the native card
 * presentation and swipe-to-dismiss for free.
 */
export default function FormSheet({ title, description, onClose, children }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  // A pageSheet already clears the status bar; a fullScreen Android modal doesn't.
  const topPad = Platform.OS === 'android' ? insets.top : 0;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <View style={[styles.sheet, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={18} color={colors.muted} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.lg }]}
            keyboardShouldPersistTaps="handled"
          >
            {!!description && <Text style={styles.description}>{description}</Text>}
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    sheet: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    title: {
      flex: 1,
      fontFamily: fonts.bold,
      color: colors.text,
      fontSize: 22,
    },
    close: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closePressed: {
      opacity: 0.6,
    },
    body: {
      paddingHorizontal: spacing.md,
    },
    description: {
      fontFamily: fonts.regular,
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: spacing.lg,
    },
  });
