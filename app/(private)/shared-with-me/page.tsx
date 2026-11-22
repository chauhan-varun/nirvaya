export const dynamic = "force-dynamic"

import { SharedWithMeDashboard } from "@/features/shared-with-me/components/shared-with-me-dashboard"

export const metadata = {
  title: "Shared with me – Nirvaya",
  description: "View health data others have shared with you",
}

export default function SharedWithMePage() {
  return <SharedWithMeDashboard />
}
