import { Text, type TextProps, type TextStyle } from 'react-native';

import { palette, type as typeScale } from '@/theme/tokens';

export type TextVariant = keyof typeof typeScale;

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

export function AppText({ variant = 'body', color = palette.ink, align, style, ...rest }: AppTextProps) {
  return <Text {...rest} style={[typeScale[variant], { color, textAlign: align }, style]} />;
}
