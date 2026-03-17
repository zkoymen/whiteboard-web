import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@whiteboard/auth", "@whiteboard/db", "@whiteboard/shared", "@whiteboard/ui"],
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
};

export default nextConfig;
