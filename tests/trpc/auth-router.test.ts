import { describe, it, expect } from "vitest"
import { appRouter } from "@/server/trpc/routers/_app"
import { createCallerFactory } from "@/server/trpc/init"
import type { TRPCContext } from "@/server/trpc/context"
import { TRPCError } from "@trpc/server"

describe("tRPC Auth Router & Protected Procedure", () => {
  const createCaller = createCallerFactory(appRouter)

  it("rejects unauthenticated requests with UNAUTHORIZED", async () => {
    const unauthCtx: TRPCContext = {
      userId: null,
      sessionId: null,
      orgId: null,
      requestId: "req_test_unauth",
      origin: null,
      host: "localhost:3000",
    }

    const caller = createCaller(unauthCtx)

    await expect(caller.auth.me()).rejects.toThrowError(TRPCError)
    await expect(caller.auth.me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    })
  })

  it("returns user subject and session when authenticated", async () => {
    const authCtx: TRPCContext = {
      userId: "user_2aBCdEf123",
      sessionId: "sess_987xYz",
      orgId: "org_careteam1",
      requestId: "req_test_auth",
      origin: "http://localhost:3000",
      host: "localhost:3000",
    }

    const caller = createCaller(authCtx)
    const result = await caller.auth.me()

    expect(result).toMatchObject({
      subject: "user_2aBCdEf123",
      sessionId: "sess_987xYz",
      orgId: "org_careteam1",
    })
    expect(result.userId).toBeDefined()
    expect(result.preferredLocale).toBe("en")
    // Ensure no health records or clinical data are exposed in identity procedure
    expect(result).not.toHaveProperty("patientId")
    expect(result).not.toHaveProperty("glucose")
  })

  it("enforces CSRF/Same-Origin checks for browser calls", async () => {
    const crossOriginCtx: TRPCContext = {
      userId: "user_2aBCdEf123",
      sessionId: "sess_987xYz",
      orgId: null,
      requestId: "req_test_csrf",
      origin: "https://malicious-site.example.com",
      host: "localhost:3000",
    }

    const caller = createCaller(crossOriginCtx)

    await expect(caller.auth.me()).rejects.toThrowError(TRPCError)
    await expect(caller.auth.me()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Cross-origin request rejected",
    })
  })

  it("allows matching origin and host", async () => {
    const validOriginCtx: TRPCContext = {
      userId: "user_2aBCdEf123",
      sessionId: "sess_987xYz",
      orgId: null,
      requestId: "req_test_valid_origin",
      origin: "http://localhost:3000",
      host: "localhost:3000",
    }

    const caller = createCaller(validOriginCtx)
    const result = await caller.auth.me()
    expect(result.subject).toBe("user_2aBCdEf123")
  })
})
