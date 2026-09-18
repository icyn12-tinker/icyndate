import { build } from "esbuild";
import { readdirSync, rmSync } from "node:fs";
rmSync("dist", { recursive: true, force: true });
const regions = readdirSync("src/regions").map(f => `src/regions/${f}`);
await build({
  entryPoints: ["src/index.ts", ...regions],
  outdir: "dist", outbase: "src",
  bundle: true, splitting: true, format: "esm", platform: "neutral", target: "es2020",
  minify: false, sourcemap: true, legalComments: "none",
});
console.log("bundled", 1 + regions.length, "entries");
