"use client"

import * as React from "react"
import Image from "next/image"
import {
  Activity,
  AlertCircle,
  Eye,
  Heart,
  Info,
  ShieldAlert,
  Sparkles,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface OrganInfo {
  id: string
  number: string
  title: string
  subtitle: string
  system: string
  description: string
  preventionTip: string
  warningSigns: string[]
}

const ORGANS: OrganInfo[] = [
  {
    id: "heart",
    number: "01",
    title: "Heart & Blood Vessels",
    subtitle: "Cardiovascular Health",
    system: "Circulatory System",
    description:
      "Persistently elevated blood glucose damages the delicate endothelium of blood vessels over time, accelerating arterial plaque formation and increasing cardiovascular risks.",
    preventionTip:
      "Routine aerobic movement (such as 30 minutes of brisk walking) and maintaining blood pressure under 130/80 mmHg protect blood vessels.",
    warningSigns: [
      "Chest tightness during exertion",
      "Shortness of breath with minimal activity",
      "Swelling in feet or ankles",
    ],
  },
  {
    id: "brain",
    number: "02",
    title: "Brain & Neurological",
    subtitle: "Cerebrovascular & Nerve Health",
    system: "Nervous System",
    description:
      "Microvascular damage and fluctuating glucose levels can affect cerebral microcirculation, impacting cognitive energy and increasing cerebrovascular risk.",
    preventionTip:
      "Stable meal timing prevents sharp glycemic spikes and drops, maintaining steady cognitive energy and protecting vascular pathways.",
    warningSigns: [
      "Sudden numbness or tingling in extremities",
      "Frequent unexplained dizziness or lightheadedness",
      "Brain fog following high-glycemic meals",
    ],
  },
  {
    id: "eyes",
    number: "03",
    title: "Eyes & Retina",
    subtitle: "Retinal Microvasculature",
    system: "Visual System",
    description:
      "The tiny blood vessels supplying the retina are particularly sensitive to high glucose. Prolonged hyperglycemia can cause micro-aneurysms and vision complications.",
    preventionTip:
      "An annual dilated eye exam (fundoscopy) allows early detection of retinal changes long before any vision changes occur.",
    warningSigns: [
      "Blurry or fluctuating vision",
      "Dark floating spots or 'cobwebs'",
      "Impaired color perception or night vision",
    ],
  },
  {
    id: "kidneys",
    number: "04",
    title: "Kidneys (Renal)",
    subtitle: "Glomerular Filtration",
    system: "Excretory System",
    description:
      "Kidneys filter waste through millions of tiny capillary clusters (glomeruli). Overworked kidneys from high glucose and blood pressure can leak micro-albumin.",
    preventionTip:
      "Staying well hydrated and getting an annual urine albumin-to-creatinine ratio (uACR) test protects renal filtration longevity.",
    warningSigns: [
      "Persistent foamy or frothy urine",
      "Unexplained fatigue and morning puffiness around the eyes",
      "Fluctuating blood pressure readings",
    ],
  },
  {
    id: "oral",
    number: "05",
    title: "Mouth & Gums",
    subtitle: "Periodontal Health",
    system: "Oral Mucosa",
    description:
      "Elevated saliva glucose creates a favorable environment for oral bacteria, increasing the frequency of gingivitis, bleeding gums, and delayed healing.",
    preventionTip:
      "Biannual dental cleanings and daily flossing significantly lower oral bacterial load and reduce chronic systemic inflammation.",
    warningSigns: [
      "Gums that bleed easily when brushing",
      "Receding gum lines or persistent dry mouth",
      "Loose teeth or persistent bad breath",
    ],
  },
]

export function OrganImpactView() {
  const [selectedOrgan, setSelectedOrgan] = React.useState<OrganInfo>(ORGANS[0])

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-background p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
              <Activity className="size-4" />
              <span>Interactive Physiological Impact Explorer</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              How Glucose Dynamics Affect Your Body
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Blood flows to every organ. Learn how early lifestyle interventions
              and glycemic stability preserve vital organ functions over your lifetime.
            </p>
          </div>

          <div className="relative h-32 w-48 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/30 shadow-sm hidden sm:block">
            <Image
              src="/images/new.png"
              alt="Medical organ illustration"
              fill
              className="object-cover object-center"
            />
          </div>
        </div>
      </div>

      {/* Interactive Tabs + Organ Detail Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Organ Selection List */}
        <div className="space-y-2 lg:col-span-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Select an Organ System
          </p>
          {ORGANS.map((organ) => {
            const isSelected = selectedOrgan.id === organ.id
            return (
              <button
                key={organ.id}
                type="button"
                onClick={() => setSelectedOrgan(organ)}
                className={cn(
                  "w-full text-left rounded-xl p-4 transition-all border flex items-start gap-3.5",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                    : "border-border/60 bg-card hover:border-primary/40 hover:bg-muted/40"
                )}
              >
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {organ.number}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm text-foreground truncate">
                      {organ.title}
                    </h3>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {organ.system}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {organ.subtitle}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Right Column: Active Organ Details Card */}
        <div className="lg:col-span-7">
          <Card className="h-full border-border/80 shadow-sm">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                    Organ System {selectedOrgan.number}
                  </span>
                  <CardTitle className="text-xl font-bold mt-0.5">
                    {selectedOrgan.title}
                  </CardTitle>
                </div>
                <Badge variant="secondary" className="text-xs font-medium">
                  {selectedOrgan.subtitle}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Biological explanation */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Physiological Connection
                </h4>
                <p className="text-sm leading-relaxed text-foreground">
                  {selectedOrgan.description}
                </p>
              </div>

              {/* Actionable protection tip */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                  <Sparkles className="size-4" />
                  <span>Clinical Protection Routine</span>
                </div>
                <p className="text-xs leading-relaxed text-foreground">
                  {selectedOrgan.preventionTip}
                </p>
              </div>

              {/* Symptoms to discuss with doctor */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5 text-amber-500" />
                  <span>Signals Warranting Clinician Review</span>
                </h4>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {selectedOrgan.warningSigns.map((sign, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span>{sign}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Clinical note */}
              <div className="border-t pt-4 text-[11px] text-muted-foreground flex items-start gap-2">
                <Info className="size-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                <span>
                  This educational overview explains biological pathways. Always
                  consult your doctor regarding personal symptoms or medical
                  diagnoses.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
