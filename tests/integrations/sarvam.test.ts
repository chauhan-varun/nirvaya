import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { transcribeAudioChunk } from "@/server/integrations/sarvam"

describe("Sarvam STT Integration Adapter", () => {
  const originalEnv = process.env.SARVAM_API_KEY

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SARVAM_API_KEY = originalEnv
    } else {
      delete process.env.SARVAM_API_KEY
    }
  })

  it("returns status: unavailable when SARVAM_API_KEY is missing", async () => {
    delete process.env.SARVAM_API_KEY

    const result = await transcribeAudioChunk({
      audioBuffer: Buffer.from("test audio content"),
      mimeType: "audio/webm",
    })

    expect(result.status).toBe("unavailable")
    if (result.status === "unavailable") {
      expect(result.reason).toContain("SARVAM_API_KEY")
    }
  })

  it("rejects audio payload exceeding 2MB limit", async () => {
    process.env.SARVAM_API_KEY = "dummy_test_sarvam_key"

    const largeBuffer = Buffer.alloc(2.5 * 1024 * 1024) // 2.5 MB

    const result = await transcribeAudioChunk({
      audioBuffer: largeBuffer,
      mimeType: "audio/webm",
    })

    expect(result.status).toBe("error")
    if (result.status === "error") {
      expect(result.message).toContain("exceeds maximum permitted size of 2MB")
    }
  })

  it("rejects unsupported MIME types", async () => {
    process.env.SARVAM_API_KEY = "dummy_test_sarvam_key"

    const result = await transcribeAudioChunk({
      audioBuffer: Buffer.from("fake data"),
      mimeType: "application/json",
    })

    expect(result.status).toBe("error")
    if (result.status === "error") {
      expect(result.message).toContain('Unsupported audio MIME type: "application/json"')
    }
  })

  it("successfully forwards valid audio and receives transcript", async () => {
    process.env.SARVAM_API_KEY = "mock_valid_sarvam_key"

    // Mock global fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        transcript: "Hello, my name is Priya and I need help tracking blood glucose.",
        language_code: "en-IN",
      }),
    })
    globalThis.fetch = mockFetch

    const result = await transcribeAudioChunk({
      audioBuffer: Buffer.from("valid-webm-audio-binary-data"),
      mimeType: "audio/webm;codecs=opus",
      languageCode: "en-IN",
    })

    expect(result.status).toBe("success")
    if (result.status === "success") {
      expect(result.transcript).toBe(
        "Hello, my name is Priya and I need help tracking blood glucose."
      )
      expect(result.languageCode).toBe("en-IN")
    }

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toBe("https://api.sarvam.ai/speech-to-text")
    expect(callArgs[1].headers["api-subscription-key"]).toBe("mock_valid_sarvam_key")
  })

  it("handles provider HTTP errors safely without leaking keys", async () => {
    process.env.SARVAM_API_KEY = "mock_valid_sarvam_key"

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized: invalid subscription key",
    })
    globalThis.fetch = mockFetch

    const result = await transcribeAudioChunk({
      audioBuffer: Buffer.from("audio-data"),
      mimeType: "audio/wav",
    })

    expect(result.status).toBe("error")
    if (result.status === "error") {
      expect(result.message).toContain("HTTP 401")
      // Ensure API key is never in error message
      expect(result.message).not.toContain("mock_valid_sarvam_key")
    }
  })
})
