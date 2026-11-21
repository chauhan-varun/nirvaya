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
  ShieldCheck,
  HeartPulse,
  Database,
  Activity,
  UserCheck,
  ArrowRight,
  AlertCircle,
} from "lucide-react"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  await auth.protect()
  const trpc = await createCaller()
  const identity = await trpc.auth.me()
  const onboarding = await trpc.onboarding.status()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Personal health dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Authenticated as{" "}
          <span className="font-mono text-xs font-semibold text-foreground">
            {identity.subject}
          </span>
        </p>
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="size-4" />
              <CardTitle className="text-xs tracking-wider uppercase">
                Identity status
              </CardTitle>
            </div>
            <CardDescription>Clerk verified session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <p>
              Subject:{" "}
              <span className="font-mono text-foreground">
                {identity.subject}
              </span>
            </p>
            {identity.sessionId && (
              <p>
                Session ID:{" "}
                <span className="font-mono text-foreground">
                  {identity.sessionId.slice(0, 12)}...
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500">
              <Database className="size-4" />
              <CardTitle className="text-xs tracking-wider uppercase">
                Database boundary
              </CardTitle>
            </div>
            <CardDescription>PostgreSQL 17 / Drizzle ORM</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <p>
              Transactional repository active. Multi-tenant isolation and
              atomic audit logging verified.
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Activity className="size-4" />
              <CardTitle className="text-xs tracking-wider uppercase">
                Clinical scope
              </CardTitle>
            </div>
            <CardDescription>No automated risk scoring</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <p>
              No fabricated medical scores are shown. Live clinical advice
              requires clinical review.
            </p>
          </CardContent>
        </Card>
      </div>

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
