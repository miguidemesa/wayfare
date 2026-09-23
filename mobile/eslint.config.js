// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // The four rules below are the React Compiler-era checks shipped by default in
      // eslint-config-expo (mirroring eslint-plugin-react-hooks v6, same as the web
      // app's eslint.config.mjs). They enforce rules of React that only fully apply
      // once the React Compiler is enabled — this app doesn't run it (no
      // babel-plugin-react-compiler in babel.config.js) — and here they mostly flag
      // the "fetch on mount" useEffect+setState pattern used by every screen, which
      // Phase 2 of the mobile revamp (TanStack Query) replaces outright. Disabled
      // until the compiler is adopted, so they don't break-gate the build on code
      // that's either idiomatic today or already slated for removal.
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
