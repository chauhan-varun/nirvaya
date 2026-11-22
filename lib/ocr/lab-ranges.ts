export const LAB_TEST_IDS = {
  HBA1C: "hba1c",
  FPG: "fpg",
  RBG: "rbg",
  OGTT: "ogtt",
  PPBS: "ppbs",
} as const

export type LabTestId = (typeof LAB_TEST_IDS)[keyof typeof LAB_TEST_IDS]

export const LAB_CATEGORY = {
  NORMAL: "normal",
  PREDIABETES: "prediabetes",
  DIABETES_RANGE: "diabetes_range",
  NON_DIAGNOSTIC: "non_diagnostic",
  MANUAL_REVIEW: "manual_review",
} as const

export type LabCategory = (typeof LAB_CATEGORY)[keyof typeof LAB_CATEGORY]

export interface LabRangeInfo {
  name: string
  unit: string
  thresholds: {
    normal: number
    prediabetes: number
  }
}

export const LAB_RANGES: Record<string, LabRangeInfo> = {
  [LAB_TEST_IDS.HBA1C]: {
    name: "HbA1c",
    unit: "%",
    thresholds: {
      normal: 5.7,
      prediabetes: 6.5,
    },
  },
  [LAB_TEST_IDS.FPG]: {
    name: "Fasting Plasma Glucose",
    unit: "mg/dL",
    thresholds: {
      normal: 100,
      prediabetes: 126,
    },
  },
  [LAB_TEST_IDS.OGTT]: {
    name: "Oral Glucose Tolerance Test (2-Hr)",
    unit: "mg/dL",
    thresholds: {
      normal: 140,
      prediabetes: 200,
    },
  },
}

export interface InterpretedLabResult {
  testId: LabTestId
  testName: string
  value: number
  unit: string
  category: LabCategory
  label: string
  message: string
}

export function interpretLabValue(
  testId: string,
  inputValue: number | string
): InterpretedLabResult | null {
  const numValue = Number(inputValue)
  if (!Number.isFinite(numValue) || numValue <= 0) return null

  if (testId === LAB_TEST_IDS.PPBS) {
    return {
      testId: LAB_TEST_IDS.PPBS,
      testName: "Postprandial Blood Sugar (PPBS)",
      value: numValue,
      unit: "mg/dL",
      category: LAB_CATEGORY.MANUAL_REVIEW,
      label: "Clinical review required",
      message:
        "PPBS reflects post-meal response and requires physician review in light of meal composition.",
    }
  }

  if (testId === LAB_TEST_IDS.RBG) {
    if (numValue >= 200) {
      return {
        testId: LAB_TEST_IDS.RBG,
        testName: "Random Blood Glucose",
        value: numValue,
        unit: "mg/dL",
        category: LAB_CATEGORY.NON_DIAGNOSTIC,
        label: "Clinical evaluation recommended",
        message:
          "Random blood glucose is ≥ 200 mg/dL. Prompt clinical evaluation and confirmatory fasting testing are recommended.",
      }
    }
    return {
      testId: LAB_TEST_IDS.RBG,
      testName: "Random Blood Glucose",
      value: numValue,
      unit: "mg/dL",
      category: LAB_CATEGORY.NON_DIAGNOSTIC,
      label: "Non-diagnostic measurement",
      message:
        "Random blood glucose fluctuates with recent food. A fasting or HbA1c test is needed for definitive evaluation.",
    }
  }

  const range = LAB_RANGES[testId]
  if (!range) return null

  const { normal, prediabetes } = range.thresholds

  if (numValue < normal) {
    return {
      testId: testId as LabTestId,
      testName: range.name,
      value: numValue,
      unit: range.unit,
      category: LAB_CATEGORY.NORMAL,
      label: "Within standard reference",
      message: "Value is below risk threshold. Maintain healthy lifestyle habits.",
    }
  }

  if (numValue < prediabetes) {
    return {
      testId: testId as LabTestId,
      testName: range.name,
      value: numValue,
      unit: range.unit,
      category: LAB_CATEGORY.PREDIABETES,
      label: "Prediabetes range",
      message: "Value falls in the prediabetes range. Consult a clinician for preventive guidance.",
    }
  }

  return {
    testId: testId as LabTestId,
    testName: range.name,
    value: numValue,
    unit: range.unit,
    category: LAB_CATEGORY.DIABETES_RANGE,
    label: "Elevated / Diabetes range",
    message: "Value is in the elevated range. Confirmatory testing with your physician is required.",
  }
}
