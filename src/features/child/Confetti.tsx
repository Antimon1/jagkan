import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const COLORS = ['#FF7FAE', '#FFC93C', '#7FD6BC', '#8A6FE8', '#FF7A1A', '#4FA3E0'];

/** Small seeded PRNG (mulberry32) so the layout is a pure function of the play key. */
function seeded(seed: number): () => number {
  let a = seed * 2654435761;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

interface PieceSpec {
  x: number;
  drift: number;
  delay: number;
  size: number;
  color: string;
  spin: number;
  round: boolean;
}

function Piece({ spec, height, playKey }: { spec: PieceSpec; height: number; playKey: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(0);
    progress.set(withDelay(spec.delay, withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) })));
  }, [playKey, progress, spec.delay]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.get() < 0.85 ? 1 : (1 - progress.get()) / 0.15,
    transform: [
      { translateX: spec.x + spec.drift * progress.get() },
      { translateY: -40 + (height + 80) * progress.get() },
      { rotate: `${spec.spin * progress.get()}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        styles.piece,
        { width: spec.size, height: spec.round ? spec.size : spec.size * 0.45, backgroundColor: spec.color, borderRadius: spec.round ? spec.size / 2 : 2 },
        style,
      ]}
    />
  );
}

/** Celebration confetti (hatch, family goal, records). Off when the OS asks for reduced motion. */
export function Confetti({ playKey, count = 36 }: { playKey: number; count?: number }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const pieces = useMemo<PieceSpec[]>(() => {
    const random = seeded(playKey + 1);
    return Array.from({ length: count }, (_, i) => ({
      x: random() * width,
      drift: (random() - 0.5) * 160,
      delay: random() * 400,
      size: 8 + random() * 10,
      color: COLORS[i % COLORS.length],
      spin: (random() - 0.5) * 900,
      round: i % 3 === 0,
    }));
  }, [playKey, width, count]);
  if (reduceMotion || playKey === 0) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((spec, i) => (
        <Piece key={`${playKey}-${i}`} spec={spec} height={height} playKey={playKey} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, left: 0 },
});
