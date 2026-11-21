import "server-only"
import { and, eq } from "drizzle-orm"
import { getDb } from "../index"
import { patients, type NewPatient, type Patient } from "../schema/patients"

export async function findPatientById(
  tenantId: string,
  patientId: string
): Promise<Patient | null> {
  const db = getDb()
  const result = await db
    .select()
    .from(patients)
    .where(and(eq(patients.tenantId, tenantId), eq(patients.id, patientId)))
    .limit(1)

  return result[0] ?? null
}

export async function createPatient(data: NewPatient): Promise<Patient> {
  const db = getDb()
  const [created] = await db.insert(patients).values(data).returning()
  return created
}
