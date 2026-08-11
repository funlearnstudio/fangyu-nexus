import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const candidatePackageManagerScript = process.env.npm_execpath;
const packageManagerScript = candidatePackageManagerScript
  ?.toLowerCase()
  .includes("pnpm")
  ? candidatePackageManagerScript
  : undefined;
export const pnpmExecutable = packageManagerScript
  ? process.execPath
  : process.platform === "win32"
    ? "pnpm.cmd"
    : "pnpm";
const pnpmArgumentPrefix = packageManagerScript ? [packageManagerScript] : [];

export function runPnpm(args, options = {}) {
  const result = spawnSync(pnpmExecutable, [...pnpmArgumentPrefix, ...args], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export function spawnPnpm(args, options = {}) {
  return spawn(pnpmExecutable, [...pnpmArgumentPrefix, ...args], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit",
    shell: false,
    ...options,
  });
}
