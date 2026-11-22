"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import {
  Mic,
  Square,
  LockKeyhole,
  CheckCircle2,
  AlertCircle,
  AudioLines,
  Sparkles,
} from "lucide-react"
import { parseOnboardingSpeech } from "@/lib/voice/onboarding-parser"

export function OnboardingFlow({
  defaultName = "",
}: {
  defaultName?: string
}) {
  const router = useRouter()
  const trpc = useTRPC()

  // Form State (Keyboard Accessible)
  const [preferredName, setPreferredName] = useState(defaultName)
  const [yearOfBirth, setYearOfBirth] = useState<number | "">("")
  const [gender, setGender] = useState<
    "female" | "male" | "other" | "prefer_not_to_say"
  >("prefer_not_to_say")
  const [consentChecked, setConsentChecked] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Voice State (Optional, Explicit Permission)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null)
  const [transcript, setTranscript] = useState("")
  const [isTranscribing, setIsTranscribing] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Submit profile mutation
  const submitMutation = useMutation(
    trpc.onboarding.submit.mutationOptions({
      onSuccess() {
        router.push("/dashboard")
        router.refresh()
      },
      onError(err) {
        setFormError(err.message)
      },
    })
  )

  // Transcribe mutation
  const transcribeMutation = useMutation(
    trpc.onboarding.transcribeAudio.mutationOptions({
      onSuccess(data) {
        setIsTranscribing(false)
        setTranscript(data.transcript)

        // Parse extracted details from spoken transcript
        const parsed = parseOnboardingSpeech(data.transcript)
        const filledDetails: string[] = []

        if (parsed.name) {
          setPreferredName(parsed.name)
          filledDetails.push(`Name: "${parsed.name}"`)
        }
        if (parsed.yearOfBirth) {
          setYearOfBirth(parsed.yearOfBirth)
          filledDetails.push(`Birth Year: ${parsed.yearOfBirth}`)
        }
        if (parsed.gender) {
          setGender(parsed.gender)
          filledDetails.push(
            `Gender: ${parsed.gender.charAt(0).toUpperCase() + parsed.gender.slice(1)}`
          )
        }

        if (filledDetails.length > 0) {
          setVoiceNotice(
            `✨ Auto-filled from voice: ${filledDetails.join(" • ")}. Please review the fields below and check consent.`
          )
        } else {
          setVoiceNotice(
            "Transcript captured. No name or birth year recognized; please check the form fields below."
          )
        }
      },
      onError(err) {
        setIsTranscribing(false)
        setVoiceNotice(`Transcription failed: ${err.message}`)
      },
    })
  )

  const startRecording = async () => {
    setVoiceNotice(null)
    setTranscript("")

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceNotice(
        "Microphone recording is not supported in this browser. Please use the keyboard form."
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
          setVoiceNotice("No audio captured.")
          return
        }

        setIsTranscribing(true)
        setVoiceNotice("Processing audio chunk with server STT...")

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
            // Auto stop at 30 seconds max chunk
            stopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    } catch {
      setVoiceNotice(
        "Microphone permission was denied or unavailable. Please use the keyboard form."
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
    setVoiceNotice("Recording cancelled.")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!preferredName.trim()) {
      setFormError("Please enter your preferred name.")
      return
    }

    if (!yearOfBirth || yearOfBirth < 1900 || yearOfBirth > 2008) {
      setFormError("Please enter a valid adult year of birth (1900–2008).")
      return
    }

    if (!consentChecked) {
      setFormError(
        "Explicit health data processing consent is required to create your profile."
      )
      return
    }

    submitMutation.mutate({
      preferredName: preferredName.trim(),
      yearOfBirth: Number(yearOfBirth),
      gender,
      healthDataConsent: true,
      preferredLocale: "en",
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Voice Option */}
      <Card>
        <CardHeader>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <AudioLines className="size-5" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Optional Voice Input
            </span>
          </div>
          <CardTitle>Speak at your own pace</CardTitle>
          <CardDescription>
            Record a short voice note. Audio is processed transiently and never
            saved until you review and verify the transcript.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/40 p-6 text-center">
            {isRecording ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-rose-500">
                  <span className="relative flex size-3">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex size-3 rounded-full bg-rose-500"></span>
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
                    <Square className="size-4" /> Stop & Transcribe
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
                <Spinner className="size-4 text-primary" /> Transcribing
                speech...
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={startRecording}
                  className="gap-2"
                >
                  <Mic className="size-4 text-primary" /> Start voice recording
                </Button>
                <p className="text-xs text-muted-foreground">
                  Microphone is only accessed after clicking the button above.
                </p>
              </div>
            )}
          </div>

          {voiceNotice && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertTitle>Voice Notice</AlertTitle>
              <AlertDescription className="text-xs">
                {voiceNotice}
              </AlertDescription>
            </Alert>
          )}

          {transcript && (
            <div className="space-y-2">
              <Label htmlFor="review-transcript">
                Review & Edit Transcript
              </Label>
              <Textarea
                id="review-transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={3}
                className="text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Verify this text is accurate before copying any values into the
                profile form.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Structured Profile Form (Keyboard accessible) */}
      <Card>
        <CardHeader>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <CheckCircle2 className="size-5" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Profile Setup
            </span>
          </div>
          <CardTitle>Personal Health Profile</CardTitle>
          <CardDescription>
            A keyboard alternative is always available. All fields are
            validated server-side before storage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Validation Error</AlertTitle>
                <AlertDescription className="text-xs">
                  {formError}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="preferred-name">
                Preferred Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="preferred-name"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="e.g. Rahul, Priya, Alex"
                disabled={submitMutation.isPending}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="year-of-birth">
                  Year of Birth <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="year-of-birth"
                  type="number"
                  min={1900}
                  max={2008}
                  value={yearOfBirth}
                  onChange={(e) =>
                    setYearOfBirth(
                      e.target.value ? parseInt(e.target.value, 10) : ""
                    )
                  }
                  placeholder="e.g. 1985"
                  disabled={submitMutation.isPending}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender-select">Gender (Optional)</Label>
                <select
                  id="gender-select"
                  value={gender}
                  onChange={(e) =>
                    setGender(
                      e.target.value as
                        | "female"
                        | "male"
                        | "other"
                        | "prefer_not_to_say"
                    )
                  }
                  disabled={submitMutation.isPending}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="prefer_not_to_say">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="consent-checkbox"
                  checked={consentChecked}
                  onCheckedChange={(checked) =>
                    setConsentChecked(Boolean(checked))
                  }
                  disabled={submitMutation.isPending}
                />
                <div className="grid gap-1">
                  <Label
                    htmlFor="consent-checkbox"
                    className="text-xs font-medium leading-snug cursor-pointer"
                  >
                    I consent to Nirvaya processing my metabolic
                    health records for personal tracking and daily habits.
                  </Label>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <LockKeyhole className="size-3 text-primary shrink-0" />
                    <span>
                      Consent is revocable anytime from settings. No data is
                      shared without explicit authorization.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitMutation.isPending || !consentChecked}
              className="w-full"
            >
              {submitMutation.isPending ? (
                <>
                  <Spinner className="mr-2 size-4" /> Creating profile...
                </>
              ) : (
                "Complete Onboarding & Enter Dashboard"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
