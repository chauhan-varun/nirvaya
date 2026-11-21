import { auth } from "@clerk/nextjs/server"
import { headers } from "next/headers"

export interface TRPCContext {
  userId: string | null
  sessionId: string | null
  orgId: string | null
  requestId: string
  origin: string | null
  host: string | null
}

export async function createTRPCContext(opts?: {
  headers?: Headers
  authOverride?: { userId: string | null; sessionId?: string | null; orgId?: string | null }
}): Promise<TRPCContext> {
  const reqHeaders = opts?.headers ?? (await headers())
  const requestId = reqHeaders.get("x-request-id") ?? crypto.randomUUID()
  const origin = reqHeaders.get("origin")
  const host = reqHeaders.get("host")

  if (opts?.authOverride) {
    return {
      userId: opts.authOverride.userId,
      sessionId: opts.authOverride.sessionId ?? null,
      orgId: opts.authOverride.orgId ?? null,
      requestId,
      origin,
      host,
    }
  }

  let userId: string | null = null
  let sessionId: string | null = null
  let orgId: string | null = null

  if (process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    try {
      const session = await auth()
      userId = session.userId
      sessionId = session.sessionId
      orgId = session.orgId ?? null
    } catch {
      userId = null
      sessionId = null
      orgId = null
    }
  }

  return {
    userId,
    sessionId,
    orgId,
    requestId,
    origin,
    host,
  }
}
