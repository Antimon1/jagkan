// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Functions are Deno code, type-checked with `deno check` in CI.
    ignores: ["dist/*", "coverage/*", "supabase/functions/**"],
  }
]);
