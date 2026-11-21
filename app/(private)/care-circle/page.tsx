import { auth } from "@clerk/nextjs/server"
import { createCaller } from "@/trpc/server"
import { CareCircleDashboard } from "@/features/care-circle/components/care-circle-dashboard"

export const dynamic = "force-dynamic"

export default async function CareCirclePage() {
  await auth.protect()

  // Resolve onboarding status and email server-side.
  // The email is passed to the Accept dialog as a convenience pre-fill;
  // it is re-verified on the server against the invitation's inviteeEmail.
  const trpc = await createCaller()
  const identity = await trpc.auth.me()
  const onboarding = await trpc.onboarding.status()

  if (!onboarding.completed) {
    return (
      <div className="rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/30 p-6 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-400">
          Onboarding required
        </p>
        <p className="mt-1 text-muted-foreground">
          Please complete your health profile before using Care Circle.{" "}
          <a href="/onboarding" className="underline">
            Start onboarding →
          </a>
        </p>
      </div>
    )
  }

  return (
    <CareCircleDashboard
      currentUserEmail={undefined /* Clerk email not exposed from server ctx in this setup */}
    />
  )
}
