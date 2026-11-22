import { describe, it, expect } from "vitest"
import { parseOnboardingSpeech } from "@/lib/voice/onboarding-parser"
import { parseJournalSpeech } from "@/lib/voice/journal-parser"

describe("Voice Onboarding Speech Parser", () => {
  it("extracts full name, birth year, and gender from natural English speech", () => {
    const result = parseOnboardingSpeech(
      "Hello, my name is Rahul Sharma and I was born in 1988, male"
    )
    expect(result.name).toBe("Rahul Sharma")
    expect(result.yearOfBirth).toBe(1988)
    expect(result.gender).toBe("male")
  })

  it("extracts age and converts to year of birth correctly", () => {
    const currentYear = new Date().getFullYear()
    const result = parseOnboardingSpeech(
      "I am Sunita Patel, 40 years old, female"
    )
    expect(result.name).toBe("Sunita Patel")
    expect(result.yearOfBirth).toBe(currentYear - 40)
    expect(result.gender).toBe("female")
  })

  it("extracts details from Hinglish phrasing", () => {
    const result = parseOnboardingSpeech(
      "Mera naam Amit Kumar hai, 1995 born, purush"
    )
    expect(result.name).toBe("Amit Kumar")
    expect(result.yearOfBirth).toBe(1995)
    expect(result.gender).toBe("male")
  })
})

describe("Voice Journal Speech Parser", () => {
  it("extracts fasting glucose in mg/dL", () => {
    const entry = parseJournalSpeech("Fasting blood sugar 114 mg/dL")
    expect(entry.kind).toBe("glucose")
    if (entry.kind === "glucose") {
      expect(entry.value).toBe(114)
      expect(entry.unit).toBe("mg/dL")
      expect(entry.context).toBe("glucose_fasting")
    }
  })

  it("extracts postprandial glucose", () => {
    const entry = parseJournalSpeech("After lunch sugar is 142")
    expect(entry.kind).toBe("glucose")
    if (entry.kind === "glucose") {
      expect(entry.value).toBe(142)
      expect(entry.context).toBe("glucose_postprandial")
    }
  })

  it("extracts mmol/L glucose decimal", () => {
    const entry = parseJournalSpeech("Morning fasting sugar 6.4 mmol/L")
    expect(entry.kind).toBe("glucose")
    if (entry.kind === "glucose") {
      expect(entry.value).toBe(6.4)
      expect(entry.unit).toBe("mmol/L")
      expect(entry.context).toBe("glucose_fasting")
    }
  })

  it("extracts medication details", () => {
    const entry = parseJournalSpeech("Took Metformin 500 mg after dinner")
    expect(entry.kind).toBe("medication")
    if (entry.kind === "medication") {
      expect(entry.medicineName).toBe("Metformin")
      expect(entry.dosage).toBe("500 mg")
    }
  })

  it("extracts physical activity duration and type", () => {
    const entry = parseJournalSpeech("Walked for 45 minutes in the park")
    expect(entry.kind).toBe("activity")
    if (entry.kind === "activity") {
      expect(entry.activityType).toBe("walking")
      expect(entry.minutes).toBe(45)
    }
  })

  it("extracts hydration volume", () => {
    const entry = parseJournalSpeech("Drank 3 glasses of water")
    expect(entry.kind).toBe("hydration")
    if (entry.kind === "hydration") {
      expect(entry.milliliters).toBe(750)
    }
  })
})
