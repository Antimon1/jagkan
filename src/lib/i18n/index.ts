import i18n, { t as translate, use as registerPlugin } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';

import { sv } from './sv';

export const DEFAULT_LOCALE = 'sv';

if (!i18n.isInitialized) {
  registerPlugin(initReactI18next)
    .init({
      resources: { sv: { translation: sv } },
      lng: DEFAULT_LOCALE,
      fallbackLng: DEFAULT_LOCALE,
      // Resources are bundled, so init synchronously: texts exist on the first render.
      initAsync: false,
      interpolation: { escapeValue: false },
      returnNull: false,
    })
    .catch(() => undefined);
}

export type TFunction = (key: string, options?: Record<string, unknown>) => string;

/** Translation hook. Keys are dot paths into src/lib/i18n/sv.ts. */
export function useT(): TFunction {
  const { t } = useTranslation();
  return t as unknown as TFunction;
}

/** Non-React access (e.g. notification texts). */
export const t: TFunction = (key, options) => translate(key, options) as unknown as string;

export default i18n;
