import { packageSitesArtifact } from "./package-sites-artifact.mjs";
import { runPnpm } from "./process-utils.mjs";

const task = process.argv[2];

switch (task) {
  case "build":
    runPnpm(["exec", "turbo", "run", "build"]);
    await packageSitesArtifact();
    break;
  case "lint":
    runPnpm(["exec", "eslint", ".", "--max-warnings=0"]);
    break;
  case "typecheck":
    runPnpm(["exec", "tsc", "-b", "--pretty"]);
    break;
  case "test":
    runPnpm(["exec", "vitest", "run"]);
    break;
  case "test:e2e":
    runPnpm(["run", "build"]);
    runPnpm(["exec", "vitest", "run", "--config", "vitest.e2e.config.ts"]);
    break;
  default:
    console.error("Unknown workspace task:", task);
    process.exit(2);
}
