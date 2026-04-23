import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { nextRuntime }) {
    // Edge runtime has no Node built-ins. Our server-only libraries use fs,
    // path, and child_process, and are only reachable via dynamic import
    // from instrumentation-node.ts, so in practice they never execute on
    // Edge. But Next.js's webpack still traces them and fails the build
    // unless we mark the Node modules as unresolvable fallbacks on Edge.
    if (nextRuntime === "edge") {
      config.resolve ??= {};
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        path: false,
        child_process: false,
        stream: false,
        os: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
