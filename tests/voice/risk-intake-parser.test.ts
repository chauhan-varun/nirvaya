import { describe, it, expect } from "vitest"
import {
  parseRiskIntakeSpeech,
  generateHindiRiskExplanation,
} from "@/lib/voice/risk-intake-parser"

describe("Voice Risk Intake Parser", () => {
  // ─── Age extraction ──────────────────────────────────────────────

  describe("age extraction", () => {
    it("extracts age from English 'I am 42 years old'", () => {
      const result = parseRiskIntakeSpeech("I am 42 years old")
      expect(result.ageYears).toBe(42)
      expect(result.confidence.ageYears).toBe(true)
    })

    it("extracts age from 'age is 35'", () => {
      const result = parseRiskIntakeSpeech("My age is 35")
      expect(result.ageYears).toBe(35)
    })

    it("extracts age from Hindi 'meri umar 42 saal hai'", () => {
      const result = parseRiskIntakeSpeech("Meri umar 42 saal hai")
      expect(result.ageYears).toBe(42)
    })

    it("extracts age from '50 saal'", () => {
      const result = parseRiskIntakeSpeech("50 saal ka hoon")
      expect(result.ageYears).toBe(50)
    })

    it("extracts age from birth year 'born in 1988'", () => {
      const currentYear = new Date().getFullYear()
      const result = parseRiskIntakeSpeech("I was born in 1988")
      expect(result.ageYears).toBe(currentYear - 1988)
    })

    it("rejects age below 18", () => {
      const result = parseRiskIntakeSpeech("I am 15 years old")
      expect(result.ageYears).toBeUndefined()
      expect(result.confidence.ageYears).toBe(false)
    })
  })

  // ─── Gender extraction ───────────────────────────────────────────

  describe("gender extraction", () => {
    it("detects male from English", () => {
      const result = parseRiskIntakeSpeech("I am a male, age 40")
      expect(result.gender).toBe("male")
    })

    it("detects female from English", () => {
      const result = parseRiskIntakeSpeech("Female, 35 years old")
      expect(result.gender).toBe("female")
    })

    it("detects male from Hindi 'purush'", () => {
      const result = parseRiskIntakeSpeech("Main purush hoon, umar 42 saal")
      expect(result.gender).toBe("male")
    })

    it("detects female from Hindi 'mahila'", () => {
      const result = parseRiskIntakeSpeech("Mahila hoon, 38 saal ki")
      expect(result.gender).toBe("female")
    })

    it("prioritizes female over male substring", () => {
      const result = parseRiskIntakeSpeech("I am female")
      expect(result.gender).toBe("female")
    })
  })

  // ─── Weight extraction & Waist approximation ─────────────────────

  describe("weight extraction and waist approximation", () => {
    it("extracts weight in kg from English 'weight is 75 kg'", () => {
      const result = parseRiskIntakeSpeech("My weight is 75 kg")
      expect(result.weightKg).toBe(75)
      expect(result.confidence.weightKg).toBe(true)
    })

    it("extracts weight from Hindi 'mera wazan 80 kilo hai'", () => {
      const result = parseRiskIntakeSpeech("Mera wazan 80 kilo hai")
      expect(result.weightKg).toBe(80)
    })

    it("approximates waist from weight when waist is not spoken directly", () => {
      const result = parseRiskIntakeSpeech("Male, weight is 70 kg")
      expect(result.weightKg).toBe(70)
      expect(result.waistCircumferenceCm).toBeDefined()
      expect(result.waistCircumferenceCm).toBe(Math.round(70 * 1.08 + 6)) // ~82 cm
    })
  })

  // ─── Waist circumference extraction ──────────────────────────────

  describe("waist circumference extraction", () => {
    it("extracts waist from 'waist is 92 cm'", () => {
      const result = parseRiskIntakeSpeech("My waist is 92 cm")
      expect(result.waistCircumferenceCm).toBe(92)
    })

    it("extracts waist from Hindi 'kamar 88 cm'", () => {
      const result = parseRiskIntakeSpeech("Kamar 88 centimeter hai")
      expect(result.waistCircumferenceCm).toBe(88)
    })

    it("converts inches to cm: 'waist 36 inches'", () => {
      const result = parseRiskIntakeSpeech("My waist is 36 inches")
      expect(result.waistCircumferenceCm).toBe(Math.round(36 * 2.54))
    })

    it("extracts from 'pet ka naap 95 cm'", () => {
      const result = parseRiskIntakeSpeech("Pet ka naap 95 cm hai")
      expect(result.waistCircumferenceCm).toBe(95)
    })

    it("rejects unrealistic waist values", () => {
      const result = parseRiskIntakeSpeech("Waist is 10 cm")
      expect(result.waistCircumferenceCm).toBeUndefined()
    })
  })

  // ─── Physical activity extraction ────────────────────────────────

  describe("physical activity extraction", () => {
    it("detects sedentary from 'no exercise'", () => {
      const result = parseRiskIntakeSpeech("I do no exercise at all, sedentary lifestyle")
      expect(result.physicalActivity).toBe("sedentary")
    })

    it("detects mild from 'thoda exercise'", () => {
      const result = parseRiskIntakeSpeech("Thoda exercise kabhi kabhi karta hoon")
      expect(result.physicalActivity).toBe("mild")
    })

    it("detects moderate from 'daily walk'", () => {
      const result = parseRiskIntakeSpeech("I do a daily walk of 30 minutes")
      expect(result.physicalActivity).toBe("moderate")
    })

    it("detects moderate from Hindi 'roz subah walk'", () => {
      const result = parseRiskIntakeSpeech("Roz subah walk karta hoon")
      expect(result.physicalActivity).toBe("moderate")
    })

    it("detects vigorous from 'gym'", () => {
      const result = parseRiskIntakeSpeech("I go to the gym daily and do heavy exercise")
      expect(result.physicalActivity).toBe("vigorous")
    })

    it("detects vigorous from Hindi 'bahut exercise'", () => {
      const result = parseRiskIntakeSpeech("Bahut exercise karta hoon, running bhi")
      expect(result.physicalActivity).toBe("vigorous")
    })

    it("detects sedentary from 'baithke kaam'", () => {
      const result = parseRiskIntakeSpeech("Main baithke kaam karta hoon, office mein")
      expect(result.physicalActivity).toBe("sedentary")
    })
  })

  // ─── Family history extraction ───────────────────────────────────

  describe("family history extraction", () => {
    it("detects both parents", () => {
      const result = parseRiskIntakeSpeech("Both parents have diabetes")
      expect(result.familyHistory).toBe("both_parents")
    })

    it("detects one parent from 'papa ko diabetes hai'", () => {
      const result = parseRiskIntakeSpeech("Papa ko diabetes hai")
      expect(result.familyHistory).toBe("one_parent")
    })

    it("detects one parent from 'mother has diabetes'", () => {
      const result = parseRiskIntakeSpeech("My mother has diabetes")
      expect(result.familyHistory).toBe("one_parent")
    })

    it("detects both parents from Hindi 'dono parents'", () => {
      const result = parseRiskIntakeSpeech("Dono parents ko diabetes hai")
      expect(result.familyHistory).toBe("both_parents")
    })

    it("detects no family history", () => {
      const result = parseRiskIntakeSpeech("No family history of diabetes")
      expect(result.familyHistory).toBe("none")
    })

    it("detects no family history from Hindi 'kisi ko nahi'", () => {
      const result = parseRiskIntakeSpeech("Family mein kisi ko nahi hai diabetes")
      expect(result.familyHistory).toBe("none")
    })

    it("infers one parent from generic family mention", () => {
      const result = parseRiskIntakeSpeech("Ghar mein papa ko sugar hai")
      expect(result.familyHistory).toBe("one_parent")
    })
  })

  // ─── Diagnosed status extraction ─────────────────────────────────

  describe("diagnosed status extraction", () => {
    it("detects already diagnosed from English", () => {
      const result = parseRiskIntakeSpeech("I am a diabetic patient")
      expect(result.alreadyDiagnosed).toBe(true)
    })

    it("detects already diagnosed from Hindi 'mujhe diabetes hai'", () => {
      const result = parseRiskIntakeSpeech("Mujhe diabetes hai already")
      expect(result.alreadyDiagnosed).toBe(true)
    })

    it("detects not diagnosed from 'diabetes nahi'", () => {
      const result = parseRiskIntakeSpeech("Mujhe diabetes nahi hai")
      expect(result.alreadyDiagnosed).toBe(false)
    })

    it("detects sugar patient", () => {
      const result = parseRiskIntakeSpeech("Main sugar patient hoon")
      expect(result.alreadyDiagnosed).toBe(true)
    })
  })

  // ─── Full sentence extraction (combined) ─────────────────────────

  describe("combined multi-field extraction", () => {
    it("extracts all fields from a complete Hindi sentence", () => {
      const result = parseRiskIntakeSpeech(
        "Meri umar 42 saal hai, male hoon, kamar 92 cm, roz subah walk karta hoon, papa ko diabetes hai"
      )
      expect(result.ageYears).toBe(42)
      expect(result.gender).toBe("male")
      expect(result.waistCircumferenceCm).toBe(92)
      expect(result.physicalActivity).toBe("moderate")
      expect(result.familyHistory).toBe("one_parent")
    })

    it("extracts all fields from a complete English sentence", () => {
      const result = parseRiskIntakeSpeech(
        "I am 55 years old, female, waist is 88 cm, sedentary lifestyle, both parents have diabetes"
      )
      expect(result.ageYears).toBe(55)
      expect(result.gender).toBe("female")
      expect(result.waistCircumferenceCm).toBe(88)
      expect(result.physicalActivity).toBe("sedentary")
      expect(result.familyHistory).toBe("both_parents")
    })

    it("extracts from Hinglish mixed sentence with weight", () => {
      const result = parseRiskIntakeSpeech(
        "Age 38, male, weight 78 kg, thoda exercise kabhi kabhi, mother ko sugar hai"
      )
      expect(result.ageYears).toBe(38)
      expect(result.gender).toBe("male")
      expect(result.weightKg).toBe(78)
      expect(result.physicalActivity).toBe("mild")
      expect(result.familyHistory).toBe("one_parent")
    })

    it("generates a meaningful extraction summary", () => {
      const result = parseRiskIntakeSpeech(
        "I am 42 years old, male, waist is 92 cm"
      )
      expect(result.extractionSummary).toContain("Age: 42")
      expect(result.extractionSummary).toContain("Gender: Male")
      expect(result.extractionSummary).toContain("Waist: 92")
    })

    it("handles empty transcript gracefully", () => {
      const result = parseRiskIntakeSpeech("")
      expect(result.ageYears).toBeUndefined()
      expect(result.gender).toBeUndefined()
      expect(result.waistCircumferenceCm).toBeUndefined()
      expect(result.physicalActivity).toBeUndefined()
      expect(result.familyHistory).toBeUndefined()
      expect(result.alreadyDiagnosed).toBeUndefined()
      expect(result.extractionSummary).toContain("No risk factor values")
    })

    it("handles gibberish input gracefully", () => {
      const result = parseRiskIntakeSpeech(
        "asdf qwerty zxcv hello world testing"
      )
      expect(Object.values(result.confidence).every((v) => !v)).toBe(true)
    })
  })

  // ─── Hindi Explainable Breakdown Generator ───────────────────────

  describe("generateHindiRiskExplanation", () => {
    it("generates explainable breakdown for high risk with family history and sedentary activity", () => {
      const explanation = generateHindiRiskExplanation({
        riskTier: "high",
        totalScore: 70,
        ageScore: 20,
        waistScore: 0,
        activityScore: 30, // sedentary
        familyHistoryScore: 20, // both parents
        alreadyDiagnosed: false,
      })

      expect(explanation.headlineHindi).toContain("high")
      expect(explanation.spokenTextHindi).toContain("family history")
      expect(explanation.spokenTextHindi).toContain("activity")
      expect(explanation.reasonsHindi.length).toBeGreaterThan(0)
    })

    it("generates appropriate guidance for low risk", () => {
      const explanation = generateHindiRiskExplanation({
        riskTier: "low",
        totalScore: 20,
        ageScore: 0,
        waistScore: 0,
        activityScore: 10,
        familyHistoryScore: 10,
        alreadyDiagnosed: false,
      })

      expect(explanation.headlineHindi).toContain("low")
      expect(explanation.spokenTextHindi).toContain("Badhai ho")
    })

    it("handles diagnosed individuals safely", () => {
      const explanation = generateHindiRiskExplanation({
        riskTier: "not_applicable",
        totalScore: null,
        alreadyDiagnosed: true,
      })

      expect(explanation.headlineHindi).toContain("diagnosed")
      expect(explanation.spokenTextHindi).toContain("doctor")
    })
  })
})
