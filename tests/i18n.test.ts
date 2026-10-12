import { t } from '@/lib/i18n';
import { sv } from '@/lib/i18n/sv';

/** Words that signal losing or failing. Child-facing texts must never use them (spec 4). */
const NEGATIVE_WORDS = /förlor|misslyck|\bfel\b|dålig|straff|tappa|förstör|\bsämst\b/i;

function collectStrings(node: unknown, path: string, out: { path: string; text: string }[]): void {
  if (typeof node === 'string') {
    out.push({ path, text: node });
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      collectStrings(value, path ? `${path}.${key}` : key, out);
    }
  }
}

describe('i18n', () => {
  it('keeps every child-facing text positive', () => {
    const texts: { path: string; text: string }[] = [];
    collectStrings(sv.child, 'child', texts);

    expect(texts.length).toBeGreaterThan(20);
    const negative = texts.filter(({ text }) => NEGATIVE_WORDS.test(text));
    expect(negative).toEqual([]);
  });

  it.each([
    ['child.week.toRecord', '1 stjärna kvar till ditt rekord!', '3 stjärnor kvar till ditt rekord!'],
    ['child.goalLeft', '1 stjärna kvar!', '3 stjärnor kvar!'],
    ['child.collection.toNext', '1 stjärna till nästa steg', '3 stjärnor till nästa steg'],
    ['child.shop.saveMore', '1 stjärna till', '3 stjärnor till'],
    ['child.celebrate.record', 'Nytt rekord! 1 stjärna på en vecka!', 'Nytt rekord! 3 stjärnor på en vecka!'],
    ['parent.overview.nextMilestone', '1 stjärna till "Hjälte"', '3 stjärnor till "Hjälte"'],
    ['parent.child.sparksOn', '1 gnista', '3 gnistor'],
    ['parent.child.repeatCount', 'Klarad 1 gång', 'Klarad 3 gånger'],
    ['parent.library.count', '1 utmaning', '3 utmaningar'],
    ['parent.album.exported', '1 foto sparat.', '3 foton sparade.'],
    ['common.starsLabel', '1 stjärna', '3 stjärnor'],
    ['common.sparksLabel', '1 gnista', '3 gnistor'],
  ])('uses singular and plural forms for %s', (key, one, other) => {
    expect(t(key, { count: 1, title: 'Hjälte' })).toBe(one);
    expect(t(key, { count: 3, title: 'Hjälte' })).toBe(other);
  });
});
