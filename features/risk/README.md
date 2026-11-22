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
- **UI**: `features/risk/components/risk-dashboard.tsx`
- **Route**: `app/(private)/risk/page.tsx`
- **Tests**: `tests/risk/risk-router.test.ts` (deterministic scoring, reference cases, prior diagnosis exclusion, non-onboarded rejection, audit logging)

## Clinical & Safety Boundaries
- Explicitly distinguishes screening from medical diagnosis.
- Prior diagnosed users are excluded from prevention screening calculation.
- Never gives dosing or drug advice.
- High/moderate risk indicates laboratory blood testing (fasting glucose / HbA1c) by a licensed clinician.
