import { describe, it, expect } from "vitest"
import {
  extractLabCandidates,
  validateValue,
} from "@/lib/ocr/ocr-test-mapper"
import {
  interpretLabValue,
  LAB_CATEGORY,
} from "@/lib/ocr/lab-ranges"

describe("OCR Lab Report Scanner & Clinical Test Mapper", () => {
  describe("extractLabCandidates", () => {
    it("extracts HbA1c value and percentage unit from printed report text", () => {
      const sampleText = `
        Dr. Lal PathLabs
        Patient: John Doe, Age: 45, Gender: Male
        Test Name: Glycated Hemoglobin (HbA1c)
        Result: 6.8 %
        Reference Interval: Normal: < 5.7 %, Prediabetes: 5.7 - 6.4 %
      `

      const candidates = extractLabCandidates(sampleText)
      expect(candidates.length).toBeGreaterThanOrEqual(1)

      const hba1c = candidates.find((c) => c.testId === "hba1c")
      expect(hba1c).toBeDefined()
      expect(hba1c?.value).toBe(6.8)
      expect(hba1c?.unit).toBe("%")
      expect(hba1c?.needsManualReview).toBe(false)
    })

    it("extracts Fasting Plasma Glucose in mg/dL and filters reference range limits", () => {
      const sampleText = `
        Metro Metropolis Diagnostics
        GLUCOSE, FASTING, PLASMA
        Value: 112 mg/dL
        Biological Reference Interval: 70 - 99 mg/dL
      `

      const candidates = extractLabCandidates(sampleText)
      const fpg = candidates.find((c) => c.testId === "fpg")
      expect(fpg).toBeDefined()
      expect(fpg?.value).toBe(112)
      expect(fpg?.unit).toBe("mg/dL")
    })

    it("converts mmol/L glucose to mg/dL correctly", () => {
      const sampleText = `
        Blood Sugar Fasting: 7.0 mmol/L
      `

      const candidates = extractLabCandidates(sampleText)
      const fpg = candidates.find((c) => c.testId === "fpg")
      expect(fpg).toBeDefined()
      expect(fpg?.originalValue).toBe(7.0)
      expect(fpg?.originalUnit).toBe("mmol/L")
      expect(fpg?.unit).toBe("mg/dL")
      expect(fpg?.convertedFrom).toBe("mmol/L")
      // 7.0 * 18.0182 = 126.1 mg/dL
      expect(fpg?.value).toBeCloseTo(126.1, 1)
    })

    it("rejects non-text or empty input gracefully", () => {
      expect(extractLabCandidates("")).toEqual([])
      expect(extractLabCandidates("   \n\n  ")).toEqual([])
    })
  })

  describe("interpretLabValue", () => {
    it("classifies HbA1c < 5.7% as Normal", () => {
      const res = interpretLabValue("hba1c", 5.4)
      expect(res?.category).toBe(LAB_CATEGORY.NORMAL)
      expect(res?.label).toContain("Within standard reference")
    })

    it("classifies HbA1c 5.7%–6.4% as Prediabetes", () => {
      const res = interpretLabValue("hba1c", 6.1)
      expect(res?.category).toBe(LAB_CATEGORY.PREDIABETES)
      expect(res?.label).toContain("Prediabetes")
    })

    it("classifies HbA1c >= 6.5% as Elevated / Diabetes range", () => {
      const res = interpretLabValue("hba1c", 7.2)
      expect(res?.category).toBe(LAB_CATEGORY.DIABETES_RANGE)
      expect(res?.label).toContain("Elevated / Diabetes range")
    })

    it("classifies Fasting Glucose 115 mg/dL as Prediabetes", () => {
      const res = interpretLabValue("fpg", 115)
      expect(res?.category).toBe(LAB_CATEGORY.PREDIABETES)
    })
  })

  describe("validateValue", () => {
    it("flags implausible HbA1c values for review", () => {
      const checkLow = validateValue("hba1c", 1.2, "%")
      expect(checkLow.valid).toBe(false)
      expect(checkLow.reason).toBe("implausible_hba1c_value")

      const checkHigh = validateValue("hba1c", 25, "%")
      expect(checkHigh.valid).toBe(false)
      expect(checkHigh.reason).toBe("implausible_hba1c_value")
    })

    it("flags implausible glucose values for review", () => {
      const checkExtreme = validateValue("fpg", 1200, "mg/dL")
      expect(checkExtreme.valid).toBe(false)
      expect(checkExtreme.reason).toBe("implausible_glucose_value")
    })
  })
})
