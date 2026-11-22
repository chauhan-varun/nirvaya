"use client"

import * as React from "react"
import { useTRPC } from "@/trpc/client"
import { useMutation } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import {
  AlertCircle,
  AudioLines,
  CheckCircle2,
  Mic,
  Square,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react"
import { parseRiskIntakeSpeech } from "@/lib/voice/risk-intake-parser"
import type { ParsedRiskIntakeValues } from "@/lib/voice/risk-intake-parser"
import { speakText, stopSpeaking, isSpeaking } from "@/lib/voice/speech-synthesis"

export interface VoiceRiskIntakeProps {
  onValuesExtracted: (values: ParsedRiskIntakeValues) => void
}

/**
 * Voice recording component that captures spoken health details (Hindi/English/Hinglish),
 * transcribes via Sarvam STT, extracts IDRS risk factor values, and passes them
 * to the parent risk assessment form for user verification.
 *
 * The microphone is only accessed after explicit user action (button click).
 * Audio is transient — never stored, never logged.
 */
export function VoiceRiskIntake({ onValuesExtracted }: VoiceRiskIntakeProps) {
  const trpc = useTRPC()

  const [isRecording, setIsRecording] = React.useState(false)
  const [recordingSeconds, setRecordingSeconds] = React.useState(0)
  const [voiceNotice, setVoiceNotice] = React.useState<string | null>(null)
  const [voiceNoticeType, setVoiceNoticeType] = React.useState<
    "info" | "success" | "error"
  >("info")
  const [transcript, setTranscript] = React.useState("")
  const [isTranscribing, setIsTranscribing] = React.useState(false)
  const [isPlayingPrompt, setIsPlayingPrompt] = React.useState(false)
  const [extractedValues, setExtractedValues] =
    React.useState<ParsedRiskIntakeValues | null>(null)

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const timerRef = React.useRef<NodeJS.Timeout | null>(null)
  const audioChunksRef = React.useRef<Blob[]>([])

  // Cleanup speech on unmount
  React.useEffect(() => {
    return () => {
      stopSpeaking()
    }
  }, [])

  // ─── Hindi Voice Prompt Playback ─────────────────────────────────
  const handlePlayPrompt = () => {
    if (isPlayingPrompt || isSpeaking()) {
      stopSpeaking()
      setIsPlayingPrompt(false)
      return
    }

    setIsPlayingPrompt(true)
    const started = speakText({
      text: "Apni diabetes risk jaanne ke liye bolna shuru karein. Apni umar, kamar ka naap, daily walk ya exercise, aur family diabetes history bolein.",
      lang: "hi-IN",
      onStart: () => setIsPlayingPrompt(true),
      onEnd: () => setIsPlayingPrompt(false),
      onError: () => setIsPlayingPrompt(false),
    })

    if (!started) {
      setIsPlayingPrompt(false)
    }
  }

  // ─── Transcribe mutation ─────────────────────────────────────────
  const transcribeMutation = useMutation(
    trpc.onboarding.transcribeAudio.mutationOptions({
      onSuccess(data) {
        setIsTranscribing(false)
        setTranscript(data.transcript)

        // Extract risk factor values from spoken transcript
        const parsed = parseRiskIntakeSpeech(data.transcript)
        setExtractedValues(parsed)

        const extractedCount = Object.values(parsed.confidence).filter(
          Boolean
        ).length
        const totalFields = Object.keys(parsed.confidence).length

        if (extractedCount > 0) {
          setVoiceNoticeType("success")
          setVoiceNotice(
            `✨ Extracted ${extractedCount}/${totalFields} risk factor values from voice. Review below and apply to form.`
          )
        } else {
          setVoiceNoticeType("info")
          setVoiceNotice(
            "Transcript captured but no risk factor values could be extracted. Try saying your age, waist measurement, activity level, and family history."
          )
        }
      },
      onError(err) {
        setIsTranscribing(false)
        setVoiceNoticeType("error")
        setVoiceNotice(`Transcription failed: ${err.message}`)
      },
    })
  )

  const startRecording = async () => {
    stopSpeaking()
    setIsPlayingPrompt(false)
    setVoiceNotice(null)
    setTranscript("")
    setExtractedValues(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceNoticeType("error")
      setVoiceNotice(
        "Microphone recording is not supported in this browser. Please fill in the form manually."
      )
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
          setVoiceNoticeType("error")
          setVoiceNotice("No audio captured.")
          return
        }

        setIsTranscribing(true)
        setVoiceNoticeType("info")
        setVoiceNotice("Processing audio with Sarvam STT...")

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
          if (prev >= 30) {
            stopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    } catch {
      setVoiceNoticeType("error")
      setVoiceNotice(
        "Microphone permission was denied or unavailable. Please use the form below."
      )
    }
  }

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop())
    }
    setIsRecording(false)
    setRecordingSeconds(0)
    setVoiceNoticeType("info")
    setVoiceNotice("Recording cancelled.")
  }

  const handleApplyValues = () => {
    if (extractedValues) {
      onValuesExtracted(extractedValues)
    }
  }

  // Helper: confidence indicator
  const FieldStatus = ({
    extracted,
    label,
    value,
  }: {
    extracted: boolean
    label: string
    value: string | undefined
  }) => (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {extracted ? (
        <Badge
          variant="secondary"
          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] gap-1"
        >
          <CheckCircle2 className="size-3" />
          {value}
        </Badge>
      ) : (
        <Badge
          variant="secondary"
          className="bg-muted text-muted-foreground text-[10px]"
        >
          Not detected
        </Badge>
      )}
    </div>
  )

  return (
    <Card className="border-dashed border-primary/30">
      <CardHeader className="pb-3">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <AudioLines className="size-5" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Voice Risk Intake (Hindi / English)
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePlayPrompt}
            className="h-7 gap-1.5 text-xs text-primary hover:bg-primary/10"
          >
            {isPlayingPrompt ? (
              <>
                <VolumeX className="size-3.5" /> Stop Prompt
              </>
            ) : (
              <>
                <Volume2 className="size-3.5" /> Suniye (Listen)
              </>
            )}
          </Button>
        </div>
        <CardTitle className="text-base">
          Speak your health details for risk assessment
        </CardTitle>
        <CardDescription className="text-xs">
          Say your age, waist or weight, daily activity level, and family diabetes
          history in Hindi or English. Example:{" "}
          <em className="text-foreground">
            &quot;Meri umar 42 saal hai, kamar 92 cm, roz subah walk karta
            hoon, papa ko diabetes hai&quot;
          </em>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Voice prompt in Hindi */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold flex items-center gap-1.5">
              <span>🎤</span>
              <span>Hindi Voice Prompt:</span>
            </p>
            <span className="text-[11px] text-muted-foreground">
              Sarvam STT Powered
            </span>
          </div>
          <p className="mt-1 font-medium text-foreground">
            &ldquo;Apni diabetes risk jaanne ke liye bolna shuru karein.&rdquo;
          </p>
          <p className="mt-0.5 text-muted-foreground text-[11px]">
            Apni umar, kamar ka naap ya weight, kitna exercise ya walk karte hain,
            aur family history bolein.
          </p>
        </div>

        {/* Recording Controls */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/40 p-6 text-center">
          {isRecording ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-rose-500">
                <span className="relative flex size-3">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex size-3 rounded-full bg-rose-500" />
                </span>
                <span className="font-mono text-sm font-semibold">
                  Recording: {recordingSeconds}s / 30s
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={stopRecording}
                >
                  <Square className="size-4" /> Stop & Extract
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={cancelRecording}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : isTranscribing ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4 text-primary" /> Transcribing &
              extracting risk values...
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={startRecording}
                className="gap-2"
              >
                <Mic className="size-4 text-primary" /> Start voice intake
              </Button>
              <p className="text-xs text-muted-foreground">
                Microphone is only accessed after clicking the button above.
                Audio is processed transiently and never stored.
              </p>
            </div>
          )}
        </div>

        {/* Voice Notice */}
        {voiceNotice && (
          <Alert
            variant={voiceNoticeType === "error" ? "destructive" : "default"}
          >
            {voiceNoticeType === "success" ? (
              <Sparkles className="size-4" />
            ) : (
              <AlertCircle className="size-4" />
            )}
            <AlertTitle>
              {voiceNoticeType === "success"
                ? "Values Extracted"
                : voiceNoticeType === "error"
                  ? "Error"
                  : "Notice"}
            </AlertTitle>
            <AlertDescription className="text-xs">
              {voiceNotice}
            </AlertDescription>
          </Alert>
        )}

        {/* Transcript display */}
        {transcript && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Transcript
            </p>
            <p className="rounded-md border bg-muted/30 p-3 text-xs text-foreground leading-relaxed">
              {transcript}
            </p>
          </div>
        )}

        {/* Extracted Values Preview */}
        {extractedValues && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Extracted Risk Factor Values
            </p>
            <div className="rounded-lg border p-3 space-y-0.5">
              <FieldStatus
                extracted={extractedValues.confidence.ageYears}
                label="Age"
                value={
                  extractedValues.ageYears
                    ? `${extractedValues.ageYears} years`
                    : undefined
                }
              />
              <FieldStatus
                extracted={extractedValues.confidence.gender}
                label="Gender"
                value={
                  extractedValues.gender
                    ? extractedValues.gender.charAt(0).toUpperCase() +
                      extractedValues.gender.slice(1)
                    : undefined
                }
              />
              <FieldStatus
                extracted={extractedValues.confidence.weightKg}
                label="Weight"
                value={
                  extractedValues.weightKg
                    ? `${extractedValues.weightKg} kg`
                    : undefined
                }
              />
              <FieldStatus
                extracted={extractedValues.confidence.waistCircumferenceCm}
                label="Waist Circumference"
                value={
                  extractedValues.waistCircumferenceCm
                    ? `${extractedValues.waistCircumferenceCm} cm`
                    : undefined
                }
              />
              <FieldStatus
                extracted={extractedValues.confidence.physicalActivity}
                label="Physical Activity"
                value={
                  extractedValues.physicalActivity
                    ? extractedValues.physicalActivity.charAt(0).toUpperCase() +
                      extractedValues.physicalActivity.slice(1)
                    : undefined
                }
              />
              <FieldStatus
                extracted={extractedValues.confidence.familyHistory}
                label="Family History"
                value={
                  extractedValues.familyHistory === "none"
                    ? "None"
                    : extractedValues.familyHistory === "one_parent"
                      ? "One parent"
                      : extractedValues.familyHistory === "both_parents"
                        ? "Both parents"
                        : undefined
                }
              />
              <FieldStatus
                extracted={extractedValues.confidence.alreadyDiagnosed}
                label="Diagnosed"
                value={
                  extractedValues.alreadyDiagnosed !== undefined
                    ? extractedValues.alreadyDiagnosed
                      ? "Yes"
                      : "No"
                    : undefined
                }
              />
            </div>

            <p className="text-[11px] text-muted-foreground">
              {extractedValues.extractionSummary}
            </p>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleApplyValues}
              className="w-full gap-2"
            >
              <Sparkles className="size-4" />
              Apply extracted values to assessment form
            </Button>

            <p className="text-[10px] text-muted-foreground text-center">
              Values will pre-fill the form below. Always review and correct
              before submitting.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
