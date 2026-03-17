import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@whiteboard/auth", "@whiteboard/db", "@whiteboard/shared", "@whiteboard/ui"],
};

export default nextConfig;
