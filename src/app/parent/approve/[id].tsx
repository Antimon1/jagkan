import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/forms';
import { goBack, Screen } from '@/components/Screen';
import { showToast } from '@/components/Toast';
import { catalog } from '@/data/catalog';
import { challengeView, findChild } from '@/domain/selectors';
import { canEarnBonusStar } from '@/domain/stars';
import { ChildAvatar } from '@/features/children/ChildAvatar';
import { EggArt } from '@/features/creatures/EggArt';
import { useT } from '@/lib/i18n';
import { pickMedia, saveMediaForCompletion, type PickedMedia } from '@/lib/media';
import { playSound } from '@/lib/sound';
import { useFamily } from '@/state/game';
import { useDispatch } from '@/state/hooks';
import { palette, radius, space } from '@/theme/tokens';

/**
 * Approval card (spec 6.3). Reached from the push notification, so approving
 * takes at most 2 taps: open the notification, tap "Godkänn".
 */
export default function Approve() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useFamily();
  const dispatch = useDispatch();
  const [note, setNote] = useState('');
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [busy, setBusy] = useState(false);
  const challenge = state.challenges.find((c) => c.id === id);
  const child = challenge ? findChild(state, challenge.childId) : undefined;

  if (!challenge || !child) {
    return (
      <Screen back="/parent" title={t('parent.approve.title')}>
        <AppText>{t('errors.not_found')}</AppText>
      </Screen>
    );
  }

  const view = challengeView(catalog, challenge, canEarnBonusStar(state, catalog, challenge));
  const attempts = state.attempts.filter((a) => a.childChallengeId === challenge.id).length;
  const open = challenge.status === 'active' || challenge.status === 'requested';
  const praise = view.reward === 'praise';

  const approve = async () => {
    setBusy(true);
    const result = await dispatch({ type: 'approveCompletion', challengeId: challenge.id, note: note.trim() || null });
    if (result) {
      const completed = result.events.find((e) => e.type === 'challenge_completed');
      if (media && completed && completed.type === 'challenge_completed') {
        await saveMediaForCompletion(completed.completionId, media);
      }
      playSound('chime');
      showToast(t(praise ? 'parent.approve.approvedPraise' : 'parent.approve.approved', { name: child.firstName }), 'success');
      goBack('/parent');
    }
    setBusy(false);
  };

  const spark = async () => {
    const ok = await dispatch({ type: 'giveSpark', challengeId: challenge.id }, { success: t('parent.approve.sparkHint') });
    if (ok) goBack('/parent');
  };

  return (
    <Screen back="/parent" title={t('parent.approve.title')}>
      <Card style={styles.card}>
        <View style={styles.row}>
          <ChildAvatar child={child} state={state} size={52} />
          <View style={styles.flex}>
            <AppText variant="label" color={palette.inkSoft}>
              {t('parent.overview.says', { name: child.firstName })}
            </AppText>
            <AppText variant="title">{view.parentTitle}</AppText>
          </View>
        </View>
        <View style={styles.egg}>
          <EggArt world={child.world} charge={view.charge} waiting={challenge.status === 'requested'} icon={view.icon} size={110} />
        </View>
        <AppText variant="caption" color={palette.inkSoft} align="center">
          {t('parent.approve.attempts', { count: attempts })} · 🔥 {challenge.sparks} · {t(`branches.${challenge.branch}`)}
        </AppText>
        {praise ? (
          <AppText variant="caption" color={palette.inkSoft} align="center">
            💛 {t('parent.approve.praiseHint')}
          </AppText>
        ) : null}
      </Card>

      {open ? (
        <>
          <Button label={t(praise ? 'parent.approve.approvePraise' : 'parent.approve.approve')} variant="star" size="lg" onPress={approve} loading={busy} testID="approve-confirm" />
          <TextField
            label={t('parent.approve.noteLabel')}
            placeholder={t('parent.approve.notePlaceholder')}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={300}
          />
          <View style={styles.row}>
            <Button label={`📷 ${t('parent.approve.photo')}`} variant="secondary" style={styles.flex} onPress={async () => setMedia((await pickMedia('camera')) ?? media)} />
            <Button label={`🖼️ ${t('parent.approve.video')}`} variant="secondary" style={styles.flex} onPress={async () => setMedia((await pickMedia('library')) ?? media)} />
          </View>
          {media ? (
            <View style={styles.preview}>
              {media.type === 'image' ? <Image source={{ uri: media.uri }} style={styles.image} /> : <AppText>🎬</AppText>}
              <AppText variant="caption" color={palette.inkSoft} style={styles.flex}>
                🔒 {t('parent.approve.photoSaved')}
              </AppText>
            </View>
          ) : null}
          <Button label={t('parent.approve.sparkInstead')} variant="spark" onPress={spark} />
        </>
      ) : (
        <Button label={t('common.close')} variant="secondary" onPress={() => router.replace('/parent')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  egg: { alignItems: 'center' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  image: { width: 72, height: 72, borderRadius: radius.md },
});
