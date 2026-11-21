/** Selector coverage, not a claim of available translations or speech models. */
export const languages = [
  { code: "en", name: "English" },
  { code: "as", name: "Assamese" },
  { code: "bn", name: "Bengali" },
  { code: "brx", name: "Bodo" },
  { code: "doi", name: "Dogri" },
  { code: "gu", name: "Gujarati" },
  { code: "hi", name: "Hindi" },
  { code: "kn", name: "Kannada" },
  { code: "ks", name: "Kashmiri" },
  { code: "kok", name: "Konkani" },
  { code: "mai", name: "Maithili" },
  { code: "ml", name: "Malayalam" },
  { code: "mni", name: "Manipuri (Meitei)" },
  { code: "mr", name: "Marathi" },
  { code: "ne", name: "Nepali" },
  { code: "or", name: "Odia" },
  { code: "pa", name: "Punjabi" },
  { code: "sa", name: "Sanskrit" },
  { code: "sat", name: "Santali" },
  { code: "sd", name: "Sindhi" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "ur", name: "Urdu" },
] as const

export type Locale = (typeof languages)[number]["code"]
export const defaultLocale: Locale = "en"
export const languageStorageKey = "carebridge.language"

export function isLocale(value: unknown): value is Locale {
  return languages.some(({ code }) => code === value)
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale
}

/** No translated dictionaries have been reviewed or connected yet. */
export function getContentLocale(requestedLocale: Locale): Locale {
  return requestedLocale === defaultLocale ? requestedLocale : defaultLocale
}
