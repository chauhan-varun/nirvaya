"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Sparkles, Move3d, Activity } from "lucide-react"
import { MetabolicAnatomyFallback } from "@/components/landing/anatomy-fallback"

function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false
  try {
    const canvas = document.createElement("canvas")
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")
    return !!(
      gl &&
      (gl instanceof WebGLRenderingContext ||
        (typeof WebGL2RenderingContext !== "undefined" &&
          gl instanceof WebGL2RenderingContext))
    )
  } catch {
    return false
  }
}

const HumanBodyModel = dynamic(
  () =>
    import("@/components/landing/human-body-model").then(
      (mod) => mod.HumanBodyModel
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <div className="relative flex size-12 items-center justify-center">
          <div className="absolute size-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <Sparkles className="size-5 text-primary animate-pulse" />
        </div>
        <span className="text-[11px] font-semibold tracking-widest text-primary uppercase">
          Loading 3D Anatomy Model...
        </span>
      </div>
    ),
  }
)

export function HeroModelContainer() {
  const [webglReady, setWebglReady] = useState<boolean | null>(null)
  const [force3D, setForce3D] = useState(false)

  useEffect(() => {
    setWebglReady(isWebGLAvailable())
  }, [])

  const handleRetry = () => {
    setWebglReady(null)
    setTimeout(() => {
      setWebglReady(isWebGLAvailable())
    }, 150)
  }

  const handleForceLoad = () => {
    setForce3D(true)
    setWebglReady(true)
  }

  const show3D = force3D || webglReady === true

  return (
    <div className="relative flex h-[520px] w-full max-w-xl items-center justify-center overflow-visible sm:h-[580px] lg:h-[640px]">
      {/* Background Ambient Glow Orbs */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-35 dark:opacity-25"
        style={{
          width: "420px",
          height: "420px",
          background:
            "radial-gradient(circle, rgba(34, 197, 94, 0.45) 0%, rgba(16, 185, 129, 0.2) 45%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl opacity-40 dark:opacity-30"
        style={{
          width: "300px",
          height: "300px",
          background:
            "radial-gradient(circle, rgba(74, 222, 128, 0.5) 0%, rgba(34, 197, 94, 0.15) 55%, transparent 75%)",
        }}
      />

      {/* Floating Interaction Badge */}
      <div className="absolute -top-2 right-4 z-20 flex items-center gap-1.5 rounded-full border border-primary/20 bg-background/85 px-3 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-md sm:top-2 sm:right-4">
        {show3D ? (
          <>
            <Move3d className="size-3.5 text-primary" />
            <span>Drag to rotate • 3D Anatomy</span>
          </>
        ) : (
          <>
            <Activity className="size-3.5 text-primary" />
            <span>Metabolic Pathways • Anatomy View</span>
          </>
        )}
      </div>

      {/* 3D Canvas or 2D Fallback */}
      <div className="relative z-10 h-full w-full">
        {!show3D && webglReady === false ? (
          <MetabolicAnatomyFallback
            onRetry={handleRetry}
            onForceLoad={handleForceLoad}
          />
        ) : (
          <HumanBodyModel />
        )}
      </div>
    </div>
  )
}
