import { auth } from "@clerk/nextjs/server"
import { createCaller } from "@/trpc/server"
import { OnboardingFlow } from "@/features/onboarding/components/onboarding-flow"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import { CheckCircle2, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function OnboardingPage() {
  await auth.protect()
  
  let status = { completed: false, patient: null as any }
  let dbError: string | null = null

  try {
    const trpc = await createCaller()
    status = await trpc.onboarding.status()
  } catch (err: any) {
    console.error("[OnboardingPage] Failed to fetch onboarding status:", err)
    dbError = err?.message || "Database connection error"
  }

  if (status.completed && status.patient) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-6">
        <Card className="border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="size-6" />
            </div>
            <CardTitle className="text-xl">Health Profile Active</CardTitle>
            <CardDescription>
              Onboarding has already been completed for your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Patient Name:</span>
                <span className="font-semibold">{status.patient.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Year of Birth:</span>
                <span className="font-mono">{status.patient.yearOfBirth}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tenant / Workspace:</span>
                <span className="font-mono text-muted-foreground">
                  {status.patient.tenantId.slice(0, 12)}...
                </span>
              </div>
            </div>

            <Link
              href="/dashboard"
              className={buttonVariants({ className: "w-full gap-2" })}
            >
              Continue to Dashboard <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <ShieldCheck className="size-4" />
          <span>Patient Registration</span>
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Welcome to Nirvaya
        </h1>
        <p className="text-sm text-muted-foreground">
          Complete your metabolic health profile. Voice input is optional with
          transient server processing; keyboard entry is always available.
        </p>
      </div>

      {dbError && (
        <Card className="border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-400 space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="size-4" />
            <span>Database Connection Notice</span>
          </div>
          <p>
            Could not verify existing patient status with PostgreSQL: <code>{dbError}</code>.
            If using a cloud database (e.g. Neon, Supabase), ensure <code>DATABASE_URL</code> in Vercel includes <code>?sslmode=require</code> and database migrations have run (<code>pnpm db:migrate</code>).
          </p>
        </Card>
      )}

      <OnboardingFlow />
    </div>
  )
}
