import "dotenv/config"
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://sugarguard:qxVL5vG9wDXSAgblb8gbJAoCklw+b6MmENc3B5Op9+0=@localhost:5432/sugarguard",
  },
  verbose: true,
  strict: true,
})
