import { runPnpm } from "./process-utils.mjs";

const action = process.argv[2];
const allowed = new Set(["generate", "migrate", "seed"]);

if (!allowed.has(action)) {
  console.error("Database action must be generate, migrate, or seed.");
  process.exit(2);
}

// Workspace packages publish their runtime entry points from dist/. A fresh
// source archive intentionally omits those build artifacts, so database tasks
// must materialize the API dependency graph before tsx loads the seed module.
if (action === "migrate" || action === "seed") {
  runPnpm(["exec", "turbo", "run", "build", "--filter=@fangyu/api..."]);
}

runPnpm(["--filter", "@fangyu/api", "run", "db:" + action]);
