import { Alert, Platform } from 'react-native';

/** Yes/no confirmation that works on native and web. */
export function confirmAsync(message: string, okLabel = 'OK', cancelLabel = 'Avbryt'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(typeof window !== 'undefined' && window.confirm(message));
  return new Promise((resolve) =>
    Alert.alert('', message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}
