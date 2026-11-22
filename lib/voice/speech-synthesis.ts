/**
 * Client-side Speech Synthesis (TTS) helper.
 * Uses the Web Speech API (window.speechSynthesis) to speak text in Hindi (hi-IN) or English (en-IN).
 * Provides safe fallback if Hindi voice is not natively installed on the user device.
 */

export interface SpeakOptions {
  text: string
  lang?: "hi-IN" | "en-IN" | "en-US"
  rate?: number
  pitch?: number
  onStart?: () => void
  onEnd?: () => void
  onError?: (err: unknown) => void
}

let activeUtterance: SpeechSynthesisUtterance | null = null

export function speakText(options: SpeakOptions): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false
  }

  try {
    // Stop any existing playback
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(options.text)
    utterance.lang = options.lang || "hi-IN"
    utterance.rate = options.rate ?? 0.95 // slightly slower for clinical clarity
    utterance.pitch = options.pitch ?? 1.0

    // Pick best available voice matching target language
    const voices = window.speechSynthesis.getVoices()
    const targetLangPrefix = (options.lang || "hi-IN").split("-")[0].toLowerCase()

    const matchedVoice =
      voices.find((v) => v.lang.toLowerCase() === (options.lang || "hi-IN").toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(targetLangPrefix)) ||
      voices.find((v) => v.lang.includes("IN"))

    if (matchedVoice) {
      utterance.voice = matchedVoice
    }

    utterance.onstart = () => {
      options.onStart?.()
    }

    utterance.onend = () => {
      activeUtterance = null
      options.onEnd?.()
    }

    utterance.onerror = (e) => {
      activeUtterance = null
      options.onError?.(e)
    }

    activeUtterance = utterance
    window.speechSynthesis.speak(utterance)
    return true
  } catch (err) {
    options.onError?.(err)
    return false
  }
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel()
    } catch {
      // ignore
    }
  }
  activeUtterance = null
}

export function isSpeaking(): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false
  }
  return window.speechSynthesis.speaking
}
