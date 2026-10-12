import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/forms';
import { Screen } from '@/components/Screen';
import { showToast } from '@/components/Toast';
import { familyLimits } from '@/domain/plan';
import { fetchSuggestions, moreLeftToday } from '@/features/ai/aiClient';
import { useT } from '@/lib/i18n';
import { logError } from '@/lib/log';
import { useFamily, useGameStore } from '@/state/game';
import { useDispatch } from '@/state/hooks';
import { palette, space } from '@/theme/tokens';

/** Weekly suggestions per child (spec 10.5). Nothing reaches the child before the parent accepts it. */
export default function AiSuggestions() {
  const t = useT();
  const state = useFamily();
  const dispatch = useDispatch();
  const isLocal = useGameStore((s) => s.backend?.kind !== 'cloud');
  const params = useLocalSearchParams<{ child?: string }>();
  const [childId, setChildId] = useState<string | null>(params.child ?? state.children[0]?.id ?? null);
  const [left, setLeft] = useState(3);
  const [busy, setBusy] = useState(false);
  const child = state.children.find((c) => c.id === childId);
  const limits = familyLimits(state);
  const suggestions = state.aiSuggestions.filter((s) => s.childId === childId && s.status === 'new');

  useEffect(() => {
    if (childId) moreLeftToday(childId).then(setLeft).catch(() => setLeft(0));
  }, [childId, state.aiSuggestions.length]);

  const more = async () => {
    if (!child) return;
    setBusy(true);
    try {
      await fetchSuggestions(state, child);
      setLeft(await moreLeftToday(child.id));
    } catch (error) {
      logError('ai.more', error);
      showToast(t(error instanceof Error && error.message === 'limit' ? 'parent.ai.noMore' : 'common.somethingWrong'), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!limits.aiSuggestions) {
    return (
      <Screen back="/parent/more" title={t('parent.ai.title')}>
        <Card tone="plus" style={styles.gap}>
          <AppText variant="heading">✨ {t('paywall.features.ai')}</AppText>
          <AppText variant="body">{t('errors.plus_required')}</AppText>
          <Button label={t('parent.more.plus')} variant="plus" onPress={() => router.push('/parent/paywall')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen back="/parent/more" title={t('parent.ai.title')} subtitle={t('parent.ai.hint')}>
      <ChipRow>
        {state.children.map((c) => (
          <Chip key={c.id} label={c.firstName} selected={childId === c.id} onPress={() => setChildId(c.id)} />
        ))}
      </ChipRow>
      {isLocal ? (
        <AppText variant="caption" color={palette.inkFaint}>
          📚 {t('parent.ai.libraryFallback')}
        </AppText>
      ) : null}
      {suggestions.length === 0 ? <AppText color={palette.inkSoft}>{t('parent.ai.empty')}</AppText> : null}
      {suggestions.map((s) => (
        <Animated.View key={s.id} entering={FadeInRight} exiting={FadeOutLeft}>
          <Card style={styles.gap}>
            <View style={styles.row}>
              <AppText style={styles.icon}>{s.payload.icon}</AppText>
              <View style={styles.flex}>
                <AppText variant="heading">{s.payload.titleChild}</AppText>
                <AppText variant="caption" color={palette.inkSoft}>
                  {t(`branches.${s.payload.branch}`)} · {t(`difficulty.${s.payload.difficulty}`)}
                </AppText>
              </View>
            </View>
            <AppText variant="caption" color={palette.inkSoft}>
              💡 {s.payload.parentTip}
            </AppText>
            <View style={styles.row}>
              <Button
                label={t('parent.ai.accept')}
                style={styles.flex}
                onPress={() => dispatch({ type: 'resolveAiSuggestion', suggestionId: s.id, accept: true }, { success: t('parent.library.added', { name: child?.firstName ?? '' }) })}
              />
              <Button label={t('parent.ai.dismiss')} variant="secondary" onPress={() => dispatch({ type: 'resolveAiSuggestion', suggestionId: s.id, accept: false })} />
            </View>
          </Card>
        </Animated.View>
      ))}
      <Button
        label={`✨ ${t('parent.ai.more')}`}
        variant="secondary"
        onPress={more}
        loading={busy}
        disabled={left <= 0 || !child}
      />
      <AppText variant="caption" color={palette.inkFaint} align="center">
        {left > 0 ? t('parent.ai.moreLeft', { count: left }) : t('parent.ai.noMore')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { fontSize: 32, lineHeight: 38 },
});
