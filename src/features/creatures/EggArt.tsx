import { useEffect, useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { WorldId } from '@/domain/types';
import { worldTheme } from '@/theme/worlds';

export interface EggArtProps {
  world: WorldId;
  /** 0..3 sparks charge. */
  charge: number;
  waiting?: boolean;
  icon?: string;
  size?: number;
  animate?: boolean;
}

/**
 * The "egg" for each active challenge (spec 5): an egg in Äggdalen, a fossil in
 * stone in Dinodalen, a locked equipment crate in Utforskarbasen. Sparks warm,
 * dig or charge it; a waiting challenge glows.
 */
export function EggArt({ world, charge, waiting = false, icon, size = 120, animate = true }: EggArtProps) {
  const reduceMotion = useReducedMotion();
  const tilt = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!animate || reduceMotion) return;
    const amplitude = 2 + charge * 2;
    tilt.set(withRepeat(
      withSequence(
        withTiming(-amplitude, { duration: 600 - charge * 80, easing: Easing.inOut(Easing.quad) }),
        withTiming(amplitude, { duration: 600 - charge * 80, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    ));
    if (waiting) {
      pulse.set(withRepeat(withSequence(withTiming(1.05, { duration: 700 }), withTiming(1, { duration: 700 })), -1));
    }
    return () => {
      cancelAnimation(tilt);
      cancelAnimation(pulse);
    };
  }, [animate, reduceMotion, charge, waiting, tilt, pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt.get()}deg` }, { scale: pulse.get() }],
  }));

  const theme = worldTheme(world);
  const glow = waiting ? 0.55 : charge * 0.14;
  // Unique gradient ids: on web all SVGs share one document.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const glowId = `glow${uid}`;
  const shineId = `shine${uid}`;

  return (
    <Animated.View style={[{ width: size, height: size * 1.1 }, style]}>
      <Svg width={size} height={size * 1.1} viewBox="0 0 100 110">
        <Defs>
          <RadialGradient id={glowId} cx="50%" cy="55%" r="50%">
            <Stop offset="0%" stopColor={theme.glow} stopOpacity={glow} />
            <Stop offset="100%" stopColor={theme.glow} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={shineId} cx="35%" cy="30%" r="70%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.9} />
            <Stop offset="45%" stopColor={theme.eggBase} stopOpacity={1} />
            <Stop offset="100%" stopColor={theme.eggShade} stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={60} r={50} fill={`url(#${glowId})`} />
        <Ellipse cx={50} cy={104} rx={30} ry={4} fill="#000000" opacity={theme.dark ? 0.35 : 0.1} />
        {world === 'valley' ? <ValleyEgg charge={charge} waiting={waiting} spot={theme.eggSpot} shine={shineId} /> : null}
        {world === 'dino' ? <DinoFossil charge={charge} waiting={waiting} spot={theme.eggSpot} accent={theme.secondary} shine={shineId} /> : null}
        {world === 'explorer' ? <ExplorerCrate charge={charge} waiting={waiting} accent={theme.primary} shine={shineId} /> : null}
      </Svg>
      {icon ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.iconWrap]}>
          <Text style={{ fontSize: size * 0.3, lineHeight: size * 0.38 }}>{icon}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const EGG_PATH = 'M50 8 C74 8 90 44 90 68 C90 90 72 103 50 103 C28 103 10 90 10 68 C10 44 26 8 50 8 Z';

function Crack({ level }: { level: number }) {
  if (level <= 0) return null;
  const paths = [
    'M44 22 L50 30 L46 36',
    'M44 22 L50 30 L46 36 L54 44 L50 50',
    'M44 22 L50 30 L46 36 L54 44 L50 50 L58 56 L54 62',
  ];
  return (
    <Path
      d={paths[Math.min(level, 3) - 1]}
      stroke="#6B4A2B"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity={0.75}
    />
  );
}

function ValleyEgg({ charge, waiting, spot, shine }: { charge: number; waiting: boolean; spot: string; shine: string }) {
  return (
    <G>
      <Path d={EGG_PATH} fill={`url(#${shine})`} stroke="#E7C9A5" strokeWidth={1.5} />
      <Circle cx={30} cy={70} r={7} fill={spot} />
      <Circle cx={70} cy={56} r={9} fill={spot} />
      <Circle cx={62} cy={86} r={5} fill={spot} />
      <Circle cx={36} cy={44} r={4} fill={spot} />
      <Crack level={waiting ? 3 : charge} />
      {waiting ? (
        <G>
          <Path d="M20 20 l3 6 l6 3 l-6 3 l-3 6 l-3 -6 l-6 -3 l6 -3 Z" fill="#FFD447" />
          <Path d="M82 30 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 Z" fill="#FFD447" />
        </G>
      ) : null}
    </G>
  );
}

function DinoFossil({ charge, waiting, spot, accent, shine }: { charge: number; waiting: boolean; spot: string; accent: string; shine: string }) {
  const rock = 'M18 40 L34 16 L62 12 L84 30 L92 62 L80 94 L50 104 L20 94 L8 66 Z';
  return (
    <G>
      <Path d={rock} fill={`url(#${shine})`} stroke="#9C8358" strokeWidth={2} strokeLinejoin="round" />
      <Path d="M24 50 L36 44 M70 80 L82 72 M60 26 L72 32" stroke="#9C8358" strokeWidth={2} strokeLinecap="round" />
      {charge >= 1 || waiting ? <Path d="M30 30 L44 22 L52 34 L38 42 Z" fill={spot} opacity={0.9} /> : null}
      {charge >= 2 || waiting ? <Path d="M58 70 L74 64 L80 80 L64 88 Z" fill={spot} opacity={0.9} /> : null}
      {charge >= 3 || waiting ? <Path d="M20 70 L32 64 L38 78 L26 84 Z" fill={spot} opacity={0.9} /> : null}
      {/* Ammonite peeking out */}
      <G opacity={0.35 + Math.min(charge, 3) * 0.2}>
        <Circle cx={50} cy={58} r={16} fill="none" stroke="#7A6440" strokeWidth={3} />
        <Path d="M50 58 m-9 0 a9 9 0 1 0 18 0 a5 5 0 1 0 -10 0" fill="none" stroke="#7A6440" strokeWidth={3} />
      </G>
      {waiting ? <Path d="M14 66 L30 60 M70 18 L80 8 M86 50 L96 46" stroke={accent} strokeWidth={3} strokeLinecap="round" /> : null}
    </G>
  );
}

function ExplorerCrate({ charge, waiting, accent, shine }: { charge: number; waiting: boolean; accent: string; shine: string }) {
  return (
    <G>
      <Rect x={10} y={waiting ? 24 : 28} width={80} height={16} rx={5} fill="#2A3D55" stroke="#4E6684" strokeWidth={2} />
      <Rect x={10} y={40} width={80} height={60} rx={8} fill={`url(#${shine})`} stroke="#4E6684" strokeWidth={2} />
      <Rect x={10} y={60} width={80} height={8} fill="#22344A" />
      {[16, 84].map((x) => [46, 94].map((y) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={2.5} fill="#7F98B8" />))}
      <Rect x={42} y={56} width={16} height={16} rx={3} fill="#1A2B40" stroke={accent} strokeWidth={1.5} />
      {[0, 1, 2].map((i) => (
        <Rect
          key={i}
          x={26 + i * 17}
          y={82}
          width={14}
          height={6}
          rx={2}
          fill={i < charge || waiting ? accent : '#2A3D55'}
          stroke="#4E6684"
          strokeWidth={1}
        />
      ))}
      {waiting ? <Rect x={14} y={38} width={72} height={3} rx={1.5} fill={accent} opacity={0.9} /> : null}
    </G>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: '8%' },
});
