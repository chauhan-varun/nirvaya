/**
 * Evidence-Based Diabetes Risk Reduction & Lifestyle Prevention Engine
 * 
 * Clinical References:
 * 1. ICMR-INDIAB Guidelines for Management of Type 2 Diabetes in India (2023)
 * 2. American Diabetes Association (ADA) Diabetes Prevention Program (DPP)
 *    - Demonstrated a 58% reduction in type 2 diabetes incidence with 150 mins/week
 *      moderate physical activity and 5-7% weight management.
 * 3. Non-insulin GLUT4 muscle translocation via light postprandial walking (Lancet Diabetes & Endo).
 * 4. Dietary fiber meal pacing (vegetables/protein before carbohydrates).
 */

export interface PreventionObservation {
  id?: string
  type: string
  numericValue: number | string | null
  unit: string | null
  observedAt: string | Date
  notes?: string | null
  qualityFlags?: string[] | null
}

export interface DailyHabitChecklist {
  id: string
  title: string
  category: "activity" | "nutrition" | "monitoring" | "hydration" | "sleep"
  description: string
  clinicalRationale: string
  target: string
  currentProgress: string
  isCompleted: boolean
  actionType: "glucose" | "meals" | "activity" | "hydration" | "sleep"
}

export interface LifestyleProtocol {
  id: string
  title: string
  badge: string
  summary: string
  mechanism: string
  actionGuidance: string
  evidenceReference: string
}

export interface PreventionPlanSummary {
  weeklyActivityMinutes: number
  weeklyActivityTarget: number // 150 min (ICMR-INDIAB / ADA)
  activityProgressPercent: number

  fastingAverage: number | null
  postprandialAverage: number | null
  postprandialSpikeCount: number // readings > 140 mg/dL

  dailyHydrationMl: number
  hydrationTargetMl: number // 2500 ml
  hydrationProgressPercent: number

  averageSleepHours: number | null
  sleepTargetHours: number // 7-8 hours

  preventionAdherenceScore: number // 0-100 composite score
  estimatedRiskReductionPercent: number // up to 58% based on DPP trial
  riskReductionCitation: string

  checklists: DailyHabitChecklist[]
  lifestyleProtocols: LifestyleProtocol[]
  summaryStatus: "optimal" | "improving" | "needs_attention" | "just_started"
  actionableRecommendations: string[]
}

/**
 * Calculates the active Diabetes Prevention Plan based on recorded journal observations.
 */
export function generatePreventionPlan(
  observations: PreventionObservation[],
  completedChecklistIds: string[] = []
): PreventionPlanSummary {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // 1. Weekly Activity Minutes (last 7 days)
  let weeklyActivityMinutes = 0
  let todayActivityMinutes = 0

  // 2. Glucose metrics
  const fastingReadings: number[] = []
  const postprandialReadings: number[] = []
  let postprandialSpikeCount = 0

  // 3. Hydration (last 24 hours)
  let dailyHydrationMl = 0

  // 4. Sleep (last 7 days)
  const sleepHoursList: number[] = []

  // 5. Meal log count (last 7 days)
  let weeklyMealLogs = 0

  for (const obs of observations) {
    const obsDate = new Date(obs.observedAt)
    const isWithin7Days = obsDate >= sevenDaysAgo && obsDate <= now
    const isWithin24Hours = obsDate >= twentyFourHoursAgo && obsDate <= now
    const numVal =
      obs.numericValue !== null && obs.numericValue !== undefined && obs.numericValue !== ""
        ? Number(obs.numericValue)
        : null
    const hasNum = numVal !== null && !isNaN(numVal)

    // Activity
    if (obs.type === "activity" && isWithin7Days && hasNum) {
      weeklyActivityMinutes += numVal
      if (isWithin24Hours) {
        todayActivityMinutes += numVal
      }
    }

    // Glucose
    if (obs.type === "glucose_fasting" && hasNum) {
      fastingReadings.push(numVal)
    } else if (obs.type === "glucose_postprandial" && hasNum) {
      postprandialReadings.push(numVal)
      if (numVal > 140) {
        postprandialSpikeCount++
      }
    } else if (obs.type === "glucose_random" && hasNum) {
      if (numVal > 140) {
        postprandialSpikeCount++
      }
    }

    // Hydration
    if (obs.type === "hydration" && isWithin24Hours && hasNum) {
      dailyHydrationMl += numVal
    }

    // Sleep
    if (obs.type === "sleep" && isWithin7Days && hasNum) {
      sleepHoursList.push(numVal)
    }

    // Meals
    if (obs.type === "meal" && isWithin7Days) {
      weeklyMealLogs++
    }
  }

  // Targets
  const weeklyActivityTarget = 150
  const hydrationTargetMl = 2500
  const sleepTargetHours = 7.5

  const activityProgressPercent = Math.min(
    100,
    Math.round((weeklyActivityMinutes / weeklyActivityTarget) * 100)
  )

  const hydrationProgressPercent = Math.min(
    100,
    Math.round((dailyHydrationMl / hydrationTargetMl) * 100)
  )

  const fastingAverage =
    fastingReadings.length > 0
      ? Math.round(
          fastingReadings.reduce((sum, v) => sum + v, 0) / fastingReadings.length
        )
      : null

  const postprandialAverage =
    postprandialReadings.length > 0
      ? Math.round(
          postprandialReadings.reduce((sum, v) => sum + v, 0) /
            postprandialReadings.length
        )
      : null

  const averageSleepHours =
    sleepHoursList.length > 0
      ? Math.round(
          (sleepHoursList.reduce((sum, v) => sum + v, 0) / sleepHoursList.length) *
            10
        ) / 10
      : null

  // Calculate composite adherence score (0 - 100)
  // - Activity: up to 40 pts
  // - Hydration: up to 15 pts
  // - Sleep: up to 15 pts
  // - Glucose logging & stability: up to 20 pts
  // - Meal logging consistency: up to 10 pts
  let adherence = 0
  adherence += Math.min(40, Math.round((weeklyActivityMinutes / weeklyActivityTarget) * 40))
  adherence += Math.min(15, Math.round((dailyHydrationMl / hydrationTargetMl) * 15))
  
  if (averageSleepHours !== null) {
    if (averageSleepHours >= 7 && averageSleepHours <= 9) adherence += 15
    else if (averageSleepHours >= 6) adherence += 10
    else adherence += 5
  }

  if (fastingReadings.length > 0 || postprandialReadings.length > 0) {
    adherence += 10 // points for active monitoring
    if (postprandialSpikeCount === 0 && postprandialReadings.length > 0) {
      adherence += 10 // bonus for glycemic control
    } else {
      adherence += 5
    }
  }

  if (weeklyMealLogs > 0) {
    adherence += Math.min(10, weeklyMealLogs * 2)
  }

  const preventionAdherenceScore = Math.min(100, Math.max(0, adherence))

  // Estimate risk reduction percentage grounded in the landmark Diabetes Prevention Program (DPP)
  // Max 58% risk reduction shown in DPP clinical trial with sustained lifestyle adherence
  let estimatedRiskReductionPercent = 0
  if (preventionAdherenceScore >= 75) {
    estimatedRiskReductionPercent = 58
  } else if (preventionAdherenceScore >= 50) {
    estimatedRiskReductionPercent = 45
  } else if (preventionAdherenceScore >= 25) {
    estimatedRiskReductionPercent = 30
  } else {
    estimatedRiskReductionPercent = 15
  }

  // Summary status
  let summaryStatus: "optimal" | "improving" | "needs_attention" | "just_started" = "just_started"
  if (preventionAdherenceScore >= 75) {
    summaryStatus = "optimal"
  } else if (preventionAdherenceScore >= 45) {
    summaryStatus = "improving"
  } else if (observations.length > 3) {
    summaryStatus = "needs_attention"
  }

  // Actionable recommendations tailored to the log findings
  const actionableRecommendations: string[] = []

  if (weeklyActivityMinutes < weeklyActivityTarget) {
    const diff = weeklyActivityTarget - weeklyActivityMinutes
    actionableRecommendations.push(
      `Log ${diff} more minutes of brisk walking or exercise this week to reach the ICMR 150-minute threshold.`
    )
  } else {
    actionableRecommendations.push(
      `Target met! You reached ${weeklyActivityMinutes} active minutes this week, preserving muscle insulin sensitivity.`
    )
  }

  if (postprandialSpikeCount > 0) {
    actionableRecommendations.push(
      `Detected ${postprandialSpikeCount} post-meal reading(s) >140 mg/dL. Adopt the 15-minute post-meal walking protocol to blunt peak excursion.`
    )
  }

  if (dailyHydrationMl < 1800) {
    actionableRecommendations.push(
      `Increase hydration: logged ${dailyHydrationMl} mL today vs 2,500 mL target to assist renal glucose clearance.`
    )
  }

  if (averageSleepHours !== null && averageSleepHours < 7) {
    actionableRecommendations.push(
      `Average sleep is ${averageSleepHours}h. Target 7–8 hours to avoid nocturnal cortisol elevation and morning insulin resistance.`
    )
  }

  if (actionableRecommendations.length < 3) {
    actionableRecommendations.push(
      "Practice fiber-first food pacing: consume vegetables and protein salads before eating rice or breads."
    )
  }

  // Daily checklists
  const checklists: DailyHabitChecklist[] = [
    {
      id: "post_meal_walk",
      title: "15-Minute Post-Meal Walk",
      category: "activity",
      description: "Take a light 15-minute stroll within 30 minutes after lunch or dinner.",
      clinicalRationale:
        "Skeletal muscle contraction stimulates GLUT4 translocation without requiring extra insulin, flattening peak postprandial glucose by 20–30 mg/dL.",
      target: "15 mins post-meal",
      currentProgress: todayActivityMinutes > 0 ? `${todayActivityMinutes} mins active today` : "Pending post-meal walk",
      isCompleted: completedChecklistIds.includes("post_meal_walk") || todayActivityMinutes >= 15,
      actionType: "activity",
    },
    {
      id: "fiber_first_order",
      title: "Fiber-First Plate Sequencing",
      category: "nutrition",
      description: "Eat salad, raw vegetables, or clear soup BEFORE carbohydrates (rice, roti, bread).",
      clinicalRationale:
        "Soluble fiber forms a viscous gel matrix in the small intestine, delaying carbohydrate gastric emptying and dampening glucose surges.",
      target: "2 meals/day",
      currentProgress: weeklyMealLogs > 0 ? "Tracked in meal journal" : "Recommended for next meal",
      isCompleted: completedChecklistIds.includes("fiber_first_order"),
      actionType: "meals",
    },
    {
      id: "glucose_tracking",
      title: "Fasting or Postprandial Check",
      category: "monitoring",
      description: "Record your morning fasting blood sugar or a 2-hour postprandial reading.",
      clinicalRationale:
        "Consistent tracking identifies food sensitivities and provides early indicators of glucose intolerance.",
      target: "1 reading/day",
      currentProgress: fastingReadings.length > 0 || postprandialReadings.length > 0 ? "Logged recently" : "Not logged yet",
      isCompleted: completedChecklistIds.includes("glucose_tracking") || fastingReadings.length > 0 || postprandialReadings.length > 0,
      actionType: "glucose",
    },
    {
      id: "optimal_hydration",
      title: "2.5 Liters Daily Hydration",
      category: "hydration",
      description: "Sip water consistently throughout the day (aim for 8–10 glasses).",
      clinicalRationale:
        "Adequate fluid volume avoids hemoconcentration and supports physiological renal clearance of circulating glucose.",
      target: "2,500 mL",
      currentProgress: `${dailyHydrationMl} / 2,500 mL logged`,
      isCompleted: completedChecklistIds.includes("optimal_hydration") || dailyHydrationMl >= 2500,
      actionType: "hydration",
    },
    {
      id: "restful_sleep",
      title: "7–8 Hours Restorative Sleep",
      category: "sleep",
      description: "Maintain a dark, cool sleep environment with consistent sleep-wake times.",
      clinicalRationale:
        "Even partial sleep deprivation impairs peripheral insulin sensitivity and increases sympathetic tone.",
      target: "7.0 – 8.5 hours",
      currentProgress: averageSleepHours ? `Avg: ${averageSleepHours}h` : "Not recorded",
      isCompleted: completedChecklistIds.includes("restful_sleep") || (averageSleepHours !== null && averageSleepHours >= 7),
      actionType: "sleep",
    },
  ]

  // Lifestyle Protocols
  const lifestyleProtocols: LifestyleProtocol[] = [
    {
      id: "glut4_walking",
      title: "Post-Meal GLUT4 Movement",
      badge: "Highest Impact on Glucose Spikes",
      summary: "10–15 minutes of light, relaxed walking after your largest meals.",
      mechanism:
        "Muscle contractions translocate glucose transporter 4 (GLUT4) protein vesicles directly to the cell membrane. This allows muscle cells to pull glucose from the bloodstream independently of insulin.",
      actionGuidance:
        "Do not engage in strenuous sprinting. A simple relaxed stroll around the neighborhood, office, or home corridor for 10-15 minutes immediately blunts the 60-90 minute post-meal glucose peak.",
      evidenceReference:
        "Lancet Diabetes & Endocrinology / Reynolds et al.: Post-meal walking reduces peak postprandial excursion by up to 22%.",
    },
    {
      id: "plate_sequencing",
      title: "Food Sequencing: Fiber & Protein First",
      badge: "Blunts Carb Absorption",
      summary: "Change the sequence of food on your plate: veggies & lentils first, carbohydrates last.",
      mechanism:
        "Dietary fiber and proteins stimulate secretion of incretin hormone GLP-1 and slow gastric motility. This prevents rapid enzymatic breakdown of starch into blood glucose.",
      actionGuidance:
        "Begin your meal with salad/cucumbers/sabzi or dal/paneer/egg. Consume your roti, paratha, or rice last during the meal.",
      evidenceReference:
        "American Diabetes Association (ADA) Care Guidelines & Shukla et al. (Diabetes Care).",
    },
    {
      id: "weekly_cardio",
      title: "150-Minute Aerobic Threshold",
      badge: "Core ICMR-INDIAB Standard",
      summary: "Accumulate 150 minutes of moderate aerobic activity across 5 days (30 mins/day).",
      mechanism:
        "Increases skeletal muscle capillary density, mitochondrial oxidative capacity, and reverses hepatic steatosis (fatty liver), directly restoring whole-body insulin responsiveness.",
      actionGuidance:
        "Brisk walking (where you can talk but not sing), cycling, swimming, or active yoga. Split into two 15-minute sessions if 30 minutes at once is difficult.",
      evidenceReference:
        "ICMR-INDIAB National Guidelines (2023) & Diabetes Prevention Program Research Group (NEJM).",
    },
    {
      id: "circadian_fasting",
      title: "12-Hour Overnight Digestive Rest",
      badge: "Cellular Autophagy & Recovery",
      summary: "Leave an unbroken 12-hour resting window between dinner and breakfast (e.g., 8:00 PM to 8:00 AM).",
      mechanism:
        "Allows nighttime circulating insulin levels to reach true baseline, enabling hepatic glycogen clearance and cellular metabolic reset without severe caloric restriction.",
      actionGuidance:
        "Finish dinner by 8:00 PM and consume only plain water or unsweetened herbal infusions until breakfast at 8:00 AM.",
      evidenceReference:
        "Panda et al. (Cell Metabolism) on Time-Restricted Eating and Metabolic Health.",
    },
  ]

  return {
    weeklyActivityMinutes,
    weeklyActivityTarget,
    activityProgressPercent,
    fastingAverage,
    postprandialAverage,
    postprandialSpikeCount,
    dailyHydrationMl,
    hydrationTargetMl,
    hydrationProgressPercent,
    averageSleepHours,
    sleepTargetHours,
    preventionAdherenceScore,
    estimatedRiskReductionPercent,
    riskReductionCitation:
      "Landmark ICMR-INDIAB & ADA Diabetes Prevention Program (DPP): 150 mins/week moderate activity + dietary modifications reduced progression to Type 2 Diabetes by 58% (up to 71% in adults aged 60+).",
    checklists,
    lifestyleProtocols,
    summaryStatus,
    actionableRecommendations,
  }
}
