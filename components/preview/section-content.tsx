import {
  AudioLines,
  Bluetooth,
  CircleCheck,
  Clock3,
  HeartHandshake,
  LockKeyhole,
  Mic,
  ShieldCheck,
  Thermometer,
  UserRound,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import type { PreviewSection } from "@/lib/demo/preview"

function Panel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card className="rounded-2xl ring-border">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function SectionContent({ section }: { section: PreviewSection }) {
  if (section === "onboarding")
    return (
      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Panel
          title="Let’s start with you."
          description="Step 1 of a planned onboarding flow · nothing is recorded or submitted."
        >
          <div className="flex flex-col items-center rounded-2xl border border-dashed bg-secondary/50 px-5 py-10 text-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-primary/10">
              <AudioLines className="size-9 text-primary" />
            </span>
            <h2 className="mt-5 text-lg font-medium">Speak at your own pace</h2>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              You’ll be able to review and correct a transcript before anything
              becomes part of your profile.
            </p>
            <Button disabled className="mt-6 h-11 rounded-full px-6">
              <Mic /> Recording not connected
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Sarvam integration pending · microphone is never accessed
            </p>
          </div>
        </Panel>
        <Panel
          title="Or tell us in writing"
          description="A keyboard alternative will always be available."
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="preview-name">Preferred name</Label>
              <Input
                id="preview-name"
                placeholder="How should we address you?"
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preview-language">Conversation language</Label>
              <Input id="preview-language" value="English (default)" disabled />
            </div>
            <Separator />
            <div className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
              <LockKeyhole className="mt-1 size-5 shrink-0 text-primary" />
              <p>
                Recording will require explicit permission. Health-data consent
                will be separate from signing in.
              </p>
            </div>
            <Button disabled className="w-full">
              Continue · integration pending
            </Button>
          </div>
        </Panel>
      </div>
    )
  if (section === "risk")
    return (
      <div className="space-y-6">
        <Alert>
          <ShieldCheck />
          <AlertTitle>No assessment has been performed</AlertTitle>
          <AlertDescription>
            This scaffold does not calculate diabetes risk or diagnose disease.
            A validated instrument and clinical review are required before
            scoring.
          </AlertDescription>
        </Alert>
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            {
              title: "Family history",
              text: "A future assessment may ask about diabetes in close relatives.",
              tag: "Background factor",
            },
            {
              title: "Everyday movement",
              text: "Self-reported activity can help start a conversation about daily routines.",
              tag: "Modifiable routine",
            },
            {
              title: "Sleep & routine",
              text: "Lifestyle context can support guidance; it is not automatically part of a clinical score.",
              tag: "Context, not diagnosis",
            },
          ].map((factor) => (
            <Panel
              key={factor.title}
              title={factor.title}
              description="Example explanation structure"
            >
              <Badge variant="secondary">{factor.tag}</Badge>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                {factor.text}
              </p>
              <Separator className="my-5" />
              <p className="text-xs text-muted-foreground">
                Source: illustrative copy · no personal data
              </p>
            </Panel>
          ))}
        </div>
        <Panel
          title="Your next step"
          description="Understand what is known, what is missing, and when to seek professional advice."
        >
          <p className="text-sm leading-relaxed text-muted-foreground">
            The implemented view should name the assessment instrument and
            version, show missing inputs, distinguish screening from diagnosis,
            and explain every contributing factor in the selected, supported
            language. No score is displayed in this preview.
          </p>
        </Panel>
      </div>
    )
  if (section === "daily-log")
    return (
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[
          {
            title: "Meals",
            hint: "Meal time, a short description, and optional portion notes.",
            unit: "Meal description",
          },
          {
            title: "Activity",
            hint: "Type, duration, and self-reported source. Presence is not exercise.",
            unit: "Duration in minutes",
          },
          {
            title: "Sleep",
            hint: "Sleep duration and optional quality notes, with local dates.",
            unit: "Duration in hours",
          },
          {
            title: "Glucose",
            hint: "Unit, reading context, timestamp, and source are required.",
            unit: "Reading + mg/dL or mmol/L",
          },
          {
            title: "Medicines",
            hint: "Log a prescribed medicine. Never recommend changing a dose.",
            unit: "Prescribed medicine name",
          },
          {
            title: "Hydration",
            hint: "Optional daily intake without one-size-fits-all medical targets.",
            unit: "Amount in mL",
          },
        ].map((log, index) => (
          <Panel key={log.title} title={log.title} description={log.hint}>
            <Label htmlFor={`log-${index}`} className="mb-2 text-xs">
              {log.unit}
            </Label>
            <Input id={`log-${index}`} placeholder={log.unit} disabled />
            <Button variant="outline" disabled className="mt-4 w-full">
              Save · not connected
            </Button>
          </Panel>
        ))}
      </div>
    )
  if (section === "care-circle")
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Panel
          title="Your permission. Your control."
          description="Invite someone you trust—only when you are ready."
        >
          <div className="rounded-xl bg-secondary p-6 text-center">
            <HeartHandshake className="mx-auto size-10 text-primary" />
            <h2 className="mt-4 text-lg font-medium">
              Your circle starts with you
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              No caregivers are connected. Invitations and permissions will be
              managed here after authentication is implemented.
            </p>
          </div>
          <Button disabled className="mt-5 w-full">
            Invite a caregiver · not connected
          </Button>
        </Panel>
        <Panel
          title="Share just enough"
          description="Proposed permission categories—not active grants."
        >
          <div className="space-y-5">
            {[
              "Habit summaries",
              "Glucose summaries",
              "Medication reminders",
              "Support alerts",
            ].map((scope) => (
              <div
                key={scope}
                className="flex items-center justify-between gap-4 border-b pb-4"
              >
                <span className="text-sm">{scope}</span>
                <Badge variant="outline">
                  <LockKeyhole className="mr-1 size-3" /> Not shared
                </Badge>
              </div>
            ))}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Grants must be scoped, time-bound where requested, and immediately
              revocable. Family links alone never grant access. Emergency
              contacts do not bypass consent.
            </p>
          </div>
        </Panel>
      </div>
    )
  if (section === "devices")
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Bluetooth,
              title: "Arduino station",
              value: "Not paired",
              note: "Device enrollment pending",
            },
            {
              icon: Thermometer,
              title: "Room temperature",
              value: "— °C",
              note: "Ambient context, not body temperature",
            },
            {
              icon: Clock3,
              title: "Last event",
              value: "No events",
              note: "No hardware connection is active",
            },
          ].map(({ icon: Icon, title, value, note }) => (
            <Panel key={title} title={title} description={note}>
              <Icon className="size-6 text-primary" />
              <p className="mt-5 text-2xl font-semibold">{value}</p>
            </Panel>
          ))}
        </div>
        <Panel
          title="Context, without surveillance"
          description="The station is an optional source of environmental context."
        >
          <div className="grid gap-6 md:grid-cols-3">
            {[
              "No video or raw images leave the edge device.",
              "Presence does not verify walking, exercise, or adherence.",
              "Only signed, minimal events should reach the API.",
            ].map((text) => (
              <div
                key={text}
                className="flex gap-3 text-sm leading-relaxed text-muted-foreground"
              >
                <ShieldCheck className="mt-1 size-5 shrink-0 text-primary" />
                <p>{text}</p>
              </div>
            ))}
          </div>
          <Button disabled variant="outline" className="mt-6">
            Pair station · not connected
          </Button>
        </Panel>
      </div>
    )
  return (
    <div className="space-y-6">
      <Alert>
        <LockKeyhole />
        <AlertTitle>Care-team preview · no patient records</AlertTitle>
        <AlertDescription>
          The real clinic workspace requires a verified role, organization
          membership, and patient-level authorization. Public preview access
          never implies clinical access.
        </AlertDescription>
      </Alert>
      <div className="grid gap-6 md:grid-cols-3">
        {[
          {
            icon: UserRound,
            title: "Screening queue",
            value: "0",
            note: "No screenings connected",
          },
          {
            icon: Clock3,
            title: "Follow-up due",
            value: "0",
            note: "No appointments connected",
          },
          {
            icon: CircleCheck,
            title: "Completed today",
            value: "0",
            note: "No clinical activity recorded",
          },
        ].map(({ icon: Icon, title, value, note }) => (
          <Panel key={title} title={title} description={note}>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-semibold">{value}</span>
              <Icon className="size-6 text-primary" />
            </div>
          </Panel>
        ))}
      </div>
      <Panel
        title="Follow-up workspace"
        description="An intentionally empty state—not a real clinic dashboard."
      >
        <div className="rounded-xl border border-dashed p-10 text-center">
          <UserRound className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-4 text-sm font-medium">No patients to display</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Authorized screening, search, and follow-up workflows will be
            implemented later.
          </p>
          <Button disabled variant="outline" className="mt-5">
            Bulk screening · not connected
          </Button>
        </div>
      </Panel>
    </div>
  )
}
