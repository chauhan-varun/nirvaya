"use client"

import * as React from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import {
  Activity,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Droplets,
  Heart,
  RefreshCw,
  Scale,
  Share2,
  User,
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { cn } from "@/lib/utils"

// ─── Scope badge config ────────────────────────────────────────────────────

type ScopeKey =
  | "view_glucose"
  | "view_weight"
  | "view_blood_pressure"
  | "view_journal"
  | "view_medications"

const SCOPE_CONFIG: Record<
  ScopeKey,
  { label: string; icon: React.ElementType; color: string }
> = {
  view_glucose: {
    label: "Blood glucose",
    icon: Droplets,
    color: "text-blue-500 bg-blue-500/10",
  },
  view_weight: {
    label: "Weight",
    icon: Scale,
    color: "text-green-500 bg-green-500/10",
  },
  view_blood_pressure: {
    label: "Blood pressure",
    icon: Heart,
    color: "text-red-500 bg-red-500/10",
  },
  view_journal: {
    label: "Journal",
    icon: Activity,
    color: "text-purple-500 bg-purple-500/10",
  },
  view_medications: {
    label: "Medications",
    icon: Activity,
    color: "text-orange-500 bg-orange-500/10",
  },
}

function ScopeBadge({ scope }: { scope: string }) {
  const cfg = SCOPE_CONFIG[scope as ScopeKey]
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        cfg.color
      )}
    >
      <Icon className="size-3" aria-hidden />
      {cfg.label}
    </span>
  )
}

// ─── Observation helpers ───────────────────────────────────────────────────

function typeLabel(type: string): string {
  const MAP: Record<string, string> = {
    glucose_fasting: "Glucose (fasting)",
    glucose_postprandial: "Glucose (post-meal)",
    glucose_random: "Glucose (random)",
    weight: "Weight",
    systolic_bp: "Systolic BP",
    diastolic_bp: "Diastolic BP",
  }
  return MAP[type] ?? type
}

function typeColor(type: string): string {
  if (type.startsWith("glucose")) return "text-blue-500"
  if (type === "weight") return "text-green-500"
  if (type.includes("bp")) return "text-red-500"
  return "text-muted-foreground"
}

// ─── Grant DTO type ────────────────────────────────────────────────────────

interface GrantDTO {
  consentGrantId: string
  patientId: string
  tenantId: string
  patientName: string | null
  grantorEmail: string
  purpose: string
  scopes: string[]
  grantedAt: string
  expiresAt: string
}

// ─── Patient card — expandable observations ────────────────────────────────

function PatientCard({ grant }: { grant: GrantDTO }) {
  const trpc = useTRPC()
  const [expanded, setExpanded] = React.useState(false)

  const obsQuery = useQuery({
    ...trpc.careCircle.delegateObservations.queryOptions({
      patientId: grant.patientId,
      tenantId: grant.tenantId,
      limit: 20,
    }),
    enabled: expanded,
    staleTime: 30_000,
  })

  const expiresAt = new Date(grant.expiresAt)
  const daysLeft = Math.ceil(
    (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  const expiresLabel =
    daysLeft <= 7
      ? `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
      : `Expires ${format(expiresAt, "d MMM yyyy")}`

  const displayName = grant.patientName ?? grant.grantorEmail

  return (
    <article className="rounded-xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* Card header */}
      <div className="flex items-start gap-4 p-5">
        {/* Avatar */}
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="size-5" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {displayName}
            </h2>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Active
            </span>
          </div>

          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {grant.grantorEmail}
          </p>

          <p className="mt-1 text-xs text-muted-foreground italic">
            &ldquo;{grant.purpose}&rdquo;
          </p>

          {/* Scope badges */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {grant.scopes.map((s) => (
              <ScopeBadge key={s} scope={s} />
            ))}
          </div>

          {/* Timestamps */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              Shared{" "}
              {formatDistanceToNow(new Date(grant.grantedAt), {
                addSuffix: true,
              })}
            </span>
            <span
              className={cn(
                "flex items-center gap-1",
                daysLeft <= 7 ? "text-amber-500" : ""
              )}
            >
              <Clock className="size-3" aria-hidden />
              {expiresLabel}
            </span>
          </div>
        </div>

        {/* Toggle button */}
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              <ChevronDown className="size-3.5" aria-hidden />
              Hide
            </>
          ) : (
            <>
              <ChevronRight className="size-3.5" aria-hidden />
              View readings
            </>
          )}
        </button>
      </div>

      {/* Expandable observations panel */}
      {expanded && (
        <div className="border-t border-border/40 bg-muted/20 px-5 py-4">
          {obsQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="size-4 animate-spin" aria-hidden />
              Loading readings…
            </div>
          )}

          {obsQuery.isError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              {obsQuery.error?.message ?? "Failed to load readings."}
            </div>
          )}

          {obsQuery.data && obsQuery.data.observations.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No readings recorded yet for the shared scopes.
            </p>
          )}

          {obsQuery.data && obsQuery.data.observations.length > 0 && (
            <div className="space-y-2">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Recent readings (last {obsQuery.data.observations.length})
              </p>
              <div className="divide-y divide-border/30 overflow-hidden rounded-lg border border-border/40 bg-background">
                {obsQuery.data.observations.map((obs) => (
                  <div
                    key={obs.id}
                    className="flex items-center justify-between gap-4 px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          typeColor(obs.type)
                        )}
                      >
                        {typeLabel(obs.type)}
                      </span>
                      {obs.notes && (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {obs.notes}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {obs.numericValue}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {obs.unit}
                        </span>
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(obs.observedAt), "d MMM, h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

// ─── Main dashboard ────────────────────────────────────────────────────────

export function SharedWithMeDashboard() {
  const trpc = useTRPC()

  const { data, isLoading, isError, error, refetch } = useQuery({
    ...trpc.careCircle.sharedWithMe.queryOptions(),
    staleTime: 60_000,
  })

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Share2 className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Shared with me</h1>
            <p className="text-sm text-muted-foreground">
              Health data others have shared with you
            </p>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl border border-border/40 bg-muted/50"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden />
            <div>
              <p className="font-medium text-destructive">
                Could not load shared data
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {error?.message ?? "An unexpected error occurred."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {data && data.total === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 py-14 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Share2 className="size-7" aria-hidden />
          </div>
          <h2 className="text-base font-semibold text-foreground">
            Nothing shared with you yet
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            When someone adds you to their Care Circle and you accept, their
            shared health readings will appear here.
          </p>
        </div>
      )}

      {/* Grants list */}
      {data && data.total > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {data.total} active {data.total === 1 ? "share" : "shares"}
          </p>
          {data.grants.map((grant) => (
            <PatientCard key={grant.consentGrantId} grant={grant} />
          ))}
        </div>
      )}
    </div>
  )
}
