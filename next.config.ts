import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow opening the app via 127.0.0.1 while the server binds to localhost
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
