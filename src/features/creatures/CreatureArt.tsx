import { useId } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, Polygon, RadialGradient, Stop } from 'react-native-svg';

import type { Stage, WorldId } from '@/domain/types';

import { creatureArtwork } from './artwork';

export interface CreatureArtProps {
  world: WorldId;
  color: string;
  stage: Stage;
  emoji?: string;
  size?: number;
  locked?: boolean;
  special?: boolean;
  /** Real artwork when it exists (./artwork.ts); otherwise the placeholder is drawn. */
  assetKey?: string;
}

/**
 * Creature art (spec 5.1). Shows the finished image for `assetKey` when there is
 * one, as a silhouette while locked. Otherwise a placeholder: a simple SVG figure
 * in the creature's color, one shape language per world.
 */
export function CreatureArt({ world, color, stage, emoji, size = 96, locked = false, special = false, assetKey }: CreatureArtProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const artwork = creatureArtwork(assetKey);
  if (artwork) {
    return (
      <Image
        source={artwork}
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        style={[{ width: size, height: size }, locked ? styles.silhouette : null]}
      />
    );
  }
  const bodyId = `body${uid}`;
  const scale = [0.8, 0.9, 1][stage - 1];
  const fill = locked ? (world === 'explorer' ? '#2B3F5A' : '#CFC6BA') : `url(#${bodyId})`;
  const ink = locked ? 'transparent' : '#2A1E35';

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={bodyId} cx="35%" cy="30%" r="75%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.7} />
            <Stop offset="35%" stopColor={color} stopOpacity={1} />
            <Stop offset="100%" stopColor={color} stopOpacity={1} />
          </RadialGradient>
        </Defs>
        {special && !locked ? <Starburst /> : null}
        <Ellipse cx={50} cy={93} rx={26 * scale} ry={4} fill="#000000" opacity={0.12} />
        <G transform={`translate(${50 - 50 * scale} ${96 - 96 * scale}) scale(${scale})`}>
          {world === 'valley' ? <Blob fill={fill} ink={ink} stage={stage} locked={locked} /> : null}
          {world === 'dino' ? <Dino fill={fill} ink={ink} stage={stage} locked={locked} /> : null}
          {world === 'explorer' ? <Badge fill={fill} stage={stage} locked={locked} color={color} /> : null}
        </G>
      </Svg>
      {emoji || locked ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, world === 'explorer' ? styles.badgeEmoji : styles.bellyEmoji]}>
          <Text style={{ fontSize: size * (world === 'explorer' ? 0.3 : 0.2), lineHeight: size * 0.34, opacity: locked ? 0.55 : 1 }}>
            {locked ? '❔' : emoji}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Starburst() {
  const points: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    const r = i % 2 === 0 ? 49 : 36;
    const a = (Math.PI * 2 * i) / 16 - Math.PI / 2;
    points.push(`${50 + r * Math.cos(a)},${52 + r * Math.sin(a)}`);
  }
  return <Polygon points={points.join(' ')} fill="#FFE07A" opacity={0.7} />;
}

function Eyes({ ink, y = 46, gap = 12 }: { ink: string; y?: number; gap?: number }) {
  if (ink === 'transparent') return null;
  return (
    <G>
      <Circle cx={50 - gap} cy={y} r={7} fill="#FFFFFF" />
      <Circle cx={50 + gap} cy={y} r={7} fill="#FFFFFF" />
      <Circle cx={50 - gap + 1.5} cy={y + 1} r={4} fill={ink} />
      <Circle cx={50 + gap + 1.5} cy={y + 1} r={4} fill={ink} />
      <Circle cx={50 - gap + 3} cy={y - 1} r={1.4} fill="#FFFFFF" />
      <Circle cx={50 + gap + 3} cy={y - 1} r={1.4} fill="#FFFFFF" />
    </G>
  );
}

function Crown({ y = 10 }: { y?: number }) {
  return (
    <G>
      <Polygon points={`36,${y + 14} 38,${y} 45,${y + 8} 50,${y - 3} 55,${y + 8} 62,${y} 64,${y + 14}`} fill="#FFC93C" stroke="#E0A21B" strokeWidth={1.5} />
      <Circle cx={50} cy={y + 6} r={2} fill="#FF6B9A" />
    </G>
  );
}

function Blob({ fill, ink, stage, locked }: { fill: string; ink: string; stage: Stage; locked: boolean }) {
  return (
    <G>
      {stage >= 2 ? (
        <G>
          <Circle cx={30} cy={26} r={10} fill={fill} />
          <Circle cx={70} cy={26} r={10} fill={fill} />
        </G>
      ) : null}
      <Path d="M50 20 C76 20 88 42 88 62 C88 82 72 94 50 94 C28 94 12 82 12 62 C12 42 24 20 50 20 Z" fill={fill} />
      {!locked ? (
        <G>
          <Ellipse cx={50} cy={74} rx={20} ry={14} fill="#FFFFFF" opacity={0.35} />
          <Eyes ink={ink} />
          <Circle cx={30} cy={58} r={5} fill="#FF8FB1" opacity={0.6} />
          <Circle cx={70} cy={58} r={5} fill="#FF8FB1" opacity={0.6} />
          <Path d="M44 58 Q50 64 56 58" stroke={ink} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        </G>
      ) : null}
      {stage === 3 && !locked ? <Crown y={4} /> : null}
    </G>
  );
}

function Dino({ fill, ink, stage, locked }: { fill: string; ink: string; stage: Stage; locked: boolean }) {
  const spikes = stage + 2;
  return (
    <G>
      {Array.from({ length: spikes }).map((_, i) => {
        const x = 30 + (i * 40) / (spikes - 1);
        return <Polygon key={i} points={`${x - 6},30 ${x},${16 - stage * 2} ${x + 6},30`} fill={fill} opacity={0.9} />;
      })}
      <Path d="M86 70 L98 84 L80 80 Z" fill={fill} />
      <Path d="M50 24 C74 24 88 44 88 64 C88 84 72 94 50 94 C28 94 12 84 12 64 C12 44 26 24 50 24 Z" fill={fill} />
      {!locked ? (
        <G>
          <Ellipse cx={50} cy={76} rx={22} ry={13} fill="#FFFFFF" opacity={0.3} />
          <Eyes ink={ink} y={48} gap={13} />
          <Path d="M40 62 Q50 68 60 62" stroke={ink} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          <Polygon points="44,62 46,66 48,62" fill="#FFFFFF" />
          <Polygon points="52,62 54,66 56,62" fill="#FFFFFF" />
          {stage === 3 ? <Polygon points="47,24 50,8 53,24" fill="#FFC93C" stroke="#E0A21B" strokeWidth={1} /> : null}
        </G>
      ) : null}
    </G>
  );
}

function Badge({ fill, stage, locked, color }: { fill: string; stage: Stage; locked: boolean; color: string }) {
  const hex = '50,10 86,30 86,70 50,92 14,70 14,30';
  return (
    <G>
      <Polygon points={hex} fill={locked ? fill : '#13223A'} stroke={locked ? '#3B5272' : color} strokeWidth={4} strokeLinejoin="round" />
      <Polygon points="50,20 77,35 77,65 50,82 23,65 23,35" fill={fill} opacity={locked ? 1 : 0.9} />
      {!locked
        ? Array.from({ length: stage }).map((_, i) => (
            <Polygon
              key={i}
              transform={`translate(${50 + (i - (stage - 1) / 2) * 13} 92)`}
              points="0,-6 1.8,-1.8 6,-1.8 2.6,1 3.8,5.4 0,2.8 -3.8,5.4 -2.6,1 -6,-1.8 -1.8,-1.8"
              fill="#FFC93C"
            />
          ))
        : null}
    </G>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  bellyEmoji: { paddingTop: '46%' },
  badgeEmoji: { paddingTop: '4%' },
  silhouette: { tintColor: '#CFC6BA' },
});
