import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { SpeakButton } from '@/components/SpeakButton';
import { shopFor } from '@/domain/selectors';
import { availableStars } from '@/domain/stars';
import { BigButton } from '@/features/child/BigButton';
import { ChildChrome } from '@/features/child/ChildChrome';
import { useActiveChild } from '@/features/child/useActiveChild';
import { useT } from '@/lib/i18n';
import { playSound } from '@/lib/sound';
import { speak } from '@/lib/speech';
import { useDispatch } from '@/state/hooks';
import { radius, shadow, space } from '@/theme/tokens';

/** The reward shop in the child view (spec 7). Affordable rewards are highlighted. */
export default function Shop() {
  const t = useT();
  const active = useActiveChild();
  const dispatch = useDispatch();
  if (!active) return null;
  const { state, child, theme } = active;
  const items = shopFor(state, child.id);
  const balance = availableStars(state, child.id);

  return (
    <ChildChrome active={active} title={t('child.shop.title')}>
      <View style={[styles.balance, { backgroundColor: theme.surface }]}>
        <AppText variant="childTitle" color={theme.ink} style={styles.flex}>
          {t('child.shop.balance', { count: balance })}
        </AppText>
        <SpeakButton text={t('child.shop.balance', { count: balance })} background={theme.surfaceSunk} color={theme.ink} />
      </View>
      {items.length === 0 ? (
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <AppText style={styles.icon}>🎁</AppText>
          <AppText variant="heading" color={theme.ink} align="center">
            {t('child.shop.empty')}
          </AppText>
        </View>
      ) : null}
      {items.map(({ reward, affordable, pending }) => {
        const missing = reward.costStars - balance;
        return (
          <View
            key={reward.id}
            style={[
              styles.card,
              shadow.card,
              { backgroundColor: theme.surface, borderColor: affordable ? theme.primary : 'transparent' },
            ]}>
            <View style={styles.row}>
              <AppText style={styles.icon}>{reward.icon}</AppText>
              <View style={styles.flex}>
                <AppText variant="childBig" color={theme.ink}>
                  {reward.title}
                </AppText>
                <AppText variant="heading" color={theme.inkSoft}>
                  ⭐ {reward.costStars}
                </AppText>
              </View>
              <SpeakButton text={`${reward.title}. ${t('common.starsLabel', { count: reward.costStars })}.`} size={44} background={theme.surfaceSunk} color={theme.ink} />
            </View>
            {pending ? (
              <AppText variant="heading" color={theme.inkSoft} align="center">
                ⏳ {t('child.shop.pending')}
              </AppText>
            ) : affordable ? (
              <BigButton
                size="lg"
                emoji="🙌"
                label={t('child.shop.want')}
                color={theme.primary}
                textColor={theme.onPrimary}
                onPress={async () => {
                  const ok = await dispatch({ type: 'requestReward', rewardId: reward.id, childId: child.id });
                  if (ok) {
                    playSound('coin');
                    speak(t('child.shop.sent'));
                  }
                }}
              />
            ) : (
              <AppText variant="heading" color={theme.inkSoft} align="center">
                {t('child.shop.saveMore', { count: missing })}
              </AppText>
            )}
          </View>
        );
      })}
    </ChildChrome>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  balance: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.xl, padding: space.lg, gap: space.md },
  card: { borderRadius: radius.xl, padding: space.lg, gap: space.md, borderWidth: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { fontSize: 48, lineHeight: 58 },
});
