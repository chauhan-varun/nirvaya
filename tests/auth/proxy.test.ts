import { describe, it, expect } from "vitest"
import proxyHandler, { config } from "@/proxy"

describe("Proxy & Clerk Core 3 Route Architecture", () => {
  it("exports a valid proxy handler function using bare clerkMiddleware", () => {
    expect(proxyHandler).toBeDefined()
    expect(typeof proxyHandler).toBe("function")
  })

  it("configures the required matcher including API/tRPC routes and excluding static assets", () => {
    expect(config).toBeDefined()
    expect(Array.isArray(config.matcher)).toBe(true)

    const matchers = config.matcher as string[]

    // Must match API and tRPC routes so auth() receives session context
    expect(matchers.some((m) => m.includes("api|trpc"))).toBe(true)

    // Must exclude Next.js static chunks and static file assets
    expect(matchers.some((m) => m.includes("_next"))).toBe(true)
  })

  it("does not rely on deprecated createRouteMatcher", async () => {
    // Read proxy source to verify createRouteMatcher is not imported
    const fs = await import("node:fs/promises")
    const proxySource = await fs.readFile("proxy.ts", "utf-8")

    expect(proxySource).not.toContain("createRouteMatcher")
    expect(proxySource).toContain("export default clerkMiddleware()")
  })
})
