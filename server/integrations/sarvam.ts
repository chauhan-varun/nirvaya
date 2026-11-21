import "server-only"

export interface TranscribeAudioParams {
  audioBuffer: Buffer
  mimeType: string
  languageCode?: string
}

export type TranscribeResult =
  | { status: "success"; transcript: string; languageCode: string }
  | { status: "unavailable"; reason: string }
  | { status: "error"; message: string }

const ALLOWED_MIME_TYPES = new Set([
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp3",
  "audio/mpeg",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
])

const MAX_AUDIO_SIZE_BYTES = 2 * 1024 * 1024 // 2MB max chunk

export async function transcribeAudioChunk(
  params: TranscribeAudioParams
): Promise<TranscribeResult> {
  const apiKey = process.env.SARVAM_API_KEY

  if (!apiKey) {
    return {
      status: "unavailable",
      reason: "Sarvam STT credentials (SARVAM_API_KEY) are not configured in this environment.",
    }
  }

  if (params.audioBuffer.length > MAX_AUDIO_SIZE_BYTES) {
    return {
      status: "error",
      message: `Audio chunk exceeds maximum permitted size of 2MB (${(params.audioBuffer.length / (1024 * 1024)).toFixed(2)}MB received).`,
    }
  }

  // Sanitize MIME type (strip parameters like codecs=opus)
  const baseMimeType = params.mimeType.split(";")[0]?.trim().toLowerCase() ?? ""
  if (!ALLOWED_MIME_TYPES.has(baseMimeType)) {
    return {
      status: "error",
      message: `Unsupported audio MIME type: "${params.mimeType}". Permitted types: WebM, WAV, MP3, OGG, MP4.`,
    }
  }

  try {
    const formData = new FormData()
    const blob = new Blob([new Uint8Array(params.audioBuffer)], {
      type: baseMimeType,
    })
    formData.append("file", blob, "audio_chunk.webm")
    formData.append("model", "saarika:v2")
    if (params.languageCode) {
      formData.append("language_code", params.languageCode)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey,
      },
      body: formData,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error")
      return {
        status: "error",
        message: `Sarvam STT service returned HTTP ${response.status}: ${errText.slice(0, 200)}`,
      }
    }

    const data = (await response.json()) as {
      transcript?: string
      language_code?: string
    }

    return {
      status: "success",
      transcript: data.transcript ?? "",
      languageCode: data.language_code ?? params.languageCode ?? "en-IN",
    }
  } catch (err: unknown) {
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("abort"))
    return {
      status: "error",
      message: isAbort
        ? "Sarvam transcription request timed out after 10 seconds."
        : "Failed to connect to Sarvam transcription service.",
    }
  }
}
