import { describe, it, expect } from "vitest"
import { appRouter } from "@/server/trpc/routers/_app"
import { createCallerFactory } from "@/server/trpc/init"
import type { TRPCContext } from "@/server/trpc/context"

describe("Server Caller & Request-Local Isolation", () => {
  const createCaller = createCallerFactory(appRouter)

  it("ensures different request contexts are completely isolated", async () => {
    const userAContext: TRPCContext = {
      userId: "user_alice",
      sessionId: "sess_alice",
      orgId: null,
      requestId: "req_alice",
      origin: null,
      host: "localhost:3000",
    }

    const userBContext: TRPCContext = {
      userId: "user_bob",
      sessionId: "sess_bob",
      orgId: "org_clinic",
      requestId: "req_bob",
      origin: null,
      host: "localhost:3000",
    }

    const callerA = createCaller(userAContext)
    const callerB = createCaller(userBContext)

    const [resA, resB] = await Promise.all([
      callerA.auth.me(),
      callerB.auth.me(),
    ])

    expect(resA.subject).toBe("user_alice")
    expect(resB.subject).toBe("user_bob")
    expect(resA.orgId).toBeNull()
    expect(resB.orgId).toBe("org_clinic")
  })

  it("verifies server caller does not bypass procedure middleware", async () => {
    const invalidCaller = createCaller({
      userId: null,
      sessionId: null,
      orgId: null,
      requestId: "req_invalid",
      origin: null,
      host: null,
    })

    await expect(invalidCaller.auth.me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })
  })
})
