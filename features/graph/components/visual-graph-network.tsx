"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import {
  Users,
  ShieldCheck,
  Activity,
  HeartPulse,
  Droplets,
  Utensils,
  Moon,
  Pill,
  ArrowRight,
  Database,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { CareGraphInsightDTO } from "@/server/graph/retrieval"

interface VisualGraphNetworkProps {
  insights: CareGraphInsightDTO
}

interface GraphNode {
  id: string
  label: string
  category: "patient" | "user" | "consent" | "observation"
  cypherLabel: string
  x: number
  y: number
  icon: any
  color: string
  borderColor: string
  bgColor: string
  textColor: string
  meta: Record<string, any>
}

interface GraphEdge {
  id: string
  from: string
  to: string
  relationship: string
  color: string
  dash?: boolean
}

export function VisualGraphNetwork({ insights }: VisualGraphNetworkProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>("node-patient")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [zoomLevel, setZoomLevel] = useState<number>(1)

  // Canvas bounds
  const width = 800
  const height = 520
  const centerX = width / 2
  const centerY = height / 2

  // Build nodes and edges dynamically from Neo4j insights
  const { nodes, edges } = useMemo(() => {
    const nodeList: GraphNode[] = []
    const edgeList: GraphEdge[] = []

    // 1. Central Patient Node
    nodeList.push({
      id: "node-patient",
      label: "Patient (You)",
      category: "patient",
      cypherLabel: ":Patient",
      x: centerX,
      y: centerY,
      icon: HeartPulse,
      color: "#10b981", // Emerald
      borderColor: "#059669",
      bgColor: "rgba(16, 185, 129, 0.15)",
      textColor: "text-emerald-700 dark:text-emerald-300",
      meta: {
        "Node Type": "Central Medical Entity (:Patient)",
        "Patient ID": insights.patientId,
        "Year of Birth": insights.yearOfBirth ?? "Not recorded",
        Gender: insights.gender ?? "Not recorded",
      },
    })

    // 2. Owner User Node (Top Left)
    nodeList.push({
      id: "node-owner",
      label: "Account Owner",
      category: "user",
      cypherLabel: ":User",
      x: centerX - 240,
      y: centerY - 140,
      icon: Users,
      color: "#3b82f6", // Blue
      borderColor: "#2563eb",
      bgColor: "rgba(59, 130, 246, 0.15)",
      textColor: "text-blue-700 dark:text-blue-300",
      meta: {
        "Node Type": "Authenticated Identity (:User)",
        "User ID": insights.ownerUserId,
        Role: "Primary Account Holder",
      },
    })

    edgeList.push({
      id: "edge-owns",
      from: "node-owner",
      to: "node-patient",
      relationship: "[:OWNS]",
      color: "#3b82f6",
    })

    // 3. Active Consents & Caregivers (Right side)
    if (insights.activeConsents.length > 0) {
      insights.activeConsents.forEach((c, idx) => {
        const consentY = centerY - 120 + idx * 110
        const consentId = `node-consent-${c.consentId}`
        const caregiverId = `node-caregiver-${c.consentId}`

        // Consent node
        nodeList.push({
          id: consentId,
          label: c.purpose || "Consent Scope",
          category: "consent",
          cypherLabel: ":Consent",
          x: centerX + 180,
          y: consentY,
          icon: ShieldCheck,
          color: "#8b5cf6", // Purple
          borderColor: "#7c3aed",
          bgColor: "rgba(139, 92, 246, 0.15)",
          textColor: "text-purple-700 dark:text-purple-300",
          meta: {
            "Consent ID": c.consentId,
            Purpose: c.purpose,
            Scopes: c.scopes.join(", "),
            Status: "Active",
          },
        })

        edgeList.push({
          id: `edge-has-consent-${c.consentId}`,
          from: "node-patient",
          to: consentId,
          relationship: "[:HAS_CONSENT]",
          color: "#8b5cf6",
        })

        // Caregiver node
        nodeList.push({
          id: caregiverId,
          label: `Caregiver (${c.granteeId.slice(0, 8)}…)`,
          category: "user",
          cypherLabel: ":User",
          x: centerX + 320,
          y: consentY,
          icon: Users,
          color: "#6366f1",
          borderColor: "#4f46e5",
          bgColor: "rgba(99, 102, 241, 0.15)",
          textColor: "text-indigo-700 dark:text-indigo-300",
          meta: {
            "Grantee ID": c.granteeId,
            Access: "Delegated Care Circle Member",
          },
        })

        edgeList.push({
          id: `edge-grants-to-${c.consentId}`,
          from: consentId,
          to: caregiverId,
          relationship: "[:GRANTS_TO]",
          color: "#6366f1",
        })
      })
    } else {
      // Default empty placeholder consent node
      nodeList.push({
        id: "node-consent-demo",
        label: "Care Circle (Empty)",
        category: "consent",
        cypherLabel: ":Consent",
        x: centerX + 240,
        y: centerY - 90,
        icon: ShieldCheck,
        color: "#94a3b8",
        borderColor: "#64748b",
        bgColor: "rgba(148, 163, 184, 0.15)",
        textColor: "text-muted-foreground",
        meta: {
          Status: "No active care circle grants",
          Notice: "Invite a family member or clinician from Care Circle tab",
        },
      })

      edgeList.push({
        id: "edge-consent-demo",
        from: "node-patient",
        to: "node-consent-demo",
        relationship: "[:HAS_CONSENT]",
        color: "#94a3b8",
        dash: true,
      })
    }

    // 4. Observation Summary Nodes (Bottom & Left)
    const summaryPositions = [
      { x: centerX - 240, y: centerY + 130 },
      { x: centerX - 90, y: centerY + 190 },
      { x: centerX + 90, y: centerY + 190 },
      { x: centerX + 240, y: centerY + 130 },
    ]

    const summaries =
      insights.observationSummaries.length > 0
        ? insights.observationSummaries
        : [
            { type: "glucose", unit: "mg/dL", count: 0, latestObservedAt: "" },
            { type: "meal", unit: "servings", count: 0, latestObservedAt: "" },
            { type: "activity", unit: "minutes", count: 0, latestObservedAt: "" },
          ]

    summaries.slice(0, 4).forEach((obs, idx) => {
      const pos = summaryPositions[idx] || { x: centerX, y: centerY + 180 }
      const obsId = `node-obs-${obs.type}`

      let icon = Activity
      let color = "#f59e0b" // Amber
      if (obs.type === "glucose") {
        icon = Activity
        color = "#ef4444" // Rose
      } else if (obs.type === "meal") {
        icon = Utensils
        color = "#f97316" // Orange
      } else if (obs.type === "activity") {
        icon = HeartPulse
        color = "#10b981" // Emerald
      }

      nodeList.push({
        id: obsId,
        label: `${obs.type.replace(/_/g, " ")} (${obs.count})`,
        category: "observation",
        cypherLabel: ":ObservationSummary",
        x: pos.x,
        y: pos.y,
        icon,
        color,
        borderColor: color,
        bgColor: `${color}20`,
        textColor: "text-foreground",
        meta: {
          "Observation Type": obs.type,
          "Total Observations": obs.count,
          Unit: obs.unit,
          "Latest Recorded": obs.latestObservedAt
            ? new Date(obs.latestObservedAt).toLocaleDateString()
            : "No records yet",
        },
      })

      edgeList.push({
        id: `edge-summary-${obs.type}`,
        from: "node-patient",
        to: obsId,
        relationship: "[:HAS_SUMMARY]",
        color,
        dash: obs.count === 0,
      })
    })

    return { nodes: nodeList, edges: edgeList }
  }, [insights, centerX, centerY])

  // Filter nodes based on user selection
  const filteredNodes = useMemo(() => {
    if (filterCategory === "all") return nodes
    if (filterCategory === "care-circle") {
      return nodes.filter(
        (n) => n.category === "patient" || n.category === "consent" || n.category === "user"
      )
    }
    if (filterCategory === "summaries") {
      return nodes.filter(
        (n) => n.category === "patient" || n.category === "observation"
      )
    }
    return nodes
  }, [nodes, filterCategory])

  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes]
  )

  const filteredEdges = useMemo(
    () =>
      edges.filter(
        (e) => filteredNodeIds.has(e.from) && filteredNodeIds.has(e.to)
      ),
    [edges, filteredNodeIds]
  )

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || nodes[0],
    [nodes, selectedNodeId]
  )

  return (
    <Card className="overflow-hidden border-primary/20 shadow-lg">
      {/* Top Header & Interactive Controls */}
      <div className="flex flex-col gap-4 border-b border-border/60 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Database className="size-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
              Neo4j Live Graph Topology
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
                Connected
              </Badge>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Direct projection of entities, ownership, and consent relationships in Neo4j
            </p>
          </div>
        </div>

        {/* Filters & Zoom Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterCategory("all")}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${
                filterCategory === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Nodes
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory("care-circle")}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${
                filterCategory === "care-circle"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Care Circle
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory("summaries")}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${
                filterCategory === "summaries"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Health Summaries
            </button>
          </div>

          <div className="flex items-center gap-1 border-l border-border pl-2">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setZoomLevel((z) => Math.min(z + 0.15, 1.4))}
              title="Zoom In"
            >
              <ZoomIn className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setZoomLevel((z) => Math.max(z - 0.15, 0.7))}
              title="Zoom Out"
            >
              <ZoomOut className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setZoomLevel(1)}
              title="Reset Zoom"
            >
              <Maximize2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div className="relative h-[520px] w-full overflow-hidden bg-gradient-to-br from-background via-muted/20 to-background select-none">
        {/* Background Dot Grid */}
        <svg className="absolute inset-0 h-full w-full opacity-20 pointer-events-none">
          <defs>
            <pattern
              id="graph-grid-dots"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1.5" className="fill-foreground" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#graph-grid-dots)" />
        </svg>

        {/* SVG Network Graph */}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full transition-transform duration-300"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
        >
          <defs>
            {/* Arrow Marker Definitions */}
            <marker
              id="arrow-blue"
              viewBox="0 0 10 10"
              refX="28"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
            </marker>
            <marker
              id="arrow-purple"
              viewBox="0 0 10 10"
              refX="28"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#8b5cf6" />
            </marker>
            <marker
              id="arrow-indigo"
              viewBox="0 0 10 10"
              refX="28"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" />
            </marker>
            <marker
              id="arrow-orange"
              viewBox="0 0 10 10"
              refX="28"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>
          </defs>

          {/* 1. Draw Edges / Relationships */}
          {filteredEdges.map((edge) => {
            const fromNode = filteredNodes.find((n) => n.id === edge.from)
            const toNode = filteredNodes.find((n) => n.id === edge.to)
            if (!fromNode || !toNode) return null

            const isHighlighted =
              selectedNodeId === edge.from || selectedNodeId === edge.to

            // Edge center for relationship label
            const midX = (fromNode.x + toNode.x) / 2
            const midY = (fromNode.y + toNode.y) / 2

            let markerId = "arrow-blue"
            if (edge.relationship.includes("CONSENT")) markerId = "arrow-purple"
            else if (edge.relationship.includes("GRANTS")) markerId = "arrow-indigo"
            else if (edge.relationship.includes("SUMMARY")) markerId = "arrow-orange"

            return (
              <g key={edge.id} className="transition-all duration-300">
                {/* Connecting Line */}
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={edge.color}
                  strokeWidth={isHighlighted ? 3 : 1.75}
                  strokeOpacity={isHighlighted ? 0.9 : 0.45}
                  strokeDasharray={edge.dash ? "4,4" : undefined}
                  markerEnd={`url(#${markerId})`}
                />

                {/* Relationship Pill Label */}
                <g transform={`translate(${midX}, ${midY})`}>
                  <rect
                    x="-42"
                    y="-9"
                    width="84"
                    height="18"
                    rx="9"
                    className="fill-background/95 stroke-border"
                    strokeWidth="1"
                  />
                  <text
                    textAnchor="middle"
                    y="3"
                    className="fill-foreground font-mono text-[9px] font-semibold"
                  >
                    {edge.relationship}
                  </text>
                </g>
              </g>
            )
          })}

          {/* 2. Draw Nodes */}
          {filteredNodes.map((node) => {
            const isSelected = selectedNodeId === node.id
            const isPatient = node.category === "patient"
            const radius = isPatient ? 34 : 26

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedNodeId(node.id)}
                className="cursor-pointer transition-transform duration-300 group"
              >
                {/* Pulsing ring for central patient node */}
                {isPatient && (
                  <circle
                    r="44"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    className="animate-ping opacity-25"
                  />
                )}

                {/* Selection Highlight Ring */}
                {isSelected && (
                  <circle
                    r={radius + 8}
                    fill="none"
                    stroke={node.color}
                    strokeWidth="2.5"
                    strokeDasharray="3,3"
                    className="animate-spin"
                    style={{ animationDuration: "8s" }}
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  r={radius}
                  fill={node.color}
                  fillOpacity="0.18"
                  stroke={node.color}
                  strokeWidth={isSelected ? 3 : 2}
                  className="transition-all duration-200 group-hover:scale-110"
                />

                {/* Node Center Badge/Dot */}
                <circle
                  r={radius - 8}
                  className="fill-background shadow-md"
                  stroke={node.color}
                  strokeWidth="1"
                />

                {/* Cypher Label Inside */}
                <text
                  textAnchor="middle"
                  y="4"
                  className="fill-foreground font-mono text-[10px] font-bold"
                >
                  {node.cypherLabel}
                </text>

                {/* Human-Readable Name Below Node */}
                <g transform={`translate(0, ${radius + 16})`}>
                  <rect
                    x="-60"
                    y="-8"
                    width="120"
                    height="16"
                    rx="8"
                    className="fill-background/90 stroke-border/70"
                    strokeWidth="0.8"
                  />
                  <text
                    textAnchor="middle"
                    y="3"
                    className="fill-foreground text-[10px] font-medium"
                  >
                    {node.label}
                  </text>
                </g>
              </g>
            )
          })}
        </svg>

        {/* Selected Node Details Floating Overlay */}
        <div className="absolute bottom-4 left-4 z-20 max-w-sm rounded-2xl border border-border/80 bg-background/95 p-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <div className="flex items-center gap-2">
              <span
                className="flex size-7 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: selectedNode.color }}
              >
                <Database className="size-3.5" />
              </span>
              <div>
                <h4 className="text-xs font-semibold text-foreground">
                  {selectedNode.label}
                </h4>
                <span className="font-mono text-[10px] text-muted-foreground">
                  Label: {selectedNode.cypherLabel}
                </span>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] capitalize">
              {selectedNode.category}
            </Badge>
          </div>

          <div className="mt-3 space-y-1.5 text-[11px]">
            {Object.entries(selectedNode.meta).map(([key, val]) => (
              <div key={key} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{key}:</span>
                <span className="font-medium text-foreground truncate max-w-[190px]">
                  {String(val)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-1.5 border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
            <Info className="size-3 text-primary shrink-0" />
            <span>Click any node in the graph above to inspect its properties.</span>
          </div>
        </div>

        {/* Graph Legend (Bottom Right) */}
        <div className="absolute bottom-4 right-4 z-20 hidden rounded-xl border border-border/60 bg-background/90 p-3 shadow-md backdrop-blur-sm sm:block text-[10px] text-muted-foreground space-y-1.5">
          <span className="font-semibold text-foreground block uppercase tracking-wider text-[9px]">
            Neo4j Relationship Schema
          </span>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-blue-500" />
            <span><code>(User)-[:OWNS]-&gt;(Patient)</code></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-purple-500" />
            <span><code>(Patient)-[:HAS_CONSENT]-&gt;(Consent)</code></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-indigo-500" />
            <span><code>(Consent)-[:GRANTS_TO]-&gt;(User)</code></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber-500" />
            <span><code>(Patient)-[:HAS_SUMMARY]-&gt;(ObsSummary)</code></span>
          </div>
        </div>
      </div>
    </Card>
  )
}
