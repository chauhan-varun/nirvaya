export const dynamic = "force-dynamic"

import { RiskDashboard } from "@/features/risk/components/risk-dashboard"

export const metadata = {
  title: "Metabolic Risk & Factor Analysis – Nirvaya",
  description:
    "Clinically validated screening indicator (MDRF Indian Diabetes Risk Score) with modifiable lifestyle factor explanations.",
}

export default function RiskPage() {
  return <RiskDashboard />
}
