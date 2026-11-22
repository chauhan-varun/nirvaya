import "server-only"
import { getDb } from "../index"
import { devices, deviceNonces, type Device } from "../schema/devices"
import { observations } from "../schema/observations"
import { auditEvents, outboxEvents } from "../schema/events"
import { patients } from "../schema/patients"
import { and, desc, eq } from "drizzle-orm"
import crypto from "node:crypto"

export interface EnrollDeviceParams {
  tenantId: string
  patientId: string
  ownerUserId: string
  model?: string
  protocolVersion?: string
  requestId: string
}

export interface EnrollDeviceResult {
  device: Omit<Device, "secretKey">
  /**
   * Cryptographic secret key returned ONCE for hardware provisioning.
   * Never exposed again in UI queries.
   */
  secretKey: string
}

export async function enrollDeviceAtomic(
  params: EnrollDeviceParams
): Promise<EnrollDeviceResult> {
  const db = getDb()

  // 1. Verify caller owns patient record
  const [patient] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.id, params.patientId),
        eq(patients.tenantId, params.tenantId),
        eq(patients.ownerUserId, params.ownerUserId)
      )
    )
    .limit(1)

  if (!patient) {
    throw Object.assign(
      new Error("Unauthorized: you can only enroll devices for your own patient profile"),
      { code: "FORBIDDEN" }
    )
  }

  // 2. Generate random externalId and cryptographic 256-bit symmetric secret key
  const externalId = `station_${crypto.randomBytes(6).toString("hex")}`
  const secretKey = crypto.randomBytes(32).toString("hex")

  let enrolledDevice: Device | undefined

  await db.transaction(async (tx) => {
    const [d] = await tx
      .insert(devices)
      .values({
        tenantId: params.tenantId,
        patientId: params.patientId,
        externalId,
        model: params.model ?? "arduino_uno_q_station",
        protocolVersion: params.protocolVersion ?? "1.0",
        status: "active",
        secretKey,
        keyVersion: 1,
      })
      .returning()

    enrolledDevice = d

    await tx.insert(auditEvents).values({
      tenantId: params.tenantId,
      actorType: "user",
      actorId: params.ownerUserId,
      action: "device.enrolled",
      resourceType: "device",
      resourceId: d.id,
      purpose: "hardware_station_enrollment",
      decision: "allow",
      requestId: params.requestId,
    })
  })

  const { secretKey: _, ...safeDevice } = enrolledDevice!
  return { device: safeDevice, secretKey }
}

export async function revokeDeviceAtomic(params: {
  deviceId: string
  tenantId: string
  patientId: string
  ownerUserId: string
  requestId: string
}): Promise<void> {
  const db = getDb()

  await db.transaction(async (tx) => {
    const [device] = await tx
      .select({ id: devices.id })
      .from(devices)
      .innerJoin(
        patients,
        and(
          eq(patients.id, devices.patientId),
          eq(patients.ownerUserId, params.ownerUserId)
        )
      )
      .where(
        and(
          eq(devices.id, params.deviceId),
          eq(devices.tenantId, params.tenantId),
          eq(devices.patientId, params.patientId)
        )
      )
      .limit(1)

    if (!device) {
      throw Object.assign(
        new Error("Device not found or not owned by you"),
        { code: "NOT_FOUND" }
      )
    }

    await tx
      .update(devices)
      .set({
        status: "revoked",
        updatedAt: new Date(),
      })
      .where(eq(devices.id, params.deviceId))

    await tx.insert(auditEvents).values({
      tenantId: params.tenantId,
      actorType: "user",
      actorId: params.ownerUserId,
      action: "device.revoked",
      resourceType: "device",
      resourceId: params.deviceId,
      purpose: "hardware_station_revocation",
      decision: "allow",
      requestId: params.requestId,
    })
  })
}

export async function rotateDeviceSecretAtomic(params: {
  deviceId: string
  tenantId: string
  patientId: string
  ownerUserId: string
  requestId: string
}): Promise<{ newSecretKey: string; newKeyVersion: number }> {
  const db = getDb()
  const newSecretKey = crypto.randomBytes(32).toString("hex")
  let newKeyVersion = 1

  await db.transaction(async (tx) => {
    const [device] = await tx
      .select({ id: devices.id, keyVersion: devices.keyVersion })
      .from(devices)
      .innerJoin(
        patients,
        and(
          eq(patients.id, devices.patientId),
          eq(patients.ownerUserId, params.ownerUserId)
        )
      )
      .where(
        and(
          eq(devices.id, params.deviceId),
          eq(devices.tenantId, params.tenantId),
          eq(devices.patientId, params.patientId)
        )
      )
      .limit(1)

    if (!device) {
      throw Object.assign(
        new Error("Device not found or not owned by you"),
        { code: "NOT_FOUND" }
      )
    }

    newKeyVersion = device.keyVersion + 1

    await tx
      .update(devices)
      .set({
        secretKey: newSecretKey,
        keyVersion: newKeyVersion,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, params.deviceId))

    await tx.insert(auditEvents).values({
      tenantId: params.tenantId,
      actorType: "user",
      actorId: params.ownerUserId,
      action: "device.secret_rotated",
      resourceType: "device",
      resourceId: params.deviceId,
      purpose: "credential_rotation",
      decision: "allow",
      requestId: params.requestId,
    })
  })

  return { newSecretKey, newKeyVersion }
}

export async function listDevicesForPatient(params: {
  tenantId: string
  patientId: string
}): Promise<Array<Omit<Device, "secretKey">>> {
  const db = getDb()

  const rows = await db
    .select({
      id: devices.id,
      tenantId: devices.tenantId,
      patientId: devices.patientId,
      externalId: devices.externalId,
      model: devices.model,
      protocolVersion: devices.protocolVersion,
      status: devices.status,
      keyVersion: devices.keyVersion,
      lastSeenAt: devices.lastSeenAt,
      createdAt: devices.createdAt,
      updatedAt: devices.updatedAt,
    })
    .from(devices)
    .where(
      and(
        eq(devices.tenantId, params.tenantId),
        eq(devices.patientId, params.patientId)
      )
    )
    .orderBy(desc(devices.createdAt))

  return rows
}
