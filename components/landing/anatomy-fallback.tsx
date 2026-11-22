import * as React from "react"
import {
  Heart,
  Activity,
  ShieldCheck,
  Eye,
  Sparkles,
  Zap,
  Info,
  AlertCircle,
  RefreshCw,
} from "lucide-react"

interface MetabolicAnatomyFallbackProps {
  onRetry?: () => void
  onForceLoad?: () => void
}

export function MetabolicAnatomyFallback({
  onRetry,
  onForceLoad,
}: MetabolicAnatomyFallbackProps) {
  const organs = [
    {
      name: "Pancreatic Beta Cells",
      role: "Insulin Regulation & Secretory Reserve",
      icon: Zap,
      status: "Primary Metabolic Target",
      badge: "HbA1c < 5.7%",
      color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    },
    {
      name: "Cardiovascular System",
      role: "Endothelial & Arterial Compliance",
      icon: Heart,
      status: "Micro & Macrovascular Health",
      badge: "Target < 120/80",
      color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    },
    {
      name: "Renal Function (Kidneys)",
      role: "Glomerular Filtration & Albumin Retention",
      icon: Activity,
      status: "eGFR Clearance",
      badge: "Normal Range",
      color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    },
    {
      name: "Retinal Microvasculature",
      role: "Microcirculation & Capillary Integrity",
      icon: Eye,
      status: "Annual Dilated Screening",
      badge: "Protected",
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    },
  ]

  return (
    <div className="relative flex h-full w-full flex-col justify-between rounded-3xl border border-primary/15 bg-gradient-to-b from-card/95 via-card/85 to-card p-6 shadow-xl backdrop-blur-md">
      {/* Notice why this card is showing */}
      <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-0.5">
              <p className="font-semibold text-amber-950 dark:text-amber-100">
                3D Model Paused: Browser WebGL is Disabled
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Your browser blocked WebGL (<code>GL_VENDOR=Disabled</code>). Enable <strong>"Use graphics acceleration"</strong> in <code>chrome://settings/system</code> or enable <code>chrome://flags/#ignore-gpu-blocklist</code> on Linux.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {onForceLoad && (
              <button
                type="button"
                onClick={onForceLoad}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
              >
                <Sparkles className="size-3" /> Force 3D
              </button>
            )}
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="size-3" /> Retry
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Metabolic Anatomy & Organ Pathways
            </h3>
            <p className="text-[11px] text-muted-foreground">
              MDRF-IDRS & ICMR clinical protection targets
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-medium text-primary">
          <Sparkles className="size-3" /> Anatomical Mode
        </span>
      </div>

      {/* Organ Cards Grid */}
      <div className="my-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {organs.map((organ) => {
          const Icon = organ.icon
          return (
            <div
              key={organ.name}
              className="group relative flex flex-col justify-between rounded-xl border border-border/60 bg-muted/40 p-3.5 transition-all duration-300 hover:border-primary/40 hover:bg-muted/70 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <span
                  className={`flex size-7 items-center justify-center rounded-lg border ${organ.color}`}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {organ.badge}
                </span>
              </div>
              <div className="mt-2.5 space-y-0.5">
                <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  {organ.name}
                </h4>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {organ.role}
                </p>
              </div>
              <div className="mt-2 flex items-center gap-1.5 pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{organ.status}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Info className="size-3.5 text-primary/70 shrink-0" />
          <span>Continuous metabolic tracking via Daily Journal & Lab OCR</span>
        </span>
        <span className="text-[10px] font-medium text-primary">
          Holistic Care Map
        </span>
      </div>
    </div>
  )
}
