import { LAB_TEST_IDS, type LabTestId } from "./lab-ranges"

export const GLUCOSE_CONVERSION_FACTOR = 18.0182

export interface ExtractedCandidate {
  testId: LabTestId
  value: number
  unit: string
  originalValue: number
  originalUnit: string
  convertedFrom: string | null
  needsManualReview: boolean
  validationReason: string | null
  sourceText: string
}

interface TestPattern {
  testId: LabTestId
  pattern: RegExp
  unit: string
}

const TEST_PATTERNS: TestPattern[] = [
  {
    testId: LAB_TEST_IDS.HBA1C,
    pattern:
      /\b(?:hba1c|hb\s*a1c|hemoglobin\s*a1c|glycated\s*hemoglobin|glycosylated\s*hemoglobin)\b/i,
    unit: "%",
  },
  {
    testId: LAB_TEST_IDS.FPG,
    pattern:
      /\b(?:fasting[\s,]*(?:blood|plasma)?[\s,]*(?:sugar|glucose)|(?:blood|plasma)?[\s,]*(?:sugar|glucose)[\s,]*fasting|fbs|fpg|b[\s,]*glucose[\s,]*fasting)\b/i,
    unit: "mg/dL",
  },
  {
    testId: LAB_TEST_IDS.PPBS,
    pattern:
      /\b(?:post[\s,-]*prandial|ppbs|ppbg|post[\s,-]*meal|2[\s,-]*hr[\s,-]*post[\s,-]*prandial)\b/i,
    unit: "mg/dL",
  },
  {
    testId: LAB_TEST_IDS.OGTT,
    pattern:
      /\b(?:ogtt|oral\s*glucose\s*tolerance|glucose\s*tolerance\s*test)\b/i,
    unit: "mg/dL",
  },
  {
    testId: LAB_TEST_IDS.RBG,
    pattern:
      /\b(?:random\s*(?:blood|plasma)?\s*(?:sugar|glucose)|rbs|rbg)\b/i,
    unit: "mg/dL",
  },
]

const NUMBER_PATTERN = /\b\d+(?:\.\d+)?\b/g
const REFERENCE_RANGE_PATTERN =
  /\b(?:\d+(?:\.\d+)?\s*(?:-|–|to)\s*\d+(?:\.\d+)?|[<>]=?\s*\d+(?:\.\d+)?)\b/gi

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function removeReferenceRanges(text: string): string {
  return text.replace(REFERENCE_RANGE_PATTERN, " ")
}

function getNumbers(text: string): number[] {
  return (text.match(NUMBER_PATTERN) || [])
    .map(Number)
    .filter(Number.isFinite)
}

function extractUnit(text: string): string {
  if (/%/.test(text)) return "%"
  if (/mmol\/l/i.test(text)) return "mmol/L"
  if (/mg\/dl/i.test(text)) return "mg/dL"
  return ""
}

export function validateValue(
  testId: LabTestId,
  value: number,
  unit: string
): { valid: boolean; reason: string | null } {
  if (!Number.isFinite(value) || value <= 0) {
    return { valid: false, reason: "invalid_value" }
  }

  if (testId === LAB_TEST_IDS.HBA1C) {
    if (unit !== "%" || value < 3 || value > 18) {
      return { valid: false, reason: "implausible_hba1c_value" }
    }
    return { valid: true, reason: null }
  }

  const valueInMgDl =
    unit === "mmol/L" ? value * GLUCOSE_CONVERSION_FACTOR : value

  if (valueInMgDl < 20 || valueInMgDl > 900) {
    return { valid: false, reason: "implausible_glucose_value" }
  }

  return { valid: true, reason: null }
}

export function extractLabCandidates(ocrText: string): ExtractedCandidate[] {
  if (!ocrText || !ocrText.trim()) return []

  const lines = ocrText
    .split(/\r?\n/)
    .map(normalizeSpaces)
    .filter(Boolean)

  const candidates: ExtractedCandidate[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const test = TEST_PATTERNS.find(({ pattern }) => pattern.test(line))

    if (!test) continue

    const cleaned = removeReferenceRanges(line)
    const detectedUnit = extractUnit(cleaned) || test.unit
    const numbers = getNumbers(cleaned)

    let val = numbers.length > 0 ? numbers[numbers.length - 1] : null
    let source = line

    // If result was on next line
    if (
      val === null &&
      index + 1 < lines.length &&
      !TEST_PATTERNS.some(({ pattern }) => pattern.test(lines[index + 1]))
    ) {
      const nextClean = removeReferenceRanges(lines[index + 1])
      const nextNumbers = getNumbers(nextClean)
      if (nextNumbers.length > 0) {
        val = nextNumbers[nextNumbers.length - 1]
        source = `${line} ${lines[index + 1]}`
        index += 1
      }
    }

    if (val === null) continue

    let normalizedValue = val
    let normalizedUnit = detectedUnit
    let convertedFrom: string | null = null

    if (test.testId !== LAB_TEST_IDS.HBA1C && detectedUnit === "mmol/L") {
      normalizedValue = Number((val * GLUCOSE_CONVERSION_FACTOR).toFixed(1))
      normalizedUnit = "mg/dL"
      convertedFrom = "mmol/L"
    }

    const validation = validateValue(test.testId, val, detectedUnit)

    candidates.push({
      testId: test.testId,
      value: normalizedValue,
      unit: normalizedUnit,
      originalValue: val,
      originalUnit: detectedUnit,
      convertedFrom,
      needsManualReview: !validation.valid,
      validationReason: validation.reason,
      sourceText: source,
    })
  }

  return candidates
}
