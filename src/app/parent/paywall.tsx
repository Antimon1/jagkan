import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { requestParentAccess } from '@/components/ParentGate';
import { goBack, Screen } from '@/components/Screen';
import { showToast } from '@/components/Toast';
import { useT } from '@/lib/i18n';
import {
  configurePurchases,
  getPlusOffers,
  purchasePlus,
  purchasesAvailable,
  restorePlus,
  type PlusOffer,
} from '@/lib/purchases';
import { useFamily, useGameStore } from '@/state/game';
import { palette, radius, space } from '@/theme/tokens';

const FEATURES = ['children', 'library', 'worlds', 'rewards', 'competitions', 'export'] as const;
const FEATURE_ICONS: Record<(typeof FEATURES)[number], string> = {
  children: '👨‍👩‍👧‍👦',
  library: '📚',
  worlds: '🌍',
  rewards: '🎁',
  competitions: '🏆',
  export: '💾',
};

/** Plus (spec 13). Buying is behind the parental gate. Prices come from the stores, not the code. */
export default function Paywall() {
  const t = useT();
  const state = useFamily();
  const backendKind = useGameStore((s) => s.backend?.kind);
  const [offers, setOffers] = useState<PlusOffer[]>([]);
  const [busy, setBusy] = useState(false);
  const canBuy = purchasesAvailable();

  useEffect(() => {
    if (!canBuy) return;
    configurePurchases(state.family.id);
    getPlusOffers().then(setOffers).catch(() => setOffers([]));
  }, [canBuy, state.family.id]);

  const activate = async (active: boolean) => {
    const game = useGameStore.getState();
    if (backendKind === 'local') await game.dispatchSystem({ type: 'setPlus', active });
    else await game.refresh(); // cloud: the RevenueCat webhook updates the family
  };

  const buy = async (offer: PlusOffer) => {
    if (!(await requestParentAccess())) return;
    setBusy(true);
    const ok = await purchasePlus(offer);
    setBusy(false);
    if (ok) {
      await activate(true);
      showToast(t('paywall.thanks'), 'success');
      goBack('/parent');
    }
  };

  const restore = async () => {
    if (!(await requestParentAccess())) return;
    setBusy(true);
    const ok = await restorePlus();
    setBusy(false);
    if (ok) {
      await activate(true);
      showToast(t('paywall.thanks'), 'success');
    }
  };

  return (
    <Screen back="/parent/more" title={t('paywall.title')} subtitle={t('paywall.subtitle')}>
      <Card tone="plus" style={styles.features}>
        {FEATURES.map((key) => (
          <View key={key} style={styles.feature}>
            <AppText style={styles.icon}>{FEATURE_ICONS[key]}</AppText>
            <AppText variant="bodyStrong" style={styles.flex}>
              {t(`paywall.features.${key}`)}
            </AppText>
          </View>
        ))}
      </Card>

      {state.family.plusActive ? (
        <Card tone="success">
          <AppText variant="heading" color={palette.success}>
            ✅ {t('parent.settings.plusActive')}
          </AppText>
        </Card>
      ) : null}

      {canBuy && offers.length > 0
        ? offers.map((offer) => (
            <Button
              key={offer.pkg.identifier}
              variant="plus"
              size="lg"
              loading={busy}
              label={`${t('paywall.buy')} · ${offer.priceString}${offer.period === 'month' ? '/mån' : offer.period === 'year' ? '/år' : ''}`}
              onPress={() => buy(offer)}
            />
          ))
        : null}
      {canBuy ? <Button variant="ghost" label={t('paywall.restore')} onPress={restore} loading={busy} /> : null}

      {!canBuy ? (
        <View style={styles.demo}>
          <AppText variant="caption" color={palette.inkSoft} align="center">
            {t('paywall.notAvailable')}
          </AppText>
          {backendKind === 'local' ? (
            <Button
              variant={state.family.plusActive ? 'secondary' : 'plus'}
              label={state.family.plusActive ? `${t('parent.settings.demoPlus')}: ${t('common.yes')}` : t('paywall.demoToggle')}
              onPress={async () => {
                if (!(await requestParentAccess())) return;
                await activate(!state.family.plusActive);
              }}
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  features: { gap: space.md, borderRadius: radius.xl },
  feature: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { fontSize: 24, lineHeight: 30, width: 34, textAlign: 'center' },
  demo: { gap: space.md },
});
