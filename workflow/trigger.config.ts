import { defineConfig } from "@trigger.dev/sdk/v3";
import { ffmpeg } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: "proj_ioaykdaiaiqtolcxfrjv",
  runtime: "node",
  logLevel: "log",
  maxDuration: 300, // 5 minutes — covers the 30s crop delay
  dirs: ["./src/trigger"],
  build: {
    extensions: [
      ffmpeg({ version: "7" }), // Provides FFmpeg binaries in Trigger.dev environment
    ],
  },
});
