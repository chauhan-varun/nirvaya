"use client"

import * as React from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert } from "@/components/ui/alert"
import {
  HeartHandshake,
  UserPlus,
  ShieldCheck,
  ShieldOff,
  Clock,
  ClipboardCopy,
  X,
  Info,
  Eye,
  CheckCircle2,
  XCircle,
} from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────────────

type ScopeKey =
  | "view_glucose"
  | "view_weight"
  | "view_blood_pressure"
  | "view_journal"
  | "view_medications"

const SCOPE_LABELS: Record<ScopeKey, string> = {
  view_glucose: "Blood glucose readings",
  view_weight: "Weight measurements",
  view_blood_pressure: "Blood pressure readings",
  view_journal: "Daily journal entries",
  view_medications: "Medication logs",
}

const ALL_SCOPES: ScopeKey[] = Object.keys(SCOPE_LABELS) as ScopeKey[]

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "default" | "outline" | "secondary" }
> = {
  pending: { label: "Pending", variant: "outline" },
  accepted: { label: "Active", variant: "default" },
  revoked: { label: "Revoked", variant: "secondary" },
  expired: { label: "Expired", variant: "secondary" },
}

// ─── Token display ──────────────────────────────────────────────────────────

function TokenDisplay({
  token,
  expiresAt,
  email,
}: {
  token: string
  expiresAt: string
  email: string
}) {
  const [copied, setCopied] = React.useState(false)

  async function copy() {
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const expiry = new Date(expiresAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <div className="space-y-3 rounded-xl bg-secondary p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="size-4 text-primary" />
        Invitation created for{" "}
        <span className="font-mono text-primary">{email}</span>
      </div>
      <div className="rounded-md bg-background p-3 font-mono text-xs break-all">
        {token}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs" variant="outline" onClick={copy} className="gap-1.5">
          <ClipboardCopy className="size-3" />
          {copied ? "Copied!" : "Copy token"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Expires {expiry}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Share this token privately with the person you are inviting. It can only
        be used once, by the account that matches the email address you entered.
        External email delivery is not yet enabled.
      </p>
    </div>
  )
}

// ─── Invite form ────────────────────────────────────────────────────────────

function InviteDialog({ onSuccess }: { onSuccess: () => void }) {
  const trpc = useTRPC()
  const [open, setOpen] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [label, setLabel] = React.useState("")
  const [purpose, setPurpose] = React.useState("")
  const [ttl, setTtl] = React.useState(48)
  const [selectedScopes, setSelectedScopes] = React.useState<Set<ScopeKey>>(
    new Set(["view_glucose"])
  )
  const [result, setResult] = React.useState<{
    rawToken: string
    expiresAt: string
  } | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const inviteMutation = useMutation(
    trpc.careCircle.invite.mutationOptions({
      onSuccess: (data) => {
        setResult({ rawToken: data.rawToken, expiresAt: data.expiresAt })
        onSuccess()
      },
      onError: (err) => {
        setError(err.message)
      },
    })
  )

  function toggleScope(scope: ScopeKey) {
    setSelectedScopes((prev) => {
      const next = new Set(prev)
      if (next.has(scope)) {
        next.delete(scope)
      } else {
        next.add(scope)
      }
      return next
    })
  }

  function resetForm() {
    setEmail("")
    setLabel("")
    setPurpose("")
    setTtl(48)
    setSelectedScopes(new Set(["view_glucose"]))
    setResult(null)
    setError(null)
  }

  function handleClose() {
    setOpen(false)
    resetForm()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (selectedScopes.size === 0) {
      setError("Select at least one type of information to share.")
      return
    }
    inviteMutation.mutate({
      inviteeEmail: email,
      relationshipLabel: label || undefined,
      requestedScopes: Array.from(selectedScopes),
      purpose: purpose || "Family health support",
      ttlHours: ttl,
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground whitespace-nowrap transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <UserPlus className="size-4" />
        Invite someone
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a trusted person</DialogTitle>
          <DialogDescription>
            You choose exactly what they can see, and you can revoke access at
            any time.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <TokenDisplay
              token={result.rawToken}
              expiresAt={result.expiresAt}
              email={email}
            />
            <DialogClose className="inline-flex w-full shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium transition-all outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50" onClick={handleClose}>
              Done
            </DialogClose>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="invitee-email">Their email address</Label>
              <Input
                id="invitee-email"
                type="email"
                required
                placeholder="person@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                They must sign in with this exact email to accept.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="relationship">Relationship (optional)</Label>
              <Input
                id="relationship"
                type="text"
                placeholder="e.g. Spouse, Parent, Sibling"
                maxLength={50}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>What can they see?</Label>
              <div className="rounded-lg border p-3 space-y-2">
                {ALL_SCOPES.map((scope) => (
                  <div key={scope} className="flex items-center gap-2.5">
                    <Checkbox
                      id={`scope-${scope}`}
                      checked={selectedScopes.has(scope)}
                      onCheckedChange={() => toggleScope(scope)}
                    />
                    <label
                      htmlFor={`scope-${scope}`}
                      className="cursor-pointer text-sm"
                    >
                      {SCOPE_LABELS[scope]}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="purpose">Purpose (optional)</Label>
              <Input
                id="purpose"
                type="text"
                placeholder="e.g. Monitoring support from family"
                maxLength={200}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ttl">Link expires after</Label>
              <select
                id="ttl"
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                value={ttl}
                onChange={(e) => setTtl(Number(e.target.value))}
              >
                <option value={1}>1 hour</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours (recommended)</option>
                <option value={72}>72 hours</option>
              </select>
            </div>

            <div className="flex gap-2">
              <DialogClose className="inline-flex flex-1 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium transition-all outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50" onClick={resetForm}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                className="flex-1"
                disabled={inviteMutation.isPending}
              >
                {inviteMutation.isPending ? "Sending…" : "Create invitation"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Accept token form ───────────────────────────────────────────────────────

function AcceptDialog({ currentUserEmail }: { currentUserEmail?: string }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [token, setToken] = React.useState("")
  const [email, setEmail] = React.useState(currentUserEmail ?? "")
  const [success, setSuccess] = React.useState<string[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const acceptMutation = useMutation(
    trpc.careCircle.accept.mutationOptions({
      onSuccess: (data) => {
        setSuccess(data.scopes)
        queryClient.invalidateQueries()
      },
      onError: (err) => {
        setError(err.message)
      },
    })
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    acceptMutation.mutate({
      rawToken: token.trim(),
      acceptorEmail: email.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium transition-all outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
        <Eye className="size-4" />
        Use an invitation token
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Accept a care circle invitation</DialogTitle>
          <DialogDescription>
            Enter the token you received from someone who wants to share their
            health data with you.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-secondary p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <CheckCircle2 className="size-4" />
                Access granted
              </div>
              <p className="text-sm text-muted-foreground">
                You now have access to view:
              </p>
              <ul className="space-y-1">
                {success.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm">
                    <ShieldCheck className="size-3.5 text-primary shrink-0" />
                    {SCOPE_LABELS[s as ScopeKey] ?? s}
                  </li>
                ))}
              </ul>
            </div>
            <DialogClose className="inline-flex w-full shrink-0 items-center justify-center rounded-lg border border-transparent bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground transition-all outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50" onClick={() => setOpen(false)}>
              Done
            </DialogClose>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="accept-token">Invitation token</Label>
              <Input
                id="accept-token"
                type="text"
                required
                placeholder="Paste token here"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="font-mono text-xs"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="accept-email">Your email address</Label>
              <Input
                id="accept-email"
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Must match the email the invitation was sent to.
              </p>
            </div>

            <div className="flex gap-2">
              <DialogClose className="inline-flex flex-1 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium transition-all outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
                Cancel
              </DialogClose>
              <Button
                type="submit"
                className="flex-1"
                disabled={acceptMutation.isPending}
              >
                {acceptMutation.isPending ? "Verifying…" : "Accept access"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── History row ─────────────────────────────────────────────────────────────

type HistoryEntry = {
  invitationId: string
  inviteeEmail: string
  relationshipLabel: string | null
  status: string
  scopes: string[]
  purpose: string
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
  consentGrantId: string | null
  consentActive: boolean
}

function HistoryRow({
  entry,
  onCancel,
  onRevoke,
}: {
  entry: HistoryEntry
  onCancel: (id: string) => void
  onRevoke: (grantId: string) => void
}) {
  const statusDef = STATUS_BADGE[entry.status] ?? {
    label: entry.status,
    variant: "outline" as const,
  }

  const displayEmail =
    entry.inviteeEmail.length > 36
      ? entry.inviteeEmail.slice(0, 33) + "…"
      : entry.inviteeEmail

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{displayEmail}</span>
            {entry.relationshipLabel && (
              <span className="text-xs text-muted-foreground">
                · {entry.relationshipLabel}
              </span>
            )}
            <Badge variant={statusDef.variant} className="text-xs">
              {statusDef.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {entry.purpose}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {entry.status === "pending" && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => onCancel(entry.invitationId)}
              aria-label="Cancel invitation"
              title="Cancel invitation"
            >
              <X className="size-3.5" />
            </Button>
          )}
          {entry.status === "accepted" && entry.consentGrantId && entry.consentActive && (
            <Button
              size="xs"
              variant="destructive"
              onClick={() => onRevoke(entry.consentGrantId!)}
              className="gap-1"
            >
              <ShieldOff className="size-3" />
              Revoke access
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {entry.scopes.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
          >
            <ShieldCheck className="size-2.5" />
            {SCOPE_LABELS[s as ScopeKey] ?? s}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          Sent {new Date(entry.createdAt).toLocaleDateString()}
        </span>
        {entry.acceptedAt && (
          <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
            <CheckCircle2 className="size-3" />
            Accepted {new Date(entry.acceptedAt).toLocaleDateString()}
          </span>
        )}
        {entry.revokedAt && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <XCircle className="size-3" />
            Revoked {new Date(entry.revokedAt).toLocaleDateString()}
          </span>
        )}
        {entry.status === "pending" && (
          <span>
            Expires {new Date(entry.expiresAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export function CareCircleDashboard({
  currentUserEmail,
}: {
  currentUserEmail?: string
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const historyQuery = useQuery(
    trpc.careCircle.history.queryOptions({ limit: 50 })
  )

  const cancelMutation = useMutation(
    trpc.careCircle.cancelInvitation.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(),
    })
  )

  const revokeMutation = useMutation(
    trpc.careCircle.revokeAccess.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(),
    })
  )

  const [confirmRevoke, setConfirmRevoke] = React.useState<string | null>(null)

  const entries: HistoryEntry[] = historyQuery.data?.entries ?? []
  const active = entries.filter((e) => e.status === "accepted" && e.consentActive)
  const pending = entries.filter((e) => e.status === "pending")
  const past = entries.filter((e) => !["accepted", "pending"].includes(e.status) || (e.status === "accepted" && !e.consentActive))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Care circle
        </h1>
        <p className="text-sm text-muted-foreground">
          Invite trusted people to view specific health data. You control every
          scope, and you can revoke access at any time.
        </p>
      </div>

      {/* Principle notice */}
      <div className="flex gap-3 rounded-xl bg-secondary p-4 text-sm">
        <Info className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium">Your data, your rules</p>
          <p className="text-muted-foreground text-xs">
            Sharing is always owner-initiated and scoped. Family relationships do
            not automatically grant access. Access is re-verified on every read
            against the canonical database — revoking is immediate.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <InviteDialog onSuccess={() => queryClient.invalidateQueries()} />
        <AcceptDialog currentUserEmail={currentUserEmail} />
      </div>

      {/* Loading / error */}
      {historyQuery.isPending && (
        <div className="text-sm text-muted-foreground animate-pulse">
          Loading care circle…
        </div>
      )}
      {historyQuery.isError && (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Could not load care circle. Please refresh or try again later.
        </div>
      )}

      {/* Active sharing */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Active sharing ({active.length})
          </h2>
          {active.map((e) => (
            <HistoryRow
              key={e.invitationId}
              entry={e}
              onCancel={(id) => cancelMutation.mutate({ invitationId: id })}
              onRevoke={(grantId) => setConfirmRevoke(grantId)}
            />
          ))}
        </section>
      )}

      {/* Pending invitations */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pending invitations ({pending.length})
          </h2>
          {pending.map((e) => (
            <HistoryRow
              key={e.invitationId}
              entry={e}
              onCancel={(id) => cancelMutation.mutate({ invitationId: id })}
              onRevoke={(grantId) => setConfirmRevoke(grantId)}
            />
          ))}
        </section>
      )}

      {/* Empty state */}
      {!historyQuery.isPending && entries.length === 0 && (
        <div className="rounded-2xl bg-secondary p-10 text-center">
          <HeartHandshake className="mx-auto size-10 text-primary mb-4" />
          <p className="font-medium">Your circle starts with you</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
            When you are ready, invite a trusted person. They will only see
            exactly what you choose to share.
          </p>
        </div>
      )}

      {/* Past entries */}
      {past.length > 0 && (
        <>
          <Separator />
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Sharing history
            </h2>
            {past.map((e) => (
              <HistoryRow
                key={e.invitationId}
                entry={e}
                onCancel={(id) => cancelMutation.mutate({ invitationId: id })}
                onRevoke={(grantId) => setConfirmRevoke(grantId)}
              />
            ))}
          </section>
        </>
      )}

      {/* Revoke confirmation dialog */}
      <Dialog
        open={!!confirmRevoke}
        onOpenChange={(o) => { if (!o) setConfirmRevoke(null) }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke access?</DialogTitle>
            <DialogDescription>
              This immediately stops this person from viewing your health data.
              This cannot be undone — you would need to send a new invitation if
              you want to share again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <DialogClose className="inline-flex flex-1 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium transition-all outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
              Keep access
            </DialogClose>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={revokeMutation.isPending}
              onClick={() => {
                if (confirmRevoke) {
                  revokeMutation.mutate({ consentGrantId: confirmRevoke })
                  setConfirmRevoke(null)
                }
              }}
            >
              {revokeMutation.isPending ? "Revoking…" : "Yes, revoke"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
