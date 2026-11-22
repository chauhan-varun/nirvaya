/**
 * Intelligent parser for spoken daily health journal entries.
 * Understands natural speech for glucose measurements, meals, activities, medicines, etc.
 */

export type ParsedJournalEntry =
  | {
      kind: "glucose"
      value: number
      unit: "mg/dL" | "mmol/L"
      context: "glucose_fasting" | "glucose_postprandial" | "glucose_random"
      notes?: string
      confidence: string
    }
  | {
      kind: "meal"
      mealType: "breakfast" | "lunch" | "dinner" | "snack"
      description: string
      carbsGrams?: number
      confidence: string
    }
  | {
      kind: "activity"
      activityType: "walking" | "running" | "cycling" | "yoga" | "strength" | "other"
      minutes: number
      notes?: string
      confidence: string
    }
  | {
      kind: "medication"
      medicineName: string
      dosage?: string
      notes?: string
      confidence: string
    }
  | {
      kind: "hydration"
      milliliters: number
      confidence: string
    }
  | {
      kind: "unknown"
      rawText: string
    }

export function parseJournalSpeech(transcript: string): ParsedJournalEntry {
  const text = transcript.trim()
  const lower = text.toLowerCase()

  // 1. Check for Glucose measurement
  // Requires explicit glucose context or unit
  const isGlucose =
    /\b(?:sugar|glucose|fasting|postprandial|random|fbs|ppbs)\b/i.test(lower) ||
    /\b(?:mg\/dl|mmol\/l|mgdl)\b/i.test(lower)

  if (isGlucose) {
    let context: "glucose_fasting" | "glucose_postprandial" | "glucose_random" =
      "glucose_random"
    if (/(?:fasting|morning|before breakfast|empty stomach|fbs)/i.test(lower)) {
      context = "glucose_fasting"
    } else if (
      /(?:post|after|lunch|dinner|breakfast|meal|ppbs|pp)/i.test(lower)
    ) {
      context = "glucose_postprandial"
    }

    let unit: "mg/dL" | "mmol/L" = "mg/dL"
    if (lower.includes("mmol") || lower.includes("mmol/l")) {
      unit = "mmol/L"
    }

    let val: number | undefined
    if (unit === "mmol/L") {
      const match = lower.match(/\b([3-9](?:\.[0-9])?|1[0-9](?:\.[0-9])?|2[0-9](?:\.[0-9])?)\b/)
      if (match) val = parseFloat(match[1])
    } else {
      const matches = lower.match(/\b(\d{2,3})\b/g)
      if (matches) {
        for (const m of matches) {
          const num = parseInt(m, 10)
          if (num >= 35 && num <= 600) {
            val = num
            break
          }
        }
      }
    }

    if (val !== undefined) {
      return {
        kind: "glucose",
        value: val,
        unit,
        context,
        notes: text,
        confidence: `Extracted ${val} ${unit} (${context.replace("glucose_", "")})`,
      }
    }
  }

  // 2. Check for Hydration (checked before meals to prevent "water" matching food)
  if (/\b(?:water|drink|drank|drinking|hydration|pani)\b/i.test(lower)) {
    let ml = 250
    const literMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:l|liter|litres?)\b/i)
    const mlMatch = lower.match(/\b(\d{2,4})\s*(?:ml|milliliters?)\b/i)
    const glassMatch = lower.match(/\b(\d{1,2})\s*(?:glass|glasses)\b/i)

    if (literMatch) ml = Math.round(parseFloat(literMatch[1]) * 1000)
    else if (mlMatch) ml = parseInt(mlMatch[1], 10)
    else if (glassMatch) ml = parseInt(glassMatch[1], 10) * 250

    return {
      kind: "hydration",
      milliliters: ml,
      confidence: `Extracted ${ml} ml hydration`,
    }
  }

  // 3. Check for Physical Activity
  if (/\b(?:walk|walked|walking|run|running|jog|cycling|cycle|yoga|gym|workout|exercise)\b/i.test(lower)) {
    let activityType: "walking" | "running" | "cycling" | "yoga" | "strength" | "other" = "walking"
    if (/\b(?:run|running|jog)\b/i.test(lower)) activityType = "running"
    else if (/\b(?:cycl|cycling|cycle)\b/i.test(lower)) activityType = "cycling"
    else if (/\b(?:yoga)\b/i.test(lower)) activityType = "yoga"
    else if (/\b(?:gym|strength|weight|weights)\b/i.test(lower)) activityType = "strength"

    const minMatch = lower.match(/\b(\d{1,3})\s*(?:mins?|minutes?)\b/)
    const minutes = minMatch ? parseInt(minMatch[1], 10) : 30

    return {
      kind: "activity",
      activityType,
      minutes,
      notes: text,
      confidence: `Recorded ${minutes} mins of ${activityType}`,
    }
  }

  // 4. Check for Medication
  const medKeywords = [
    /\bmetformin\b/i,
    /\bglycomet\b/i,
    /\bglimepiride\b/i,
    /\bjanuvia\b/i,
    /\bsitagliptin\b/i,
    /\binsulin\b/i,
    /\bempagliflozin\b/i,
    /\bdapagliflozin\b/i,
    /\btelmisartan\b/i,
    /\batorvastatin\b/i,
    /\bmedicine\b/i,
    /\btablet\b/i,
    /\bpill\b/i,
    /\bdose\b/i,
    /\btook\b/i,
  ]
  if (medKeywords.some((r) => r.test(lower))) {
    const dosageMatch = text.match(/\b(\d+(?:\s*(?:mg|g|mcg|ml|units|iu)))\b/i)
    const dosage = dosageMatch ? dosageMatch[1].trim() : undefined

    let medName = "Prescribed Medication"
    for (const k of [
      "metformin",
      "glycomet",
      "glimepiride",
      "sitagliptin",
      "januvia",
      "insulin",
      "empagliflozin",
      "dapagliflozin",
      "telmisartan",
      "atorvastatin",
    ]) {
      if (lower.includes(k)) {
        medName = k.charAt(0).toUpperCase() + k.slice(1)
        break
      }
    }

    return {
      kind: "medication",
      medicineName: medName,
      dosage,
      notes: text,
      confidence: `Detected medication ${medName}${dosage ? ` (${dosage})` : ""}`,
    }
  }

  // 5. Check for Meal / Food
  const mealRegexes = [
    /\bate\b/i,
    /\bhad\b/i,
    /\beaten\b/i,
    /\beating\b/i,
    /\bfood\b/i,
    /\bbreakfast\b/i,
    /\blunch\b/i,
    /\bdinner\b/i,
    /\bsnack\b/i,
    /\broti\b/i,
    /\brice\b/i,
    /\bdal\b/i,
    /\bidli\b/i,
    /\bdosa\b/i,
    /\bsalad\b/i,
  ]
  if (mealRegexes.some((r) => r.test(lower))) {
    let mealType: "breakfast" | "lunch" | "dinner" | "snack" = "lunch"
    if (lower.includes("breakfast") || lower.includes("morning")) mealType = "breakfast"
    else if (lower.includes("dinner") || lower.includes("night")) mealType = "dinner"
    else if (lower.includes("snack") || lower.includes("tea")) mealType = "snack"

    return {
      kind: "meal",
      mealType,
      description: text,
      confidence: `Logged as ${mealType}`,
    }
  }

  return {
    kind: "unknown",
    rawText: text,
  }
}
