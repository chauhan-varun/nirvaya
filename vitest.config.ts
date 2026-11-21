import "dotenv/config"
import { defineConfig } from "vitest/config"
import path from "node:path"

const rootDir = import.meta.dirname ?? "."

export default defineConfig({
  test: {
    environment: "node",
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://sugarguard:qxVL5vG9wDXSAgblb8gbJAoCklw+b6MmENc3B5Op9+0=@localhost:5432/sugarguard",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir),
      "server-only": path.resolve(rootDir, "node_modules/server-only/empty.js"),
    },
  },
})
