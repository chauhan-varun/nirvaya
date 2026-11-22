import Link from "next/link"
import { HeartPulse } from "lucide-react"

export function Brand() {
  return (
    <Link
      href="/"
      aria-label="Nirvaya home"
      className="inline-flex items-center gap-2.5"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <HeartPulse className="size-6" aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className="block text-lg font-bold tracking-tight">
          Nirvaya<span className="text-primary">.</span>
        </span>
        <span className="block text-[10px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
          CareBridge
        </span>
      </span>
    </Link>
  )
}
