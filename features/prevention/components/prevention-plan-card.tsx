"use client"

import * as React from "react"
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Droplets,
  Flame,
  HeartPulse,
  Info,
  Moon,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Utensils,
  Footprints,
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
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress"
import {
  generatePreventionPlan,
  PreventionObservation,
  DailyHabitChecklist,
  LifestyleProtocol,
} from "@/lib/prevention/prevention-engine"
import { cn } from "@/lib/utils"

interface PreventionPlanCardProps {
  observations: PreventionObservation[]
  onSelectJournalTab?: (tab: string, defaultMinutes?: number) => void
  className?: string
}

export function PreventionPlanCard({
  observations,
  onSelectJournalTab,
  className,
}: PreventionPlanCardProps) {
  // Local state for today's interactive checklist
  const [completedIds, setCompletedIds] = React.useState<string[]>([])
  const [showProtocols, setShowProtocols] = React.useState(false)
  const [selectedProtocol, setSelectedProtocol] = React.useState<string | null>("glut4_walking")

  // Load saved checklist from localStorage on mount
  React.useEffect(() => {
    try {
      const todayKey = `nirvaya_prevention_${new Date().toISOString().slice(0, 10)}`
      const saved = localStorage.getItem(todayKey)
      if (saved) {
        setCompletedIds(JSON.parse(saved))
      }
    } catch {
      // Storage access blocked or unavailable
    }
  }, [])

  // Toggle habit completion
  const handleToggleHabit = (id: string) => {
    setCompletedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      try {
        const todayKey = `nirvaya_prevention_${new Date().toISOString().slice(0, 10)}`
        localStorage.setItem(todayKey, JSON.stringify(next))
      } catch {
        // Ignored
      }
      return next
    })
  }

  // Generate dynamic plan from observations and checklist state
  const plan = React.useMemo(() => {
    return generatePreventionPlan(observations, completedIds)
  }, [observations, completedIds])

  return (
    <Card className={cn("overflow-hidden border-primary/30 shadow-md", className)}>
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-5 sm:p-6 border-b border-border/70">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-medium text-xs">
                <Sparkles className="mr-1 size-3 text-primary" />
                ICMR-INDIAB & ADA DPP Grounded
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "font-medium text-xs",
                  plan.preventionAdherenceScore >= 70
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                )}
              >
                Adherence: {plan.preventionAdherenceScore}%
              </Badge>
            </div>
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="size-6 text-primary shrink-0" />
              Active Diabetes Prevention & Risk Reduction Plan
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
              Your logged glucose, meals, and movements are synthesized into clinical lifestyle targets
              designed to blunt glycemic spikes and restore cellular insulin sensitivity.
            </p>
          </div>

          {/* Risk Reduction Callout Box */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 sm:p-4 text-center sm:text-right shrink-0">
            <div className="flex items-center justify-center sm:justify-end gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
              <TrendingDown className="size-4" />
              <span>Target Risk Reduction</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">
              Up to {plan.estimatedRiskReductionPercent}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              per ADA Diabetes Prevention Program
            </p>
          </div>
        </div>

        {/* Actionable recommendations banner */}
        {plan.actionableRecommendations.length > 0 && (
          <div className="mt-4 rounded-lg border border-primary/20 bg-background/80 p-3 text-xs space-y-1.5">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Info className="size-3.5 text-primary" />
              <span>Priority Action Recommendations based on your logs:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              {plan.actionableRecommendations.slice(0, 3).map((rec, i) => (
                <li key={i} className="leading-relaxed">
                  <span className="text-foreground font-medium">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <CardContent className="p-5 sm:p-6 space-y-6">
        {/* Core Prevention Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Weekly Movement */}
          <div className="rounded-xl border border-border/80 bg-card p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Footprints className="size-4 text-primary" /> Weekly Movement
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {plan.activityProgressPercent}%
              </Badge>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">{plan.weeklyActivityMinutes}</span>
              <span className="text-xs text-muted-foreground">/ 150 mins (ICMR)</span>
            </div>
            <Progress value={plan.activityProgressPercent} className="h-2">
              <ProgressTrack className="h-2 bg-muted">
                <ProgressIndicator
                  className={cn(
                    "h-2",
                    plan.activityProgressPercent >= 100
                      ? "bg-emerald-500"
                      : "bg-primary"
                  )}
                  style={{ width: `${plan.activityProgressPercent}%` }}
                />
              </ProgressTrack>
            </Progress>
            {onSelectJournalTab && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectJournalTab("activity", 15)}
                className="w-full text-xs h-7 text-primary hover:text-primary hover:bg-primary/10 gap-1"
              >
                + Log 15-min walk <ArrowRight className="size-3" />
              </Button>
            )}
          </div>

          {/* 2. Glycemic Stability */}
          <div className="rounded-xl border border-border/80 bg-card p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <HeartPulse className="size-4 text-rose-500" /> Glycemic Control
              </span>
              {plan.postprandialSpikeCount > 0 ? (
                <Badge variant="destructive" className="text-[10px]">
                  {plan.postprandialSpikeCount} Spikes
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                  Stable
                </Badge>
              )}
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xl font-bold">
                  {plan.fastingAverage ? `${plan.fastingAverage}` : "--"}
                </span>
                <span className="text-[11px] text-muted-foreground ml-1">Fasting</span>
              </div>
              <div>
                <span className="text-xl font-bold">
                  {plan.postprandialAverage ? `${plan.postprandialAverage}` : "--"}
                </span>
                <span className="text-[11px] text-muted-foreground ml-1">Post-Meal</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {plan.postprandialSpikeCount > 0
                ? "Post-meal walks blunt glucose spikes >140 mg/dL"
                : "Target: Fasting <100, Postprandial <140 mg/dL"}
            </p>
            {onSelectJournalTab && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectJournalTab("glucose")}
                className="w-full text-xs h-7 text-primary hover:text-primary hover:bg-primary/10 gap-1"
              >
                Record Glucose <ArrowRight className="size-3" />
              </Button>
            )}
          </div>

          {/* 3. Daily Hydration */}
          <div className="rounded-xl border border-border/80 bg-card p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Droplets className="size-4 text-sky-500" /> Daily Hydration
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {plan.hydrationProgressPercent}%
              </Badge>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">{plan.dailyHydrationMl}</span>
              <span className="text-xs text-muted-foreground">/ 2,500 mL</span>
            </div>
            <Progress value={plan.hydrationProgressPercent} className="h-2">
              <ProgressTrack className="h-2 bg-muted">
                <ProgressIndicator
                  className="h-2 bg-sky-500"
                  style={{ width: `${plan.hydrationProgressPercent}%` }}
                />
              </ProgressTrack>
            </Progress>
            {onSelectJournalTab && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectJournalTab("hydration")}
                className="w-full text-xs h-7 text-primary hover:text-primary hover:bg-primary/10 gap-1"
              >
                + Log Water <ArrowRight className="size-3" />
              </Button>
            )}
          </div>

          {/* 4. Sleep Recovery */}
          <div className="rounded-xl border border-border/80 bg-card p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Moon className="size-4 text-indigo-400" /> Sleep Recovery
              </span>
              <Badge variant="secondary" className="text-[10px]">
                Target: 7-8h
              </Badge>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">
                {plan.averageSleepHours !== null ? `${plan.averageSleepHours}` : "--"}
              </span>
              <span className="text-xs text-muted-foreground">hours / night</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Adequate deep sleep prevents nighttime cortisol surges that worsen morning insulin resistance.
            </p>
            {onSelectJournalTab && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectJournalTab("sleep")}
                className="w-full text-xs h-7 text-primary hover:text-primary hover:bg-primary/10 gap-1"
              >
                Log Sleep <ArrowRight className="size-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Today's Daily Prevention Checklist */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                Today&apos;s Lifestyle Prevention Protocol Checklist
              </h3>
              <p className="text-xs text-muted-foreground">
                Check off daily protocols as you complete them to boost your adherence score.
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-medium">
              {plan.checklists.filter((c) => c.isCompleted).length} / {plan.checklists.length} Done
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plan.checklists.map((item) => (
              <div
                key={item.id}
                onClick={() => handleToggleHabit(item.id)}
                className={cn(
                  "cursor-pointer rounded-xl border p-3.5 transition-all flex items-start gap-3",
                  item.isCompleted
                    ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10"
                    : "border-border/80 bg-card hover:border-primary/50 hover:bg-accent/30"
                )}
              >
                <div className="mt-0.5 shrink-0">
                  <div
                    className={cn(
                      "size-5 rounded-md border flex items-center justify-center transition-colors",
                      item.isCompleted
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-muted-foreground/40 bg-background"
                    )}
                  >
                    {item.isCompleted && <CheckCircle2 className="size-3.5" />}
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-xs font-semibold leading-tight",
                        item.isCompleted ? "line-through text-muted-foreground" : "text-foreground"
                      )}
                    >
                      {item.title}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                      {item.target}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {item.description}
                  </p>
                  <div className="text-[10px] text-primary/80 font-medium">
                    {item.currentProgress}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evidence & Biological Mechanism Drawer */}
        <div className="border border-border/70 rounded-xl overflow-hidden bg-muted/20">
          <button
            type="button"
            onClick={() => setShowProtocols(!showProtocols)}
            className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <span>Clinical Mechanisms: Why These Protocols Reverse Insulin Resistance</span>
            </div>
            {showProtocols ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>

          {showProtocols && (
            <div className="p-4 border-t border-border/70 space-y-4 bg-background">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                {plan.lifestyleProtocols.map((p) => (
                  <Button
                    key={p.id}
                    variant={selectedProtocol === p.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedProtocol(p.id)}
                    className="text-xs justify-start h-auto py-2 px-3 text-left whitespace-normal"
                  >
                    <div>
                      <div className="font-semibold">{p.title}</div>
                      <div className="text-[10px] opacity-80">{p.badge}</div>
                    </div>
                  </Button>
                ))}
              </div>

              {selectedProtocol && (
                (() => {
                  const active = plan.lifestyleProtocols.find((p) => p.id === selectedProtocol)
                  if (!active) return null
                  return (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">{active.title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {active.badge}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-foreground">Mechanism: </strong>
                        {active.mechanism}
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-foreground">Action Guidance: </strong>
                        {active.actionGuidance}
                      </p>
                      <div className="pt-2 text-[10px] text-muted-foreground/80 border-t border-border/50">
                        <strong>Evidence: </strong> {active.evidenceReference}
                      </div>
                    </div>
                  )
                })()
              )}
            </div>
          )}
        </div>

        {/* Disclaimer per clinical rules */}
        <p className="text-[11px] text-muted-foreground/75 leading-relaxed text-center">
          {plan.riskReductionCitation} This lifestyle prevention plan is strictly educational and supportive of daily habits. It does not replace medical consultation, clinical diagnosis, or prescribed pharmaceutical regimens.
        </p>
      </CardContent>
    </Card>
  )
}
