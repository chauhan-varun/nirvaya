"use client"

import { useState } from "react"
import { useTRPC } from "@/trpc/client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty"
import {
  Activity,
  HeartPulse,
  Utensils,
  Moon,
  Droplets,
  Pill,
  CheckCircle2,
  AlertCircle,
  Clock,
  Scan,
  ShieldAlert,
  Mic,
} from "lucide-react"
import { LabReportScanner } from "./lab-report-scanner"
import { VoiceJournalLogger } from "./voice-journal-logger"
import { PreventionPlanCard } from "@/features/prevention/components/prevention-plan-card"

export function JournalDashboard() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // Form states
  const [activeTab, setActiveTab] = useState("glucose")
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Glucose state
  const [glucoseValue, setGlucoseValue] = useState<number | "">("")
  const [glucoseUnit, setGlucoseUnit] = useState<"mg/dL" | "mmol/L">("mg/dL")
  const [glucoseContext, setGlucoseContext] = useState<
    "glucose_fasting" | "glucose_postprandial" | "glucose_random"
  >("glucose_fasting")
  const [glucoseNotes, setGlucoseNotes] = useState("")

  // Meal state
  const [mealType, setMealType] = useState<
    "breakfast" | "lunch" | "dinner" | "snack"
  >("breakfast")
  const [mealDesc, setMealDesc] = useState("")
  const [carbsGrams, setCarbsGrams] = useState<number | "">("")

  // Activity state
  const [activityType, setActivityType] = useState<
    "walking" | "running" | "cycling" | "yoga" | "strength" | "other"
  >("walking")
  const [activityMinutes, setActivityMinutes] = useState<number | "">("")
  const [activityNotes, setActivityNotes] = useState("")

  // Sleep state
  const [sleepHours, setSleepHours] = useState<number | "">("")
  const [sleepQuality, setSleepQuality] = useState<
    "restful" | "interrupted" | "light"
  >("restful")

  // Hydration state
  const [hydrationMl, setHydrationMl] = useState<number | "">("")

  // Medication state
  const [medName, setMedName] = useState("")
  const [medDose, setMedDose] = useState("")
  const [medNotes, setMedNotes] = useState("")

  // Fetch recent observations
  const observationsQuery = useQuery(
    trpc.journal.list.queryOptions({ limit: 30 })
  )

  const handleMutationSuccess = (msg: string) => {
    setErrorMessage(null)
    setSuccessMessage(msg)
    queryClient.invalidateQueries({
      queryKey: trpc.journal.list.queryKey(),
    })
    setTimeout(() => setSuccessMessage(null), 5000)
  }

  // Glucose Mutation
  const recordGlucoseMutation = useMutation(
    trpc.journal.recordGlucose.mutationOptions({
      onSuccess(data) {
        setGlucoseValue("")
        setGlucoseNotes("")
        handleMutationSuccess(
          data.isDuplicate
            ? "Duplicate entry acknowledged (idempotent)."
            : "Blood glucose reading recorded."
        )
      },
      onError(err) {
        setErrorMessage(err.message)
      },
    })
  )

  // Meal Mutation
  const recordMealMutation = useMutation(
    trpc.journal.recordMeal.mutationOptions({
      onSuccess() {
        setMealDesc("")
        setCarbsGrams("")
        handleMutationSuccess("Meal entry recorded.")
      },
      onError(err) {
        setErrorMessage(err.message)
      },
    })
  )

  // Activity Mutation
  const recordActivityMutation = useMutation(
    trpc.journal.recordActivity.mutationOptions({
      onSuccess() {
        setActivityMinutes("")
        setActivityNotes("")
        handleMutationSuccess("Activity entry recorded.")
      },
      onError(err) {
        setErrorMessage(err.message)
      },
    })
  )

  // Sleep Mutation
  const recordSleepMutation = useMutation(
    trpc.journal.recordSleep.mutationOptions({
      onSuccess() {
        setSleepHours("")
        handleMutationSuccess("Sleep log recorded.")
      },
      onError(err) {
        setErrorMessage(err.message)
      },
    })
  )

  // Hydration Mutation
  const recordHydrationMutation = useMutation(
    trpc.journal.recordHydration.mutationOptions({
      onSuccess() {
        setHydrationMl("")
        handleMutationSuccess("Hydration log recorded.")
      },
      onError(err) {
        setErrorMessage(err.message)
      },
    })
  )

  // Medication Mutation
  const recordMedicationMutation = useMutation(
    trpc.journal.recordMedication.mutationOptions({
      onSuccess() {
        setMedName("")
        setMedDose("")
        setMedNotes("")
        handleMutationSuccess("Prescribed medication log recorded.")
      },
      onError(err) {
        setErrorMessage(err.message)
      },
    })
  )

  const isPending =
    recordGlucoseMutation.isPending ||
    recordMealMutation.isPending ||
    recordActivityMutation.isPending ||
    recordSleepMutation.isPending ||
    recordHydrationMutation.isPending ||
    recordMedicationMutation.isPending

  const handleGlucoseSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!glucoseValue) return
    recordGlucoseMutation.mutate({
      value: Number(glucoseValue),
      unit: glucoseUnit,
      context: glucoseContext,
      observedAt: new Date().toISOString(),
      notes: glucoseNotes || undefined,
    })
  }

  const handleMealSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!mealDesc.trim()) return
    recordMealMutation.mutate({
      mealType,
      description: mealDesc.trim(),
      carbsGrams: carbsGrams ? Number(carbsGrams) : undefined,
      observedAt: new Date().toISOString(),
    })
  }

  const handleActivitySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activityMinutes) return
    recordActivityMutation.mutate({
      activityType,
      durationMinutes: Number(activityMinutes),
      notes: activityNotes || undefined,
      observedAt: new Date().toISOString(),
    })
  }

  const handleSleepSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sleepHours) return
    recordSleepMutation.mutate({
      durationHours: Number(sleepHours),
      quality: sleepQuality,
      observedAt: new Date().toISOString(),
    })
  }

  const handleHydrationSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!hydrationMl) return
    recordHydrationMutation.mutate({
      amountMl: Number(hydrationMl),
      observedAt: new Date().toISOString(),
    })
  }

  const handleMedicationSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!medName.trim() || !medDose.trim()) return
    recordMedicationMutation.mutate({
      medicationName: medName.trim(),
      dose: medDose.trim(),
      notes: medNotes || undefined,
      observedAt: new Date().toISOString(),
    })
  }

  const recentObservations = observationsQuery.data?.observations ?? []

  return (
    <div className="space-y-6">
      {/* Alert Notices */}
      {successMessage && (
        <Alert className="border-emerald-500/30 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle className="text-xs font-semibold">Success</AlertTitle>
          <AlertDescription className="text-xs">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle className="text-xs font-semibold">Entry Error</AlertTitle>
          <AlertDescription className="text-xs">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Dynamic Evidence-Based Diabetes Risk Reduction & Lifestyle Prevention Plan */}
      <PreventionPlanCard
        observations={recentObservations}
        onSelectJournalTab={(tab, defaultMinutes) => {
          setActiveTab(tab)
          if (tab === "activity" && defaultMinutes) {
            setActivityType("walking")
            setActivityMinutes(defaultMinutes)
            setActivityNotes("Post-meal walk (GLUT4 muscle activation)")
          }
        }}
      />

      {/* Logging Forms Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <HeartPulse className="size-5" />
            <CardTitle className="text-base font-semibold">
              Daily Health Journal
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Record verified metabolic observations, meals, movement, sleep, and
            prescribed medicines. Stored in your private tenant with audit trail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 w-full h-auto gap-1">
              <TabsTrigger value="glucose" className="gap-1.5 text-xs">
                <HeartPulse className="size-3.5" /> Glucose
              </TabsTrigger>
              <TabsTrigger value="meals" className="gap-1.5 text-xs">
                <Utensils className="size-3.5" /> Meals
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5 text-xs">
                <Activity className="size-3.5" /> Activity
              </TabsTrigger>
              <TabsTrigger value="sleep" className="gap-1.5 text-xs">
                <Moon className="size-3.5" /> Sleep
              </TabsTrigger>
              <TabsTrigger value="hydration" className="gap-1.5 text-xs">
                <Droplets className="size-3.5" /> Hydration
              </TabsTrigger>
              <TabsTrigger value="medication" className="gap-1.5 text-xs">
                <Pill className="size-3.5" /> Medicines
              </TabsTrigger>
              <TabsTrigger value="voice" className="gap-1.5 text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-semibold">
                <Mic className="size-3.5" /> Voice Log
              </TabsTrigger>
              <TabsTrigger value="ocr" className="gap-1.5 text-xs bg-primary/10 text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
                <Scan className="size-3.5" /> Scan Report (OCR)
              </TabsTrigger>
            </TabsList>

            {/* 1. Glucose Tab */}
            <TabsContent value="glucose">
              <form onSubmit={handleGlucoseSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="glucose-value" className="text-xs">
                      Blood Glucose Value <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="glucose-value"
                      type="number"
                      step={glucoseUnit === "mg/dL" ? "1" : "0.1"}
                      placeholder={glucoseUnit === "mg/dL" ? "e.g. 115" : "e.g. 6.4"}
                      value={glucoseValue}
                      onChange={(e) =>
                        setGlucoseValue(
                          e.target.value ? parseFloat(e.target.value) : ""
                        )
                      }
                      disabled={isPending}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="glucose-unit" className="text-xs">
                      Unit of Measurement
                    </Label>
                    <select
                      id="glucose-unit"
                      value={glucoseUnit}
                      onChange={(e) =>
                        setGlucoseUnit(e.target.value as "mg/dL" | "mmol/L")
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      disabled={isPending}
                    >
                      <option value="mg/dL">mg/dL (India / US standard)</option>
                      <option value="mmol/L">mmol/L (UK / International)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="glucose-context" className="text-xs">
                      Measurement Context
                    </Label>
                    <select
                      id="glucose-context"
                      value={glucoseContext}
                      onChange={(e) =>
                        setGlucoseContext(
                          e.target.value as
                            | "glucose_fasting"
                            | "glucose_postprandial"
                            | "glucose_random"
                        )
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      disabled={isPending}
                    >
                      <option value="glucose_fasting">Fasting (pre-meal)</option>
                      <option value="glucose_postprandial">
                        Postprandial (2h after meal)
                      </option>
                      <option value="glucose_random">Random / Bedtime</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="glucose-notes" className="text-xs">
                    Context Notes (Optional)
                  </Label>
                  <Input
                    id="glucose-notes"
                    placeholder="e.g. Checked after morning walk, feeling well"
                    value={glucoseNotes}
                    onChange={(e) => setGlucoseNotes(e.target.value)}
                    disabled={isPending}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-muted-foreground">
                    Plausible boundary enforced (20–600 mg/dL). No diagnostic
                    inference.
                  </span>
                  <Button type="submit" size="sm" disabled={isPending || !glucoseValue}>
                    {isPending ? (
                      <>
                        <Spinner className="mr-2 size-3.5" /> Saving...
                      </>
                    ) : (
                      "Save Glucose Entry"
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* 2. Meals Tab */}
            <TabsContent value="meals">
              <form onSubmit={handleMealSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="meal-type" className="text-xs">
                      Meal Type
                    </Label>
                    <select
                      id="meal-type"
                      value={mealType}
                      onChange={(e) =>
                        setMealType(
                          e.target.value as
                            | "breakfast"
                            | "lunch"
                            | "dinner"
                            | "snack"
                        )
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      disabled={isPending}
                    >
                      <option value="breakfast">Breakfast</option>
                      <option value="lunch">Lunch</option>
                      <option value="dinner">Dinner</option>
                      <option value="snack">Snack</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="carbs-grams" className="text-xs">
                      Estimated Carbohydrates (grams, optional)
                    </Label>
                    <Input
                      id="carbs-grams"
                      type="number"
                      placeholder="e.g. 45"
                      value={carbsGrams}
                      onChange={(e) =>
                        setCarbsGrams(
                          e.target.value ? parseFloat(e.target.value) : ""
                        )
                      }
                      disabled={isPending}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="meal-desc" className="text-xs">
                    Meal Description <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="meal-desc"
                    placeholder="e.g. 2 whole wheat rotis, dal tadka, cucumber salad"
                    value={mealDesc}
                    onChange={(e) => setMealDesc(e.target.value)}
                    disabled={isPending}
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-muted-foreground">
                    Meal logs assist in correlating postprandial glucose
                    patterns.
                  </span>
                  <Button type="submit" size="sm" disabled={isPending || !mealDesc.trim()}>
                    {isPending ? (
                      <>
                        <Spinner className="mr-2 size-3.5" /> Saving...
                      </>
                    ) : (
                      "Save Meal Entry"
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* 3. Activity Tab */}
            <TabsContent value="activity">
              <form onSubmit={handleActivitySubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="activity-type" className="text-xs">
                      Activity Type
                    </Label>
                    <select
                      id="activity-type"
                      value={activityType}
                      onChange={(e) =>
                        setActivityType(
                          e.target.value as
                            | "walking"
                            | "running"
                            | "cycling"
                            | "yoga"
                            | "strength"
                            | "other"
                        )
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      disabled={isPending}
                    >
                      <option value="walking">Brisk Walking</option>
                      <option value="running">Running / Jogging</option>
                      <option value="cycling">Cycling</option>
                      <option value="yoga">Yoga / Stretching</option>
                      <option value="strength">Strength / Resistance</option>
                      <option value="other">Other Activity</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="activity-minutes" className="text-xs">
                      Duration (Minutes) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="activity-minutes"
                      type="number"
                      placeholder="e.g. 30"
                      value={activityMinutes}
                      onChange={(e) =>
                        setActivityMinutes(
                          e.target.value ? parseInt(e.target.value, 10) : ""
                        )
                      }
                      disabled={isPending}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="activity-notes" className="text-xs">
                    Notes (Optional)
                  </Label>
                  <Input
                    id="activity-notes"
                    placeholder="e.g. Post-dinner walk at steady pace"
                    value={activityNotes}
                    onChange={(e) => setActivityNotes(e.target.value)}
                    disabled={isPending}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-muted-foreground">
                    Self-reported activity. Camera presence is never counted as
                    exercise.
                  </span>
                  <Button type="submit" size="sm" disabled={isPending || !activityMinutes}>
                    {isPending ? (
                      <>
                        <Spinner className="mr-2 size-3.5" /> Saving...
                      </>
                    ) : (
                      "Save Activity Entry"
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* 4. Sleep Tab */}
            <TabsContent value="sleep">
              <form onSubmit={handleSleepSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sleep-hours" className="text-xs">
                      Sleep Duration (Hours) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="sleep-hours"
                      type="number"
                      step="0.5"
                      placeholder="e.g. 7.5"
                      value={sleepHours}
                      onChange={(e) =>
                        setSleepHours(
                          e.target.value ? parseFloat(e.target.value) : ""
                        )
                      }
                      disabled={isPending}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="sleep-quality" className="text-xs">
                      Sleep Quality
                    </Label>
                    <select
                      id="sleep-quality"
                      value={sleepQuality}
                      onChange={(e) =>
                        setSleepQuality(
                          e.target.value as "restful" | "interrupted" | "light"
                        )
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      disabled={isPending}
                    >
                      <option value="restful">Restful (Woke up refreshed)</option>
                      <option value="interrupted">Interrupted / Fragmented</option>
                      <option value="light">Light / Restless</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-muted-foreground">
                    Captures restorative sleep context with local date/time.
                  </span>
                  <Button type="submit" size="sm" disabled={isPending || !sleepHours}>
                    {isPending ? (
                      <>
                        <Spinner className="mr-2 size-3.5" /> Saving...
                      </>
                    ) : (
                      "Save Sleep Log"
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* 5. Hydration Tab */}
            <TabsContent value="hydration">
              <form onSubmit={handleHydrationSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="hydration-ml" className="text-xs">
                    Water Intake (mL) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="hydration-ml"
                    type="number"
                    step="50"
                    placeholder="e.g. 500"
                    value={hydrationMl}
                    onChange={(e) =>
                      setHydrationMl(
                        e.target.value ? parseInt(e.target.value, 10) : ""
                      )
                    }
                    disabled={isPending}
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-muted-foreground">
                    Logged intake only. No generic medical targets.
                  </span>
                  <Button type="submit" size="sm" disabled={isPending || !hydrationMl}>
                    {isPending ? (
                      <>
                        <Spinner className="mr-2 size-3.5" /> Saving...
                      </>
                    ) : (
                      "Save Hydration Log"
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* 6. Prescribed Medication Tab */}
            <TabsContent value="medication">
              <form onSubmit={handleMedicationSubmit} className="space-y-4">
                <Alert className="border-amber-500/30 bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                  <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-xs font-semibold">
                    Clinical Safety Boundary
                  </AlertTitle>
                  <AlertDescription className="text-xs">
                    Log only medicines currently prescribed by your qualified
                    doctor. Nirvaya records adherence but never
                    recommends, adjusts, or calculates medication dosages.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="med-name" className="text-xs">
                      Medicine Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="med-name"
                      placeholder="e.g. Metformin Hydrochloride"
                      value={medName}
                      onChange={(e) => setMedName(e.target.value)}
                      disabled={isPending}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="med-dose" className="text-xs">
                      Prescribed Dose <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="med-dose"
                      placeholder="e.g. 500 mg, 1 tablet"
                      value={medDose}
                      onChange={(e) => setMedDose(e.target.value)}
                      disabled={isPending}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="med-notes" className="text-xs">
                    Adherence Notes (Optional)
                  </Label>
                  <Input
                    id="med-notes"
                    placeholder="e.g. Taken after dinner with water"
                    value={medNotes}
                    onChange={(e) => setMedNotes(e.target.value)}
                    disabled={isPending}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-muted-foreground">
                    Logs adherence time for your personal and care-circle records.
                  </span>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isPending || !medName.trim() || !medDose.trim()}
                  >
                    {isPending ? (
                      <>
                        <Spinner className="mr-2 size-3.5" /> Saving...
                      </>
                    ) : (
                      "Save Medication Log"
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* 7. OCR Scan Tab */}
            <TabsContent value="ocr">
              <LabReportScanner
                onSaved={() => {
                  setSuccessMessage("Lab report measurements saved to your journal successfully.")
                  observationsQuery.refetch()
                }}
              />
            </TabsContent>

            {/* 8. Voice Log Tab */}
            <TabsContent value="voice">
              <VoiceJournalLogger
                onSuccess={(msg) => handleMutationSuccess(msg)}
                onError={(err) => setErrorMessage(err)}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Observations History Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">
                Recent Health Log Entries ({recentObservations.length})
              </CardTitle>
            </div>
            {observationsQuery.isFetching && (
              <Spinner className="size-3.5 text-primary" />
            )}
          </div>
          <CardDescription className="text-xs">
            Chronological records stored with exact numeric precision and audit
            provenance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {observationsQuery.isLoading ? (
            <div className="flex justify-center p-8">
              <Spinner className="size-6 text-primary" />
            </div>
          ) : recentObservations.length === 0 ? (
            <Empty className="border-border">
              <EmptyMedia variant="icon">
                <HeartPulse className="size-5 text-primary" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle className="text-sm">No entries recorded yet</EmptyTitle>
                <EmptyDescription className="text-xs">
                  Use the tabs above to log your first blood glucose reading,
                  meal, or movement entry.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px] text-xs">Category</TableHead>
                  <TableHead className="text-xs">Value / Details</TableHead>
                  <TableHead className="text-xs">Notes / Provenance</TableHead>
                  <TableHead className="w-[180px] text-right text-xs">
                    Recorded At
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentObservations.map((obs) => {
                  const date = new Date(obs.observedAt)
                  return (
                    <TableRow key={obs.id}>
                      <TableCell className="text-xs font-medium">
                        {obs.type.startsWith("glucose") ? (
                          <Badge variant="default" className="text-[10px]">
                            {obs.type.replace("glucose_", "")}
                          </Badge>
                        ) : obs.type === "meal" ? (
                          <Badge variant="secondary" className="text-[10px]">
                            meal
                          </Badge>
                        ) : obs.type === "activity" ? (
                          <Badge variant="outline" className="text-[10px]">
                            activity
                          </Badge>
                        ) : obs.type === "medication" ? (
                          <Badge
                            variant="destructive"
                            className="bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 text-[10px]"
                          >
                            medicine
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            {obs.type}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-semibold text-foreground">
                          {obs.numericValue}
                        </span>{" "}
                        <span className="text-muted-foreground">{obs.unit}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {obs.notes || "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {date.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        {date.toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
