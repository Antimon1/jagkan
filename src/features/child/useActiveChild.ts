import type { Child, FamilyState } from '@/domain/types';
import { useDeviceStore } from '@/state/device';
import { useGameStore } from '@/state/game';
import { worldTheme, type WorldTheme } from '@/theme/worlds';

export interface ActiveChild {
  state: FamilyState;
  child: Child;
  theme: WorldTheme;
}

/** Children this device may show: paired children on a child device, otherwise all. */
export function useVisibleChildren(): Child[] {
  const family = useGameStore((s) => s.family);
  const paired = useDeviceStore((s) => s.pairedChildIds);
  if (!family) return [];
  return paired ? family.children.filter((c) => paired.includes(c.id)) : family.children;
}

export function useActiveChild(): ActiveChild | null {
  const family = useGameStore((s) => s.family);
  const activeChildId = useDeviceStore((s) => s.activeChildId);
  const visible = useVisibleChildren();
  if (!family) return null;
  const child = visible.find((c) => c.id === activeChildId) ?? (visible.length === 1 ? visible[0] : undefined);
  if (!child) return null;
  return { state: family, child, theme: worldTheme(child.world) };
}
