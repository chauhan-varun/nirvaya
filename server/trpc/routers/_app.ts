import { router } from "../init"
import { authRouter } from "./auth"
import { onboardingRouter } from "./onboarding"
import { journalRouter } from "./journal"
import { careCircleRouter } from "./care-circle"

export const appRouter = router({
  auth: authRouter,
  onboarding: onboardingRouter,
  journal: journalRouter,
  careCircle: careCircleRouter,
})

export type AppRouter = typeof appRouter
