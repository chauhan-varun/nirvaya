/**
 * Intelligent parser for spoken patient onboarding details.
 * Supports English, Indian English, and conversational Hindi/Hinglish phrasing.
 */

export interface ParsedOnboardingDetails {
  name?: string
  yearOfBirth?: number
  gender?: "female" | "male" | "other" | "prefer_not_to_say"
  confidence: {
    name: boolean
    yearOfBirth: boolean
    gender: boolean
  }
}

export function parseOnboardingSpeech(transcript: string): ParsedOnboardingDetails {
  const text = transcript.trim()
  const lower = text.toLowerCase()
  const currentYear = new Date().getFullYear()

  let extractedName: string | undefined
  let extractedYearOfBirth: number | undefined
  let extractedGender: "female" | "male" | "other" | "prefer_not_to_say" | undefined

  // 1. Extract Name
  // Patterns: "my name is X", "i am X", "this is X", "mera naam X hai", "naam hai X"
  const namePatterns = [
    /(?:my name is|i am|i'm|this is|call me)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
    /(?:mera naam|naam hai|naam)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s*(?:hai)?/i,
  ]

  for (const pattern of namePatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const candidate = match[1].trim()
      // Exclude common trigger words that might accidentally match
      const stopWords = new Set(["a", "an", "the", "and", "born", "male", "female", "years", "old", "saal"])
      if (!stopWords.has(candidate.toLowerCase())) {
        // Capitalize words cleanly
        extractedName = candidate
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ")
        break
      }
    }
  }

  // 2. Extract Year of Birth or Age
  // Direct 4-digit year: "born in 1988", "year 1995", "in 1974" or bare 1940-2025
  const yearMatch = text.match(/\b(19[3-9]\d|20[0-2]\d)\b/)
  if (yearMatch) {
    const yr = parseInt(yearMatch[1], 10)
    if (yr >= 1920 && yr <= currentYear - 10) {
      extractedYearOfBirth = yr
    }
  }

  // If no direct year, check age: "35 years old", "age 42", "42 saal", "age is 28"
  if (!extractedYearOfBirth) {
    const ageMatch = lower.match(
      /\b(?:age\s*(?:is)?|i am|i'm)?\s*(\d{1,2})\s*(?:years old|years|yrs|saal|year)\b/
    ) || lower.match(/\bage\s*(?:is)?\s*(\d{1,2})\b/)

    if (ageMatch && ageMatch[1]) {
      const age = parseInt(ageMatch[1], 10)
      if (age >= 18 && age <= 110) {
        extractedYearOfBirth = currentYear - age
      }
    }
  }

  // 3. Extract Gender
  // Check female first to avoid substring confusion
  if (/\b(?:female|woman|lady|girl|mahila|aurat|stri)\b/i.test(text)) {
    extractedGender = "female"
  } else if (/\b(?:male|man|boy|gentleman|purush|aadmi)\b/i.test(text)) {
    extractedGender = "male"
  } else if (/\b(?:other|non-binary|transgender)\b/i.test(text)) {
    extractedGender = "other"
  }

  return {
    name: extractedName,
    yearOfBirth: extractedYearOfBirth,
    gender: extractedGender,
    confidence: {
      name: !!extractedName,
      yearOfBirth: !!extractedYearOfBirth,
      gender: !!extractedGender,
    },
  }
}
