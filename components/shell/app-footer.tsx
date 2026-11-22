import * as React from "react"
import Link from "next/link"
import { Brand } from "@/components/shell/brand"
import {
  ShieldCheck,
  AlertTriangle,
  Lock,
  HeartHandshake,
  Activity,
  FileScan,
  Cpu,
  CheckCircle2,
  ExternalLink,
} from "lucide-react"

interface AppFooterProps {
  variant?: "full" | "compact"
}

export function AppFooter({ variant = "full" }: AppFooterProps) {
  const currentYear = new Date().getFullYear()

  if (variant === "compact") {
    return (
      <footer className="mt-auto border-t border-border/50 bg-card/60 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-3">
              <Brand />
              <span className="hidden text-xs text-muted-foreground sm:inline">
                • Empowering proactive metabolic wellness
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <Link href="/dashboard" className="transition hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/risk" className="transition hover:text-foreground">
                Risk Assessment
              </Link>
              <Link href="/care-circle" className="transition hover:text-foreground">
                Care Circle
              </Link>
              <Link href="/graph" className="transition hover:text-foreground">
                Care Graph
              </Link>
              <Link href="/devices" className="transition hover:text-foreground">
                Edge Stations
              </Link>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Systems operational</span>
              <span>•</span>
              <span>© {currentYear} Nirvaya</span>
            </div>
          </div>

          <div className="mt-4 border-t border-border/40 pt-4 text-center text-[11px] leading-relaxed text-muted-foreground/80">
            <strong>Clinical Safety Boundary:</strong> Nirvaya records observations and supports lifestyle habits. It does not provide medical diagnoses, treatment plans, or emergency care. In case of acute medical emergencies, call 112 immediately.
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="mt-auto border-t border-border/60 bg-card">
      {/* Main Footer Content */}
      <div className="mx-auto max-w-7xl px-5 pt-14 pb-10 md:px-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          {/* Column 1: Brand & Mission */}
          <div className="space-y-4 lg:col-span-2">
            <Brand />
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Personalized metabolic health tracking, validated clinical screening navigation, and compassionate care circle collaboration for individuals and families across India.
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary">
                <ShieldCheck className="size-3.5" />
                MDRF-IDRS Validated
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                <Lock className="size-3.5" />
                Zero-Cloud Client OCR
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                <CheckCircle2 className="size-3.5" />
                ICMR & ADA Aligned
              </span>
            </div>
          </div>

          {/* Column 2: Platform & Features */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Platform & Features
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/dashboard" className="transition hover:text-primary">
                  Daily Health Journal
                </Link>
              </li>
              <li>
                <Link href="/risk" className="transition hover:text-primary">
                  Metabolic Risk Assessment
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="transition hover:text-primary">
                  Lab Report Scanner (OCR)
                </Link>
              </li>
              <li>
                <Link href="/care-circle" className="transition hover:text-primary">
                  Care Circle & Family Sync
                </Link>
              </li>
              <li>
                <Link href="/devices" className="transition hover:text-primary">
                  Edge Station Gateway
                </Link>
              </li>
              <li>
                <Link href="/graph" className="transition hover:text-primary">
                  Relational Care Graph
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Clinical Resources */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Clinical Guidelines
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/risk" className="transition hover:text-primary">
                  Indian Diabetes Risk Score
                </Link>
              </li>
              <li>
                <Link href="/risk" className="transition hover:text-primary">
                  Confirmatory Lab Protocols
                </Link>
              </li>
              <li>
                <Link href="/risk" className="transition hover:text-primary">
                  HbA1c & Glucose Standards
                </Link>
              </li>
              <li>
                <Link href="/risk" className="transition hover:text-primary">
                  Cardiovascular & Renal Impact
                </Link>
              </li>
              <li>
                <Link href="/risk" className="transition hover:text-primary">
                  Lifestyle Modifiability Analysis
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Governance & Trust */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Trust & Privacy
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="flex items-center gap-1.5">
                  <Lock className="size-3 text-primary" />
                  <span>Granular Consent Model</span>
                </span>
              </li>
              <li>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3 text-primary" />
                  <span>Strict Data-Layer Auth</span>
                </span>
              </li>
              <li>
                <span className="flex items-center gap-1.5">
                  <Activity className="size-3 text-primary" />
                  <span>Audit Provenance Logging</span>
                </span>
              </li>
              <li>
                <span className="flex items-center gap-1.5">
                  <HeartHandshake className="size-3 text-primary" />
                  <span>Family Delegated Access</span>
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Emergency Medical Disclaimer Banner */}
        <div className="mt-12 rounded-xl border border-amber-500/25 bg-amber-50/70 p-4 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
              <p className="font-semibold text-amber-950 dark:text-amber-100">
                Medical & Emergency Safety Notice
              </p>
              <p className="leading-relaxed">
                Nirvaya is designed for preventive screening education, risk awareness, and personal health habit tracking. It does not provide automated clinical diagnosis, emergency intervention, or medical prescription changes. If you are experiencing acute distress, suspected severe hypoglycemia, or a life-threatening medical emergency, please immediately call <strong>112</strong> (National Emergency Service, India) or visit your nearest healthcare facility.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & System Status */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-6 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span>© {currentYear} Nirvaya Health Technologies. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-medium text-foreground">Operational Status: Healthy</span>
            </div>
            <span className="text-[11px]">English-First • Indian Cohort Validated</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
