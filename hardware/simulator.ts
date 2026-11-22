import crypto from "node:crypto"
import {
  buildCanonicalHmacString,
  computeBodySha256,
  computeHmacSignature,
} from "@/server/hardware/hmac"

export interface SimulatedSensorReading {
  kind: "presence" | "ambient_temperature"
  value: number
  unit: "presence_binary" | "celsius"
}

export interface PreparedDeviceRequest {
  url: string
  method: "POST"
  headers: Record<string, string>
  body: string
}

/**
 * Arduino UNO Q + Modulino Thermo Edge Station Simulator.
 * Unmistakably labeled as simulated output in firmwareVersion and telemetry.
 * Discloses truthful sensor limits:
 * - Presence indicates room activity, never verified patient exercise adherence.
 * - Thermo measures room/ambient temperature, never clinical body temperature.
 */
export class ArduinoStationSimulator {
  readonly deviceExternalId: string
  readonly secretKey: string
  readonly keyVersion: number
  readonly firmwareVersion = "UNO-Q-MODULINO-1.0.0-SIM"

  constructor(params: {
    deviceExternalId: string
    secretKey: string
    keyVersion?: number
  }) {
    this.deviceExternalId = params.deviceExternalId
    this.secretKey = params.secretKey
    this.keyVersion = params.keyVersion ?? 1
  }

  /**
   * Generates a signed HTTP request ready to be dispatched to /api/devices/events.
   */
  prepareSignedRequest(params: {
    readings: SimulatedSensorReading[]
    observedAt?: Date
    timestampOverride?: string
    nonceOverride?: string
    signatureOverride?: string
    path?: string
  }): PreparedDeviceRequest {
    const observedAt = (params.observedAt ?? new Date()).toISOString()
    const timestamp = params.timestampOverride ?? new Date().toISOString()
    const nonce = params.nonceOverride ?? crypto.randomBytes(16).toString("hex")
    const path = params.path ?? "/api/devices/events"

    const events = params.readings.map((r) => ({
      ...r,
      eventId: `sim_evt_${crypto.randomBytes(8).toString("hex")}`,
      deviceId: this.deviceExternalId,
      observedAt,
      kind: r.kind,
      value: r.value,
      unit: r.unit,
      firmwareVersion: this.firmwareVersion,
    }))

    const bodyString = JSON.stringify(events)
    const bodySha256 = computeBodySha256(bodyString)

    const canonicalString = buildCanonicalHmacString({
      method: "POST",
      path,
      timestamp,
      nonce,
      keyVersion: this.keyVersion,
      bodySha256,
    })

    const signature =
      params.signatureOverride ??
      computeHmacSignature(canonicalString, this.secretKey)

    return {
      url: path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-device-id": this.deviceExternalId,
        "x-device-key-version": String(this.keyVersion),
        "x-device-timestamp": timestamp,
        "x-device-nonce": nonce,
        "x-device-signature": signature,
      },
      body: bodyString,
    }
  }

  /**
   * Generates a realistic Modulino Thermo ambient room temperature event (21.5 °C).
   */
  generateAmbientTemperatureReading(celsius = 22.0): SimulatedSensorReading {
    return {
      kind: "ambient_temperature",
      value: celsius,
      unit: "celsius",
    }
  }

  /**
   * Generates an environmental presence event (binary detected/undetected).
   */
  generatePresenceReading(detected: boolean): SimulatedSensorReading {
    return {
      kind: "presence",
      value: detected ? 1 : 0,
      unit: "presence_binary",
    }
  }
}
