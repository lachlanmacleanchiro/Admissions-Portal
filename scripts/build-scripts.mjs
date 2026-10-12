// Bundles the standalone Node scripts (e.g. the daily task reminders) into
// single files under dist/, so the production image can run them with plain
// `node` — no tsx, TypeScript or full node_modules needed.
import { build } from "esbuild";

await build({
  entryPoints: ["scripts/send-task-reminders.ts"],
  outfile: "dist/send-task-reminders.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  // Optional native addon that pg only loads if present.
  external: ["pg-native"],
  // Bundled CommonJS dependencies still call require(); provide it in ESM.
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "info",
});
