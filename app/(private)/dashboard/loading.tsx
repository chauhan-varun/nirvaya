import { Spinner } from "@/components/ui/spinner"

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Spinner className="size-6 text-primary" />
      <p className="text-xs">Loading dashboard...</p>
    </div>
  )
}
