import { build } from "esbuild";

await build({
  entryPoints: ["src/lambda/handler.ts"],
  outfile: "dist/index.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  // Provided by the Lambda Node.js runtime; keeps the bundle small.
  external: ["@aws-sdk/*"],
  // Some bundled dependencies call require() at runtime; ESM output needs a
  // shim for that.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
