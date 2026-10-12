import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CHALLENGE_ICONS, EmojiPicker } from '@/components/EmojiPicker';
import { Chip, ChipRow, SectionHeader, TextField, ToggleRow } from '@/components/forms';
import { goBack, Screen } from '@/components/Screen';
import { showToast } from '@/components/Toast';
import { BRANCH_ICONS, BRANCHES } from '@/domain/constants';
import type { BranchId } from '@/domain/types';
import { draftCustomChallenge } from '@/features/ai/aiClient';
import { useT } from '@/lib/i18n';
import { logError } from '@/lib/log';
import { useFamily } from '@/state/game';
import { useDispatch } from '@/state/hooks';
import { palette, space } from '@/theme/tokens';

export default function CustomChallenge() {
  const t = useT();
  const state = useFamily();
  const dispatch = useDispatch();
  const params = useLocalSearchParams<{ child?: string }>();
  const [childId, setChildId] = useState<string | null>(params.child ?? state.children[0]?.id ?? null);
  const [title, setTitle] = useState('');
  const [branch, setBranch] = useState<BranchId>('kropp');
  const [icon, setIcon] = useState('⭐');
  const [tip, setTip] = useState('');
  const [repeatable, setRepeatable] = useState(false);
  const [description, setDescription] = useState('');
  const [thinking, setThinking] = useState(false);
  const child = state.children.find((c) => c.id === childId);

  const create = async () => {
    if (!childId) return;
    const ok = await dispatch(
      { type: 'addCustomChallenge', childId, title, branch, icon, tip: tip.trim() || null, repeatable },
      { success: t('parent.library.added', { name: child?.firstName ?? '' }) },
    );
    if (ok) goBack('/parent');
  };

  const askAi = async () => {
    if (!child || !description.trim()) return;
    setThinking(true);
    try {
      const draft = await draftCustomChallenge(state, child, description.trim());
      if (!draft) {
        showToast(t('parent.ai.empty'));
        return;
      }
      setTitle(draft.titleChild);
      setBranch(draft.branch);
      setIcon(draft.icon);
      setTip(draft.parentTip);
      setRepeatable(draft.repeatable);
    } catch (error) {
      logError('custom.ai', error);
      showToast(t('common.somethingWrong'), 'error');
    } finally {
      setThinking(false);
    }
  };

  return (
    <Screen back="/parent" title={t('parent.custom.title')}>
      <Card tone="primary" style={styles.gap}>
        <AppText variant="heading">✨ {t('parent.custom.aiHelp')}</AppText>
        <AppText variant="caption" color={palette.inkSoft}>
          {t('parent.custom.aiHelpHint')}
        </AppText>
        <TextField
          label={t('parent.custom.aiHelp')}
          placeholder={t('parent.custom.aiPlaceholder')}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={300}
        />
        <Button label={t('parent.custom.aiSuggest')} variant="secondary" onPress={askAi} loading={thinking} disabled={!description.trim()} />
      </Card>

      <SectionHeader title={t('parent.custom.forChild')} />
      <ChipRow>
        {state.children.map((c) => (
          <Chip key={c.id} label={c.firstName} selected={childId === c.id} onPress={() => setChildId(c.id)} />
        ))}
      </ChipRow>

      <TextField
        label={t('parent.custom.name')}
        placeholder={t('parent.custom.namePlaceholder')}
        value={title}
        onChangeText={setTitle}
        maxLength={80}
        testID="custom-title"
      />
      <View style={styles.gap}>
        <AppText variant="label" color={palette.inkSoft}>
          {t('parent.custom.branch')}
        </AppText>
        <ChipRow>
          {BRANCHES.map((b) => (
            <Chip key={b} icon={BRANCH_ICONS[b]} label={t(`branches.${b}`)} selected={branch === b} onPress={() => setBranch(b)} />
          ))}
        </ChipRow>
      </View>
      <View style={styles.gap}>
        <AppText variant="label" color={palette.inkSoft}>
          {t('parent.custom.icon')}
        </AppText>
        <EmojiPicker label={t('parent.custom.icon')} value={icon} onChange={setIcon} options={CHALLENGE_ICONS} />
      </View>
      <TextField label={t('parent.custom.tip')} value={tip} onChangeText={setTip} multiline maxLength={300} />
      <ToggleRow label={t('parent.custom.repeatable')} value={repeatable} onChange={setRepeatable} />
      <Button label={t('parent.custom.create')} onPress={create} disabled={!title.trim() || !childId} size="lg" testID="custom-create" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.sm },
});
