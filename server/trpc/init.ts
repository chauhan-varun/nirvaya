import { initTRPC, TRPCError } from "@trpc/server"
import type { TRPCContext } from "./context"

const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, ctx }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        requestId: ctx?.requestId,
        stack: undefined, // Never leak stack traces or internals to client
      },
    }
  },
})

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory

// Origin / CSRF validation middleware
const enforceSameOrigin = t.middleware(async ({ ctx, next }) => {
  if (ctx.origin && ctx.host) {
    try {
      const originHost = new URL(ctx.origin).host
      const allowedHost = ctx.host
      const appUrl = process.env.NEXT_PUBLIC_APP_URL
      const appHost = appUrl ? new URL(appUrl).host : null

      if (originHost !== allowedHost && originHost !== appHost) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cross-origin request rejected",
        })
      }
    } catch (err) {
      if (err instanceof TRPCError) throw err
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Invalid origin header",
      })
    }
  }
  return next()
})

export const protectedProcedure = t.procedure
  .use(enforceSameOrigin)
  .use(async ({ ctx, next }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      })
    }
    return next({
      ctx: {
        ...ctx,
        userId: ctx.userId,
      },
    })
  })
