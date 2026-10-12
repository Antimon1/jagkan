import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import type { ChallengeView } from '@/domain/selectors';
import { useT } from '@/lib/i18n';
import { playSound } from '@/lib/sound';
import { useDispatch } from '@/state/hooks';
import { BRANCH_COLORS, palette, radius, space } from '@/theme/tokens';

export function ChallengeRow({ view, childName }: { view: ChallengeView; childName: string }) {
  const t = useT();
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const { challenge } = view;
  const isActive = challenge.status === 'active' || challenge.status === 'requested';

  return (
    <View style={[styles.row, challenge.status === 'requested' ? styles.requested : null]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={view.parentTitle}
        onPress={() => setOpen((v) => !v)}
        style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${BRANCH_COLORS[challenge.branch]}22` }]}>
          <AppText style={styles.icon}>{view.icon}</AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{view.parentTitle}</AppText>
          <AppText variant="caption" color={palette.inkSoft}>
            {challenge.status === 'requested'
              ? `⏳ ${t('parent.child.requested')}`
              : `🔥 ${t('parent.child.sparksOn', { count: challenge.sparks })}`}
            {challenge.repeatable ? ` · 🔁 ${t('parent.child.repeatCount', { count: challenge.repeatCount })}` : ''}
          </AppText>
        </View>
        <AppText variant="title" color={palette.inkFaint}>
          {open ? '–' : '+'}
        </AppText>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          {view.tip ? (
            <AppText variant="caption" color={palette.inkSoft}>
              💡 {view.tip}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            {isActive ? (
              <>
                <Button
                  size="sm"
                  variant="star"
                  label={t('parent.child.registerDone')}
                  onPress={async () => {
                    const ok = await dispatch(
                      { type: 'approveCompletion', challengeId: challenge.id },
                      { success: t('parent.approve.approved', { name: childName }) },
                    );
                    if (ok) playSound('chime');
                  }}
                />
                <Button size="sm" variant="spark" label={t('parent.child.giveSpark')} onPress={() => dispatch({ type: 'giveSpark', challengeId: challenge.id })} />
                <Button
                  size="sm"
                  variant="secondary"
                  label={t('parent.child.pause')}
                  onPress={() => dispatch({ type: 'setChallengeStatus', challengeId: challenge.id, status: 'paused' })}
                />
              </>
            ) : null}
            {challenge.status === 'paused' ? (
              <Button
                size="sm"
                label={t('parent.child.activate')}
                onPress={() => dispatch({ type: 'setChallengeStatus', challengeId: challenge.id, status: 'active' })}
              />
            ) : null}
            {challenge.status !== 'archived' ? (
              <Button
                size="sm"
                variant="ghost"
                label={t('parent.child.archive')}
                onPress={() => dispatch({ type: 'setChallengeStatus', challengeId: challenge.id, status: 'archived' })}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.line,
    overflow: 'hidden',
  },
  requested: { borderColor: palette.star, backgroundColor: '#FFFCF0' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 24, lineHeight: 30 },
  body: { paddingHorizontal: space.md, paddingBottom: space.md, gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
