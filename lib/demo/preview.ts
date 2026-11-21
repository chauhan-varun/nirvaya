// Public, synthetic UI fixtures. Never import real patient records into this module.
export const previewSections = [
  {
    slug: "onboarding",
    label: "Getting started",
    english: "Voice onboarding",
    description: "A simpler first conversation, in your own language.",
  },
  {
    slug: "risk",
    label: "Understand your risk",
    english: "Risk & insights",
    description:
      "Understand the factors. Know what to discuss with a clinician.",
  },
  {
    slug: "daily-log",
    label: "Everyday care",
    english: "Daily journal",
    description:
      "One gentle routine for meals, movement, sleep, and medicines.",
  },
  {
    slug: "care-circle",
    label: "Support from your circle",
    english: "Care circle",
    description: "Support that starts with your permission.",
  },
  {
    slug: "devices",
    label: "Your environment",
    english: "Connected station",
    description: "Privacy-first context from your everyday environment.",
  },
  {
    slug: "clinic",
    label: "Care-team desk",
    english: "Clinic workspace",
    description: "A focused follow-up workspace for care teams.",
  },
] as const
export type PreviewSection = (typeof previewSections)[number]["slug"]

export const demoHabits = [
  {
    title: "A little movement, a little better",
    detail: "Movement · illustrative 10-minute walk",
    progress: 50,
    value: "5 / 10 min",
  },
  {
    title: "A little balance on your plate",
    detail: "Meals · illustrative journal entries",
    progress: 66,
    value: "2 / 3 entries",
  },
  {
    title: "Make time for a pause",
    detail: "Rest · illustrative evening check-in",
    progress: 0,
    value: "Not checked in",
  },
] as const
