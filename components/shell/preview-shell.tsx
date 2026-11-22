import { LanguageSelector } from "@/components/shell/language-selector"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowUpRight,
  LayoutDashboard,
  LockKeyhole,
  Sprout,
} from "lucide-react"
import { Brand } from "@/components/shell/brand"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { previewSections } from "@/lib/demo/preview"
import { cn } from "@/lib/utils"

export function PreviewShell({
  active = "overview",
  children,
}: {
  active?: string
  children: React.ReactNode
}) {
  const links = [
    { slug: "overview", label: "Today’s overview", english: "Overview" },
    ...previewSections,
  ]
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b bg-card px-5 py-6 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0">
        <Brand />
        <p className="mt-10 hidden px-3 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase lg:block">
          Your care workspace
        </p>
        <nav
          aria-label="Preview workspace"
          className="mt-5 flex gap-1 overflow-x-auto pb-2 lg:flex-col"
        >
          {links.map((item) => (
            <Link
              key={item.slug}
              href={
                item.slug === "overview" ? "/preview" : `/preview/${item.slug}`
              }
              aria-current={active === item.slug ? "page" : undefined}
              className={cn(
                "flex min-w-fit items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors hover:bg-muted",
                active === item.slug && "bg-primary/8 font-medium text-primary"
              )}
            >
              <LayoutDashboard className="size-4 shrink-0" aria-hidden="true" />
              <span>{item.english}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden rounded-2xl bg-secondary p-4 lg:block">
          <Sprout className="mb-3 size-5 text-primary" />
          <p className="text-sm font-semibold">
            Small steps. A better tomorrow.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Small, steady steps. A little support along the way.
          </p>
          <Link
            href="/#how-it-works"
            className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-primary"
          >
            Our approach <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <Link
          href="/"
          className="mt-5 hidden items-center gap-2 px-3 text-xs text-muted-foreground lg:flex"
        >
          <ArrowLeft className="size-3" /> Back to website
        </Link>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card/70 px-5 py-4 md:px-9">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-primary" /> Your wellbeing,
            connected
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSelector compact />
            <Badge variant="secondary">Interface preview</Badge>
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "text-xs"
              )}
            >
              Open Live App →
            </Link>
            <span
              className="flex size-8 items-center justify-center rounded-full border bg-secondary text-xs font-semibold"
              aria-label="Demo profile"
            >
              D
            </span>
          </div>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs leading-relaxed text-amber-950 md:px-9">
          <div className="flex items-start gap-2">
            <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
            <p>
              Public synthetic preview mode. For real health tracking, care circles,
              edge stations, and clinic workflows, switch to the authenticated workspace.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="font-medium underline hover:text-amber-800 text-xs"
          >
            Open Live App Dashboard →
          </Link>
        </div>
        <main
          id="main-content"
          className="mx-auto max-w-[1440px] px-5 py-8 md:px-9 md:py-10"
        >
          {children}
        </main>
        <footer className="px-5 pb-6 text-xs leading-relaxed text-muted-foreground md:px-9">
          Health education, not a diagnosis or a substitute for professional
          care. If you feel seriously unwell, seek urgent medical help.
        </footer>
      </div>
    </div>
  )
}
