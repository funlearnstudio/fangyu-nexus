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
// Keep type safety enforced in production while avoiding Next 16's incomplete
// project-reference checker. This invokes the repository's TypeScript build.
runPnpm(["typecheck"]);
runPnpm(["--filter", "@fangyu/web", "exec", "next", "build"]);
