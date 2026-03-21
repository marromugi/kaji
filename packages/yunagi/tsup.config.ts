import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    clean: true,
    target: "node18",
    shims: true,
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm", "cjs"],
    splitting: false,
    target: "node18",
    shims: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
