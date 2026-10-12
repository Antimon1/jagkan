import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { SectionHeader } from '@/components/forms';
import { Screen } from '@/components/Screen';
import { catalog } from '@/data/catalog';
import { suggestFromLibrary } from '@/domain/library';
import { familyLimits } from '@/domain/plan';
import { useT } from '@/lib/i18n';
import { useFamily } from '@/state/game';
import { useDispatch } from '@/state/hooks';
import { palette, radius, space } from '@/theme/tokens';

const STARTERS_PER_CHILD = 3;

export default function StarterStep() {
  const t = useT();
  const state = useFamily();
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);
  const suggestions = useMemo(() => {
    const now = new Date().toISOString();
    const includePlus = familyLimits(state).fullLibrary;
    return state.children.map((child) => ({
      child,
      templates: suggestFromLibrary(state, catalog, child, now, STARTERS_PER_CHILD, includePlus),
    }));
    // Suggestions are picked once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(suggestions.flatMap((s) => s.templates.map((tpl) => `${s.child.id}:${tpl.id}`))),
  );

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const finish = async () => {
    setBusy(true);
    for (const key of selected) {
      const [childId, templateId] = key.split(':');
      await dispatch({ type: 'activateTemplate', childId, templateId }, { quiet: true });
    }
    setBusy(false);
    router.push('/onboarding/finish');
  };

  return (
    <Screen
      back
      title={t('onboarding.starterTitle')}
      subtitle={t('onboarding.starterHint')}
      footer={<Button label={t('common.next')} onPress={finish} loading={busy} testID="starter-next" />}>
      {suggestions.map(({ child, templates }) => (
        <View key={child.id} style={styles.group}>
          <SectionHeader title={child.firstName} />
          {templates.map((template) => {
            const key = `${child.id}:${template.id}`;
            const on = selected.has(key);
            return (
              <Pressable
                key={key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={template.titleParent}
                onPress={() => toggle(key)}
                style={[styles.item, on ? styles.itemOn : null]}>
                <AppText style={styles.icon}>{template.icon}</AppText>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{template.titleChild}</AppText>
                  <AppText variant="caption" color={palette.inkSoft}>
                    {t(`branches.${template.branch}`)}
                  </AppText>
                </View>
                <View style={[styles.check, on ? styles.checkOn : null]}>
                  {on ? (
                    <AppText variant="label" color="#FFFFFF">
                      ✓
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: space.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderColor: palette.line,
  },
  itemOn: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  icon: { fontSize: 28, lineHeight: 34 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: palette.primary, borderColor: palette.primary },
});
