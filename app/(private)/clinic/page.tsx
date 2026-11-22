import { auth } from "@clerk/nextjs/server"
import { createCaller } from "@/trpc/server"
import { ClinicDashboard } from "@/features/clinic/components/clinic-dashboard"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShieldAlert } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function ClinicPage() {
  await auth.protect()

  const trpc = await createCaller()
  const clinicianStatus = await trpc.clinic.status()

  if (!clinicianStatus.isClinician) {
    return (
      <div className="space-y-4">
        <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" />
              <CardTitle>Clinician Workspace Restricted</CardTitle>
            </div>
            <CardDescription>
              Verified clinic membership and clinician credentials required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Health-worker follow-up queues, patient worklists, and screening ingestion
              are restricted to verified staff belonging to an active clinic organization.
              Self-claimed or client-editable Clerk metadata does not confer clinician access.
            </p>
            <p>
              Status:{" "}
              <span className="font-semibold text-foreground">
                {clinicianStatus.verificationStatus ?? "No active clinician credentials found"}
              </span>
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard"
                className="text-xs font-medium text-primary underline"
              >
                ← Return to Personal Health Dashboard
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <ClinicDashboard />
}
