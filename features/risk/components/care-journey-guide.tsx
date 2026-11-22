"use client"

import * as React from "react"
import {
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  FileText,
  HelpCircle,
  Info,
  ShieldCheck,
  Stethoscope,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface LabRange {
  name: string
  code: string
  unit: string
  normal: string
  prediabetes: string
  diabetes: string
  preparation: string
  clinicalPurpose: string
}

const LAB_TESTS: LabRange[] = [
  {
    name: "HbA1c (Glycated Hemoglobin)",
    code: "hba1c",
    unit: "%",
    normal: "< 5.7%",
    prediabetes: "5.7% – 6.4%",
    diabetes: "≥ 6.5%",
    preparation: "No fasting required. Can be drawn at any time of day.",
    clinicalPurpose:
      "Measures your weighted average blood glucose concentration over the prior 2 to 3 months by evaluating glucose-bound hemoglobin.",
  },
  {
    name: "Fasting Plasma Glucose (FPG)",
    code: "fpg",
    unit: "mg/dL",
    normal: "< 100 mg/dL",
    prediabetes: "100 – 125 mg/dL",
    diabetes: "≥ 126 mg/dL",
    preparation: "Requires an overnight fast of 8 to 10 hours (water permitted).",
    clinicalPurpose:
      "Evaluates baseline hepatic glucose output after overnight rest before food intake.",
  },
  {
    name: "Oral Glucose Tolerance Test (2-Hr OGTT)",
    code: "ogtt",
    unit: "mg/dL",
    normal: "< 140 mg/dL",
    prediabetes: "140 – 199 mg/dL",
    diabetes: "≥ 200 mg/dL",
    preparation: "Fasting blood sample, followed by drinking a 75g glucose solution, then re-tested at 2 hours.",
    clinicalPurpose:
      "Tests the body's acute pancreatic insulin response and cellular glucose clearance under a standardized glucose challenge.",
  },
]

const DOCTOR_QUESTIONS = [
  {
    id: "target_a1c",
    question: "What is my personalized target HbA1c range based on my age and lifestyle?",
  },
  {
    id: "fasting_baseline",
    question: "Should I schedule a laboratory fasting glucose and lipid profile test?",
  },
  {
    id: "lifestyle_changes",
    question: "Which specific nutrition and physical movement changes will have the highest impact for me?",
  },
  {
    id: "monitoring_freq",
    question: "Do I need a home glucose meter (CGM or fingerstick), or is periodic lab testing sufficient?",
  },
  {
    id: "family_check",
    question: "Given my family history, what screening schedule should my siblings or children follow?",
  },
]

export function CareJourneyGuide() {
  const [checkedQuestions, setCheckedQuestions] = React.useState<Record<string, boolean>>({})

  const toggleQuestion = (id: string) => {
    setCheckedQuestions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  return (
    <div className="space-y-8">
      {/* Overview Card */}
      <div className="rounded-xl border border-border/80 bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2 text-primary font-semibold text-xs uppercase tracking-wider">
          <Stethoscope className="size-4" />
          <span>Clinical Navigation Roadmap</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          From Screening to Confirmatory Medical Care
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground max-w-2xl">
          A screening score highlights probability — only standardized laboratory
          blood tests evaluated by a licensed clinician can confirm or rule out
          metabolic conditions.
        </p>
      </div>

      {/* Confirmatory Lab Test Guide */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Standard Confirmatory Laboratory Tests
          </h3>
          <span className="text-xs text-muted-foreground">
            ICMR & ADA Clinical Guidelines
          </span>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {LAB_TESTS.map((test) => (
            <Card key={test.code} className="flex flex-col justify-between border-border/80 shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-bold">{test.name}</CardTitle>
                <CardDescription className="text-xs">
                  Standard Unit: <span className="font-semibold text-foreground">{test.unit}</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 space-y-4 flex-1 flex flex-col justify-between text-xs">
                {/* Thresholds Table */}
                <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 border border-border/50">
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Normal:</span>
                    <span className="font-mono font-bold">{test.normal}</span>
                  </div>
                  <div className="flex justify-between items-center text-amber-600 dark:text-amber-400 font-medium">
                    <span>Prediabetes:</span>
                    <span className="font-mono font-bold">{test.prediabetes}</span>
                  </div>
                  <div className="flex justify-between items-center text-rose-600 dark:text-rose-400 font-medium">
                    <span>Elevated:</span>
                    <span className="font-mono font-bold">{test.diabetes}</span>
                  </div>
                </div>

                {/* Preparation */}
                <div className="space-y-1">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                    Preparation Protocol
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    {test.preparation}
                  </p>
                </div>

                {/* Clinical Purpose */}
                <div className="border-t pt-2 text-[11px] text-muted-foreground">
                  {test.clinicalPurpose}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Doctor Visit Discussion Checklist */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" />
            <CardTitle className="text-base font-semibold">
              Doctor Appointment Discussion Checklist
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Check off key clinical questions to bring to your consultation.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          {DOCTOR_QUESTIONS.map((q) => {
            const isChecked = Boolean(checkedQuestions[q.id])
            return (
              <label
                key={q.id}
                onClick={() => toggleQuestion(q.id)}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                  isChecked
                    ? "border-primary bg-primary/5 text-foreground font-medium"
                    : "border-border/60 bg-card hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <div className="mt-0.5 shrink-0 text-primary">
                  {isChecked ? (
                    <CheckSquare className="size-4" />
                  ) : (
                    <div className="size-4 rounded border border-border" />
                  )}
                </div>
                <span className="text-sm leading-snug">{q.question}</span>
              </label>
            )
          })}

          <div className="mt-4 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
            <Info className="size-4 text-primary shrink-0" />
            <span>
              Tip: You can print or save your screening report to share directly with your healthcare provider.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
