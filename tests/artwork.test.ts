import { catalog } from '@/data/catalog';
import { playableSpecies } from '@/domain/catalog';
import { BRANCHES } from '@/domain/constants';
import { CREATURE_ARTWORK } from '@/features/creatures/artwork';

describe('beta artwork (docs/grafik-brief-aggdalen.md)', () => {
  it('needs one Äggdalen creature per branch in three stages, named <branch>_1_s<stage>', () => {
    const keys = BRANCHES.flatMap((branch) => playableSpecies(catalog, 'valley', branch)).flatMap((species) =>
      species.stages.map((stage) => stage.assetKey),
    );
    expect(keys).toHaveLength(BRANCHES.length * 3);
    expect(keys.filter((key) => !/^valley\/[a-z]+_1_s[123]$/.test(key))).toEqual([]);
  });

  it('only registers artwork for asset keys that exist', () => {
    const known = new Set([
      ...catalog.species.flatMap((species) => species.stages.map((stage) => stage.assetKey)),
      ...catalog.specials.map((special) => special.assetKey),
    ]);
    expect(Object.keys(CREATURE_ARTWORK).filter((key) => !known.has(key))).toEqual([]);
  });
});
