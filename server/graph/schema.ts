import "server-only"
import { withNeo4jSession } from "./driver"

export const GRAPH_CONSTRAINTS = [
  {
    name: "user_id_unique",
    cypher:
      "CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
  },
  {
    name: "tenant_id_unique",
    cypher:
      "CREATE CONSTRAINT tenant_id_unique IF NOT EXISTS FOR (t:Tenant) REQUIRE t.id IS UNIQUE",
  },
  {
    name: "patient_id_unique",
    cypher:
      "CREATE CONSTRAINT patient_id_unique IF NOT EXISTS FOR (p:Patient) REQUIRE p.id IS UNIQUE",
  },
  {
    name: "consent_id_unique",
    cypher:
      "CREATE CONSTRAINT consent_id_unique IF NOT EXISTS FOR (c:Consent) REQUIRE c.id IS UNIQUE",
  },
  {
    name: "device_id_unique",
    cypher:
      "CREATE CONSTRAINT device_id_unique IF NOT EXISTS FOR (d:Device) REQUIRE d.id IS UNIQUE",
  },
  {
    name: "care_plan_id_unique",
    cypher:
      "CREATE CONSTRAINT care_plan_id_unique IF NOT EXISTS FOR (cp:CarePlan) REQUIRE cp.id IS UNIQUE",
  },
  {
    name: "obs_summary_id_unique",
    cypher:
      "CREATE CONSTRAINT obs_summary_id_unique IF NOT EXISTS FOR (o:ObservationSummary) REQUIRE o.id IS UNIQUE",
  },
  {
    name: "receipt_key_unique",
    cypher:
      "CREATE CONSTRAINT receipt_key_unique IF NOT EXISTS FOR (pr:ProjectionReceipt) REQUIRE pr.receiptKey IS UNIQUE",
  },
] as const

export async function initializeGraphSchema(): Promise<void> {
  await withNeo4jSession(async (session) => {
    for (const constraint of GRAPH_CONSTRAINTS) {
      await session.run(constraint.cypher)
    }
  })
}
