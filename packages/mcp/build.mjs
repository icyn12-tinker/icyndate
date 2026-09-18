import { build } from "esbuild";
await build({ entryPoints: ["src/server.ts"], outfile: "dist/server.js", bundle: true, format: "esm", platform: "node", target: "node18",
  banner: { js: "#!/usr/bin/env node" }, external: ["@modelcontextprotocol/sdk", "zod", "@icyn/date", "@icyn/date/*"], minify: false });
