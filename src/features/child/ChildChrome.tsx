import { router, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { requestParentAccess } from '@/components/ParentGate';
import { SpeakButton } from '@/components/SpeakButton';
import { availableStars } from '@/domain/stars';
import { ChildAvatar } from '@/features/children/ChildAvatar';
import { useT } from '@/lib/i18n';
import { haptic } from '@/lib/sound';
import { useDeviceStore } from '@/state/device';
import { CHILD_TOUCH, radius, space } from '@/theme/tokens';

import type { ActiveChild } from './useActiveChild';
import { useVisibleChildren } from './useActiveChild';

async function leaveChildMode() {
  const device = useDeviceStore.getState();
  if (device.role === 'child-device') {
    // A paired child device has no parent area; the lock only switches profile.
    device.setActiveChild(null);
    router.replace('/child');
    return;
  }
  if (await requestParentAccess()) {
    device.enterParentMode();
    router.replace('/parent');
  }
}

function TopBar({ active, title }: { active: ActiveChild; title: string }) {
  const t = useT();
  const { child, state, theme } = active;
  const visible = useVisibleChildren();
  return (
    <View style={styles.topBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={child.firstName}
        onPress={() => {
          if (visible.length > 1) {
            useDeviceStore.getState().setActiveChild(null);
            router.replace('/child');
          } else router.push('/child/collection');
        }}>
        <ChildAvatar child={child} state={state} size={56} />
      </Pressable>
      <View style={styles.titleWrap}>
        <AppText variant="childBig" color={theme.ink} numberOfLines={1}>
          {title}
        </AppText>
        <SpeakButton text={title} size={40} background={theme.surface} color={theme.ink} />
      </View>
      <View style={[styles.starBadge, { backgroundColor: theme.surface }]} accessible accessibilityLabel={t('common.starsLabel', { count: availableStars(state, child.id) })}>
        <AppText variant="childBig" color={theme.ink}>
          ⭐ {availableStars(state, child.id)}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('child.parentMode')}
        onPress={leaveChildMode}
        hitSlop={8}
        style={[styles.lock, { backgroundColor: theme.surfaceSunk }]}>
        <AppText style={styles.lockIcon}>🔒</AppText>
      </Pressable>
    </View>
  );
}

const NAV = [
  { href: '/child', key: 'home', emoji: '🏠' },
  { href: '/child/collection', key: 'collection', emoji: '🐣' },
  { href: '/child/shop', key: 'shop', emoji: '🎁' },
  { href: '/child/album', key: 'album', emoji: '📸' },
] as const;

function BottomNav({ active }: { active: ActiveChild }) {
  const t = useT();
  const pathname = usePathname();
  const { theme } = active;
  return (
    <View style={[styles.nav, { backgroundColor: theme.surface, borderTopColor: theme.line }]}>
      {NAV.map((item) => {
        const selected = pathname === item.href;
        const label = t(`child.nav.${item.key}`);
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            onPress={() => {
              haptic('light');
              router.replace(item.href);
            }}
            style={[styles.navItem, selected ? { backgroundColor: theme.bgAccent } : null]}>
            <AppText style={[styles.navEmoji, { transform: [{ scale: selected ? 1.15 : 1 }] }]}>{item.emoji}</AppText>
            <AppText variant="label" color={theme.ink}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ChildChrome({ active, title, children }: { active: ActiveChild; title: string; children: ReactNode }) {
  const { theme } = active;
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right', 'bottom']}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.decor, styles.decorA, { backgroundColor: theme.decor[0] }]} />
        <View style={[styles.decor, styles.decorB, { backgroundColor: theme.decor[1] }]} />
        <View style={[styles.decor, styles.decorC, { backgroundColor: theme.decor[2] }]} />
      </View>
      <TopBar active={active} title={title} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      <BottomNav active={active} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  starBadge: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  lock: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  lockIcon: { fontSize: 18, lineHeight: 22 },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl, width: '100%', maxWidth: 900, alignSelf: 'center' },
  nav: { flexDirection: 'row', borderTopWidth: 1, paddingHorizontal: space.sm, paddingVertical: space.xs, gap: space.xs },
  navItem: { flex: 1, minHeight: CHILD_TOUCH, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 2 },
  navEmoji: { fontSize: 28, lineHeight: 34 },
  decor: { position: 'absolute', borderRadius: 999, opacity: 0.7 },
  decorA: { width: 260, height: 260, top: -90, right: -70 },
  decorB: { width: 200, height: 200, bottom: 60, left: -80 },
  decorC: { width: 110, height: 110, top: 260, right: -30 },
});
