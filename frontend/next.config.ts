import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The backend workspace ships TypeScript source consumed directly by
  // Next.js route handlers; transpile it as part of the app build.
  transpilePackages: ["@aurora/backend"],
  eslint: {
    // Lint is run as a dedicated CI step; don't fail production builds on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
