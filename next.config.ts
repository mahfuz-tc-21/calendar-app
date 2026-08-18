import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.EXPORT === 'true' ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  // Bypass TypeScript checks during production builds
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
