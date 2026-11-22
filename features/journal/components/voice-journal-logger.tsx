"use client"

import * as React from "react"
import { useState, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import {
  Mic,
  Square,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Activity,
  Utensils,
  HeartPulse,
  Pill,
  Droplets,
  RotateCcw,
} from "lucide-react"
import { parseJournalSpeech, ParsedJournalEntry } from "@/lib/voice/journal-parser"

interface VoiceJournalLoggerProps {
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

export function VoiceJournalLogger({ onSuccess, onError }: VoiceJournalLoggerProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [parsedEntry, setParsedEntry] = useState<ParsedJournalEntry | null>(null)
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Transcribe mutation via Sarvam STT
  const transcribeMutation = useMutation(
    trpc.onboarding.transcribeAudio.mutationOptions({
      onSuccess(data) {
        setIsTranscribing(false)
        setTranscript(data.transcript)
        const parsed = parseJournalSpeech(data.transcript)
        setParsedEntry(parsed)
        if (parsed.kind !== "unknown") {
          setVoiceNotice(`Understood: ${parsed.confidence}`)
        } else {
          setVoiceNotice("Could not confidently identify the health category. Try saying your glucose, meal, or walk duration.")
        }
      },
      onError(err) {
        setIsTranscribing(false)
        onError(`Voice transcription failed: ${err.message}`)
      },
    })
  )

  // Direct mutations to save parsed records
  const recordGlucoseMutation = useMutation(
    trpc.journal.recordGlucose.mutationOptions({
      onSuccess() {
        queryClient.invalidateQueries({ queryKey: trpc.journal.list.queryKey() })
        onSuccess("Blood glucose recorded via voice log.")
        handleReset()
      },
      onError(err) {
        onError(err.message)
      },
    })
  )

  const recordMealMutation = useMutation(
    trpc.journal.recordMeal.mutationOptions({
      onSuccess() {
        queryClient.invalidateQueries({ queryKey: trpc.journal.list.queryKey() })
        onSuccess("Meal entry recorded via voice log.")
        handleReset()
      },
      onError(err) {
        onError(err.message)
      },
    })
  )

  const recordActivityMutation = useMutation(
    trpc.journal.recordActivity.mutationOptions({
      onSuccess() {
        queryClient.invalidateQueries({ queryKey: trpc.journal.list.queryKey() })
        onSuccess("Physical activity recorded via voice log.")
        handleReset()
      },
      onError(err) {
        onError(err.message)
      },
    })
  )

  const recordMedicationMutation = useMutation(
    trpc.journal.recordMedication.mutationOptions({
      onSuccess() {
        queryClient.invalidateQueries({ queryKey: trpc.journal.list.queryKey() })
        onSuccess("Prescribed medication recorded via voice log.")
        handleReset()
      },
      onError(err) {
        onError(err.message)
      },
    })
  )

  const recordHydrationMutation = useMutation(
    trpc.journal.recordHydration.mutationOptions({
      onSuccess() {
        queryClient.invalidateQueries({ queryKey: trpc.journal.list.queryKey() })
        onSuccess("Hydration recorded via voice log.")
        handleReset()
      },
      onError(err) {
        onError(err.message)
      },
    })
  )

  const isSaving =
    recordGlucoseMutation.isPending ||
    recordMealMutation.isPending ||
    recordActivityMutation.isPending ||
    recordMedicationMutation.isPending ||
    recordHydrationMutation.isPending

  const handleReset = () => {
    setTranscript("")
    setParsedEntry(null)
    setVoiceNotice(null)
  }

  const startRecording = async () => {
    setVoiceNotice(null)
    setTranscript("")
    setParsedEntry(null)

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onError("Microphone recording is not supported in this browser.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" })

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        })

        if (audioBlob.size === 0) {
          onError("No audio recorded.")
          return
        }

        setIsTranscribing(true)
        setVoiceNotice("Processing speech with Sarvam AI...")

        const reader = new FileReader()
        reader.onloadend = () => {
          const base64Data = (reader.result as string).split(",")[1]
          if (base64Data) {
            transcribeMutation.mutate({
              audioBase64: base64Data,
              mimeType: "audio/webm",
            })
          }
        }
        reader.readAsDataURL(audioBlob)
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setRecordingSeconds(0)

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 20) {
            stopRecording()
            return 20
          }
          return prev + 1
        })
      }, 1000)
    } catch (err: unknown) {
      onError(
        err instanceof Error
          ? err.message
          : "Microphone permission denied or unavailable."
      )
    }
  }

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  const handleSaveParsedEntry = () => {
    if (!parsedEntry) return
    const now = new Date().toISOString()

    switch (parsedEntry.kind) {
      case "glucose":
        recordGlucoseMutation.mutate({
          value: parsedEntry.value,
          unit: parsedEntry.unit,
          context: parsedEntry.context,
          observedAt: now,
          notes: parsedEntry.notes,
        })
        break
      case "meal":
        recordMealMutation.mutate({
          mealType: parsedEntry.mealType,
          description: parsedEntry.description,
          carbsGrams: parsedEntry.carbsGrams,
          observedAt: now,
        })
        break
      case "activity":
        recordActivityMutation.mutate({
          activityType: parsedEntry.activityType,
          durationMinutes: parsedEntry.minutes,
          observedAt: now,
          notes: parsedEntry.notes,
        })
        break
      case "medication":
        recordMedicationMutation.mutate({
          medicationName: parsedEntry.medicineName,
          dose: parsedEntry.dosage || "1 dose",
          observedAt: now,
          notes: parsedEntry.notes,
        })
        break
      case "hydration":
        recordHydrationMutation.mutate({
          amountMl: parsedEntry.milliliters,
          observedAt: now,
        })
        break
    }
  }

  return (
    <div className="space-y-6">
      {/* Voice Intake Mic Card */}
      <Card className="border-emerald-500/20 bg-gradient-to-b from-emerald-500/5 via-card to-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Mic className="size-4" />
              </span>
              <div>
                <CardTitle className="text-sm font-semibold">
                  Voice Journal Intake
                </CardTitle>
                <CardDescription className="text-xs">
                  Speak your reading in English or Hindi (e.g. &ldquo;Fasting sugar 114 mg/dL&rdquo; or &ldquo;Took Metformin 500mg&rdquo;)
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px]">
              Sarvam saaras:v3
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-background/50 p-6 text-center">
            {isRecording ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <span className="relative flex size-4">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex size-4 rounded-full bg-red-500" />
                  </span>
                  <span className="font-mono text-sm font-semibold text-foreground">
                    Recording: {recordingSeconds}s / 20s
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Say your glucose, meal, walk, or medicine clearly...
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={stopRecording}
                  className="gap-2"
                >
                  <Square className="size-3.5" /> Stop & Process Entry
                </Button>
              </div>
            ) : isTranscribing ? (
              <div className="flex flex-col items-center gap-2 py-4 text-xs text-muted-foreground">
                <Spinner className="size-6 text-emerald-600" />
                <span className="font-medium">Transcribing speech with Sarvam AI...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  type="button"
                  onClick={startRecording}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  size="lg"
                >
                  <Mic className="size-4" /> Start Speaking
                </Button>
                <p className="text-xs text-muted-foreground">
                  Click to speak. Audio is processed transiently and never stored.
                </p>
              </div>
            )}
          </div>

          {voiceNotice && (
            <Alert className="border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200">
              <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
              <AlertTitle className="text-xs font-semibold">Voice Processing Result</AlertTitle>
              <AlertDescription className="text-xs">{voiceNotice}</AlertDescription>
            </Alert>
          )}

          {/* Transcript Display */}
          {transcript && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Recognized Transcript
              </span>
              <p className="mt-1 text-xs text-foreground italic">&ldquo;{transcript}&rdquo;</p>
            </div>
          )}

          {/* Parsed Entry Card */}
          {parsedEntry && parsedEntry.kind !== "unknown" && (
            <div className="rounded-2xl border border-primary/20 bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <CheckCircle2 className="size-4" /> Structured Entry Recognized
                </span>
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {parsedEntry.kind}
                </Badge>
              </div>

              {parsedEntry.kind === "glucose" && (
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-center">
                  <div>
                    <span className="text-[10px] text-muted-foreground">Value</span>
                    <p className="text-lg font-bold text-foreground">{parsedEntry.value}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Unit</span>
                    <p className="text-sm font-semibold text-foreground">{parsedEntry.unit}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Context</span>
                    <p className="text-xs font-medium text-foreground capitalize">
                      {parsedEntry.context.replace("glucose_", "")}
                    </p>
                  </div>
                </div>
              )}

              {parsedEntry.kind === "meal" && (
                <div className="space-y-1 rounded-xl bg-muted/40 p-3">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold capitalize text-foreground">{parsedEntry.mealType}</span>
                    {parsedEntry.carbsGrams && (
                      <span className="text-muted-foreground">~{parsedEntry.carbsGrams}g carbs</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{parsedEntry.description}</p>
                </div>
              )}

              {parsedEntry.kind === "activity" && (
                <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                  <span className="text-xs font-semibold capitalize text-foreground">
                    {parsedEntry.activityType}
                  </span>
                  <span className="text-xs font-bold text-primary">
                    {parsedEntry.minutes} minutes
                  </span>
                </div>
              )}

              {parsedEntry.kind === "medication" && (
                <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                  <span className="text-xs font-semibold text-foreground">
                    {parsedEntry.medicineName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {parsedEntry.dosage || "Standard Dose"}
                  </span>
                </div>
              )}

              {parsedEntry.kind === "hydration" && (
                <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                  <span className="text-xs font-semibold text-foreground">Water Intake</span>
                  <span className="text-xs font-bold text-blue-600">{parsedEntry.milliliters} ml</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="gap-1 text-xs"
                >
                  <RotateCcw className="size-3" /> Discard
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveParsedEntry}
                  disabled={isSaving}
                  className="gap-1.5 text-xs bg-primary"
                >
                  {isSaving ? (
                    <>
                      <Spinner className="size-3.5" /> Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" /> Confirm & Log to Journal
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Quick Examples Helper */}
          <div className="border-t border-border/50 pt-3">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Example Phrases You Can Say:
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              <span className="rounded-md border bg-muted/30 px-2 py-0.5">
                &ldquo;Fasting sugar 114 mg/dL&rdquo;
              </span>
              <span className="rounded-md border bg-muted/30 px-2 py-0.5">
                &ldquo;After lunch sugar 142&rdquo;
              </span>
              <span className="rounded-md border bg-muted/30 px-2 py-0.5">
                &ldquo;Took Metformin 500 mg&rdquo;
              </span>
              <span className="rounded-md border bg-muted/30 px-2 py-0.5">
                &ldquo;Walked for 30 minutes&rdquo;
              </span>
              <span className="rounded-md border bg-muted/30 px-2 py-0.5">
                &ldquo;Had 2 rotis and dal for dinner&rdquo;
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
