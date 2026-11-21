import { router, protectedProcedure } from "../init"
import { z } from "zod"
import { upsertUserFromClerk } from "@/server/db/repositories/users"

export const authRouter = router({
  me: protectedProcedure
    .output(
      z.object({
        subject: z.string(),
        userId: z.string().optional(),
        preferredLocale: z.string().optional(),
        sessionId: z.string().nullable(),
        orgId: z.string().nullable(),
      })
    )
    .query(async ({ ctx }) => {
      let internalUserId: string | undefined
      let preferredLocale: string | undefined

      try {
        const user = await upsertUserFromClerk({
          clerkSubject: ctx.userId,
        })
        internalUserId = user.id
        preferredLocale = user.preferredLocale
      } catch {
        // If DB is temporarily unavailable or during tests without DB, proceed with verified subject
        internalUserId = undefined
        preferredLocale = undefined
      }

      return {
        subject: ctx.userId,
        userId: internalUserId,
        preferredLocale,
        sessionId: ctx.sessionId,
        orgId: ctx.orgId,
      }
    }),
})
