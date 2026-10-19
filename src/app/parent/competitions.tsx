import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BarChart } from '@/components/BarChart';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ProgressBar, SectionHeader, Stepper, TextField, ToggleRow } from '@/components/forms';
import { Screen } from '@/components/Screen';
import { duelScores, handicapFor, selfStats } from '@/domain/competitions';
import { familyLimits } from '@/domain/plan';
import { familyGoalView, lastReachedGoal } from '@/domain/selectors';
import { weekStartKey } from '@/domain/time';
import { ChildAvatar } from '@/features/children/ChildAvatar';
import { useT } from '@/lib/i18n';
import { useFamily } from '@/state/game';
import { useDispatch, useNow } from '@/state/hooks';
import { palette, space } from '@/theme/tokens';

export default function Competitions() {
  const t = useT();
  const state = useFamily();
  const dispatch = useDispatch();
  const now = useNow();
  const limits = familyLimits(state);
  const { competitions } = state;
  const goal = familyGoalView(state, now);
  const reached = lastReachedGoal(state);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState(20);
  const [reward, setReward] = useState('');
  const week = weekStartKey(now, state.family.settings.timeZone);
  const standings = duelScores(state, week);
  const history = [...state.weeklyResults].sort((a, b) => b.weekStart.localeCompare(a.weekStart)).slice(0, 6);

  return (
    <Screen back="/parent/more" title={t('parent.competitions.title')}>
      {!limits.plus ? (
        <Card tone="plus" onPress={() => router.push('/parent/paywall')}>
          <AppText variant="body">🔓 {t('parent.paywall.features.competitions')} – {t('common.plusOnly')}</AppText>
        </Card>
      ) : null}

      <SectionHeader title={`🎯 ${t('parent.competitions.familyGoal')}`} />
      <Card style={styles.gap}>
        <AppText variant="caption" color={palette.inkSoft}>
          {t('parent.competitions.familyGoalHint')}
        </AppText>
        {goal ? (
          <>
            <AppText variant="heading">{goal.goal.title}</AppText>
            <ProgressBar ratio={goal.ratio} color={palette.primary} height={14} />
            <AppText variant="caption" color={palette.inkSoft}>
              {t('parent.competitions.goalProgress', { progress: goal.progress, target: goal.goal.targetStars })} · {goal.goal.rewardText}
            </AppText>
            <Button size="sm" variant="ghost" label={t('parent.competitions.cancelGoal')} onPress={() => dispatch({ type: 'cancelFamilyGoal', goalId: goal.goal.id })} />
          </>
        ) : (
          <>
            {reached ? (
              <AppText variant="bodyStrong" color={palette.success}>
                {t('parent.competitions.goalReached')} {reached.title} – {reached.rewardText}
              </AppText>
            ) : null}
            <TextField label={t('parent.competitions.goalTitle')} placeholder={t('parent.competitions.goalTitlePlaceholder')} value={title} onChangeText={setTitle} maxLength={60} />
            <Stepper label={t('parent.competitions.goalTarget')} value={target} min={5} max={200} step={5} onChange={setTarget} format={(v) => `⭐ ${v}`} />
            <TextField label={t('parent.competitions.goalReward')} placeholder={t('parent.competitions.goalRewardPlaceholder')} value={reward} onChangeText={setReward} maxLength={60} />
            <Button
              label={t('parent.competitions.startGoal')}
              disabled={!limits.familyGoal || !title.trim() || !reward.trim()}
              onPress={async () => {
                const ok = await dispatch({ type: 'setFamilyGoal', title, targetStars: target, rewardText: reward });
                if (ok) {
                  setTitle('');
                  setReward('');
                }
              }}
            />
          </>
        )}
      </Card>

      <SectionHeader title={`🏆 ${t('parent.competitions.duel')}`} />
      <Card style={styles.gap}>
        <ToggleRow
          label={t('parent.competitions.duel')}
          hint={state.children.length < 2 ? t('parent.competitions.needTwo') : t('parent.competitions.duelHint')}
          value={competitions.siblingDuelEnabled}
          disabled={!limits.siblingDuel || state.children.length < 2}
          onChange={(value) => dispatch({ type: 'updateCompetitions', siblingDuelEnabled: value })}
        />
        {competitions.siblingDuelEnabled ? (
          <>
            {state.children.map((child) => (
              <Stepper
                key={child.id}
                label={t('parent.competitions.handicap', { name: child.firstName })}
                value={handicapFor(state, child.id)}
                min={1}
                max={3}
                step={0.5}
                format={(v) => `×${v.toLocaleString('sv-SE')}`}
                onChange={(value) => dispatch({ type: 'updateCompetitions', handicaps: { [child.id]: value } })}
              />
            ))}
            <AppText variant="label" color={palette.inkSoft}>
              {t('parent.competitions.standings')}
            </AppText>
            {standings.map((s, i) => {
              const child = state.children.find((c) => c.id === s.childId);
              if (!child) return null;
              return (
                <View key={s.childId} style={styles.row}>
                  <AppText variant="heading" style={styles.rank}>
                    {i === 0 && s.score > 0 ? '🏆' : `${i + 1}.`}
                  </AppText>
                  <ChildAvatar child={child} state={state} size={36} />
                  <AppText variant="bodyStrong" style={styles.flex}>
                    {child.firstName}
                  </AppText>
                  <AppText variant="bodyStrong">
                    ⭐ {s.stars} {s.score !== s.stars ? `→ ${s.score}` : ''}
                  </AppText>
                </View>
              );
            })}
          </>
        ) : null}
      </Card>

      <SectionHeader title={`📈 ${t('parent.competitions.self')}`} />
      <Card style={styles.gap}>
        <ToggleRow
          label={t('parent.competitions.self')}
          hint={t('parent.competitions.selfHint')}
          value={competitions.selfModeEnabled}
          onChange={(value) => dispatch({ type: 'updateCompetitions', selfModeEnabled: value })}
        />
        {state.children.map((child) => {
          const stats = selfStats(state, child.id, now);
          return (
            <View key={child.id} style={styles.gap}>
              <AppText variant="bodyStrong">
                {child.firstName}: ⭐ {stats.thisWeek} · {t('child.week.record', { count: stats.record })}
              </AppText>
              <BarChart
                height={70}
                bars={stats.history.slice(-8).map((w, i, arr) => ({
                  key: w.weekStart,
                  label: w.weekStart.slice(5).replace('-', '/'),
                  value: w.stars,
                  highlight: i === arr.length - 1,
                }))}
              />
            </View>
          );
        })}
      </Card>

      {history.length ? <SectionHeader title={t('parent.competitions.history')} /> : null}
      {history.map((weekResult) => (
        <Card key={weekResult.id} tone="sunk" style={styles.gap}>
          <AppText variant="label" color={palette.inkSoft}>
            {t('parent.competitions.weekOf', { date: weekResult.weekStart })}
          </AppText>
          {weekResult.results.map((r) => {
            const child = state.children.find((c) => c.id === r.childId);
            return child ? (
              <AppText key={r.childId} variant="body">
                {r.isWinner ? '🏆 ' : ''}
                {child.firstName}: ⭐ {r.stars}
                {r.isRecord ? ` · ${t('child.week.newRecord')}` : ''}
              </AppText>
            ) : null;
          })}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rank: { width: 32 },
});
