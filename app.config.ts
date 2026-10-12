import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json with values from the environment:
 * - EXPO_BASE_URL: sub-path for the web preview on GitHub Pages (e.g. "/jagkan").
 * - EAS_PROJECT_ID: needed for push tokens once the project is linked to EAS.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const baseUrl = process.env.EXPO_BASE_URL?.trim();
  const projectId = process.env.EAS_PROJECT_ID?.trim();
  return {
    ...(config as ExpoConfig),
    experiments: {
      ...config.experiments,
      ...(baseUrl ? { baseUrl } : {}),
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
