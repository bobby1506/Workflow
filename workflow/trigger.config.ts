import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_ioaykdaiaiqtolcxfrjv",
  runtime: "node",
  logLevel: "log",
  maxDuration: 300, // 5 minutes — covers the 30s crop delay
  dirs: ["./src/trigger"],
});
