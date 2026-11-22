"use client"

import * as React from "react"
import { useTRPC } from "@/trpc/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createWorker } from "tesseract.js"
import {
  Activity,
  AlertCircle,
  Camera,
  CheckCircle2,
  FileText,
  HelpCircle,
  Info,
  RefreshCw,
  Save,
  Scan,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  interpretLabValue,
  type InterpretedLabResult,
  type LabTestId,
} from "@/lib/ocr/lab-ranges"
import {
  extractLabCandidates,
  type ExtractedCandidate,
} from "@/lib/ocr/ocr-test-mapper"
import { cn } from "@/lib/utils"

interface ScannedRecordItem extends ExtractedCandidate {
  selected: boolean
  interpreted: InterpretedLabResult | null
  currentValue: number
}

export function LabReportScanner({ onSaved }: { onSaved?: () => void }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const [file, setFile] = React.useState<File | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [isScanning, setIsScanning] = React.useState(false)
  const [scanProgress, setScanProgress] = React.useState(0)
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [records, setRecords] = React.useState<ScannedRecordItem[]>([])
  const [saveSuccess, setSaveSuccess] = React.useState(false)

  const recordMutation = useMutation(
    trpc.journal.recordGlucose.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries()
      },
    })
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setErrorMessage(null)
    setSaveSuccess(false)
    setRecords([])

    if (!selectedFile.type.startsWith("image/")) {
      setErrorMessage("Please upload an image file (PNG, JPG, or WEBP).")
      return
    }

    setFile(selectedFile)
    const reader = new FileReader()
    reader.onload = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(selectedFile)
  }

  const runOCR = async () => {
    if (!file) return

    setIsScanning(true)
    setScanProgress(0)
    setStatusMessage("Initializing OCR engine...")
    setErrorMessage(null)
    setSaveSuccess(false)

    let worker: any = null
    try {
      worker = await createWorker("eng", 1, {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            setScanProgress(Math.round(m.progress * 100))
            setStatusMessage(`Scanning lab report... ${Math.round(m.progress * 100)}%`)
          }
        },
      })

      const { data } = await worker.recognize(file)
      await worker.terminate()

      const rawText = data.text || ""
      if (!rawText.trim()) {
        setErrorMessage("No readable text found. Please upload a clearer photo or enter values manually.")
        setIsScanning(false)
        return
      }

      const extracted = extractLabCandidates(rawText)
      if (extracted.length === 0) {
        setStatusMessage("No matching glucose or HbA1c lab tests recognized in this image.")
      } else {
        setStatusMessage(`Extracted ${extracted.length} laboratory test result(s).`)
      }

      const items: ScannedRecordItem[] = extracted.map((c) => ({
        ...c,
        selected: true,
        currentValue: c.value,
        interpreted: interpretLabValue(c.testId, c.value),
      }))

      setRecords(items)
    } catch (err: any) {
      if (worker) {
        try {
          await worker.terminate()
        } catch {
          // ignore
        }
      }
      setErrorMessage("OCR engine encountered an error while scanning the image. Please try another image.")
    } finally {
      setIsScanning(false)
    }
  }

  const updateRecordValue = (index: number, val: number) => {
    setRecords((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r
        return {
          ...r,
          currentValue: val,
          interpreted: interpretLabValue(r.testId, val),
        }
      })
    )
  }

  const toggleSelect = (index: number) => {
    setRecords((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r))
    )
  }

  const handleSaveToJournal = async () => {
    const toSave = records.filter((r) => r.selected && r.currentValue > 0)
    if (toSave.length === 0) return

    setErrorMessage(null)
    try {
      for (const item of toSave) {
        let context: "glucose_fasting" | "glucose_postprandial" | "glucose_random" =
          "glucose_fasting"
        if (item.testId === "ppbs" || item.testId === "ogtt") {
          context = "glucose_postprandial"
        } else if (item.testId === "rbg") {
          context = "glucose_random"
        }

        const validUnit = item.unit === "mmol/L" ? "mmol/L" : "mg/dL"

        await recordMutation.mutateAsync({
          context,
          value: item.currentValue,
          unit: validUnit,
          notes: `Extracted via Lab Report OCR (${item.sourceText.slice(0, 80)})`,
          observedAt: new Date().toISOString(),
        })
      }

      setSaveSuccess(true)
      if (onSaved) onSaved()
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save observation to journal.")
    }
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-3 border-b bg-muted/20">
        <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
          <Scan className="size-4" />
          <span>Automated Optical Lab Report Scanner</span>
        </div>
        <CardTitle className="text-base font-bold">
          Scan Lab Report & Extract Blood Test Values
        </CardTitle>
        <CardDescription className="text-xs">
          Upload an image of your diagnostic lab report. Client-side OCR will
          extract HbA1c, Fasting Glucose, and Postprandial values automatically.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Upload Dropzone */}
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <div className="flex-1 w-full space-y-3">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/80 hover:border-primary/50 bg-muted/20 hover:bg-muted/40 rounded-xl p-6 cursor-pointer transition-all">
              <Camera className="size-8 text-muted-foreground mb-2" />
              <span className="text-xs font-semibold text-foreground">
                Click to select lab report image
              </span>
              <span className="text-[11px] text-muted-foreground mt-1">
                PNG, JPG, or WEBP (clear, well-lit photo)
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {file && (
              <div className="flex items-center justify-between rounded-lg border bg-card p-3 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="size-4 text-primary shrink-0" />
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="text-muted-foreground">
                    ({Math.round(file.size / 1024)} KB)
                  </span>
                </div>
                <Button
                  size="xs"
                  onClick={runOCR}
                  disabled={isScanning}
                  className="gap-1.5 shrink-0"
                >
                  {isScanning ? (
                    <>
                      <RefreshCw className="size-3 animate-spin" /> Scanning…
                    </>
                  ) : (
                    <>
                      <Scan className="size-3" /> Run OCR Scan
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Thumbnail preview */}
          {imagePreview && (
            <div className="relative size-32 shrink-0 rounded-lg border overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Lab report preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Scanning progress */}
        {isScanning && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
            <div className="flex justify-between text-xs text-primary font-medium">
              <span>{statusMessage}</span>
              <span>{scanProgress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 transition-all duration-200"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success message */}
        {saveSuccess && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>Successfully saved extracted measurements to your Daily Health Journal!</span>
          </div>
        )}

        {/* Extracted Records Table */}
        {records.length > 0 && (
          <div className="space-y-4 pt-2 border-t">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Extracted Test Candidates ({records.length})
              </h4>
              <span className="text-[11px] text-muted-foreground">
                Verify values before saving to your journal
              </span>
            </div>

            <div className="divide-y divide-border/60 rounded-lg border overflow-hidden">
              {records.map((record, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors",
                    record.selected ? "bg-card" : "bg-muted/30 opacity-60"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={record.selected}
                      onChange={() => toggleSelect(idx)}
                      className="mt-1 size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm capitalize">
                          {record.testId.toUpperCase()}
                        </span>
                        {record.interpreted && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              record.interpreted.category === "normal" &&
                                "border-emerald-500/30 text-emerald-600",
                              record.interpreted.category === "prediabetes" &&
                                "border-amber-500/30 text-amber-600",
                              record.interpreted.category === "diabetes_range" &&
                                "border-rose-500/30 text-rose-600"
                            )}
                          >
                            {record.interpreted.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate max-w-sm">
                        OCR source: &ldquo;{record.sourceText}&rdquo;
                      </p>
                      {record.interpreted && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {record.interpreted.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Value input and unit */}
                  <div className="flex items-center gap-2 sm:self-center shrink-0">
                    <div className="w-24">
                      <Input
                        type="number"
                        step="0.1"
                        value={record.currentValue}
                        onChange={(e) =>
                          updateRecordValue(idx, parseFloat(e.target.value) || 0)
                        }
                        className="h-8 text-xs font-mono font-bold"
                      />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {record.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Save Action */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSaveToJournal}
                disabled={recordMutation.isPending || records.filter((r) => r.selected).length === 0}
                className="gap-2"
              >
                {recordMutation.isPending ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save Selected Values to Journal
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
