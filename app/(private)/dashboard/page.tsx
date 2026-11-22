import { auth } from "@clerk/nextjs/server"
import { createCaller } from "@/trpc/server"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "@/components/ui/empty"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import { JournalDashboard } from "@/features/journal/components/journal-dashboard"
import {
  HeartPulse,
  UserCheck,
  ArrowRight,
  AlertCircle,
} from "lucide-react"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  await auth.protect()
  
  let onboarding = { completed: false, patient: null as any }
  let dbError: string | null = null

  try {
    const trpc = await createCaller()
    onboarding = await trpc.onboarding.status()
  } catch (err: any) {
    console.error("[DashboardPage] Failed to fetch onboarding status:", err)
    dbError = err?.message || "Database connection error"
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Personal health dashboard
        </h1>
      </div>

      {!onboarding.completed ? (
        <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="size-5" />
              <CardTitle className="text-base font-semibold">
                Profile Onboarding Required
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Complete your metabolic health profile and explicit data
              processing consent to unlock journal entries, device sync, and
              care-circle sharing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/onboarding"
              className={buttonVariants({ size: "sm", className: "gap-2" })}
            >
              Start Onboarding <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-primary">
              <UserCheck className="size-5" />
              <CardTitle className="text-sm font-semibold">
                Registered Patient: {onboarding.patient?.name}
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Year of birth: {onboarding.patient?.yearOfBirth} • Gender:{" "}
              {onboarding.patient?.gender ?? "Not specified"} • Tenant:{" "}
              <span className="font-mono">{onboarding.patient?.tenantId.slice(0, 8)}...</span>
            </CardDescription>
          </CardHeader>
        </Card>
      )}



      {onboarding.completed ? (
        <JournalDashboard />
      ) : (
        <Card className="p-4 md:p-8">
          <Empty className="border-border">
            <EmptyMedia variant="icon">
              <HeartPulse className="size-5 text-primary" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>No observation records yet</EmptyTitle>
              <EmptyDescription>
                This is your private workspace. Metabolic readings and daily journal
                entries will appear here once submitted.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <p className="text-xs text-muted-foreground">
                Health records, intake questionnaires, and care-circle consent
                workflows are strictly scoped to your tenant.
              </p>
            </EmptyContent>
          </Empty>
        </Card>
      )}
    </div>
  )
}
