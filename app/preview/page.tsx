import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  AudioLines,
  CalendarDays,
  Check,
  Footprints,
  HeartHandshake,
  Plus,
  Sprout,
  Sun,
} from "lucide-react"
import { PreviewShell } from "@/components/shell/preview-shell"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { demoHabits } from "@/lib/demo/preview"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Your care, connected · Preview",
  robots: { index: false, follow: false },
}

export default function PreviewPage() {
  return (
    <PreviewShell>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">A fresh start, every day</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Welcome. Make room for your wellbeing.{" "}
            <Sun className="ml-1 inline size-7 text-amber-500" />
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your daily care, a little more connected.
          </p>
        </div>
        <Badge variant="outline" className="h-9 gap-2 bg-card px-3">
          <CalendarDays className="size-4" /> A sample day
        </Badge>
      </div>
      <section
        className="mb-7 grid gap-5 xl:grid-cols-[1.6fr_1fr]"
        aria-label="Getting started"
      >
        <div className="relative overflow-hidden rounded-2xl bg-primary p-7 text-primary-foreground md:p-8">
          <Sprout
            className="absolute -right-4 -bottom-7 size-44 rotate-[-15deg] opacity-10"
            aria-hidden="true"
          />
          <Badge className="border-white/20 bg-white/10 text-white">
            Your next small step
          </Badge>
          <h2 className="relative mt-4 text-2xl leading-relaxed font-medium">
            Your health story,
            <br />
            in your own words.
          </h2>
          <p className="relative mt-3 max-w-md text-sm leading-relaxed text-white/75">
            Start with a few questions about your everyday routine.
            English-first, at your pace.
          </p>
          <Link
            href="/preview/onboarding"
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "relative mt-6 h-10 rounded-full px-5"
            )}
          >
            <AudioLines /> Explore voice intake <ArrowRight />
          </Link>
        </div>
        <Card className="rounded-2xl ring-border">
          <CardHeader>
            <div className="mb-3 flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary">
                <HeartHandshake className="size-5 text-primary" />
              </span>
              <Badge variant="outline">Consent first</Badge>
            </div>
            <CardTitle>You don’t have to do it alone.</CardTitle>
            <CardDescription className="mt-2 leading-relaxed">
              Make room for the people who care. You decide what they can see,
              and for how long.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/preview/care-circle"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              Meet your care circle <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      </section>
      <section
        aria-label="Sample routine summary"
        className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          {
            label: "Movement",
            subtitle: "Your daily movement",
            value: "5 min",
            note: "Self-reported sample",
            icon: Footprints,
          },
          {
            label: "Journal",
            subtitle: "Your everyday journal",
            value: "2 entries",
            note: "Illustrative meal entries",
            icon: CalendarDays,
          },
          {
            label: "Care circle",
            subtitle: "Support from your circle",
            value: "Not connected",
            note: "Invitation flow planned",
            icon: HeartHandshake,
          },
          {
            label: "Risk profile",
            subtitle: "Understand your health",
            value: "Not assessed",
            note: "No clinical score generated",
            icon: Sprout,
          },
        ].map(({ label, subtitle, value, note, icon: Icon }) => (
          <Card key={label} className="rounded-2xl ring-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{label}</span>
                <Icon className="size-4 text-primary" />
              </div>
              <p className="mt-4 text-xl font-semibold tracking-tight">
                {value}
              </p>
              <p className="mt-1 text-xs font-medium">{subtitle}</p>
              <p className="mt-3 text-[11px] text-muted-foreground">{note}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card className="rounded-2xl ring-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Small steps for today</CardTitle>
              <CardDescription className="mt-1">
                A sample routine, not a prescribed plan
              </CardDescription>
            </div>
            <Badge variant="secondary">Illustration</Badge>
          </CardHeader>
          <CardContent className="space-y-6 pb-2">
            {demoHabits.map((habit, index) => (
              <div key={habit.title} className="flex gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                  {index === 1 ? (
                    <Check className="size-4" />
                  ) : (
                    <span className="text-xs">0{index + 1}</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap justify-between gap-2">
                    <h3 className="text-sm font-medium">{habit.title}</h3>
                    <span className="text-xs text-muted-foreground">
                      {habit.value}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {habit.detail}
                  </p>
                  <Progress
                    value={habit.progress}
                    aria-label={habit.title}
                    className="mt-3"
                  />
                </div>
              </div>
            ))}
            <Link
              href="/preview/daily-log"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "mt-1 h-10 w-full"
              )}
            >
              <Plus /> Explore daily journal
            </Link>
          </CardContent>
        </Card>
        <Card className="rounded-2xl ring-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>A week of small steps</CardTitle>
              <Footprints className="size-4 text-primary" />
            </div>
            <CardDescription>
              Illustrative self-reported minutes · not sensor-verified
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="flex h-36 items-end justify-between gap-3 pt-3"
              role="img"
              aria-label="Synthetic movement minutes: Monday 10, Tuesday 15, Wednesday 5, Thursday 20, Friday 10, Saturday 15, Sunday 5."
            >
              {[10, 15, 5, 20, 10, 15, 5].map((minutes, index) => (
                <div
                  key={index}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                >
                  <span className="text-[10px] text-muted-foreground">
                    {minutes}
                  </span>
                  <div
                    className={cn(
                      "w-full max-w-9 rounded-t-md bg-primary/20",
                      index === 6 && "bg-primary"
                    )}
                    style={{ height: `${minutes * 4}px` }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {["M", "T", "W", "T", "F", "S", "S"][index]}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl bg-secondary p-4">
              <p className="text-sm font-medium text-primary">
                Every small step matters.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                The real experience will connect your journal over time. This
                chart is a static design sample, not a health trend.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PreviewShell>
  )
}
