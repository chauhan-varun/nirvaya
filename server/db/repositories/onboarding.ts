import "server-only"
import { getDb } from "../index"
import { tenants, memberships } from "../schema/tenants"
import { patients, type Patient } from "../schema/patients"
import { consentGrants, type ConsentGrant } from "../schema/consent"
import { auditEvents, outboxEvents } from "../schema/events"
import { eq } from "drizzle-orm"

export interface CompleteOnboardingParams {
  userId: string
  preferredName: string
  yearOfBirth: number
  gender?: string
  preferredLocale: string
  requestId: string
}

export interface OnboardingResult {
  patient: Patient
  consentGrant: ConsentGrant
  tenantId: string
}

export async function completeOnboardingAtomic(
  params: CompleteOnboardingParams
): Promise<OnboardingResult> {
  const db = getDb()

  return await db.transaction(async (tx) => {
    // 1. Check if user already has an active personal tenant membership
    const existingMembership = await tx
      .select({
        tenantId: memberships.tenantId,
        role: memberships.role,
      })
      .from(memberships)
      .where(eq(memberships.userId, params.userId))
      .limit(1)

    let tenantId: string

    if (existingMembership[0]) {
      tenantId = existingMembership[0].tenantId
    } else {
      // Create personal tenant
      const [newTenant] = await tx
        .insert(tenants)
        .values({
          name: `${params.preferredName}'s Care Space`,
          kind: "personal",
          status: "active",
        })
        .returning()

      tenantId = newTenant.id

      // Create owner membership
      await tx.insert(memberships).values({
        tenantId,
        userId: params.userId,
        role: "owner",
        status: "active",
      })
    }

    // 2. Check if a patient record already exists for this owner
    const existingPatient = await tx
      .select()
      .from(patients)
      .where(eq(patients.ownerUserId, params.userId))
      .limit(1)

    let patient: Patient

    if (existingPatient[0]) {
      // Update demographic info
      const [updated] = await tx
        .update(patients)
        .set({
          name: params.preferredName,
          yearOfBirth: params.yearOfBirth,
          gender: params.gender ?? null,
          updatedAt: new Date(),
        })
        .where(eq(patients.id, existingPatient[0].id))
        .returning()
      patient = updated
    } else {
      // Create new patient record
      const [newPatient] = await tx
        .insert(patients)
        .values({
          tenantId,
          ownerUserId: params.userId,
          name: params.preferredName,
          yearOfBirth: params.yearOfBirth,
          gender: params.gender ?? null,
        })
        .returning()
      patient = newPatient
    }

    // 3. Create canonical health-data processing consent grant (valid for 1 year)
    const grantedAt = new Date()
    const expiresAt = new Date(grantedAt)
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)

    const [consent] = await tx
      .insert(consentGrants)
      .values({
        tenantId,
        patientId: patient.id,
        grantorUserId: params.userId,
        granteeUserId: params.userId, // Self-management scope
        scopes: ["profile:manage", "health:record", "observations:read"],
        purpose: "metabolic_health_support",
        policyVersion: "1.0",
        grantedAt,
        expiresAt,
      })
      .returning()

    // 4. Record audit event
    await tx.insert(auditEvents).values({
      tenantId,
      actorType: "user",
      actorId: params.userId,
      action: "onboarding.complete",
      resourceType: "patient",
      resourceId: patient.id,
      purpose: "metabolic_health_support",
      decision: "allow",
      requestId: params.requestId,
    })

    // 5. Insert outbox events for patient and consent projection
    await tx.insert(outboxEvents).values([
      {
        tenantId,
        aggregateType: "patient",
        aggregateId: patient.id,
        aggregateVersion: 1,
        eventType: "patient.created",
        schemaVersion: 1,
        payload: {
          patientId: patient.id,
          ownerUserId: params.userId,
          preferredName: params.preferredName,
          yearOfBirth: params.yearOfBirth,
          gender: params.gender ?? null,
        },
      },
      {
        tenantId,
        aggregateType: "consent",
        aggregateId: consent.id,
        aggregateVersion: 1,
        eventType: "consent.granted",
        schemaVersion: 1,
        payload: {
          consentId: consent.id,
          tenantId,
          patientId: patient.id,
          grantorUserId: params.userId,
          granteeUserId: params.userId,
          scopes: consent.scopes,
          purpose: consent.purpose,
          policyVersion: consent.policyVersion,
          expiresAt: consent.expiresAt.toISOString(),
        },
      },
    ])

    return {
      patient,
      consentGrant: consent,
      tenantId,
    }
  })
}
