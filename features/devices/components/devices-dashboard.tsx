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
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Cpu,
  ShieldCheck,
  ShieldAlert,
  Thermometer,
  Eye,
  Key,
  ClipboardCopy,
  Wifi,
  WifiOff,
  AlertTriangle,
  Play,
  RotateCw,
  Plus,
} from "lucide-react"

export function DevicesDashboard() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const devicesQuery = useQuery(trpc.devices.list.queryOptions())

  const [enrollOpen, setEnrollOpen] = React.useState(false)
  const [enrolledSecret, setEnrolledSecret] = React.useState<{
    externalId: string
    secretKey: string
  } | null>(null)
  const [copied, setCopied] = React.useState(false)

  const [simulatingDeviceId, setSimulatingDeviceId] = React.useState<
    string | null
  >(null)
  const [simKind, setSimKind] = React.useState<
    "presence" | "ambient_temperature"
  >("ambient_temperature")
  const [simValue, setSimValue] = React.useState<number>(22.5)
  const [simResult, setSimResult] = React.useState<string | null>(null)

  const enrollMutation = useMutation(
    trpc.devices.enroll.mutationOptions({
      onSuccess: (data) => {
        setEnrolledSecret({
          externalId: data.device.externalId,
          secretKey: data.secretKey,
        })
        queryClient.invalidateQueries()
      },
    })
  )

  const revokeMutation = useMutation(
    trpc.devices.revoke.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(),
    })
  )

  const rotateMutation = useMutation(
    trpc.devices.rotateSecret.mutationOptions({
      onSuccess: (data) => {
        setEnrolledSecret({
          externalId: "Rotated Key",
          secretKey: data.newSecretKey,
        })
        queryClient.invalidateQueries()
      },
    })
  )

  const simulateMutation = useMutation(
    trpc.devices.simulateReading.mutationOptions({
      onSuccess: () => {
        setSimResult("Simulation ingested successfully!")
        queryClient.invalidateQueries()
      },
      onError: (err) => {
        setSimResult(`Simulation failed: ${err.message}`)
      },
    })
  )

  const devicesList = devicesQuery.data ?? []

  function isDeviceOnline(lastSeenAt: string | Date | null): boolean {
    if (!lastSeenAt) return false
    const ts = new Date(lastSeenAt).getTime()
    return Date.now() - ts < 15 * 60 * 1000 // within 15 min
  }

  async function copySecret() {
    if (enrolledSecret?.secretKey) {
      await navigator.clipboard.writeText(enrolledSecret.secretKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Cpu className="size-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Arduino edge stations & ambient sensing
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Outbound HMAC-authenticated hardware stations for room context and
          ambient temperature.
        </p>
      </div>

      {/* Truthful sensor disclosures */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-50/30 p-4 text-xs dark:bg-amber-950/20">
          <Thermometer className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Ambient Temperature (Modulino Thermo)
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Measures room environment temperature, not body temperature. Never
              used for fever screening, metabolic diagnosis, or clinical alerts.
            </p>
          </div>
        </div>

        <div className="flex gap-3 rounded-xl border border-blue-500/20 bg-blue-50/30 p-4 text-xs dark:bg-blue-950/20">
          <Eye className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Environmental Presence Sensing
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Provides passive room context. Never used for exercise adherence,
              workout verification, or physical tracking. No camera frames or
              images are ever uploaded or persisted.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Enrolled hardware stations ({devicesList.length})
        </h2>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setEnrolledSecret(null)
            setEnrollOpen(true)
          }}
        >
          <Plus className="size-4" />
          Enroll Edge Station
        </Button>
      </div>

      {/* Device List */}
      {devicesQuery.isPending && (
        <div className="text-sm text-muted-foreground animate-pulse">
          Loading hardware stations…
        </div>
      )}

      {devicesList.length === 0 && !devicesQuery.isPending && (
        <Card className="border-dashed p-8 text-center">
          <Cpu className="mx-auto size-10 text-muted-foreground mb-3" />
          <h3 className="font-medium text-base">No hardware stations enrolled</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Enroll an Arduino UNO Q station to monitor room conditions with
            signed HMAC telemetry.
          </p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {devicesList.map((dev) => {
          const online = isDeviceOnline(dev.lastSeenAt)
          return (
            <Card key={dev.id} className="relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="size-5 text-primary" />
                    <CardTitle className="text-sm font-mono font-semibold">
                      {dev.externalId}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {online ? (
                      <Badge variant="default" className="text-[10px] gap-1 bg-green-600">
                        <Wifi className="size-3" /> Online
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                        <WifiOff className="size-3" /> Disconnected / Stale
                      </Badge>
                    )}
                    <Badge
                      variant={dev.status === "active" ? "default" : "secondary"}
                      className="text-[10px] capitalize"
                    >
                      {dev.status}
                    </Badge>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  Model: {dev.model} · Key v{dev.keyVersion} · Protocol {dev.protocolVersion}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-secondary/50 p-2.5 text-xs font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Telemetry:</span>
                    <span>
                      {dev.lastSeenAt
                        ? new Date(dev.lastSeenAt).toLocaleString()
                        : "Never received"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Enrolled:</span>
                    <span>{new Date(dev.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="xs"
                    variant="outline"
                    className="gap-1 text-xs"
                    onClick={() => {
                      setSimulatingDeviceId(dev.id)
                      setSimResult(null)
                    }}
                  >
                    <Play className="size-3" /> Test Simulator
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="gap-1 text-xs"
                    disabled={rotateMutation.isPending}
                    onClick={() => rotateMutation.mutate({ deviceId: dev.id })}
                  >
                    <RotateCw className="size-3" /> Rotate Secret
                  </Button>
                  {dev.status === "active" && (
                    <Button
                      size="xs"
                      variant="destructive"
                      className="gap-1 text-xs"
                      disabled={revokeMutation.isPending}
                      onClick={() => revokeMutation.mutate({ deviceId: dev.id })}
                    >
                      <ShieldAlert className="size-3" /> Revoke
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Enroll Dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll Arduino Edge Station</DialogTitle>
            <DialogDescription>
              Provision a unique symmetric secret key for signed HMAC-SHA-256
              telemetry.
            </DialogDescription>
          </DialogHeader>

          {enrolledSecret ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-secondary p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Key className="size-4" />
                  Hardware Provisioning Secret
                </div>
                <p className="text-xs text-muted-foreground">
                  Copy this 256-bit symmetric key to your Arduino firmware or
                  environment configuration. It will NOT be shown again.
                </p>
                <div className="rounded-md bg-background p-2.5 font-mono text-xs break-all border">
                  {enrolledSecret.secretKey}
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  className="gap-1"
                  onClick={copySecret}
                >
                  <ClipboardCopy className="size-3" />
                  {copied ? "Copied!" : "Copy Secret Key"}
                </Button>
              </div>

              <Button className="w-full" onClick={() => setEnrollOpen(false)}>
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">
                Click below to generate a cryptographically random hardware
                identity and HMAC secret key.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEnrollOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={enrollMutation.isPending}
                  onClick={() => enrollMutation.mutate({ model: "arduino_uno_q_station" })}
                >
                  {enrollMutation.isPending ? "Generating…" : "Generate Credentials"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Simulator Modal */}
      <Dialog
        open={!!simulatingDeviceId}
        onOpenChange={(o) => {
          if (!o) setSimulatingDeviceId(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Arduino Edge Station Simulator</DialogTitle>
            <DialogDescription>
              Simulate signed outbound telemetry from an Arduino UNO Q station.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Sensor Kind</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
                value={simKind}
                onChange={(e) =>
                  setSimKind(e.target.value as "presence" | "ambient_temperature")
                }
              >
                <option value="ambient_temperature">
                  Modulino Thermo (Ambient Room °C)
                </option>
                <option value="presence">Environmental Presence (Binary)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">
                {simKind === "ambient_temperature"
                  ? "Room Temperature (°C)"
                  : "Presence Detected"}
              </label>
              {simKind === "ambient_temperature" ? (
                <input
                  type="number"
                  step="0.5"
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
                  value={simValue}
                  onChange={(e) => setSimValue(parseFloat(e.target.value))}
                />
              ) : (
                <select
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
                  value={simValue}
                  onChange={(e) => setSimValue(parseInt(e.target.value, 10))}
                >
                  <option value={1}>1 (Presence Detected)</option>
                  <option value={0}>0 (No Presence)</option>
                </select>
              )}
            </div>

            {simResult && (
              <div className="rounded-lg bg-secondary p-2.5 font-mono text-xs">
                {simResult}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setSimulatingDeviceId(null)}
              >
                Close
              </Button>
              <Button
                disabled={simulateMutation.isPending}
                onClick={() => {
                  if (simulatingDeviceId) {
                    simulateMutation.mutate({
                      deviceId: simulatingDeviceId,
                      kind: simKind,
                      value: simValue,
                    })
                  }
                }}
              >
                {simulateMutation.isPending ? "Sending…" : "Send Signed Reading"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
