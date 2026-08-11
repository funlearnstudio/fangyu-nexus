import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The workspace runs `pnpm typecheck` before `next build`. Next 16's built-in
  // checker does not fully support TypeScript project references, so avoid
  // running the same check a second time with different semantics on Vercel.
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: [
    "@fangyu/domain",
    "@fangyu/game-rules",
    "@fangyu/ui",
    "@fangyu/voxel-engine",
  ],
};

export default nextConfig;
