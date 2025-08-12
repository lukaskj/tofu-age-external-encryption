import Bun from "bun";
import { renameSync } from "node:fs";
import { join } from "node:path";

console.log("Starting build...");
const start = Date.now();

const buildConfig: Bun.BuildConfig = {
  entrypoints: ["src/index.ts"],
  outdir: "dist",
  target: "node",
  sourcemap: "inline",
  minify: false,
  packages: "external",
  root: "./src",
};

const esmBuild = await Bun.build({
  ...buildConfig,
  format: "esm",
});
outputLogs(esmBuild);

if (esmBuild.success) {
  renameSync(join(".", "dist", "index.js"), join(".", "dist", "index.mjs"));
}

const cjsBuild = await Bun.build({
  ...buildConfig,
  format: "cjs",
});
outputLogs(cjsBuild);
if (cjsBuild.success) {
  renameSync(join(".", "dist", "index.js"), join(".", "dist", "index.cjs"));
}

function outputLogs(result: Bun.BuildOutput) {
  if (result.logs.length > 0) {
    console.warn("Build succeeded with warnings:");
    for (const message of result.logs) {
      // Bun will pretty print the message object
      console.warn(message);
    }
  }
}

console.log(`Build finished in ${Date.now() - start}ms`);
