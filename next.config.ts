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
  // Rewrite /latest.json → /api/latest.json so that old APK versions
  // (v1.0.5 and earlier) that use the legacy URL continue to receive
  // update manifests. Rewrites are ignored during `next export` (mobile
  // static builds) — this only applies to the Vercel server deployment.
  async rewrites() {
    return [
      {
        source: '/latest.json',
        destination: '/api/latest.json',
      },
    ]
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-private-space-token, x-refresh-token" },
        ]
      }
    ]
  }
};

export default nextConfig;
