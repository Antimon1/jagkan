import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow, TextField } from '@/components/forms';
import { catalog } from '@/data/catalog';
import { childAge } from '@/domain/age';
import { BRANCH_ICONS, BRANCHES } from '@/domain/constants';
import { searchLibrary } from '@/domain/library';
import { familyLimits } from '@/domain/plan';
import type { BranchId, ChallengeTemplate, FamilyState } from '@/domain/types';
import { useT } from '@/lib/i18n';
import { useFamily } from '@/state/game';
import { useDispatch, useNow } from '@/state/hooks';
import { palette, radius, space } from '@/theme/tokens';

export default function Library() {
  const t = useT();
  const state = useFamily();
  const now = useNow();
  const params = useLocalSearchParams<{ child?: string }>();
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState<BranchId | null>(null);
  const [childFilter, setChildFilter] = useState<string | null>(params.child ?? state.children[0]?.id ?? null);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | null>(null);
  const limits = familyLimits(state);
  const tz = state.family.settings.timeZone;
  const filterChild = state.children.find((c) => c.id === childFilter);
  const age = filterChild ? childAge(filterChild, now, tz) : null;

  const results = useMemo(
    () => searchLibrary(catalog, { query, branch, age, difficulty, includePlus: true }),
    [query, branch, age, difficulty],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText variant="title" accessibilityRole="header">
              {t('parent.library.title')}
            </AppText>
            <TextField label={t('parent.library.search')} value={query} onChangeText={setQuery} placeholder="🔍" />
            <ChipRow>
              <Chip label={t('parent.library.anyAge')} selected={childFilter === null} onPress={() => setChildFilter(null)} />
              {state.children.map((child) => (
                <Chip
                  key={child.id}
                  label={`${child.firstName} (${childAge(child, now, tz)})`}
                  selected={childFilter === child.id}
                  onPress={() => setChildFilter(child.id)}
                />
              ))}
            </ChipRow>
            <ChipRow>
              <Chip label={t('parent.library.all')} selected={branch === null} onPress={() => setBranch(null)} />
              {BRANCHES.map((b) => (
                <Chip key={b} icon={BRANCH_ICONS[b]} label={t(`branches.${b}`)} selected={branch === b} onPress={() => setBranch(branch === b ? null : b)} />
              ))}
            </ChipRow>
            <ChipRow>
              {([1, 2, 3] as const).map((d) => (
                <Chip key={d} label={t(`difficulty.${d}`)} selected={difficulty === d} onPress={() => setDifficulty(difficulty === d ? null : d)} />
              ))}
            </ChipRow>
            <View style={styles.countRow}>
              <AppText variant="caption" color={palette.inkSoft}>
                {t('parent.library.count', { count: results.length })}
              </AppText>
              <Button size="sm" variant="ghost" label={`✏️ ${t('parent.library.createOwn')}`} onPress={() => router.push({ pathname: '/parent/custom', params: childFilter ? { child: childFilter } : {} })} />
            </View>
            {!limits.fullLibrary ? (
              <Card tone="plus" onPress={() => router.push('/parent/paywall')}>
                <AppText variant="bodyStrong">🔓 {t('parent.library.plusLocked')}</AppText>
              </Card>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <LibraryItem template={item} state={state} locked={item.isPlus && !limits.fullLibrary} />}
      />
    </SafeAreaView>
  );
}

function LibraryItem({ template, state, locked }: { template: ChallengeTemplate; state: FamilyState; locked: boolean }) {
  const t = useT();
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.item, locked ? styles.locked : null]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={template.titleParent}
        onPress={() => setOpen((v) => !v)}
        style={styles.itemHeader}>
        <AppText style={styles.icon}>{template.icon}</AppText>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{template.titleChild}</AppText>
          <AppText variant="caption" color={palette.inkSoft}>
            {t('parent.library.ages', { min: template.ageMin, max: template.ageMax })} · {t(`difficulty.${template.difficulty}`)}
            {template.repeatable ? ' · 🔁' : ''}
            {template.reward === 'praise' ? ` · 💛 ${t('parent.library.praise')}` : ''}
          </AppText>
        </View>
        {locked ? (
          <AppText variant="label" color={palette.plus}>
            🔒 {t('common.plus')}
          </AppText>
        ) : null}
      </Pressable>
      {open ? (
        <View style={styles.itemBody}>
          <AppText variant="body">{template.titleParent}</AppText>
          <AppText variant="caption" color={palette.inkSoft}>
            💡 {template.parentTip}
          </AppText>
          {locked ? (
            <Button size="sm" variant="plus" label={t('parent.more.plus')} onPress={() => router.push('/parent/paywall')} />
          ) : (
            <View style={styles.actions}>
              {state.children.map((child) => {
                const has = state.challenges.some(
                  (c) => c.childId === child.id && c.templateId === template.id && c.status !== 'archived',
                );
                return (
                  <Button
                    key={child.id}
                    size="sm"
                    variant={has ? 'secondary' : 'primary'}
                    disabled={has}
                    label={has ? `✓ ${child.firstName}` : t('parent.library.addFor', { name: child.firstName })}
                    onPress={() =>
                      dispatch(
                        { type: 'activateTemplate', childId: child.id, templateId: template.id },
                        { success: t('parent.library.added', { name: child.firstName }) },
                      )
                    }
                  />
                );
              })}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  flex: { flex: 1 },
  list: { padding: space.lg, gap: space.sm, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { gap: space.md, marginBottom: space.sm },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  item: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.line,
  },
  locked: { opacity: 0.75 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  icon: { fontSize: 28, lineHeight: 34 },
  itemBody: { paddingHorizontal: space.md, paddingBottom: space.md, gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
