import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { REWARD_ICONS, EmojiPicker } from '@/components/EmojiPicker';
import { Chip, ChipRow, SectionHeader, Stepper, TextField } from '@/components/forms';
import { Screen } from '@/components/Screen';
import { catalog } from '@/data/catalog';
import { childAge } from '@/domain/age';
import { familyLimits } from '@/domain/plan';
import { pendingRewardRequests } from '@/domain/selectors';
import type { Reward } from '@/domain/types';
import { RewardRequestCard } from '@/features/parent/cards';
import { useT } from '@/lib/i18n';
import { useFamily } from '@/state/game';
import { useDispatch, useNow } from '@/state/hooks';
import { palette, space } from '@/theme/tokens';

interface Draft {
  id: string | null;
  title: string;
  icon: string;
  costStars: number;
  childId: string | null;
}

const EMPTY: Draft = { id: null, title: '', icon: '🎁', costStars: 5, childId: null };

export default function Rewards() {
  const t = useT();
  const state = useFamily();
  const dispatch = useDispatch();
  const now = useNow();
  const [draft, setDraft] = useState<Draft | null>(null);
  const limits = familyLimits(state);
  const active = state.rewards.filter((r) => r.active);
  const atLimit = active.length >= limits.maxRewards;
  const requests = pendingRewardRequests(state);
  const ages = state.children.map((c) => childAge(c, now, state.family.settings.timeZone));
  const minAge = Math.min(...ages, 13);
  const maxAge = Math.max(...ages, 4);
  const suggestions = catalog.rewardSuggestions
    .filter((s) => s.ageMax >= minAge && s.ageMin <= maxAge)
    .filter((s) => !active.some((r) => r.title === s.title))
    .slice(0, 12);
  const history = state.rewardRequests
    .filter((r) => r.status !== 'requested')
    .sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''))
    .slice(0, 15);

  const save = async () => {
    if (!draft) return;
    const ok = draft.id
      ? await dispatch({ type: 'updateReward', rewardId: draft.id, title: draft.title, icon: draft.icon, costStars: draft.costStars, childId: draft.childId })
      : await dispatch({ type: 'createReward', title: draft.title, icon: draft.icon, costStars: draft.costStars, childId: draft.childId });
    if (ok) setDraft(null);
  };

  const edit = (reward: Reward) =>
    setDraft({ id: reward.id, title: reward.title, icon: reward.icon, costStars: reward.costStars, childId: reward.childId });

  return (
    <Screen title={t('parent.rewards.title')}>
      {requests.length ? <SectionHeader title={t('parent.rewards.requests')} /> : null}
      {requests.map((item) => (
        <RewardRequestCard key={item.request.id} item={item} state={state} />
      ))}

      {draft ? (
        <Card style={styles.form}>
          <TextField
            label={t('parent.rewards.name')}
            placeholder={t('parent.rewards.namePlaceholder')}
            value={draft.title}
            onChangeText={(title) => setDraft({ ...draft, title })}
            maxLength={60}
          />
          <Stepper label={t('parent.rewards.cost')} value={draft.costStars} min={1} max={200} onChange={(costStars) => setDraft({ ...draft, costStars })} format={(v) => `⭐ ${v}`} />
          <AppText variant="label" color={palette.inkSoft}>
            {t('parent.rewards.forWho')}
          </AppText>
          <ChipRow>
            <Chip label={t('common.allChildren')} selected={draft.childId === null} onPress={() => setDraft({ ...draft, childId: null })} />
            {state.children.map((child) => (
              <Chip key={child.id} label={child.firstName} selected={draft.childId === child.id} onPress={() => setDraft({ ...draft, childId: child.id })} />
            ))}
          </ChipRow>
          <AppText variant="label" color={palette.inkSoft}>
            {t('parent.rewards.icon')}
          </AppText>
          <EmojiPicker label={t('parent.rewards.icon')} value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} options={REWARD_ICONS} />
          <View style={styles.row}>
            <Button label={t('common.save')} onPress={save} disabled={!draft.title.trim()} style={styles.flex} />
            <Button label={t('common.cancel')} variant="secondary" onPress={() => setDraft(null)} />
          </View>
        </Card>
      ) : atLimit ? (
        <Card tone="plus" onPress={() => router.push('/parent/paywall')}>
          <AppText variant="body">{t('parent.rewards.freeLimit')}</AppText>
        </Card>
      ) : (
        <Button label={`＋ ${t('parent.rewards.create')}`} onPress={() => setDraft({ ...EMPTY })} />
      )}

      {active.length === 0 ? <AppText color={palette.inkSoft}>{t('parent.rewards.noRewards')}</AppText> : null}
      {active.map((reward) => {
        const child = state.children.find((c) => c.id === reward.childId);
        return (
          <Card key={reward.id} style={styles.reward}>
            <AppText style={styles.icon}>{reward.icon}</AppText>
            <View style={styles.flex}>
              <AppText variant="heading">{reward.title}</AppText>
              <AppText variant="caption" color={palette.inkSoft}>
                ⭐ {reward.costStars} · {child ? child.firstName : t('common.allChildren')}
              </AppText>
            </View>
            <Button size="sm" variant="secondary" label={t('common.edit')} onPress={() => edit(reward)} />
            <Button size="sm" variant="ghost" label={t('parent.rewards.archive')} onPress={() => dispatch({ type: 'archiveReward', rewardId: reward.id })} />
          </Card>
        );
      })}

      {!atLimit && suggestions.length ? (
        <>
          <SectionHeader title={t('parent.rewards.suggestions')} />
          <ChipRow>
            {suggestions.map((s) => (
              <Chip
                key={s.id}
                icon={s.icon}
                label={`${s.title} · ⭐${s.costStars}`}
                onPress={() => dispatch({ type: 'createReward', title: s.title, icon: s.icon, costStars: s.costStars, childId: null })}
              />
            ))}
          </ChipRow>
        </>
      ) : null}

      {history.length ? <SectionHeader title={t('parent.rewards.history')} /> : null}
      {history.map((request) => {
        const reward = state.rewards.find((r) => r.id === request.rewardId);
        const child = state.children.find((c) => c.id === request.childId);
        return (
          <View key={request.id} style={styles.historyRow}>
            <AppText variant="body" style={styles.flex}>
              {reward?.icon} {reward?.title} – {child?.firstName}
            </AppText>
            <AppText variant="caption" color={request.status === 'confirmed' ? palette.success : palette.inkFaint}>
              {request.status === 'confirmed' ? `${t('parent.rewards.confirmed')} ⭐ ${request.costStars}` : t('parent.rewards.declined')}
            </AppText>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  reward: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { fontSize: 30, lineHeight: 36 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
});
