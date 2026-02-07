import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    mcpServer: false,
  },
  cleanDistDir: false,
  serverExternalPackages: ["better-sqlite3"],
  typescript: {
    ignoreBuildErrors: true,
  },
  // @ts-expect-error Types might be outdated
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
