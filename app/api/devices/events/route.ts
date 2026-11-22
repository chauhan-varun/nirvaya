import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/server/db"
import { devices, deviceNonces } from "@/server/db/schema/devices"
import { observations } from "@/server/db/schema/observations"
import { auditEvents, outboxEvents } from "@/server/db/schema/events"
import {
  buildCanonicalHmacString,
  computeBodySha256,
  verifyHmacSignature,
  validateTimestampSkew,
} from "@/server/hardware/hmac"
import { eq } from "drizzle-orm"
import crypto from "node:crypto"

export const dynamic = "force-dynamic"

const MAX_PAYLOAD_BYTES = 64 * 1024 // 64 KB

export async function POST(req: NextRequest) {
  // 1. Enforce content-type
  const contentType = req.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    )
  }

  // 2. Read headers
  const deviceId = req.headers.get("x-device-id")
  const keyVersionStr = req.headers.get("x-device-key-version")
  const timestamp = req.headers.get("x-device-timestamp")
  const nonce = req.headers.get("x-device-nonce")
  const signature = req.headers.get("x-device-signature")

  if (!deviceId || !keyVersionStr || !timestamp || !nonce || !signature) {
    return NextResponse.json(
      {
        error:
          "Missing required security headers: x-device-id, x-device-key-version, x-device-timestamp, x-device-nonce, x-device-signature",
      },
      { status: 400 }
    )
  }

  if (nonce.length < 8 || nonce.length > 128) {
    return NextResponse.json({ error: "Invalid nonce length" }, { status: 400 })
  }

  const keyVersion = parseInt(keyVersionStr, 10)
  if (isNaN(keyVersion) || keyVersion < 1) {
    return NextResponse.json(
      { error: "Invalid key version" },
      { status: 400 }
    )
  }

  // 3. Timestamp skew validation (max 5 minutes)
  const skewCheck = validateTimestampSkew(timestamp, 5 * 60 * 1000)
  if (!skewCheck.valid) {
    return NextResponse.json({ error: skewCheck.error }, { status: 400 })
  }

  // 4. Read raw body and bound payload size
  const rawBodyBuffer = await req.arrayBuffer()
  if (rawBodyBuffer.byteLength > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: `Payload exceeds maximum allowable size of ${MAX_PAYLOAD_BYTES} bytes` },
      { status: 413 }
    )
  }

  const rawBody = Buffer.from(rawBodyBuffer)
  const bodySha256 = computeBodySha256(rawBody)

  // 5. Look up registered active device in PostgreSQL
  const db = getDb()
  const [device] = await db
    .select()
    .from(devices)
    .where(eq(devices.externalId, deviceId))
    .limit(1)

  if (!device) {
    return NextResponse.json(
      { error: "Device not registered" },
      { status: 401 }
    )
  }

  if (device.status !== "active") {
    return NextResponse.json(
      { error: `Device credentials are ${device.status}` },
      { status: 403 }
    )
  }

  if (device.keyVersion !== keyVersion) {
    return NextResponse.json(
      { error: "Stale key version. Please rotate device credentials." },
      { status: 401 }
    )
  }

  // 6. Verify HMAC-SHA-256 signature in constant time
  const canonicalString = buildCanonicalHmacString({
    method: "POST",
    path: "/api/devices/events",
    timestamp,
    nonce,
    keyVersion,
    bodySha256,
  })

  const isValidSig = verifyHmacSignature(signature, canonicalString, device.secretKey)
  if (!isValidSig) {
    return NextResponse.json(
      { error: "Invalid HMAC signature" },
      { status: 401 }
    )
  }

  // 7. Parse and validate JSON payload
  let parsedPayload: any
  try {
    parsedPayload = JSON.parse(rawBody.toString("utf8"))
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON payload" },
      { status: 400 }
    )
  }

  const events: any[] = Array.isArray(parsedPayload)
    ? parsedPayload
    : [parsedPayload]

  if (events.length === 0) {
    return NextResponse.json(
      { error: "Empty events array" },
      { status: 400 }
    )
  }

  // Validate each event
  for (const evt of events) {
    if (!evt.eventId || !evt.deviceId || !evt.observedAt || !evt.kind || evt.value === undefined || !evt.unit) {
      return NextResponse.json(
        { error: "Event missing required fields: eventId, deviceId, observedAt, kind, value, unit" },
        { status: 400 }
      )
    }

    if (evt.deviceId !== device.externalId) {
      return NextResponse.json(
        { error: "Event deviceId mismatch with authenticated device identity" },
        { status: 400 }
      )
    }

    // Explicit privacy safeguard: reject any video, image, or media frames
    if (evt.image || evt.frame || evt.video || evt.audio || evt.rawFrame) {
      return NextResponse.json(
        { error: "Privacy violation: raw media frames are not permitted in event payload" },
        { status: 400 }
      )
    }

    // Validate sensor kinds & units
    if (evt.kind === "presence") {
      if (evt.unit !== "presence_binary" || (evt.value !== 0 && evt.value !== 1)) {
        return NextResponse.json(
          { error: "Presence event requires unit 'presence_binary' and value 0 or 1" },
          { status: 400 }
        )
      }
    } else if (evt.kind === "ambient_temperature") {
      if (evt.unit !== "celsius") {
        return NextResponse.json(
          { error: "Ambient temperature requires unit 'celsius'" },
          { status: 400 }
        )
      }
      if (typeof evt.value !== "number" || evt.value < -20 || evt.value > 80) {
        return NextResponse.json(
          { error: "Ambient temperature value out of plausible room range (-20 to 80 °C)" },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json(
        { error: `Unsupported sensor kind: ${evt.kind}` },
        { status: 400 }
      )
    }

    // Verify observation timestamp is not in the future
    const obsTime = new Date(evt.observedAt).getTime()
    if (isNaN(obsTime) || obsTime > Date.now() + 5 * 60 * 1000) {
      return NextResponse.json(
        { error: "Observation timestamp cannot be in the future" },
        { status: 400 }
      )
    }
  }

  // 8. Commit nonce and observations atomically
  const now = new Date()
  const nonceExpiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 min nonce lifetime

  try {
    await db.transaction(async (tx) => {
      // Replay prevention: insert nonce
      try {
        await tx.insert(deviceNonces).values({
          deviceId: device.id,
          keyVersion: device.keyVersion,
          nonce,
          signedTimestamp: new Date(timestamp),
          expiresAt: nonceExpiresAt,
        })
      } catch (err: any) {
        // Postgres unique violation error code: 23505
        if (err.code === "23505" || err.message?.includes("unique")) {
          throw Object.assign(new Error("Nonce already consumed (replay detected)"), {
            code: "REPLAY_DETECTED",
          })
        }
        throw err
      }

      // Insert observations and outbox events
      for (const evt of events) {
        await tx.insert(observations).values({
          tenantId: device.tenantId,
          patientId: device.patientId,
          type: evt.kind,
          numericValue: String(evt.value),
          unit: evt.unit,
          source: "device",
          deviceId: device.id,
          observedAt: new Date(evt.observedAt),
        })

        await tx.insert(outboxEvents).values({
          tenantId: device.tenantId,
          aggregateType: "patient",
          aggregateId: device.patientId,
          aggregateVersion: 1,
          eventType: "observation.recorded",
          payload: {
            patientId: device.patientId,
            type: evt.kind,
            numericValue: String(evt.value),
            unit: evt.unit,
            observedAt: evt.observedAt,
            source: "device",
            deviceId: device.id,
          },
        })
      }

      // Audit event
      await tx.insert(auditEvents).values({
        tenantId: device.tenantId,
        actorType: "device",
        actorId: device.externalId,
        action: "device.events_ingested",
        resourceType: "device",
        resourceId: device.id,
        purpose: "environmental_monitoring",
        decision: "allow",
        requestId: crypto.randomUUID(),
      })

      // Update device last seen
      await tx
        .update(devices)
        .set({ lastSeenAt: now, updatedAt: now })
        .where(eq(devices.id, device.id))
    })

    return NextResponse.json({
      accepted: true,
      eventCount: events.length,
      deviceId: device.externalId,
    })
  } catch (err: any) {
    if (
      err.code === "REPLAY_DETECTED" ||
      err.code === "23505" ||
      err.cause?.code === "23505" ||
      err.message?.includes("replay") ||
      err.message?.includes("unique") ||
      err.cause?.message?.includes("unique")
    ) {
      return NextResponse.json(
        { error: "Nonce already consumed (replay detected)" },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: "Internal error processing device events" },
      { status: 500 }
    )
  }
}
