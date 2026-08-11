import { spawnSync } from "node:child_process";
import path from "node:path";
import { repositoryRoot, runPnpm, spawnPnpm } from "./process-utils.mjs";

const forwardedArguments = process.argv.slice(2);

if (forwardedArguments.length > 0) {
  const webRoot = path.join(repositoryRoot, "apps", "web");
  const viteEntry = path.join(
    webRoot,
    "node_modules",
    "vite",
    "bin",
    "vite.js",
  );
  const result = spawnSync(
    process.execPath,
    [viteEntry, ...forwardedArguments],
    {
      cwd: webRoot,
      env: { ...process.env, FANGYU_SITES_PREVIEW: "1" },
      stdio: "inherit",
      shell: false,
    },
  );
  process.exit(result.status ?? 1);
}

runPnpm(["exec", "turbo", "run", "build", "--filter=./packages/*"]);

const child = spawnPnpm(["exec", "turbo", "run", "dev", "--parallel"]);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
