import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  format: ["esm", "cjs"],
  dts: { entry: "src/index.ts" },
  splitting: false,
  clean: true,
  target: "node18",
  shims: true,
});
