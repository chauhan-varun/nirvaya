"use client"

import * as React from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Network,
  ShieldCheck,
  RefreshCw,
  Activity,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Database,
} from "lucide-react"
import { VisualGraphNetwork } from "./visual-graph-network"

export function CareGraphView() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const insightsQuery = useQuery(trpc.graph.insights.queryOptions({}))
  const statusQuery = useQuery(trpc.graph.status.queryOptions())

  const syncMutation = useMutation(
    trpc.graph.sync.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries()
      },
    })
  )

  const insights = insightsQuery.data
  const syncStatus = statusQuery.data

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Network className="size-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Care network & graph projections
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Visual representation of authorized relationships, active care
          circle consent, and health observation summaries.
        </p>
      </div>

      {/* Projection Outbox Status Bar */}
      <Card size="sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Database className="size-4 text-primary" />
            <CardTitle className="text-xs uppercase tracking-wider">
              Transactional outbox status
            </CardTitle>
          </div>
          <Button
            size="xs"
            variant="outline"
            className="gap-1.5"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate({ batchSize: 25 })}
          >
            <RefreshCw
              className={`size-3 ${syncMutation.isPending ? "animate-spin" : ""}`}
            />
            {syncMutation.isPending ? "Syncing…" : "Sync outbox now"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Pending</span>
              <p className="text-xl font-bold">
                {syncStatus?.pending ?? 0}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Completed</span>
              <p className="text-xl font-bold text-green-700 dark:text-green-400">
                {syncStatus?.completed ?? 0}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Failed (Retrying)</span>
              <p className="text-xl font-bold text-amber-600">
                {syncStatus?.failed ?? 0}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Sync Health</span>
              <div className="flex items-center gap-1.5 pt-1">
                {(syncStatus?.pending ?? 0) === 0 ? (
                  <Badge variant="default" className="text-xs gap-1">
                    <CheckCircle2 className="size-3" /> Caught up
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Clock className="size-3" /> Catching up
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Graph Visual Structure */}
      {insightsQuery.isPending && (
        <div className="text-sm text-muted-foreground animate-pulse">
          Loading graph structure…
        </div>
      )}

      {insightsQuery.isError && (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {insightsQuery.error.message || "Failed to load graph insights"}
        </div>
      )}

      {insights && (
        <div className="space-y-6">
          {/* Interactive Visual Graph Canvas */}
          <VisualGraphNetwork insights={insights} />

          <div className="grid gap-6 md:grid-cols-2">
          {/* Patient Core Node */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-5 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    Patient & ownership node
                  </CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  :Patient
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Patient identity in your connected care network
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-secondary/50 p-3 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Node ID:</span>
                  <span className="truncate max-w-[200px]">
                    {insights.patientId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Year of Birth:</span>
                  <span>{insights.yearOfBirth ?? "Not recorded"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gender:</span>
                  <span>{insights.gender ?? "Not recorded"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Owner User:</span>
                  <span className="truncate max-w-[200px]">
                    {insights.ownerUserId}
                  </span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ArrowRight className="size-3 text-primary shrink-0" />
                Directed relationship: <code className="text-foreground">(User)-[:OWNS]-&gt;(Patient)</code>
              </div>
            </CardContent>
          </Card>

          {/* Active Care Circle Consents */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    Care circle consent edges
                  </CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  :Consent
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Active permissions granted to caregivers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {insights.activeConsents.length === 0 ? (
                <div className="rounded-lg bg-secondary/50 p-4 text-center text-xs text-muted-foreground">
                  No active caregiver consent edges in graph.
                </div>
              ) : (
                <div className="space-y-2">
                  {insights.activeConsents.map((c) => (
                    <div
                      key={c.consentId}
                      className="rounded-lg border p-2.5 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">
                          {c.purpose || "Health support"}
                        </span>
                        <Badge variant="default" className="text-[10px]">
                          Active
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {c.scopes.map((s) => (
                          <span
                            key={s}
                            className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate">
                        Grantee: {c.granteeId}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ArrowRight className="size-3 text-primary shrink-0" />
                Directed path: <code className="text-foreground">(Patient)-[:HAS_CONSENT]-&gt;(Consent)-[:GRANTS_TO]-&gt;(User)</code>
              </div>
            </CardContent>
          </Card>

          {/* Observation Summary Projections */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="size-5 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    Observation summaries
                  </CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  :ObservationSummary
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Privacy-preserving aggregated metric nodes (no raw personal notes or free-text)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {insights.observationSummaries.length === 0 ? (
                <div className="rounded-lg bg-secondary/50 p-6 text-center text-xs text-muted-foreground">
                  No observation summaries projected yet. Record entries in the Daily Journal and sync outbox.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {insights.observationSummaries.map((obs) => (
                    <div
                      key={obs.type}
                      className="rounded-lg border p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm capitalize">
                          {obs.type.replace(/_/g, " ")}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {obs.unit}
                        </Badge>
                      </div>
                      <div className="flex items-baseline justify-between pt-1">
                        <span className="text-xs text-muted-foreground">Recorded count:</span>
                        <span className="text-lg font-bold">{obs.count}</span>
                      </div>
                      {obs.latestObservedAt && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          Latest: {new Date(obs.latestObservedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      )}
    </div>
  )
}
