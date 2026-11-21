import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { appRouter } from "@/server/trpc/routers/_app"
import { createTRPCContext } from "@/server/trpc/context"
import type { NextRequest } from "next/server"

const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError({ error, path }) {
      if (
        process.env.NODE_ENV === "development" &&
        error.code === "INTERNAL_SERVER_ERROR"
      ) {
        console.error(`[tRPC Error] ${path ?? "<no-path>"}:`, error.message)
      }
    },
  })

  // Enforce private, no-store response header on all transport responses
  response.headers.set(
    "Cache-Control",
    "private, no-store, max-age=0, must-revalidate"
  )
  return response
}

export { handler as GET, handler as POST }
