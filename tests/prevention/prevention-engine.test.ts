import { describe, it, expect } from "vitest"
import {
  generatePreventionPlan,
  PreventionObservation,
} from "@/lib/prevention/prevention-engine"

describe("Prevention Engine (Diabetes Risk Reduction)", () => {
  it("initializes with baseline values when observations are empty", () => {
    const plan = generatePreventionPlan([])

    expect(plan.weeklyActivityMinutes).toBe(0)
    expect(plan.weeklyActivityTarget).toBe(150)
    expect(plan.activityProgressPercent).toBe(0)
    expect(plan.fastingAverage).toBeNull()
    expect(plan.postprandialAverage).toBeNull()
    expect(plan.postprandialSpikeCount).toBe(0)
    expect(plan.preventionAdherenceScore).toBe(0)
    expect(plan.summaryStatus).toBe("just_started")
    expect(plan.checklists.length).toBeGreaterThan(0)
    expect(plan.lifestyleProtocols.length).toBeGreaterThan(0)
    expect(plan.riskReductionCitation).toContain("58%")
  })

  it("calculates weekly activity, hydration, and glucose averages correctly", () => {
    const now = new Date()
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString()

    const observations: PreventionObservation[] = [
      {
        type: "activity",
        numericValue: 45,
        unit: "minutes",
        observedAt: twoDaysAgo,
        notes: "Brisk morning walk",
      },
      {
        type: "activity",
        numericValue: 30,
        unit: "minutes",
        observedAt: fiveHoursAgo,
        notes: "Post-lunch stroll",
      },
      {
        type: "glucose_fasting",
        numericValue: 98,
        unit: "mg/dL",
        observedAt: fiveHoursAgo,
      },
      {
        type: "glucose_postprandial",
        numericValue: 135,
        unit: "mg/dL",
        observedAt: fiveHoursAgo,
      },
      {
        type: "hydration",
        numericValue: 1500,
        unit: "mL",
        observedAt: fiveHoursAgo,
      },
      {
        type: "sleep",
        numericValue: 7.5,
        unit: "hours",
        observedAt: twoDaysAgo,
      },
    ]

    const plan = generatePreventionPlan(observations)

    expect(plan.weeklyActivityMinutes).toBe(75) // 45 + 30
    expect(plan.activityProgressPercent).toBe(50) // 75 / 150 = 50%
    expect(plan.fastingAverage).toBe(98)
    expect(plan.postprandialAverage).toBe(135)
    expect(plan.postprandialSpikeCount).toBe(0) // 135 <= 140
    expect(plan.dailyHydrationMl).toBe(1500)
    expect(plan.hydrationProgressPercent).toBe(60) // 1500 / 2500 = 60%
    expect(plan.averageSleepHours).toBe(7.5)
    expect(plan.preventionAdherenceScore).toBeGreaterThan(40)
  })

  it("detects postprandial glucose spikes (> 140 mg/dL) and generates walking guidance", () => {
    const now = new Date().toISOString()
    const observations: PreventionObservation[] = [
      {
        type: "glucose_postprandial",
        numericValue: 165, // Spike!
        unit: "mg/dL",
        observedAt: now,
      },
      {
        type: "glucose_random",
        numericValue: 155, // Spike!
        unit: "mg/dL",
        observedAt: now,
      },
    ]

    const plan = generatePreventionPlan(observations)

    expect(plan.postprandialSpikeCount).toBe(2)
    const spikeRecommendation = plan.actionableRecommendations.find((r) =>
      r.includes("post-meal reading(s) >140 mg/dL")
    )
    expect(spikeRecommendation).toBeDefined()
    expect(spikeRecommendation).toContain("15-minute post-meal walking protocol")
  })

  it("recognizes manual checklist completions and auto-completes met criteria", () => {
    const now = new Date().toISOString()
    const observations: PreventionObservation[] = [
      {
        type: "hydration",
        numericValue: 2600,
        unit: "mL",
        observedAt: now,
      },
    ]

    // User checked off fiber-first food pacing manually
    const plan = generatePreventionPlan(observations, ["fiber_first_order"])

    const fiberChecklist = plan.checklists.find((c) => c.id === "fiber_first_order")
    const hydrationChecklist = plan.checklists.find((c) => c.id === "optimal_hydration")

    expect(fiberChecklist?.isCompleted).toBe(true)
    expect(hydrationChecklist?.isCompleted).toBe(true) // Auto-completed because 2600 >= 2500
  })

  it("awards up to 58% estimated risk reduction for high lifestyle adherence", () => {
    const now = new Date().toISOString()
    const observations: PreventionObservation[] = [
      {
        type: "activity",
        numericValue: 160, // Exceeds 150 target
        unit: "minutes",
        observedAt: now,
      },
      {
        type: "hydration",
        numericValue: 2500,
        unit: "mL",
        observedAt: now,
      },
      {
        type: "sleep",
        numericValue: 8,
        unit: "hours",
        observedAt: now,
      },
      {
        type: "glucose_fasting",
        numericValue: 92,
        unit: "mg/dL",
        observedAt: now,
      },
      {
        type: "glucose_postprandial",
        numericValue: 120, // Normal glycemic response
        unit: "mg/dL",
        observedAt: now,
      },
      {
        type: "meal",
        numericValue: null,
        unit: null,
        observedAt: now,
        notes: "Salad first, then brown rice and dal",
      },
    ]

    const plan = generatePreventionPlan(observations)

    expect(plan.preventionAdherenceScore).toBeGreaterThanOrEqual(75)
    expect(plan.estimatedRiskReductionPercent).toBe(58)
    expect(plan.summaryStatus).toBe("optimal")
  })
})
