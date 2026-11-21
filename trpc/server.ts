import "server-only"
import { createCallerFactory } from "@/server/trpc/init"
import { appRouter } from "@/server/trpc/routers/_app"
import { createTRPCContext } from "@/server/trpc/context"

const callerFactory = createCallerFactory(appRouter)

export async function createCaller() {
  const ctx = await createTRPCContext()
  return callerFactory(ctx)
}
