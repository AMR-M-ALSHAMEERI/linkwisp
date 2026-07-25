import { fileURLToPath } from "node:url";
import {
  cloudflareTest,
  readD1Migrations
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./test/wrangler.test.jsonc" },
      miniflare: {
        bindings: {
          ACCESS_TOKEN: "linkwisp-test-owner-token",
          TEST_MIGRATIONS: await readD1Migrations(
            fileURLToPath(new URL("./migrations", import.meta.url))
          )
        }
      }
    }))
  ],
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/apply-migrations.ts"]
  }
});
