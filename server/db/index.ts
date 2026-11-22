import "server-only"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import pg from "pg"
import * as schema from "./schema"

const { Pool } = pg

declare global {
  var __dbPool: pg.Pool | undefined
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Configure PostgreSQL in .env.local or compose."
    )
  }
  return url
}

export function getDbPool(): pg.Pool {
  const url = getDatabaseUrl()
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1")

  if (!globalThis.__dbPool) {
    globalThis.__dbPool = new Pool({
      connectionString: url,
      max: process.env.NODE_ENV === "production" ? 10 : 5,
      idleTimeoutMillis: 30000,
      ssl: !isLocal ? { rejectUnauthorized: false } : undefined,
    })
  }

  return globalThis.__dbPool
}

let _dbInstance: NodePgDatabase<typeof schema> | null = null

export function getDb(): NodePgDatabase<typeof schema> {
  if (!_dbInstance) {
    const pool = getDbPool()
    _dbInstance = drizzle(pool, { schema })
  }
  return _dbInstance
}

// Lazy proxy: does NOT connect to PostgreSQL eagerly on module import
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const instance = getDb()
    return Reflect.get(instance, prop, receiver)
  },
})
