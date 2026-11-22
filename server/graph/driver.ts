import "server-only"
import neo4j, { type Driver, type Session } from "neo4j-driver"

declare global {
  var __neo4jDriver: Driver | undefined
}

function getNeo4jConfig() {
  const uri = process.env.NEO4J_URI || "bolt://localhost:7687"
  const user = process.env.NEO4J_USER || "neo4j"
  const password =
    process.env.NEO4J_PASSWORD ||
    "qxVL5vG9wDXSAgblb8gbJAoCklw+b6MmENc3B5Op9+0="

  return { uri, user, password }
}

export function getNeo4jDriver(): Driver {
  if (!globalThis.__neo4jDriver) {
    const { uri, user, password } = getNeo4jConfig()
    globalThis.__neo4jDriver = neo4j.driver(
      uri,
      neo4j.auth.basic(user, password),
      {
        maxConnectionPoolSize: 25,
        connectionTimeout: 10000,
      }
    )
  }

  return globalThis.__neo4jDriver
}

export async function closeNeo4jDriver(): Promise<void> {
  if (globalThis.__neo4jDriver) {
    await globalThis.__neo4jDriver.close()
    globalThis.__neo4jDriver = undefined
  }
}

export async function withNeo4jSession<T>(
  fn: (session: Session) => Promise<T>
): Promise<T> {
  const driver = getNeo4jDriver()
  const session = driver.session({
    defaultAccessMode: neo4j.session.WRITE,
  })

  try {
    return await fn(session)
  } finally {
    await session.close()
  }
}
