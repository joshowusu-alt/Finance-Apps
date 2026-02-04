import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    mcpServer: false,
  },
  cleanDistDir: false,
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
