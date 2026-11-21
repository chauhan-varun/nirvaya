import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET as trpcHandler } from "@/app/api/trpc/[trpc]/route"

describe("tRPC Transport & Route Handler", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("enforces private, no-store headers on tRPC transport responses", async () => {
    const req = new NextRequest("http://localhost:3000/api/trpc/auth.me", {
      method: "GET",
      headers: {
        "x-request-id": "test_req_headers",
      },
    })

    const res = await trpcHandler(req)

    expect(res.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0, must-revalidate"
    )
  })

  it("sanitizes errors and includes requestId without leaking stack traces", async () => {
    const req = new NextRequest("http://localhost:3000/api/trpc/auth.me", {
      method: "GET",
      headers: {
        "x-request-id": "safe_req_123",
      },
    })

    const res = await trpcHandler(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBeDefined()
    expect(json.error.data.code).toBe("UNAUTHORIZED")
    expect(json.error.data.requestId).toBe("safe_req_123")
    expect(json.error.data.stack).toBeUndefined()
  })
})
