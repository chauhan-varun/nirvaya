import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SectionContent } from "@/components/preview/section-content"
import { PreviewShell } from "@/components/shell/preview-shell"
import { previewSections } from "@/lib/demo/preview"

export const dynamicParams = false
export function generateStaticParams() {
  return previewSections.map(({ slug }) => ({ section: slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>
}): Promise<Metadata> {
  const { section } = await params
  const item = previewSections.find(({ slug }) => slug === section)
  return {
    title: `${item?.english ?? "Not found"} · Preview`,
    robots: { index: false, follow: false },
  }
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  const item = previewSections.find(({ slug }) => slug === section)
  if (!item) notFound()
  return (
    <PreviewShell active={item.slug}>
      <div className="mb-8">
        <p className="eyebrow">{item.english}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          {item.label}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {item.description}
        </p>
      </div>
      <SectionContent section={item.slug} />
    </PreviewShell>
  )
}
