import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/lib/i18n';
import { palette, space } from '@/theme/tokens';

import { AppText } from './AppText';

export interface ScreenProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  /** Show a back button; pass a route to use when there is no history (deep links, web reload). */
  back?: boolean | string;
  right?: ReactNode;
  scroll?: boolean;
  background?: string;
  inkColor?: string;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export function goBack(fallback: string = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

export function Screen({
  children,
  title,
  subtitle,
  back,
  right,
  scroll = true,
  background = palette.bg,
  inkColor = palette.ink,
  contentStyle,
  footer,
  edges = ['top', 'left', 'right'],
}: ScreenProps) {
  const t = useT();
  const header =
    title || back || right ? (
      <View style={styles.header}>
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={12}
            onPress={() => goBack(typeof back === 'string' ? back : '/')}
            style={styles.backButton}>
            <AppText variant="title" color={inkColor}>
              ‹
            </AppText>
          </Pressable>
        ) : null}
        <View style={styles.headerText}>
          {title ? (
            <AppText variant="title" color={inkColor} accessibilityRole="header" numberOfLines={1}>
              {title}
            </AppText>
          ) : null}
          {subtitle ? (
            <AppText variant="caption" color={inkColor} style={styles.subtitle}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right}
      </View>
    ) : null;

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: background }]} edges={edges}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {header}
        {body}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    gap: space.sm,
    minHeight: 52,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -space.sm,
  },
  headerText: { flex: 1 },
  subtitle: { opacity: 0.75, marginTop: 2 },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxxl,
    gap: space.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
});
