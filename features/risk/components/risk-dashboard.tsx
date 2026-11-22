"use client"

import * as React from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  HeartPulse,
  HelpCircle,
  Info,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react"
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
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

export function RiskDashboard() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const latestQuery = useQuery(trpc.risk.latest.queryOptions())
  const historyQuery = useQuery(trpc.risk.history.queryOptions({ limit: 5 }))

  const [isAssessing, setIsAssessing] = React.useState(false)

  // Form state
  const [alreadyDiagnosed, setAlreadyDiagnosed] = React.useState(false)
  const [ageYears, setAgeYears] = React.useState<number>(35)
  const [gender, setGender] = React.useState<"male" | "female">("male")
  const [waistCm, setWaistCm] = React.useState<number>(84)
  const [activity, setActivity] = React.useState<
    "vigorous" | "moderate" | "mild" | "sedentary"
  >("moderate")
  const [familyHistory, setFamilyHistory] = React.useState<
    "none" | "one_parent" | "both_parents"
  >("none")

  // Auto-fill from patient profile if available
  React.useEffect(() => {
    if (latestQuery.data?.patientProfile) {
      const p = latestQuery.data.patientProfile
      if (p.inferredAge) setAgeYears(p.inferredAge)
      if (p.gender === "male" || p.gender === "female") setGender(p.gender)
    }
  }, [latestQuery.data])

  const assessMutation = useMutation(
    trpc.risk.assess.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries()
        setIsAssessing(false)
      },
    })
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    assessMutation.mutate({
      ageYears,
      gender,
      waistCircumferenceCm: waistCm,
      physicalActivity: activity,
      familyHistory,
      alreadyDiagnosed,
    })
  }

  const latest = latestQuery.data?.assessment

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HeartPulse className="size-5" />
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              Metabolic Risk & Factor Analysis
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Clinically validated screening indicator (MDRF Indian Diabetes Risk
            Score) with modifiable lifestyle factor explanations.
          </p>
        </div>

        <Button
          onClick={() => setIsAssessing(!isAssessing)}
          variant={isAssessing ? "outline" : "default"}
          className="gap-2 shrink-0"
        >
          {isAssessing ? (
            <>
              <ChevronUp className="size-4" /> Cancel
            </>
          ) : (
            <>
              <Activity className="size-4" /> Take / Update Assessment
            </>
          )}
        </Button>
      </div>

      {/* Assessment Form Modal / Accordion */}
      {isAssessing && (
        <Card className="border-primary/30 bg-card shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">
              MDRF Indian Diabetes Risk Assessment
            </CardTitle>
            <CardDescription className="text-xs">
              Answer 5 clinical factor questions to calculate your risk tier
              deterministically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Prior diagnosis toggle */}
              <div className="rounded-lg border border-border/80 bg-muted/30 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alreadyDiagnosed}
                    onChange={(e) => setAlreadyDiagnosed(e.target.checked)}
                    className="mt-1 size-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      I have already been diagnosed with diabetes
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      The IDRS is a primary prevention screening tool for
                      undiagnosed individuals. If diagnosed, standard preventive
                      scoring is not applicable.
                    </p>
                  </div>
                </label>
              </div>

              {!alreadyDiagnosed && (
                <div className="grid gap-5 sm:grid-cols-2">
                  {/* Age */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Age (years)
                    </label>
                    <input
                      type="number"
                      min={18}
                      max={120}
                      value={ageYears}
                      onChange={(e) => setAgeYears(parseInt(e.target.value) || 18)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      &lt;35 yrs (0 pts), 35–49 yrs (20 pts), ≥50 yrs (30 pts)
                    </p>
                  </div>

                  {/* Gender */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Gender
                    </label>
                    <select
                      value={gender}
                      onChange={(e) =>
                        setGender(e.target.value as "male" | "female")
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      Used for gender-specific abdominal waist circumference cutoffs.
                    </p>
                  </div>

                  {/* Waist Circumference */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Waist Circumference (cm)
                    </label>
                    <input
                      type="number"
                      min={40}
                      max={200}
                      value={waistCm}
                      onChange={(e) => setWaistCm(parseInt(e.target.value) || 80)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Measured horizontally at the navel level.
                    </p>
                  </div>

                  {/* Physical Activity */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Daily Physical Activity
                    </label>
                    <select
                      value={activity}
                      onChange={(e) =>
                        setActivity(
                          e.target.value as
                            | "vigorous"
                            | "moderate"
                            | "mild"
                            | "sedentary"
                        )
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="vigorous">
                        Vigorous exercise or strenuous work (0 pts)
                      </option>
                      <option value="moderate">
                        Moderate daily activity / regular walking (10 pts)
                      </option>
                      <option value="mild">
                        Mild activity / mostly desk routine (20 pts)
                      </option>
                      <option value="sedentary">
                        Sedentary routine with minimal movement (30 pts)
                      </option>
                    </select>
                  </div>

                  {/* Family History */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Parental History of Type 2 Diabetes
                    </label>
                    <select
                      value={familyHistory}
                      onChange={(e) =>
                        setFamilyHistory(
                          e.target.value as "none" | "one_parent" | "both_parents"
                        )
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="none">
                        Neither parent has diabetes (0 pts)
                      </option>
                      <option value="one_parent">
                        One parent has diabetes (10 pts)
                      </option>
                      <option value="both_parents">
                        Both parents have diabetes (20 pts)
                      </option>
                    </select>
                  </div>
                </div>
              )}

              {assessMutation.isError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  {assessMutation.error.message}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAssessing(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={assessMutation.isPending}
                  className="gap-2"
                >
                  {assessMutation.isPending && (
                    <RefreshCw className="size-3.5 animate-spin" />
                  )}
                  Calculate & Save Assessment
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Latest Assessment Results */}
      {latestQuery.isLoading && (
        <div className="h-64 animate-pulse rounded-xl border bg-muted/40" />
      )}

      {!latestQuery.isLoading && !latest && !isAssessing && (
        <Card className="border-dashed p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <HeartPulse className="size-6" />
          </div>
          <h2 className="text-base font-semibold">No Risk Assessment on File</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            Take a 1-minute validated Indian Diabetes Risk Score (IDRS)
            assessment to understand your baseline risk tier and modifiable
            lifestyle factors.
          </p>
          <Button
            onClick={() => setIsAssessing(true)}
            className="mt-4 gap-2"
          >
            <Activity className="size-4" /> Start Assessment
          </Button>
        </Card>
      )}

      {!latestQuery.isLoading && latest && (
        <div className="space-y-6">
          {/* Main Score Card */}
          <Card className="overflow-hidden border-border/80 shadow-sm">
            <div
              className={cn(
                "px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4",
                latest.riskTier === "low" && "bg-emerald-500/10 border-emerald-500/20",
                latest.riskTier === "moderate" && "bg-amber-500/10 border-amber-500/20",
                latest.riskTier === "high" && "bg-rose-500/10 border-rose-500/20",
                latest.alreadyDiagnosed && "bg-blue-500/10 border-blue-500/20"
              )}
            >
              <div className="flex items-center gap-3">
                {latest.riskTier === "low" && (
                  <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400" />
                )}
                {latest.riskTier === "moderate" && (
                  <AlertTriangle className="size-6 text-amber-600 dark:text-amber-400" />
                )}
                {latest.riskTier === "high" && (
                  <ShieldAlert className="size-6 text-rose-600 dark:text-rose-400" />
                )}
                {latest.alreadyDiagnosed && (
                  <Info className="size-6 text-blue-600 dark:text-blue-400" />
                )}

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">
                      {latest.alreadyDiagnosed
                        ? "Diagnosed Diabetes Pathway"
                        : `${latest.riskTier ? latest.riskTier.toUpperCase() : "SCREENING"} RISK TIER`}
                    </h2>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-semibold capitalize",
                        latest.riskTier === "low" && "border-emerald-500/30 text-emerald-600",
                        latest.riskTier === "moderate" && "border-amber-500/30 text-amber-600",
                        latest.riskTier === "high" && "border-rose-500/30 text-rose-600"
                      )}
                    >
                      {latest.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Assessed {formatDistanceToNow(new Date(latest.assessedAt), { addSuffix: true })} ({format(new Date(latest.assessedAt), "dd MMM yyyy, h:mm a")})
                  </p>
                </div>
              </div>

              {!latest.alreadyDiagnosed && latest.totalScore !== null && (
                <div className="text-right">
                  <div className="text-3xl font-black tabular-nums tracking-tight">
                    {latest.totalScore}
                    <span className="text-sm font-normal text-muted-foreground">
                      /100
                    </span>
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    IDRS Score
                  </span>
                </div>
              )}
            </div>

            <CardContent className="p-6 space-y-6">
              {/* Clinical summary */}
              <div className="rounded-lg bg-muted/40 p-4 border border-border/60">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Clinical Guidance & Summary
                </h3>
                <p className="text-sm leading-relaxed text-foreground">
                  {latest.clinicalSummary}
                </p>
              </div>

              {/* Factor Breakdown */}
              {!latest.alreadyDiagnosed && latest.factorBreakdown?.factors && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      Contributing Factor Breakdown
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      MDRF-IDRS Validated Standard
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {latest.factorBreakdown.factors.map((f) => (
                      <div
                        key={f.factor}
                        className="rounded-lg border border-border/60 p-4 space-y-2 bg-card"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {f.label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                f.category === "modifiable"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {f.category === "modifiable"
                                ? "Modifiable"
                                : "Non-modifiable"}
                            </Badge>
                            <span className="font-mono text-xs font-bold tabular-nums">
                              {f.score} / {f.maxScore} pts
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {f.summary}
                        </p>

                        {f.recommendation && (
                          <div className="rounded bg-primary/5 p-2 text-[11px] text-primary flex items-start gap-1.5">
                            <Sparkles className="size-3.5 shrink-0 mt-0.5" />
                            <span>{f.recommendation}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Screening limitations & disclaimer */}
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-muted-foreground space-y-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold">
                  <ShieldCheck className="size-4" />
                  <span>Clinical Scope & Screening Boundaries</span>
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    The Indian Diabetes Risk Score is a screening indicator for
                    population risk awareness; it is <strong>not</strong> a medical diagnosis.
                  </li>
                  <li>
                    High or moderate scores indicate an increased likelihood of
                    undiagnosed diabetes or impaired glucose tolerance and warrant laboratory confirmation.
                  </li>
                  <li>
                    Never start, stop, or alter any medication or dosing regimen without direct physician consultation.
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Assessment History */}
          {historyQuery.data && historyQuery.data.entries.length > 1 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  Assessment History
                </CardTitle>
                <CardDescription className="text-xs">
                  Your previous screening snapshots and lifestyle trend records.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border/60">
                  {historyQuery.data.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="py-3 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <span className="font-medium text-foreground capitalize">
                          {entry.alreadyDiagnosed
                            ? "Diagnosed Care"
                            : `${entry.riskTier} Risk (${entry.totalScore ?? 0}/100)`}
                        </span>
                        <p className="text-muted-foreground">
                          {format(new Date(entry.assessedAt), "d MMM yyyy, h:mm a")}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {entry.riskTier}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
