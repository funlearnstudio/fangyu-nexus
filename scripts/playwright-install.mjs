import path from "node:path";
import { repositoryRoot, runPnpm } from "./process-utils.mjs";

runPnpm(["exec", "playwright", "install", "chromium"], {
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: path.join(repositoryRoot, ".playwright-browsers"),
  },
});
