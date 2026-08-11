import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@fangyu/domain",
    "@fangyu/game-rules",
    "@fangyu/ui",
    "@fangyu/voxel-engine",
  ],
};

export default nextConfig;
