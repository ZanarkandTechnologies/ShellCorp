import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environmentMatchGlobs: [
      ["convex/**/*.test.ts", "edge-runtime"],
      ["**/*.test.ts", "node"],
    ],
    server: {
      deps: {
        inline: ["convex-test"],
      },
    },
  },
});
