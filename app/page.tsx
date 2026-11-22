import { LanguageSelector } from "@/components/shell/language-selector"
import Link from "next/link"
import {
  ArrowDown,
  ArrowRight,
  AudioLines,
  Check,
  HeartHandshake,
  Leaf,
  Network,
  ShieldCheck,
  Sparkles,
  Sprout,
} from "lucide-react"
import { Brand } from "@/components/shell/brand"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-10">
          <Brand />
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-1 md:flex"
          >
            <a
              href="#how-it-works"
              className="rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
            >
              How it works
            </a>
            <a
              href="#connected-care"
              className="rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
            >
              Connected care
            </a>
            <Link
              href="/prompts"
              className="rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
            >
              Build roadmap
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSelector compact />
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "h-9 rounded-full px-4 text-xs font-semibold shadow-sm transition hover:shadow-md"
              )}
            >
              Open App <ArrowRight className="ml-1 size-3.5" />
            </Link>
          </div>
        </div>
      </header>
      <main id="main-content">
        <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pt-14 pb-20 md:px-10 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28">
          <div>
            <Badge
              variant="outline"
              className="h-auto gap-2 border-primary/20 bg-primary/5 px-3 py-1.5 text-primary"
            >
              <span className="size-1.5 rounded-full bg-primary" />{" "}
              English-first. Human-centered.
            </Badge>
            <h1 className="mt-7 text-5xl leading-[1.15] font-semibold tracking-tight md:text-6xl lg:text-[4.3rem]">
              Better health
              <br />
              starts <span className="text-primary">today.</span>
            </h1>
            <p
              lang="en"
              className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground"
            >
              A little understanding.
              <br className="hidden md:block" /> A healthier everyday. Together.
            </p>
            <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
              Understand your risk, build everyday habits, and move forward with
              the people who care. Your metabolic-health journey, in one
              connected place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 rounded-full px-6"
                )}
              >
                Get started <ArrowRight />
              </Link>
              <a
                href="#how-it-works"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "h-12 px-4"
                )}
              >
                Meet CareBridge <ArrowDown />
              </a>
            </div>
            <div className="mt-7 flex flex-wrap gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-primary" /> English by default
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-primary" /> Consent-led support
              </span>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Not a medical device or diagnostic service
            </p>
          </div>
          <div className="relative rounded-[2rem] border border-primary/10 bg-[#eaf0e8] p-5 sm:p-8">
            <div className="absolute -top-4 right-8 flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-xs shadow-sm">
              <Leaf className="size-4 text-primary" /> A little better, every
              day
            </div>
            <Card className="rounded-2xl shadow-[0_20px_70px_-30px_rgba(37,74,59,0.3)]">
              <CardContent className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Your daily companion
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                      Welcome to a fresh start <span aria-hidden="true">☀</span>
                    </h2>
                  </div>
                  <span className="flex size-10 items-center justify-center rounded-full bg-secondary">
                    <Sprout className="size-5 text-primary" />
                  </span>
                </div>
                <div className="rounded-xl bg-primary p-5 text-primary-foreground">
                  <div className="flex items-center gap-2 text-xs text-primary-foreground/80">
                    <Sparkles className="size-4" /> One small step for today
                  </div>
                  <p className="mt-3 text-lg font-medium">
                    Your health, in your words.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-primary-foreground/80">
                    Start by understanding your routine.
                    <br />
                    No judgment. Just a starting point.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border p-4">
                    <AudioLines className="size-5 text-primary" />
                    <p className="mt-3 text-sm font-medium">
                      You speak. We listen.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Voice onboarding · planned
                    </p>
                  </div>
                  <div className="rounded-xl border p-4">
                    <HeartHandshake className="size-5 text-primary" />
                    <p className="mt-3 text-sm font-medium">Better, together</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Family support · planned
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 border-t pt-4">
                  <span className="flex size-8 items-center justify-center rounded-full bg-secondary">
                    <ShieldCheck className="size-4 text-primary" />
                  </span>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Your story stays yours.
                    <br />
                    <span className="font-medium text-foreground">
                      You choose what to share.
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
            <div className="mt-5 flex items-center justify-center gap-2 text-[10px] font-medium tracking-[0.12em] text-primary/80 uppercase">
              <span className="h-px w-8 bg-primary/20" /> Illustrative
              experience <span className="h-px w-8 bg-primary/20" />
            </div>
          </div>
        </section>
        <section id="how-it-works" className="border-y bg-card">
          <div className="mx-auto max-w-7xl px-5 py-16 md:px-10">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="eyebrow">A connected path to wellbeing</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                  Know. Understand. Take small steps.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                From the first conversation to everyday care, designed to make
                the next step feel simpler.
              </p>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: AudioLines,
                  step: "01",
                  title: "Speak naturally",
                  subtitle: "Your story, your words",
                  text: "Planned voice intake in supported languages, with a transcript you can review before sharing.",
                },
                {
                  icon: Sprout,
                  step: "02",
                  title: "Understand your next step",
                  subtitle: "Clarity before action",
                  text: "Explainable factors and gentle lifestyle guidance, with clear clinical boundaries.",
                },
                {
                  icon: HeartHandshake,
                  step: "03",
                  title: "Care, together",
                  subtitle: "Support for every day",
                  text: "Daily check-ins and permission-based family support, all connected to your routine.",
                },
              ].map(({ icon: Icon, step, title, subtitle, text }) => (
                <Card
                  key={step}
                  className="rounded-2xl shadow-none ring-border"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-secondary">
                        <Icon className="size-5 text-primary" />
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {step}
                      </span>
                    </div>
                    <h3 className="mt-6 text-lg font-semibold">{title}</h3>
                    <p className="mt-1 text-sm text-primary">{subtitle}</p>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {text}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
        <section
          id="connected-care"
          className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:px-10 lg:grid-cols-2"
        >
          <div>
            <p className="eyebrow">More than a number</p>
            <h2 className="mt-3 max-w-md text-3xl leading-tight font-semibold tracking-tight">
              Your health doesn’t happen in isolation.
              <br />
              <span className="text-primary">Neither should your care.</span>
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground">
              Designed for adults exploring prevention, people managing
              prediabetes or diabetes, and the families and care teams beside
              them.
            </p>
            <Link
              href="/care-circle"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary"
            >
              Explore the connected experience <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-4">
            {[
              {
                icon: Network,
                title: "Context that connects",
                text: "Neo4j relationships connect habits and care history—not a black-box diagnosis.",
              },
              {
                icon: ShieldCheck,
                title: "Privacy is part of care",
                text: "Scoped, revocable sharing. Verified consent boundaries with immediate revocation.",
              },
              {
                icon: HeartHandshake,
                title: "Built for the whole care circle",
                text: "Separate experiences for personal routines, family support, and clinic follow-up.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="flex gap-4 rounded-2xl border bg-card p-5"
              >
                <Icon className="mt-1 size-5 shrink-0 text-primary" />
                <div>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-5 py-8 md:px-10">
          <Brand />
          <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">
            SugarGuard CareBridge · Health education, not medical advice. Connect with your care circle and healthcare team.
          </p>
          <Link href="/prompts" className="text-xs font-medium text-primary">
            Implementation roadmap ↗
          </Link>
        </div>
      </footer>
    </div>
  )
}
