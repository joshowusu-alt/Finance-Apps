import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  experimental: {
    mcpServer: false,
  },
  cleanDistDir: false,
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
