import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BarChart, HorizontalBars } from '@/components/BarChart';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow, SectionHeader } from '@/components/forms';
import { Screen } from '@/components/Screen';
import { catalog } from '@/data/catalog';
import { childAge, worldForAge } from '@/domain/age';
import { weeklyHistory } from '@/domain/competitions';
import { BRANCHES, WORLDS } from '@/domain/constants';
import { suggestFromLibrary } from '@/domain/library';
import { familyLimits } from '@/domain/plan';
import { albumFor, branchStats, challengesByStatus, findChild, ownedCount } from '@/domain/selectors';
import { spendableStars, totalStars } from '@/domain/stars';
import type { FamilyState, WorldId } from '@/domain/types';
import { ChildAvatar } from '@/features/children/ChildAvatar';
import { ChildForm } from '@/features/children/ChildForm';
import { ChallengeRow } from '@/features/parent/ChallengeRow';
import { startChildMode } from '@/features/parent/handoff';
import { confirmAsync } from '@/lib/confirm';
import { useT } from '@/lib/i18n';
import { useFamily } from '@/state/game';
import { useDispatch, useNow } from '@/state/hooks';
import { BRANCH_COLORS, palette, space } from '@/theme/tokens';

type Tab = 'active' | 'suggested' | 'completed' | 'stats';

function NewChild() {
  const t = useT();
  const dispatch = useDispatch();
  return (
    <Screen back="/parent/children" title={t('onboarding.addChild')} subtitle={t('onboarding.childrenHint')}>
      <Card>
        <ChildForm
          submitLabel={t('onboarding.addChild')}
          onSubmit={async (value) => {
            const result = await dispatch({ type: 'addChild', ...value });
            const added = result?.state.children[result.state.children.length - 1];
            if (added) router.replace({ pathname: '/parent/child/[id]', params: { id: added.id } });
          }}
        />
      </Card>
    </Screen>
  );
}

export default function ChildPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useFamily();
  if (id === 'new') return <NewChild />;
  const child = findChild(state, id);
  if (!child) return <Missing />;
  return <ChildDetails state={state} childId={child.id} />;
}

function Missing() {
  const t = useT();
  return (
    <Screen back="/parent/children" title="">
      <AppText>{t('errors.not_found')}</AppText>
    </Screen>
  );
}

function ChildDetails({ state, childId }: { state: FamilyState; childId: string }) {
  const t = useT();
  const dispatch = useDispatch();
  const now = useNow();
  const [tab, setTab] = useState<Tab>('active');
  const [editing, setEditing] = useState(false);
  const child = findChild(state, childId);
  const limits = familyLimits(state);

  const libraryIdeas = useMemo(
    () => (child ? suggestFromLibrary(state, catalog, child, now, 4, limits.fullLibrary) : []),
    [state, child, now, limits.fullLibrary],
  );
  if (!child) return null;

  const active = challengesByStatus(state, catalog, child.id, ['requested', 'active', 'paused']);
  const suggested = challengesByStatus(state, catalog, child.id, ['suggested']);
  const album = albumFor(state, catalog, child.id);
  const stats = branchStats(state, child.id);
  const history = weeklyHistory(state, child.id, now, 8);
  const age = childAge(child, now, state.family.settings.timeZone);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'active', label: `${t('parent.child.active')} (${active.length})` },
    { key: 'suggested', label: t('parent.child.suggested') },
    { key: 'completed', label: `${t('parent.child.completed')} (${album.length})` },
    { key: 'stats', label: t('parent.child.stats') },
  ];

  return (
    <Screen back="/parent/children" title={child.firstName} subtitle={`${age} år · ${t(`worlds.${child.world}`)}`}>
      <Card style={styles.hero}>
        <ChildAvatar child={child} state={state} size={72} />
        <View style={styles.heroStats}>
          <Metric value={totalStars(state, child.id)} label={t('parent.child.totalStars')} />
          <Metric value={spendableStars(state, child.id)} label={t('parent.child.spendable')} />
          <Metric value={ownedCount(state, child.id)} label={t('parent.child.creatures')} />
        </View>
      </Card>
      <Button label={`🧒 ${t('parent.overview.childMode')}`} variant="secondary" onPress={() => startChildMode(state, child.id)} />

      <ChipRow>
        {tabs.map((item) => (
          <Chip key={item.key} label={item.label} selected={tab === item.key} onPress={() => setTab(item.key)} />
        ))}
      </ChipRow>

      {tab === 'active' ? (
        <View style={styles.list}>
          <View style={styles.addRow}>
            <Button size="sm" label={`📚 ${t('parent.child.fromLibrary')}`} onPress={() => router.push({ pathname: '/parent/library', params: { child: child.id } })} />
            <Button size="sm" variant="secondary" label={`✏️ ${t('parent.child.custom')}`} onPress={() => router.push({ pathname: '/parent/custom', params: { child: child.id } })} />
            <Button size="sm" variant="secondary" label={`✨ ${t('parent.child.ai')}`} onPress={() => router.push({ pathname: '/parent/ai', params: { child: child.id } })} />
          </View>
          {active.length === 0 ? <AppText color={palette.inkSoft}>{t('parent.overview.noChallenges')}</AppText> : null}
          {active.map((view) => (
            <ChallengeRow key={view.challenge.id} view={view} childName={child.firstName} />
          ))}
        </View>
      ) : null}

      {tab === 'suggested' ? (
        <View style={styles.list}>
          {suggested.map((view) => (
            <ChallengeRow key={view.challenge.id} view={view} childName={child.firstName} />
          ))}
          <SectionHeader title={t('parent.child.suggestions')} />
          {libraryIdeas.map((template) => (
            <Card key={template.id} style={styles.idea}>
              <AppText style={styles.ideaIcon}>{template.icon}</AppText>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{template.titleParent}</AppText>
                <AppText variant="caption" color={palette.inkSoft}>
                  {t(`branches.${template.branch}`)} · {t(`difficulty.${template.difficulty}`)}
                </AppText>
              </View>
              <Button
                size="sm"
                label={t('common.add')}
                onPress={() =>
                  dispatch(
                    { type: 'activateTemplate', childId: child.id, templateId: template.id },
                    { success: t('parent.library.added', { name: child.firstName }) },
                  )
                }
              />
            </Card>
          ))}
        </View>
      ) : null}

      {tab === 'completed' ? (
        <View style={styles.list}>
          {album.length === 0 ? <AppText color={palette.inkSoft}>{t('parent.child.noneHere')}</AppText> : null}
          {album.map((entry) => (
            <Card key={entry.completion.id} style={styles.completed}>
              <AppText variant="bodyStrong">
                {entry.icon} {entry.title}
              </AppText>
              <AppText variant="caption" color={palette.inkSoft}>
                {new Date(entry.completion.approvedAt).toLocaleDateString('sv-SE')}
                {entry.creature ? ` · ${entry.creature.emoji} ${entry.creature.name}` : ''}
              </AppText>
              <AppText variant="body">{entry.completion.cardText}</AppText>
            </Card>
          ))}
          {album.length > 0 ? (
            <Button variant="secondary" label={t('parent.child.album')} onPress={() => router.push({ pathname: '/parent/album', params: { child: child.id } })} />
          ) : null}
        </View>
      ) : null}

      {tab === 'stats' ? (
        <View style={styles.list}>
          <Card style={styles.gap}>
            <SectionHeader title={t('parent.child.weeks')} />
            <BarChart
              bars={history.map((week, i) => ({
                key: week.weekStart,
                label: week.weekStart.slice(5).replace('-', '/'),
                value: week.stars,
                highlight: i === history.length - 1,
              }))}
            />
          </Card>
          <Card style={styles.gap}>
            <SectionHeader title={t('parent.child.perBranch')} />
            <HorizontalBars
              bars={BRANCHES.map((branch) => ({
                key: branch,
                label: t(`branches.${branch}`),
                value: stats[branch],
                color: BRANCH_COLORS[branch],
              }))}
            />
          </Card>
          <Card style={styles.gap}>
            <SectionHeader title={t('parent.child.world')} />
            <ChipRow>
              {WORLDS.map((world: WorldId) => {
                const allowed = limits.allWorlds || world === worldForAge(age);
                return (
                  <Chip
                    key={world}
                    label={t(`worlds.${world}`)}
                    selected={child.world === world}
                    disabled={!allowed}
                    onPress={() => dispatch({ type: 'changeWorld', childId: child.id, world })}
                  />
                );
              })}
            </ChipRow>
            {!limits.allWorlds ? (
              <AppText variant="caption" color={palette.inkFaint}>
                {t('parent.child.worldFree')}
              </AppText>
            ) : null}
          </Card>
          {editing ? (
            <Card>
              <ChildForm
                initial={{ firstName: child.firstName, birthYear: child.birthYear, birthMonth: child.birthMonth }}
                submitLabel={t('common.save')}
                onSubmit={async (value) => {
                  const ok = await dispatch({ type: 'updateChild', childId: child.id, ...value });
                  if (ok) setEditing(false);
                }}
              />
            </Card>
          ) : (
            <Button variant="secondary" label={t('parent.child.edit')} onPress={() => setEditing(true)} />
          )}
          <Button
            variant="danger"
            label={t('parent.child.remove')}
            onPress={async () => {
              if (!(await confirmAsync(t('parent.child.removeConfirm', { name: child.firstName })))) return;
              const ok = await dispatch({ type: 'removeChild', childId: child.id });
              if (ok) router.replace('/parent/children');
            }}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.metric}>
      <AppText variant="display">{value}</AppText>
      <AppText variant="caption" color={palette.inkSoft}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  heroStats: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  metric: { alignItems: 'center' },
  list: { gap: space.md },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  idea: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ideaIcon: { fontSize: 28, lineHeight: 34 },
  completed: { gap: space.xs },
  gap: { gap: space.md },
});
