# Explainable screening and risk factors (Task 4)

## Current state
IMPLEMENTED.
Clinically validated Indian Diabetes Risk Score (MDRF-IDRS; Mohan et al., JAPI 2005) deterministic engine, immutable historical snapshot persistence, factor modifiability breakdown, prior diagnosis exclusion pathway, and tRPC endpoints.

## Instrument Specification
- **Instrument**: MDRF Indian Diabetes Risk Score (IDRS)
- **Version**: 2005.1
- **Target Population**: Adults aged 18+ of South Asian / Indian heritage
- **Reference**: Mohan V, Deepa R, Deepa M, Somannavar S, Datta M. A Simplified Indian Diabetes Risk Score for Screening for Undiagnosed Diabetic Subjects. *J Assoc Physicians India*. 2005; 53: 759-763.
- **Parameters**:
  1. Age (<35: 0, 35–49: 20, ≥50: 30)
  2. Waist circumference (Females <80: 0, 80–89: 10, ≥90: 20; Males <85: 0, 85–99: 10, ≥100: 20)
  3. Physical activity (vigorous: 0, moderate: 10, mild: 20, sedentary: 30)
  4. Parental history of diabetes (none: 0, one parent: 10, both parents: 20)
- **Cutoffs**:
  - Score < 30: Low risk
  - Score 30–59: Moderate risk
  - Score ≥ 60: High risk

## Implementation details
- **Schema**: `server/db/schema/risk.ts` (`risk_assessments` table with composite foreign key to `patients(tenant_id, id)`)
- **Repository**: `server/db/repositories/risk.ts` (`calculateIDRS`, `saveRiskAssessmentAtomic`, `getLatestRiskAssessment`, `getRiskAssessmentHistory`)
- **Router**: `server/trpc/routers/risk.ts` (`risk.evaluatePreview`, `risk.latest`, `risk.history`, `risk.assess`)
- **UI**: `features/risk/components/risk-dashboard.tsx`, `features/risk/components/voice-risk-intake.tsx`
- **Voice Intake & NLP Parser**: `lib/voice/risk-intake-parser.ts` (extracts age, gender, waist, weight, activity level, family history from Hindi, English, and Hinglish speech; generates explainable Hindi breakdown `generateHindiRiskExplanation`)
- **Speech Synthesis**: `lib/voice/speech-synthesis.ts` (Web Speech API integration for Hindi voice prompt and spoken risk explanation)
- **Route**: `app/(private)/risk/page.tsx`
- **Tests**: `tests/risk/risk-router.test.ts`, `tests/voice/risk-intake-parser.test.ts`

## Clinical & Safety Boundaries
- Explicitly distinguishes screening from medical diagnosis.
- Prior diagnosed users are excluded from prevention screening calculation.
- Never gives dosing or drug advice.
- High/moderate risk indicates laboratory blood testing (fasting glucose / HbA1c) by a licensed clinician.
