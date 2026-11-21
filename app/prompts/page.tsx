import { LanguageSelector } from "@/components/shell/language-selector"
import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Code2,
  Database,
  ShieldCheck,
} from "lucide-react"
import { Brand } from "@/components/shell/brand"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Build roadmap",
  robots: { index: false, follow: false },
}
const phases = [
  {
    title: "01 · Foundation & identity",
    icon: Code2,
    text: "Configure Clerk, protect private routes, and scaffold tRPC procedures and the Drizzle PostgreSQL schema with ownership checks.",
    files: "features/auth/README.md · drizzle/README.md",
  },
  {
    title: "02 · Understand & guide",
    icon: BookOpen,
    text: "Build consent-led voice intake, reviewed screening, and safe English explanations with translation on request with provider adapters.",
    files:
      "features/onboarding/README.md · features/risk/README.md · features/coaching/README.md",
  },
  {
    title: "03 · Connect everyday care",
    icon: Database,
    text: "Implement daily journals, revocable family permissions, graph projections, and authenticated device events.",
    files:
      "features/journal/README.md · features/care-circle/README.md · features/graph/README.md · hardware/README.md",
  },
  {
    title: "04 · Validate & ship",
    icon: ShieldCheck,
    text: "Finish authorized clinic follow-up, security tests, two real ArgosX scans, and deployment evidence.",
    files:
      "features/clinic/README.md · tests/README.md · security/README.md · docs/roadmap.md",
  },
]
export default function BuildGuidePage() {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-5 py-7 md:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Brand />
        <LanguageSelector />
        <Link
          href="/preview"
          className={buttonVariants({ variant: "outline" })}
        >
          UI preview <ArrowRight />
        </Link>
      </header>
      <main id="main-content" className="py-16">
        <Badge variant="secondary">Developer handoff</Badge>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight">
          A clear foundation.
          <br />
          <span className="text-primary">One focused task at a time.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground">
          This repository intentionally stops at the interface and
          implementation plan. Start with <code>PROMPTS.md</code> in the project
          root, then give the next model one folder-level task at a time. These
          are repository paths, not public file-download links.
        </p>
        <div className="mt-9 grid gap-5 md:grid-cols-2">
          {phases.map(({ title, icon: Icon, text, files }) => (
            <Card key={title} className="rounded-2xl ring-border">
              <CardHeader>
                <Icon className="mb-3 size-6 text-primary" />
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {text}
                </p>
                <p className="mt-5 font-mono text-[11px] leading-6 break-words text-primary">
                  {files}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border bg-card p-6">
          <h2 className="font-semibold">Not connected yet</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Clerk authentication · tRPC procedures · Drizzle queries ·
            PostgreSQL application records · Neo4j graph queries · Sarvam voice
            · LLM coaching · hardware ingestion · family alerts · clinical
            workflows · PWA offline behavior. Docker services are configured
            separately; the UI does not connect to them.
          </p>
        </div>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "ghost" }), "mt-8")}
        >
          <ArrowLeft /> Back to website
        </Link>
      </main>
    </div>
  )
}
