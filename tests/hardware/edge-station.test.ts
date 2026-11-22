import { describe, it, expect, beforeEach } from "vitest"
import { getDb } from "@/server/db"
import { users } from "@/server/db/schema/users"
import { patients } from "@/server/db/schema/patients"
import { tenants } from "@/server/db/schema/tenants"
import { devices, deviceNonces } from "@/server/db/schema/devices"
import { observations } from "@/server/db/schema/observations"
import { auditEvents, outboxEvents } from "@/server/db/schema/events"
import {
  enrollDeviceAtomic,
  revokeDeviceAtomic,
  rotateDeviceSecretAtomic,
} from "@/server/db/repositories/devices"
import { ArduinoStationSimulator } from "@/hardware/simulator"
import { POST as handleDeviceEvents } from "@/app/api/devices/events/route"
import { NextRequest } from "next/server"
import { eq, and } from "drizzle-orm"

const TEST_OWNER_CLERK = "user_clerk_hardware_test_201"
const TEST_OTHER_CLERK = "user_clerk_hardware_test_202"

describe("Arduino Edge Station & Signed HMAC Telemetry", () => {
  let testTenantId: string
  let testPatientId: string
  let testOwnerUserId: string
  let enrolledDeviceId: string
  let enrolledExternalId: string
  let enrolledSecretKey: string

  beforeEach(async () => {
    const db = getDb()

    // Clean up previous test runs
    for (const clerkSub of [TEST_OWNER_CLERK, TEST_OTHER_CLERK]) {
      const uList = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkSubject, clerkSub))

      for (const u of uList) {
        const pList = await db
          .select({ id: patients.id, tenantId: patients.tenantId })
          .from(patients)
          .where(eq(patients.ownerUserId, u.id))

        for (const p of pList) {
          const devList = await db
            .select({ id: devices.id })
            .from(devices)
            .where(eq(devices.patientId, p.id))

          for (const d of devList) {
            await db
              .delete(deviceNonces)
              .where(eq(deviceNonces.deviceId, d.id))
          }

          await db.delete(devices).where(eq(devices.patientId, p.id))
          await db
            .delete(observations)
            .where(eq(observations.patientId, p.id))
          await db
            .delete(outboxEvents)
            .where(eq(outboxEvents.tenantId, p.tenantId))
          await db
            .delete(auditEvents)
            .where(eq(auditEvents.tenantId, p.tenantId))
          await db.delete(patients).where(eq(patients.id, p.id))
          await db.delete(tenants).where(eq(tenants.id, p.tenantId))
        }
        await db.delete(users).where(eq(users.id, u.id))
      }
    }

    // Set up owner, tenant, patient
    const [t] = await db
      .insert(tenants)
      .values({ kind: "personal", name: "Hardware Test Tenant" })
      .returning()
    testTenantId = t.id

    const [u] = await db
      .insert(users)
      .values({ clerkSubject: TEST_OWNER_CLERK })
      .returning()
    testOwnerUserId = u.id

    const [p] = await db
      .insert(patients)
      .values({
        tenantId: testTenantId,
        ownerUserId: testOwnerUserId,
        name: "Hardware Patient",
        yearOfBirth: 1984,
      })
      .returning()
    testPatientId = p.id

    // Enroll a test station
    const enrolled = await enrollDeviceAtomic({
      tenantId: testTenantId,
      patientId: testPatientId,
      ownerUserId: testOwnerUserId,
      model: "arduino_uno_q_station",
      requestId: "req_test_enroll",
    })

    enrolledDeviceId = enrolled.device.id
    enrolledExternalId = enrolled.device.externalId
    enrolledSecretKey = enrolled.secretKey
  })

  function createNextRequest(prep: {
    url: string
    method: "POST"
    headers: Record<string, string>
    body: string
  }): NextRequest {
    return new NextRequest(`http://localhost:3000${prep.url}`, {
      method: prep.method,
      headers: new Headers(prep.headers),
      body: prep.body,
    })
  }

  // ─── 1. Happy Path & Ingestion ───────────────────────────────────────────

  it("accepts a signed valid Modulino Thermo ambient temperature event", async () => {
    const simulator = new ArduinoStationSimulator({
      deviceExternalId: enrolledExternalId,
      secretKey: enrolledSecretKey,
    })

    const prep = simulator.prepareSignedRequest({
      readings: [simulator.generateAmbientTemperatureReading(23.5)],
    })

    const req = createNextRequest(prep)
    const res = await handleDeviceEvents(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.accepted).toBe(true)
    expect(json.eventCount).toBe(1)

    // Verify observation committed to PostgreSQL
    const db = getDb()
    const [obs] = await db
      .select()
      .from(observations)
      .where(
        and(
          eq(observations.patientId, testPatientId),
          eq(observations.source, "device")
        )
      )

    expect(obs).toBeDefined()
    expect(obs.type).toBe("ambient_temperature")
    expect(Number(obs.numericValue)).toBe(23.5)
    expect(obs.unit).toBe("celsius")
    expect(obs.deviceId).toBe(enrolledDeviceId)

    // Verify device lastSeenAt updated
    const [dev] = await db
      .select()
      .from(devices)
      .where(eq(devices.id, enrolledDeviceId))

    expect(dev.lastSeenAt).not.toBeNull()
  })

  it("accepts a signed valid environmental presence detection event", async () => {
    const simulator = new ArduinoStationSimulator({
      deviceExternalId: enrolledExternalId,
      secretKey: enrolledSecretKey,
    })

    const prep = simulator.prepareSignedRequest({
      readings: [simulator.generatePresenceReading(true)],
    })

    const req = createNextRequest(prep)
    const res = await handleDeviceEvents(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.accepted).toBe(true)

    // Verify presence observation
    const db = getDb()
    const [obs] = await db
      .select()
      .from(observations)
      .where(
        and(
          eq(observations.patientId, testPatientId),
          eq(observations.type, "presence")
        )
      )

    expect(obs.unit).toBe("presence_binary")
    expect(Number(obs.numericValue)).toBe(1)
  })

  // ─── 2. Security: Signature & Credentials ────────────────────────────────

  it("rejects an invalid HMAC signature with 401 Unauthorized", async () => {
    const simulator = new ArduinoStationSimulator({
      deviceExternalId: enrolledExternalId,
      secretKey: "wrong_secret_key_0000000000000000000000000000000000000000000000000000000000000000",
    })

    const prep = simulator.prepareSignedRequest({
      readings: [simulator.generateAmbientTemperatureReading(21.0)],
    })

    const req = createNextRequest(prep)
    const res = await handleDeviceEvents(req)
    expect(res.status).toBe(401)

    const json = await res.json()
    expect(json.error).toMatch(/Invalid HMAC signature/)
  })

  it("rejects telemetry from a revoked device with 403 Forbidden", async () => {
    // Revoke device
    await revokeDeviceAtomic({
      deviceId: enrolledDeviceId,
      tenantId: testTenantId,
      patientId: testPatientId,
      ownerUserId: testOwnerUserId,
      requestId: "req_test_revoke",
    })

    const simulator = new ArduinoStationSimulator({
      deviceExternalId: enrolledExternalId,
      secretKey: enrolledSecretKey,
    })

    const prep = simulator.prepareSignedRequest({
      readings: [simulator.generateAmbientTemperatureReading(22.0)],
    })

    const req = createNextRequest(prep)
    const res = await handleDeviceEvents(req)
    expect(res.status).toBe(403)
  })

  // ─── 3. Replay Protection & Timestamp Skew ───────────────────────────────

  it("rejects replayed requests with 409 Conflict", async () => {
    const simulator = new ArduinoStationSimulator({
      deviceExternalId: enrolledExternalId,
      secretKey: enrolledSecretKey,
    })

    const prep = simulator.prepareSignedRequest({
      readings: [simulator.generateAmbientTemperatureReading(22.0)],
    })

    // First delivery accepted
    const req1 = createNextRequest(prep)
    const res1 = await handleDeviceEvents(req1)
    expect(res1.status).toBe(200)

    // Replay with exact same nonce and signature
    const req2 = createNextRequest(prep)
    const res2 = await handleDeviceEvents(req2)
    expect(res2.status).toBe(409)

    const json = await res2.json()
    expect(json.error).toMatch(/replay detected/i)
  })

  it("rejects timestamp with excessive clock skew (> 5 min) with 400 Bad Request", async () => {
    const simulator = new ArduinoStationSimulator({
      deviceExternalId: enrolledExternalId,
      secretKey: enrolledSecretKey,
    })

    // Timestamp 1 hour in the past
    const staleTime = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const prep = simulator.prepareSignedRequest({
      readings: [simulator.generateAmbientTemperatureReading(22.0)],
      timestampOverride: staleTime,
    })

    const req = createNextRequest(prep)
    const res = await handleDeviceEvents(req)
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.error).toMatch(/Timestamp skew/)
  })

  // ─── 4. Privacy & Payload Bounds ─────────────────────────────────────────

  it("rejects payloads containing camera or video frames with 400 Bad Request", async () => {
    const simulator = new ArduinoStationSimulator({
      deviceExternalId: enrolledExternalId,
      secretKey: enrolledSecretKey,
    })

    const rawReading = {
      ...simulator.generateAmbientTemperatureReading(22.0),
      rawFrame: "base64_camera_frame_data_that_must_be_blocked",
    }

    const prep = simulator.prepareSignedRequest({
      readings: [rawReading as any],
    })

    const req = createNextRequest(prep)
    const res = await handleDeviceEvents(req)
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.error).toMatch(/Privacy violation: raw media frames are not permitted/)
  })

  it("rejects oversized request bodies (> 64KB) with 413 Payload Too Large", async () => {
    const simulator = new ArduinoStationSimulator({
      deviceExternalId: enrolledExternalId,
      secretKey: enrolledSecretKey,
    })

    // Create a large number of readings exceeding 64KB
    const manyReadings = Array.from({ length: 800 }, () =>
      simulator.generateAmbientTemperatureReading(22.0)
    )

    const prep = simulator.prepareSignedRequest({
      readings: manyReadings,
    })

    const req = createNextRequest(prep)
    const res = await handleDeviceEvents(req)
    expect(res.status).toBe(413)
  })

  // ─── 5. Secret Rotation & Cross-User Isolation ───────────────────────────

  it("handles credential rotation: old key rejected, new key accepted", async () => {
    const rotated = await rotateDeviceSecretAtomic({
      deviceId: enrolledDeviceId,
      tenantId: testTenantId,
      patientId: testPatientId,
      ownerUserId: testOwnerUserId,
      requestId: "req_test_rotate",
    })

    expect(rotated.newKeyVersion).toBe(2)

    // Old key (version 1) is rejected
    const oldSim = new ArduinoStationSimulator({
      deviceExternalId: enrolledExternalId,
      secretKey: enrolledSecretKey,
      keyVersion: 1,
    })
    const oldReq = createNextRequest(
      oldSim.prepareSignedRequest({
        readings: [oldSim.generateAmbientTemperatureReading(22.0)],
      })
    )
    const oldRes = await handleDeviceEvents(oldReq)
    expect(oldRes.status).toBe(401)

    // New key (version 2) is accepted
    const newSim = new ArduinoStationSimulator({
      deviceExternalId: enrolledExternalId,
      secretKey: rotated.newSecretKey,
      keyVersion: 2,
    })
    const newReq = createNextRequest(
      newSim.prepareSignedRequest({
        readings: [newSim.generateAmbientTemperatureReading(22.0)],
      })
    )
    const newRes = await handleDeviceEvents(newReq)
    expect(newRes.status).toBe(200)
  })

  it("rejects cross-user device enrollment", async () => {
    const db = getDb()
    const [u2] = await db
      .insert(users)
      .values({ clerkSubject: TEST_OTHER_CLERK })
      .returning()

    // Other user attempts to enroll a device on owner's patient profile
    await expect(
      enrollDeviceAtomic({
        tenantId: testTenantId,
        patientId: testPatientId,
        ownerUserId: u2.id,
        requestId: "req_cross_enroll",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})
