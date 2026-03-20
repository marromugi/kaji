import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/server.ts"],
  format: ["esm"],
  dts: true,
  splitting: false,
  clean: true,
  target: "node18",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
