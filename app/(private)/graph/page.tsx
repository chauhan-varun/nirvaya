import { auth } from "@clerk/nextjs/server"
import { createCaller } from "@/trpc/server"
import { CareGraphView } from "@/features/graph/components/care-graph-view"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function GraphPage() {
  await auth.protect()

  const trpc = await createCaller()
  const onboarding = await trpc.onboarding.status()

  if (!onboarding.completed) {
    return (
      <div className="rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/30 p-6 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-400">
          Onboarding required
        </p>
        <p className="mt-1 text-muted-foreground">
          Please complete your health profile before viewing the care graph.{" "}
          <Link href="/onboarding" className="underline">
            Start onboarding →
          </Link>
        </p>
      </div>
    )
  }

  return <CareGraphView />
}
