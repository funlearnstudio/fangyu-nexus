import { runPnpm } from "./process-utils.mjs";

// Build the workspace libraries consumed by Next before the serverless app.
// This is intentionally Node/pnpm-only so it behaves the same on all hosts.
runPnpm([
  "exec",
  "turbo",
  "run",
  "build",
  "--filter=@fangyu/domain",
  "--filter=@fangyu/game-rules",
  "--filter=@fangyu/ui",
  "--filter=@fangyu/voxel-engine",
]);
runPnpm(["--filter", "@fangyu/web", "exec", "next", "build"]);
