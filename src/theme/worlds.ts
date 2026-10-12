import type { WorldId } from '@/domain/types';

/**
 * Child world themes (spec 5). Same mechanics, different look and tone:
 * valley = soft pastel clay, dino = saturated adventure, explorer = dark tech base.
 */
export interface WorldTheme {
  id: WorldId;
  dark: boolean;
  bg: string;
  bgAccent: string;
  surface: string;
  surfaceSunk: string;
  ink: string;
  inkSoft: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  tryColor: string;
  doneColor: string;
  eggBase: string;
  eggShade: string;
  eggSpot: string;
  glow: string;
  line: string;
  /** Decorative shapes in the background. */
  decor: string[];
}

export const WORLD_THEMES: Record<WorldId, WorldTheme> = {
  valley: {
    id: 'valley',
    dark: false,
    bg: '#FFF4E8',
    bgAccent: '#FFE1EC',
    surface: '#FFFFFF',
    surfaceSunk: '#FFF0E2',
    ink: '#3B2A4A',
    inkSoft: '#7A6688',
    primary: '#FF7FAE',
    onPrimary: '#4A1230',
    secondary: '#7FD6BC',
    onSecondary: '#10392D',
    tryColor: '#FFB25C',
    doneColor: '#FF7FAE',
    eggBase: '#FFF6E0',
    eggShade: '#F3D9B5',
    eggSpot: '#FFC4DB',
    glow: '#FFB703',
    line: '#F3D9C6',
    decor: ['#FFD6E5', '#D5F2E8', '#FFF0B8', '#E6DCFF'],
  },
  dino: {
    id: 'dino',
    dark: false,
    bg: '#EFE5CC',
    bgAccent: '#CFE0AE',
    surface: '#FFFBF0',
    surfaceSunk: '#E6D9B8',
    ink: '#1F2A1F',
    inkSoft: '#56604F',
    primary: '#2F8F4E',
    onPrimary: '#FFFFFF',
    secondary: '#FF7A1A',
    onSecondary: '#FFFFFF',
    tryColor: '#FF7A1A',
    doneColor: '#2F8F4E',
    eggBase: '#D8C7A2',
    eggShade: '#B89F72',
    eggSpot: '#F4EAD2',
    glow: '#FF7A1A',
    line: '#D6C59D',
    decor: ['#C7DC9F', '#E9C88A', '#F3B07A', '#A9C98A'],
  },
  explorer: {
    id: 'explorer',
    dark: true,
    bg: '#0F1B2D',
    bgAccent: '#15263D',
    surface: '#1A2C46',
    surfaceSunk: '#13223A',
    ink: '#EAF2FF',
    inkSoft: '#9FB3CF',
    primary: '#2EC4B6',
    onPrimary: '#062B27',
    secondary: '#FF9F1C',
    onSecondary: '#2B1600',
    tryColor: '#FF9F1C',
    doneColor: '#2EC4B6',
    eggBase: '#34495F',
    eggShade: '#22344A',
    eggSpot: '#2EC4B6',
    glow: '#2EC4B6',
    line: '#2A3F5C',
    decor: ['#1D3352', '#173049', '#22405F', '#1B2F4C'],
  },
};

export function worldTheme(world: WorldId): WorldTheme {
  return WORLD_THEMES[world];
}
