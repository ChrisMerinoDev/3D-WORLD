import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The backend workspace ships TypeScript source consumed directly by
  // Next.js route handlers; transpile it as part of the app build.
  transpilePackages: ["@aurora/backend"],
};

export default nextConfig;
