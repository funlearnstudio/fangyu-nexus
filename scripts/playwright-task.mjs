import fs from "node:fs";
import path from "node:path";
import { repositoryRoot, runPnpm } from "./process-utils.mjs";

const browserRoot = path.join(repositoryRoot, ".playwright-browsers");
const names =
  process.platform === "win32"
    ? new Set(["chrome.exe"])
    : new Set(["chrome", "Chromium"]);

function findExecutable(directory) {
  if (!fs.existsSync(directory)) return undefined;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isFile() && names.has(entry.name)) return candidate;
    if (entry.isDirectory()) {
      const nested = findExecutable(candidate);
      if (nested) return nested;
    }
  }
  return undefined;
}

const executablePath = findExecutable(browserRoot);
runPnpm(["exec", "playwright", "test"], {
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: browserRoot,
    ...(executablePath ? { PLAYWRIGHT_EXECUTABLE_PATH: executablePath } : {}),
  },
});
