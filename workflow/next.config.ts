import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from Transloadit CDN and mock CDN
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.transloadit.com" },
      { protocol: "https", hostname: "mock-cdn.nextflow.ai" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "pub-*.r2.dev" },
    ],
  },

  // Suppress specific build warnings
  typescript: {
    ignoreBuildErrors: false,
  },

  // Ensure server-only packages don't leak to client
  serverExternalPackages: [
    "fluent-ffmpeg",
    "ffmpeg-static",
    "ffprobe-static",
    "@prisma/client",
    "pg",
    "fs",
    "child_process",
  ],

  // Reduce bundle size
  experimental: {
    optimizePackageImports: ["@xyflow/react", "zustand"],
  },
  // Ensure Turbopack resolves modules from this app folder (prevents parent lockfile inference)
  turbopack: {
    // Use process.cwd() so the root is the app folder when running inside workflow/
    root: process.cwd(),
  },
};

export default nextConfig;
