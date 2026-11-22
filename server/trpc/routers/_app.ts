import { router } from "../init"
import { authRouter } from "./auth"
import { onboardingRouter } from "./onboarding"
import { journalRouter } from "./journal"
import { careCircleRouter } from "./care-circle"
import { graphRouter } from "./graph"
import { devicesRouter } from "./devices"
import { clinicRouter } from "./clinic"
import { riskRouter } from "./risk"

export const appRouter = router({
  auth: authRouter,
  onboarding: onboardingRouter,
  journal: journalRouter,
  careCircle: careCircleRouter,
  graph: graphRouter,
  devices: devicesRouter,
  clinic: clinicRouter,
  risk: riskRouter,
})

export type AppRouter = typeof appRouter
