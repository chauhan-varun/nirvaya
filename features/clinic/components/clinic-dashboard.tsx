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
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  History,
  PhoneCall,
  PlusCircle,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  UploadCloud,
  UserCheck,
} from "lucide-react"

export function ClinicDashboard() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // Tab state: "worklist" | "import"
  const [activeTab, setActiveTab] = React.useState<"worklist" | "import">(
    "worklist"
  )

  // Filters & Pagination state
  const [search, setSearch] = React.useState("")
  const [priorityFilter, setPriorityFilter] = React.useState<
    "all" | "routine" | "urgent"
  >("all")
  const [page, setPage] = React.useState(1)

  // Modals state
  const [actionModalPatient, setActionModalPatient] = React.useState<{
    id: string
    name: string | null
    priority: "routine" | "urgent"
  } | null>(null)

  const [historyModalPatient, setHistoryModalPatient] = React.useState<{
    id: string
    name: string | null
  } | null>(null)

  const [exportModalPatient, setExportModalPatient] = React.useState<{
    id: string
    name: string | null
  } | null>(null)

  // Form states
  const [actionType, setActionType] = React.useState<
    "phone_call" | "review" | "referral" | "message" | "in_person"
  >("phone_call")
  const [actionNotes, setActionNotes] = React.useState("")
  const [actionPriority, setActionPriority] = React.useState<
    "routine" | "urgent" | undefined
  >(undefined)

  const [exportPurpose, setExportPurpose] = React.useState(
    "Clinical specialist referral"
  )
  const [exportFormat, setExportFormat] = React.useState<"csv" | "json">("csv")
  const [exportResult, setExportResult] = React.useState<{
    content?: string
    summary?: any
    provenance: any
  } | null>(null)

  // Bulk import state
  const [importPurpose, setImportPurpose] = React.useState(
    "Community outreach screening camp"
  )
  const [importRowsText, setImportRowsText] = React.useState("")
  const [dryRunResult, setDryRunResult] = React.useState<{
    dryRun: boolean
    totalRows: number
    validRows: number
    errors: string[]
    canProceed: boolean
  } | null>(null)
  const [importSuccess, setImportSuccess] = React.useState<string | null>(null)

  // Queries
  const statusQuery = useQuery(trpc.clinic.status.queryOptions())

  const worklistQuery = useQuery(
    trpc.clinic.worklist.queryOptions({
      search: search || undefined,
      priority: priorityFilter,
      page,
      pageSize: 10,
    })
  )

  const historyQuery = useQuery({
    ...trpc.clinic.patientHistory.queryOptions(
      {
        patientId: historyModalPatient?.id ?? "",
      },
      {
        enabled: !!historyModalPatient?.id,
      }
    ),
  })

  // Mutations
  const recordActionMutation = useMutation(
    trpc.clinic.recordAction.mutationOptions({
      onSuccess: () => {
        setActionModalPatient(null)
        setActionNotes("")
        queryClient.invalidateQueries(trpc.clinic.worklist.pathFilter())
      },
    })
  )

  const exportMutation = useMutation(
    trpc.clinic.exportSummary.mutationOptions({
      onSuccess: (data) => {
        setExportResult(data as any)
      },
    })
  )

  const bulkImportMutation = useMutation(
    trpc.clinic.bulkImport.mutationOptions({
      onSuccess: (data) => {
        if (data.dryRun) {
          setDryRunResult(data as any)
          setImportSuccess(null)
        } else {
          setImportSuccess(
            `Successfully imported ${data.importedCount} screening observations in batch ${data.batchId}`
          )
          setDryRunResult(null)
          queryClient.invalidateQueries(trpc.clinic.worklist.pathFilter())
        }
      },
    })
  )

  // Load sample import roster
  const handleLoadSampleRoster = (samplePatientId?: string) => {
    const pId =
      samplePatientId ||
      worklistQuery.data?.items[0]?.patientId ||
      "00000000-0000-0000-0000-000000000000"
    const sample = [
      {
        patientId: pId,
        screeningType: "glucose_fasting",
        value: "118.5",
        unit: "mg/dL",
        screenedAt: new Date(Date.now() - 3600000).toISOString(),
        externalReference: "CAMP-REF-01",
      },
      {
        patientId: pId,
        screeningType: "systolic_bp",
        value: "128",
        unit: "mmHg",
        screenedAt: new Date(Date.now() - 3600000).toISOString(),
        externalReference: "CAMP-REF-02",
      },
    ]
    setImportRowsText(JSON.stringify(sample, null, 2))
    setDryRunResult(null)
    setImportSuccess(null)
  }

  // Handle dry run or commit
  const handleImportSubmit = (dryRun: boolean) => {
    try {
      const parsed = JSON.parse(importRowsText)
      if (!Array.isArray(parsed)) {
        alert("Payload must be a JSON array of screening rows.")
        return
      }
      bulkImportMutation.mutate({
        purpose: importPurpose,
        dryRun,
        rows: parsed,
      })
    } catch {
      alert("Invalid JSON format. Please verify your screening rows syntax.")
    }
  }

  // Handle file download
  const handleDownloadExport = () => {
    if (!exportResult) return
    const blob = new Blob(
      [
        exportFormat === "csv"
          ? exportResult.content || ""
          : JSON.stringify(exportResult, null, 2),
      ],
      {
        type:
          exportFormat === "csv"
            ? "text/csv;charset=utf-8;"
            : "application/json",
      }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `patient-summary-${exportModalPatient?.id ?? "export"}.${exportFormat}`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (statusQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">
          Verifying clinician authorization credentials...
        </p>
      </div>
    )
  }

  const clinician = statusQuery.data

  if (!clinician?.isClinician) {
    return (
      <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader>
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <ShieldAlert className="h-5 w-5" />
            <CardTitle>Clinician Workspace Restricted</CardTitle>
          </div>
          <CardDescription>
            You do not possess an active, verified clinician membership in a recognized healthcare tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Health-worker workflows, patient worklists, and screening imports require server-authenticated
            credentials verified by clinic administrators. Client-edited metadata or personal accounts
            cannot self-claim clinician authorization.
          </p>
          <p>
            Current verification status:{" "}
            <span className="font-semibold text-foreground">
              {clinician?.verificationStatus ?? "No clinician profile found"}
            </span>
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Clinician Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">
              Clinic Follow-up Workspace
            </h1>
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              Verified Clinician
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Clinic: <span className="font-medium text-foreground">{clinician.clinicName}</span>
            {clinician.licenseNumber ? ` • License: ${clinician.licenseNumber}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === "worklist" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("worklist")}
          >
            <UserCheck className="mr-2 h-4 w-4" />
            Follow-up Worklist
          </Button>
          <Button
            variant={activeTab === "import" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("import")}
          >
            <UploadCloud className="mr-2 h-4 w-4" />
            Bulk Screenings
          </Button>
        </div>
      </div>

      {activeTab === "worklist" && (
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">
                  Assigned Patient Follow-up List
                </CardTitle>
                <CardDescription>
                  Patients explicitly assigned to your care queue. Unassigned patients are isolated.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search assigned patient..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                    className="pl-9 h-9 w-[220px] text-xs"
                  />
                </div>

                <div className="flex items-center gap-1 border rounded-md p-1 bg-background text-xs">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setPriorityFilter("all")
                      setPage(1)
                    }}
                    className={`px-2 py-0.5 rounded text-xs transition ${
                      priorityFilter === "all"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPriorityFilter("urgent")
                      setPage(1)
                    }}
                    className={`px-2 py-0.5 rounded text-xs transition ${
                      priorityFilter === "urgent"
                        ? "bg-rose-600 text-white font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Urgent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPriorityFilter("routine")
                      setPage(1)
                    }}
                    className={`px-2 py-0.5 rounded text-xs transition ${
                      priorityFilter === "routine"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Routine
                  </button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {worklistQuery.isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
                Loading assigned patient follow-ups...
              </div>
            ) : worklistQuery.isError ? (
              <div className="p-8 text-center text-sm text-destructive">
                Failed to load patient worklist: {worklistQuery.error.message}
              </div>
            ) : (worklistQuery.data?.items.length ?? 0) === 0 ? (
              <div className="p-12 text-center space-y-2">
                <UserCheck className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">
                  No assigned patients found
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {search
                    ? `No matching records found for "${search}".`
                    : "You currently have no active care assignments in this clinic queue."}
                </p>
              </div>
            ) : (
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Demographics</TableHead>
                      <TableHead>Latest Observation</TableHead>
                      <TableHead>Actions Count</TableHead>
                      <TableHead className="text-right">Follow-up</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {worklistQuery.data?.items.map((item) => (
                      <TableRow key={item.assignmentId}>
                        <TableCell>
                          <div className="font-medium text-foreground text-xs">
                            {item.patientName || "Anonymous Patient"}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            ID: {item.patientId.slice(0, 8)}...
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={item.priority === "urgent" ? "destructive" : "secondary"}
                            className="text-[10px] uppercase font-semibold"
                          >
                            {item.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.yearOfBirth ? `YOB: ${item.yearOfBirth}` : "YOB: N/A"}
                          {item.gender ? ` • ${item.gender}` : ""}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.lastObservation ? (
                            <div className="space-y-0.5">
                              <span className="font-semibold text-foreground">
                                {item.lastObservation.value} {item.lastObservation.unit}
                              </span>
                              <span className="text-[10px] text-muted-foreground block">
                                {item.lastObservation.type} •{" "}
                                {new Date(item.lastObservation.observedAt).toLocaleDateString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              None recorded
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <button
                            type="button"
                            onClick={() =>
                              setHistoryModalPatient({
                                id: item.patientId,
                                name: item.patientName,
                              })
                            }
                            className="underline hover:text-foreground inline-flex items-center gap-1"
                          >
                            <History className="h-3 w-3" />
                            {item.followUpActionsCount} logged
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setActionModalPatient({
                                  id: item.patientId,
                                  name: item.patientName,
                                  priority: item.priority as any,
                                })
                                setActionPriority(item.priority as any)
                              }}
                            >
                              <PlusCircle className="mr-1 h-3 w-3" />
                              Log Action
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setExportModalPatient({
                                  id: item.patientId,
                                  name: item.patientName,
                                })
                                setExportResult(null)
                              }}
                            >
                              <Download className="mr-1 h-3 w-3" />
                              Export
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination footer */}
                <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
                  <div>
                    Page {worklistQuery.data?.page} of {worklistQuery.data?.totalPages || 1} (
                    {worklistQuery.data?.totalCount} total assigned)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={page >= (worklistQuery.data?.totalPages || 1)}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "import" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">
                Bulk Screening Ingestion
              </CardTitle>
            </div>
            <CardDescription>
              Bounded, schema-validated, duplicate-aware screening ingestion with dry-run review.
              Only accepts records for consented patients within this clinic.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Clinical Ingestion Purpose (Required for Audit Provenance)
              </label>
              <Input
                value={importPurpose}
                onChange={(e) => setImportPurpose(e.target.value)}
                placeholder="e.g. Community Outreach Blood Pressure Camp"
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">
                  Screening Records (JSON Array, max 500 rows)
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground"
                  onClick={() => handleLoadSampleRoster()}
                >
                  Load Sample Roster
                </Button>
              </div>
              <textarea
                value={importRowsText}
                onChange={(e) => {
                  setImportRowsText(e.target.value)
                  setDryRunResult(null)
                  setImportSuccess(null)
                }}
                rows={8}
                placeholder='[\n  {\n    "patientId": "uuid-here",\n    "screeningType": "glucose_fasting",\n    "value": "118.5",\n    "unit": "mg/dL",\n    "screenedAt": "2026-11-21T18:00:00Z",\n    "externalReference": "CAMP-01"\n  }\n]'
                className="w-full rounded-md border bg-muted/20 p-2.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {dryRunResult && (
              <div
                className={`rounded-lg p-3 text-xs border ${
                  dryRunResult.canProceed
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  {dryRunResult.canProceed ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  Dry Run Validation: {dryRunResult.validRows} valid rows of {dryRunResult.totalRows}
                </div>
                {dryRunResult.errors.length > 0 && (
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    {dryRunResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {importSuccess && (
              <div className="rounded-lg p-3 text-xs border bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {importSuccess}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleImportSubmit(true)}
                disabled={bulkImportMutation.isPending || !importRowsText.trim()}
              >
                Dry Run Review
              </Button>
              <Button
                size="sm"
                onClick={() => handleImportSubmit(false)}
                disabled={
                  bulkImportMutation.isPending ||
                  !importRowsText.trim() ||
                  (dryRunResult !== null && !dryRunResult.canProceed)
                }
              >
                {bulkImportMutation.isPending ? "Ingesting..." : "Commit Transaction"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Log Action Dialog */}
      <Dialog
        open={!!actionModalPatient}
        onOpenChange={(open) => !open && setActionModalPatient(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Log Follow-up Action</DialogTitle>
            <DialogDescription className="text-xs">
              Recording clinical follow-up for {actionModalPatient?.name || "Anonymous Patient"}.
              Audit log will capture actor and timestamp without storing freeform clinical text in audit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Action Type</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as any)}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs"
              >
                <option value="phone_call">Phone Call Follow-up</option>
                <option value="review">Clinical Trend Review</option>
                <option value="referral">Specialist / Dietitian Referral</option>
                <option value="message">Secure Message</option>
                <option value="in_person">In-Person Consultation</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Follow-up Priority
              </label>
              <select
                value={actionPriority ?? "routine"}
                onChange={(e) => setActionPriority(e.target.value as any)}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Clinical Follow-up Notes (max 500 chars)
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Discussed 14-day fasting blood glucose trend; scheduled next review."
                className="w-full rounded-md border bg-background p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {recordActionMutation.isError && (
              <p className="text-xs text-destructive">
                Error: {recordActionMutation.error.message}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActionModalPatient(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={recordActionMutation.isPending}
                onClick={() => {
                  if (!actionModalPatient) return
                  recordActionMutation.mutate({
                    patientId: actionModalPatient.id,
                    actionType,
                    status: "completed",
                    notes: actionNotes,
                    updatePriority: actionPriority,
                  })
                }}
              >
                {recordActionMutation.isPending ? "Saving..." : "Save Action"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog
        open={!!historyModalPatient}
        onOpenChange={(open) => !open && setHistoryModalPatient(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              Follow-up Action History
            </DialogTitle>
            <DialogDescription className="text-xs">
              Recent recorded follow-up interventions for {historyModalPatient?.name || "Patient"}.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto space-y-3 pt-2">
            {historyQuery.isLoading ? (
              <p className="text-xs text-muted-foreground animate-pulse">
                Loading history...
              </p>
            ) : historyQuery.isError ? (
              <p className="text-xs text-destructive">
                Failed to load history: {historyQuery.error.message}
              </p>
            ) : (historyQuery.data?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No previous follow-up actions recorded for this patient.
              </p>
            ) : (
              historyQuery.data?.map((act) => (
                <div
                  key={act.id}
                  className="rounded-lg border p-3 text-xs space-y-1 bg-muted/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground uppercase tracking-wider text-[10px]">
                      {act.actionType.replace("_", " ")}
                    </span>
                    <span className="text-muted-foreground text-[10px]">
                      {new Date(act.performedAt).toLocaleString()}
                    </span>
                  </div>
                  {act.notes && (
                    <p className="text-muted-foreground text-xs">{act.notes}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog
        open={!!exportModalPatient}
        onOpenChange={(open) => !open && setExportModalPatient(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Authorized Clinician Export
            </DialogTitle>
            <DialogDescription className="text-xs">
              Generate an audited patient summary. CSV output includes formula-injection protections.
              Never creates public links or unvetted diagnosis scores.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Export Purpose (Mandatory for Disclosure Audit)
              </label>
              <Input
                value={exportPurpose}
                onChange={(e) => setExportPurpose(e.target.value)}
                placeholder="e.g. Endocrinologist consult referral"
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Format</label>
              <div className="flex gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value="csv"
                    checked={exportFormat === "csv"}
                    onChange={() => setExportFormat("csv")}
                  />
                  CSV (Formula Protected)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value="json"
                    checked={exportFormat === "json"}
                    onChange={() => setExportFormat("json")}
                  />
                  JSON (Structured)
                </label>
              </div>
            </div>

            {exportResult && (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  Authorized Summary Generated
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Provenance: Exported by {exportResult.provenance.exportedByUserId.slice(0, 8)}... at{" "}
                  {exportResult.provenance.exportedAt}
                </p>
                <Button
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleDownloadExport}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download {exportFormat.toUpperCase()} File
                </Button>
              </div>
            )}

            {exportMutation.isError && (
              <p className="text-xs text-destructive">
                Error: {exportMutation.error.message}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportModalPatient(null)}
              >
                Close
              </Button>
              {!exportResult && (
                <Button
                  size="sm"
                  disabled={exportMutation.isPending || !exportPurpose.trim()}
                  onClick={() => {
                    if (!exportModalPatient) return
                    exportMutation.mutate({
                      patientId: exportModalPatient.id,
                      purpose: exportPurpose,
                      format: exportFormat,
                    })
                  }}
                >
                  {exportMutation.isPending ? "Generating..." : "Generate Export"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
