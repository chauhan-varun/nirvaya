"use client"

import * as React from "react"
import { useRef, useEffect, useState, Suspense } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { useGLTF, useAnimations, Float, Center } from "@react-three/drei"
import * as THREE from "three"
import { MetabolicAnatomyFallback } from "@/components/landing/anatomy-fallback"

const MODEL_PATH = "/models/human_organs.glb"

/**
 * Robust WebGL feature and context availability detector
 */
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

/**
 * Graceful error boundary to catch any Three.js WebGL context initialization crashes
 */
class WebGLErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn("WebGL initialization failed, displaying anatomical fallback:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

interface ModelProps {
  mousePos: React.MutableRefObject<{ x: number; y: number }>
  scrollProgress: React.MutableRefObject<number>
  dragRotation: React.MutableRefObject<{ x: number; y: number }>
}

function BodyModelMesh({ mousePos, scrollProgress, dragRotation }: ModelProps) {
  const group = useRef<THREE.Group>(null!)
  const idleAngle = useRef(0)
  const { scene, animations } = useGLTF(MODEL_PATH)
  const { actions } = useAnimations(animations, group)

  // Play embedded GLB animations if available
  useEffect(() => {
    if (actions && Object.keys(actions).length > 0) {
      const firstActionKey = Object.keys(actions)[0]
      if (actions[firstActionKey]) {
        actions[firstActionKey]?.play()
      }
    }
  }, [actions])

  // Optimize materials & mesh visibility
  useEffect(() => {
    if (!scene) return
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.visible = true
        mesh.castShadow = true
        mesh.receiveShadow = true
        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial
          mat.transparent = false
          mat.opacity = 1.0
          mat.roughness = 0.35
          mat.metalness = 0.45
          mat.needsUpdate = true
        }
      }
    })
  }, [scene])

  useFrame((_, delta) => {
    if (!group.current) return

    // Oscillate Y rotation back and forth across a 180 deg arc
    idleAngle.current += delta * 0.45
    const oscRotationY = Math.sin(idleAngle.current) * (Math.PI / 2.2)

    const s = scrollProgress.current

    // Interaction targets (oscillation + drag + mouse parallax)
    const targetRotY =
      oscRotationY +
      dragRotation.current.y +
      mousePos.current.x * 0.25 +
      s * 0.35
    const targetRotX = dragRotation.current.x + mousePos.current.y * 0.15
    const targetRotZ = -mousePos.current.x * 0.08

    const clampedRotY = THREE.MathUtils.clamp(
      targetRotY,
      -Math.PI / 1.7,
      Math.PI / 1.7
    )

    // Position targets
    const initialY = -0.2
    const targetPosY = initialY - s * 0.1
    const targetPosZ = -(s * 0.25)
    const targetPosX = +(s * 0.5)

    // Scale target
    const initialScale = 2.3
    const targetScale = Math.max(initialScale * (1 - s * 0.1), 1.7)

    // Damped lerp transition
    const lerpFactor = 0.07
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      clampedRotY,
      lerpFactor
    )
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      targetRotX,
      lerpFactor
    )
    group.current.rotation.z = THREE.MathUtils.lerp(
      group.current.rotation.z,
      targetRotZ,
      lerpFactor
    )

    group.current.position.y = THREE.MathUtils.lerp(
      group.current.position.y,
      targetPosY,
      lerpFactor
    )
    group.current.position.z = THREE.MathUtils.lerp(
      group.current.position.z,
      targetPosZ,
      lerpFactor
    )
    group.current.position.x = THREE.MathUtils.lerp(
      group.current.position.x,
      targetPosX,
      lerpFactor
    )

    const currentScale = group.current.scale.x
    const newScale = THREE.MathUtils.lerp(currentScale, targetScale, lerpFactor)
    group.current.scale.set(newScale, newScale, newScale)
  })

  return (
    <group ref={group}>
      <Center top={false}>
        <primitive object={scene} />
      </Center>
    </group>
  )
}

export function HumanBodyModel() {
  const [hasWebGL, setHasWebGL] = useState<boolean | null>(null)
  const mousePos = useRef({ x: 0, y: 0 })
  const scrollProgress = useRef(0)
  const dragRotation = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const previousPointer = useRef({ x: 0, y: 0 })
  const [cursorStyle, setCursorStyle] = useState<"grab" | "grabbing">("grab")

  // Check WebGL context support on client mount
  useEffect(() => {
    setHasWebGL(isWebGLAvailable())
  }, [])
  useEffect(() => {
    const handleScroll = () => {
      const heroHeight = window.innerHeight || 800
      const ratio = Math.min(Math.max(window.scrollY / heroHeight, 0), 2.0)
      scrollProgress.current = ratio
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Pointer drag event handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true
    previousPointer.current = { x: e.clientX, y: e.clientY }
    setCursorStyle("grabbing")
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const { innerWidth, innerHeight } = window
    mousePos.current = {
      x: (e.clientX / innerWidth) * 2 - 1,
      y: -(e.clientY / innerHeight) * 2 + 1,
    }

    if (isDragging.current) {
      const deltaX = e.clientX - previousPointer.current.x
      const deltaY = e.clientY - previousPointer.current.y

      dragRotation.current.y += deltaX * 0.008
      dragRotation.current.x += deltaY * 0.005

      dragRotation.current.x = THREE.MathUtils.clamp(
        dragRotation.current.x,
        -Math.PI / 3,
        Math.PI / 3
      )

      previousPointer.current = { x: e.clientX, y: e.clientY }
    }
  }

  const handlePointerUp = () => {
    isDragging.current = false
    setCursorStyle("grab")
  }

  // If WebGL is still checking, return null
  if (hasWebGL === null) {
    return null
  }

  return (
    <WebGLErrorBoundary fallback={<MetabolicAnatomyFallback />}>
      <div
        className="relative h-full w-full overflow-visible touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: cursorStyle }}
      >
        <Canvas
          camera={{ position: [0, 0, 4.8], fov: 44 }}
          gl={{
            antialias: false,
            alpha: true,
            powerPreference: "default",
            failIfMajorPerformanceCaveat: false,
          }}
          style={{ overflow: "visible" }}
        >
          {/* Cinematic Multi-Light Lighting */}
          <ambientLight intensity={1.3} />
          <directionalLight position={[5, 8, 5]} intensity={3.2} color="#ffffff" />
          <directionalLight position={[-5, 2, 3]} intensity={2.2} color="#86efac" />
          <pointLight position={[0, 5, -5]} intensity={3.5} color="#22c55e" />
          <pointLight position={[0, 0, 4.5]} intensity={2.0} color="#ffffff" />
          <pointLight position={[0, -4, 3]} intensity={1.5} color="#4ade80" />

          <Suspense fallback={null}>
            <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.35}>
              <BodyModelMesh
                mousePos={mousePos}
                scrollProgress={scrollProgress}
                dragRotation={dragRotation}
              />
            </Float>
          </Suspense>
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  )
}

try {
  useGLTF.preload(MODEL_PATH)
} catch {
  // Graceful preload catch
}
