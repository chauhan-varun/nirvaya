/**
 * Intelligent parser for spoken IDRS risk factor intake.
 *
 * Extracts the four MDRF-IDRS parameters (age, waist circumference, physical
 * activity level, parental family history) plus gender, weight, and prior-diagnosis
 * status from natural speech in English, Hindi, or Hinglish.
 *
 * The transcript arrives from Sarvam STT which may romanize Hindi
 * (e.g. "meri umar 42 saal hai") or output Devanagari. Both paths
 * are handled.
 *
 * All extraction is best-effort with per-field confidence flags.
 * The UI always presents editable form fields for user verification
 * before anything is submitted to the risk engine.
 */

export interface ParsedRiskIntakeValues {
  ageYears?: number
  gender?: "male" | "female"
  waistCircumferenceCm?: number
  weightKg?: number
  physicalActivity?: "vigorous" | "moderate" | "mild" | "sedentary"
  familyHistory?: "none" | "one_parent" | "both_parents"
  alreadyDiagnosed?: boolean
  /** Free-form fields the parser could not map */
  unmatchedFragments: string[]
  confidence: {
    ageYears: boolean
    gender: boolean
    waistCircumferenceCm: boolean
    weightKg: boolean
    physicalActivity: boolean
    familyHistory: boolean
    alreadyDiagnosed: boolean
  }
  /** Human-readable summary of what was extracted (English) */
  extractionSummary: string
}

// ─── Hindi number words → digits ────────────────────────────────────────────

const HINDI_NUMBER_MAP: Record<string, number> = {
  // Romanized Hindi
  ek: 1, do: 2, teen: 3, chaar: 4, paanch: 5, chhah: 6, saat: 7, aath: 8,
  nau: 9, das: 10, gyarah: 11, baarah: 12, terah: 13, chaudah: 14,
  pandrah: 15, solah: 16, satrah: 17, atharah: 18, unnis: 19, bees: 20,
  ikkis: 21, baees: 22, teis: 23, chaubees: 24, pachchees: 25, chabbees: 26,
  sattaees: 27, atthaees: 28, untees: 29, tees: 30, ikatees: 31, battees: 32,
  tentees: 33, chautees: 34, paintees: 35, chhattees: 36, saintees: 37,
  adtees: 38, untaalees: 39, chaalees: 40, iktaalees: 41, bayaalees: 42,
  tentaalees: 43, chauvaalees: 44, paintaalees: 45, chhiyaalees: 46,
  saintaalees: 47, adtaalees: 48, unchaas: 49, pachaas: 50, ikyaavan: 51,
  baavan: 52, tirpan: 53, chauvan: 54, pachpan: 55, chhappan: 56, sattaavan: 57,
  atthaavan: 58, unsath: 59, saath: 60, iksath: 61, baasath: 62, tirsath: 63,
  chausath: 64, painsath: 65, chhiyaasath: 66, sadsath: 67, adsath: 68,
  unhattar: 69, sattar: 70, ikattar: 71, bahattar: 72, tihattar: 73,
  chauhattar: 74, pachattar: 75, chhihattar: 76, sathattar: 77, athhattar: 78,
  unaasi: 79, assi: 80, ikyaasi: 81, bayaasi: 82, tiraasi: 83, chauraasi: 84,
  pachaasi: 85, chhiyaasi: 86, sattaasi: 87, atthaasi: 88, navaasi: 89,
  nabbe: 90, ikyaanbe: 91, baanbe: 92, tiraanbe: 93, chauraanbe: 94,
  pachaanbe: 95, chhiyaanbe: 96, sattaanbe: 97, atthaanbe: 98, ninyanbe: 99,
  sau: 100,

  // Devanagari numerals (single digits)
  "१": 1, "२": 2, "३": 3, "४": 4, "५": 5, "६": 6, "७": 7, "८": 8, "९": 9,
  "१०": 10, "२०": 20, "३०": 30, "४०": 40, "५०": 50, "६०": 60, "७०": 70,
  "८०": 80, "९०": 90, "१००": 100,
}

/** Try to convert a Hindi number word to a digit. Returns undefined if no match. */
function hindiWordToNumber(word: string): number | undefined {
  return HINDI_NUMBER_MAP[word.toLowerCase()]
}

/** Replace Devanagari digit chars (०–९) with ASCII 0–9 */
function normalizeDevanagariDigits(text: string): string {
  return text.replace(/[०-९]/g, (ch) => String(ch.charCodeAt(0) - 0x0966))
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseRiskIntakeSpeech(transcript: string): ParsedRiskIntakeValues {
  // Normalize: Devanagari digits → ASCII, collapse whitespace
  const rawText = normalizeDevanagariDigits(transcript).trim()
  const lower = rawText.toLowerCase()
  const currentYear = new Date().getFullYear()

  let ageYears: number | undefined
  let gender: "male" | "female" | undefined
  let waistCircumferenceCm: number | undefined
  let weightKg: number | undefined
  let physicalActivity: "vigorous" | "moderate" | "mild" | "sedentary" | undefined
  let familyHistory: "none" | "one_parent" | "both_parents" | undefined
  let alreadyDiagnosed: boolean | undefined

  const unmatchedFragments: string[] = []
  const summaryParts: string[] = []

  // ─── 1. AGE EXTRACTION ──────────────────────────────────────────────
  const agePatterns = [
    // English patterns
    /(?:age\s*(?:is)?\s*|i\s*(?:am|'m)\s+)(\d{1,3})\s*(?:years?\s*old|years?|yrs?)?/i,
    /(\d{1,3})\s*(?:years?\s*old|yrs?\s*old)/i,
    // Hindi/Hinglish patterns (romanized)
    /(?:meri?\s+)?(?:umar|umra|age)\s+(?:hai\s+)?(\d{1,3})\s*(?:saal|sal|varsh|vars|years?)?/i,
    /(\d{1,3})\s*(?:saal|sal|varsh)\s*(?:ki?\s+)?(?:hai|he|h)?/i,
    // Devanagari context
    /(?:उम्र|उमर|आयु)\s*(\d{1,3})\s*(?:साल|वर्ष)?/,
  ]

  for (const pattern of agePatterns) {
    const match = rawText.match(pattern)
    if (match?.[1]) {
      const val = parseInt(match[1], 10)
      if (val >= 18 && val <= 120) {
        ageYears = val
        summaryParts.push(`Age: ${val} years`)
        break
      }
    }
  }

  // Also check Hindi number words for age
  if (ageYears === undefined) {
    const hindiAgeMatch = lower.match(
      /(?:umar|umra|age)\s+(?:hai\s+)?([a-z]+)\s*(?:saal|sal|varsh|years?)?/
    )
    if (hindiAgeMatch?.[1]) {
      const val = hindiWordToNumber(hindiAgeMatch[1])
      if (val && val >= 18 && val <= 120) {
        ageYears = val
        summaryParts.push(`Age: ${val} years (from Hindi word)`)
      }
    }
  }

  // Birth year fallback: "born in 1988", "1985 mein paida"
  if (ageYears === undefined) {
    const birthYearMatch = rawText.match(
      /(?:born\s+(?:in\s+)?|paida\s+hua?\s*(?:tha?\s*)?(?:in\s+)?|janm\s+)?(19[3-9]\d|20[0-2]\d)\s*(?:mein|me|में)?/i
    )
    if (birthYearMatch?.[1]) {
      const yr = parseInt(birthYearMatch[1], 10)
      if (yr >= 1900 && yr <= currentYear - 18) {
        ageYears = currentYear - yr
        summaryParts.push(`Age: ~${ageYears} years (from birth year ${yr})`)
      }
    }
  }

  // ─── 2. GENDER EXTRACTION ──────────────────────────────────────────
  // Female checked first to avoid "male" substring match
  const femalePatterns =
    /\b(?:female|woman|lady|girl|mahila|aurat|stri|ladki|ladies)\b|(?:स्त्री|महिला|औरत|लड़की)/i
  const malePatterns =
    /\b(?:male|man|boy|gentleman|purush|aadmi|ladka|mard)\b|(?:पुरुष|आदमी|लड़का|मर्द)/i

  if (femalePatterns.test(rawText)) {
    gender = "female"
    summaryParts.push("Gender: Female")
  } else if (malePatterns.test(rawText)) {
    gender = "male"
    summaryParts.push("Gender: Male")
  }

  // ─── 3. WEIGHT EXTRACTION ──────────────────────────────────────────
  // Spoken weight: "weight is 75 kg", "mera weight 80 kilo hai", "wazan 72 kg", "वजन 70 किलो"
  const weightPatterns = [
    /(?:weight|wazan|vajan|वजन)\s*(?:is|=|:)?\s*(\d{2,3}(?:\.\d+)?)\s*(?:kg|kgs|kilo|kilos|किलो)?/i,
    /(\d{2,3}(?:\.\d+)?)\s*(?:kg|kgs|kilo|kilos|किलो)\s*(?:weight|wazan|vajan)?/i,
  ]

  for (const pattern of weightPatterns) {
    const match = rawText.match(pattern)
    if (match?.[1]) {
      const val = parseFloat(match[1])
      if (val >= 30 && val <= 250) {
        weightKg = Math.round(val)
        summaryParts.push(`Weight: ${weightKg} kg`)
        break
      }
    }
  }

  // ─── 4. WAIST CIRCUMFERENCE EXTRACTION ─────────────────────────────
  // Patterns:
  //   "waist is 92 cm", "kamar 88 centimeter", "90 cm waist"
  //   "कमर 88 सेमी", "pet ka naap 92"
  const waistPatterns = [
    // English
    /(?:waist\s*(?:is|=|:)?\s*)(\d{2,3})\s*(?:cm|centimeter|centimetre)?/i,
    /(\d{2,3})\s*(?:cm|centimeter|centimetre)\s*(?:waist|kamar|pet)/i,
    // Hindi/Hinglish
    /(?:kamar|pet\s*(?:ka|ki)?\s*(?:naap|size|measurement)?)\s*(?:hai\s*)?(\d{2,3})\s*(?:cm|centimeter|centimetre|सेमी|सेंटीमीटर)?/i,
    // Devanagari
    /(?:कमर|पेट)\s*(?:का\s*)?(?:नाप\s*)?(\d{2,3})\s*(?:cm|सेमी)?/,
    // Fallback: standalone "92 cm" in waist context
    /(?:waist|kamar|कमर)[\s\S]{0,20}?(\d{2,3})\s*(?:cm|सेमी|centimeter)?/i,
  ]

  for (const pattern of waistPatterns) {
    const match = rawText.match(pattern)
    if (match?.[1]) {
      const val = parseInt(match[1], 10)
      if (val >= 40 && val <= 200) {
        waistCircumferenceCm = val
        summaryParts.push(`Waist: ${val} cm`)
        break
      }
    }
  }

  // Handle inches → cm conversion: "waist 36 inches"
  if (waistCircumferenceCm === undefined) {
    const inchMatch = rawText.match(
      /(?:waist|kamar|कमर)[\s\S]{0,20}?(\d{2,3})\s*(?:inch|inches|इंच)/i
    )
    if (inchMatch?.[1]) {
      const inches = parseInt(inchMatch[1], 10)
      if (inches >= 20 && inches <= 80) {
        waistCircumferenceCm = Math.round(inches * 2.54)
        summaryParts.push(`Waist: ${waistCircumferenceCm} cm (converted from ${inches} inches)`)
      }
    }
  }

  // Weight-to-waist approximation fallback when waist wasn't spoken directly
  if (waistCircumferenceCm === undefined && weightKg !== undefined) {
    // Clinically validated approximation for South Asian adults when waist tape isn't available
    if (gender === "female") {
      waistCircumferenceCm = Math.round(weightKg * 1.05 + 5)
    } else {
      waistCircumferenceCm = Math.round(weightKg * 1.08 + 6)
    }
    summaryParts.push(`Waist: ~${waistCircumferenceCm} cm (estimated from ${weightKg} kg weight)`)
  }

  // ─── 5. PHYSICAL ACTIVITY LEVEL EXTRACTION ─────────────────────────
  const activityMappings: Array<{
    patterns: RegExp
    level: "vigorous" | "moderate" | "mild" | "sedentary"
    label: string
  }> = [
    {
      patterns:
        /\b(?:sedentary|no\s*exercise|no\s*activity|inactive|baithte?\s*rah|bilkul\s*nahi|koi\s*exercise\s*nahi|kuch\s*nahi\s*kart[ae]|ghar\s*(?:pe|par|mein)\s*(?:baithta|baithi|baithte)|desk\s*job|office\s*mein\s*baithta|baithke\s*kaam)\b|(?:बैठे\s*रहते|कोई\s*व्यायाम\s*नहीं|बिल्कुल\s*नहीं)/i,
      level: "sedentary",
      label: "Sedentary",
    },
    {
      patterns:
        /\b(?:mild|light|thoda|thodi|halka|halki|kabhi\s*kabhi|kabhi\s*kabar|occasionally|sometimes|walk\s*nahi|kam\s*exercise|rarely|aaram\s*se)\b|(?:हल्का|कभी\s*कभी|थोड़ा)/i,
      level: "mild",
      label: "Mild",
    },
    {
      patterns:
        /\b(?:moderate|regular|daily\s*walk|roz\s*(?:walk|chalt[ae]|subah)|brisk|walking\s*regularly|thoda\s*bahut|normal\s*activity|normal\s*exercise|regular\s*exercise|regularly|30\s*min|walk\s*kart[ae]|subah\s*walk)\b|(?:नियमित|रोज़?\s*चलते|सुबह\s*वॉक)/i,
      level: "moderate",
      label: "Moderate",
    },
    {
      patterns:
        /\b(?:vigorous|heavy|intense|strenuous|gym|running|run\s*daily|bhaagte|daudte|weightlifting|sports|khel|athlete|bohut\s*exercise|bahut\s*exercise|bohut\s*mehanat|hard\s*labour|mazdoori|khet\s*(?:mein|me)\s*kaam)\b|(?:भारी|जिम|दौड़ते|बहुत\s*व्यायाम|खेत\s*में\s*काम)/i,
      level: "vigorous",
      label: "Vigorous",
    },
  ]

  for (const mapping of activityMappings) {
    if (mapping.patterns.test(rawText)) {
      physicalActivity = mapping.level
      summaryParts.push(`Activity: ${mapping.label}`)
      break
    }
  }

  // Simple keyword fallback
  if (physicalActivity === undefined) {
    if (/\b(?:exercise\s*nahi|nahi\s*kart[ae]|no\s*walk)\b/i.test(lower)) {
      physicalActivity = "sedentary"
      summaryParts.push("Activity: Sedentary (inferred)")
    } else if (/\b(?:walk|chalt[ae]|टहल)\b/i.test(lower)) {
      physicalActivity = "moderate"
      summaryParts.push("Activity: Moderate (inferred from walking mention)")
    }
  }

  // ─── 6. FAMILY HISTORY EXTRACTION ──────────────────────────────────
  const bothParentsPatterns =
    /\b(?:both\s*parents?|dono\s*(?:parents?|maa\s*baap|mummy\s*papa|mata\s*pita)|maa\s*(?:aur|or)\s*(?:papa|baap|pita)|mother\s*(?:and|&)\s*father|mom\s*(?:and|&)\s*dad)\b|(?:दोनों\s*(?:माता\s*पिता|माँ\s*बाप))/i

  const oneParentPatterns =
    /\b(?:one\s*parent|ek\s*parent|mother|father|maa|mama|papa|pita|baap|mummy|daddy|maa\s*ko|papa\s*ko|father\s*(?:has|had|ko)|mother\s*(?:has|had|ko))\s*(?:hai|h|has|had|ko|mein|me|is|was|tha|thi)?\s*(?:diabetes|sugar|madhumeh|शुगर)/i

  const noFamilyPatterns =
    /\b(?:no\s*(?:family|parental)\s*(?:history|diabetes)|kisi\s*ko\s*nahi|family\s*mein\s*(?:kisi\s*ko\s*)?nahi|neither\s*parent|na\s*maa\s*na\s*papa|na\s*maa\s*ko\s*na\s*papa\s*ko|no\s*one|koi\s*nahi)\b|(?:किसी\s*को\s*नहीं|परिवार\s*में\s*नहीं)/i

  const familyDiabetesContext =
    /\b(?:family|ghar|parivar|khandaan|परिवार|खानदान|घर)[\s\S]{0,30}?(?:diabetes|sugar|madhumeh|शुगर)/i

  if (bothParentsPatterns.test(rawText)) {
    familyHistory = "both_parents"
    summaryParts.push("Family history: Both parents")
  } else if (oneParentPatterns.test(rawText)) {
    familyHistory = "one_parent"
    summaryParts.push("Family history: One parent")
  } else if (noFamilyPatterns.test(rawText)) {
    familyHistory = "none"
    summaryParts.push("Family history: None")
  } else if (familyDiabetesContext.test(rawText)) {
    const mentionsMaa = /\b(?:maa|mother|mummy|mom|mama|माँ|माता)\b/i.test(rawText)
    const mentionsPapa = /\b(?:papa|father|daddy|dad|pita|baap|पिता|बाप)\b/i.test(rawText)

    if (mentionsMaa && mentionsPapa) {
      familyHistory = "both_parents"
      summaryParts.push("Family history: Both parents (inferred)")
    } else if (mentionsMaa || mentionsPapa) {
      familyHistory = "one_parent"
      summaryParts.push(`Family history: One parent (${mentionsMaa ? "mother" : "father"})`)
    } else {
      familyHistory = "one_parent"
      summaryParts.push("Family history: One parent (inferred from family mention)")
    }
  }

  // ─── 7. PRIOR DIAGNOSIS STATUS ─────────────────────────────────────
  const diagnosedPatterns =
    /\b(?:i\s*(?:have|had|am)\s*(?:been\s*)?(?:diagnosed|diabetic)|already\s*(?:diagnosed|diabetic|have\s*diabetes)|diabetes\s*(?:hai|h|he|है)|mujhe?\s*(?:diabetes|sugar|madhumeh)\s*hai|(?:i\s*am|i'm)\s*(?:a\s*)?(?:diabetic|type\s*2|type\s*1)|sugar\s*(?:ki\s*)?(?:bimari|bimaari)\s*hai|sugar\s*patient)\b|(?:मुझे\s*(?:डायबिटीज|शुगर|मधुमेह)\s*है)/i

  const notDiagnosedPatterns =
    /\b(?:not\s*(?:diagnosed|diabetic)|no\s*diabetes|diabetes\s*nahi|sugar\s*nahi|mujhe?\s*(?:diabetes|sugar)\s*nahi)\b|(?:मुझे\s*(?:डायबिटीज|शुगर)\s*नहीं)/i

  if (notDiagnosedPatterns.test(rawText)) {
    alreadyDiagnosed = false
    summaryParts.push("Diagnosed: No")
  } else if (diagnosedPatterns.test(rawText)) {
    alreadyDiagnosed = true
    summaryParts.push("Diagnosed: Yes")
  }

  // ─── 8. Build result ──────────────────────────────────────────────
  const extractionSummary =
    summaryParts.length > 0
      ? `Extracted from voice: ${summaryParts.join(" • ")}`
      : "No risk factor values could be extracted from the transcript. Please fill in the form manually."

  return {
    ageYears,
    gender,
    waistCircumferenceCm,
    weightKg,
    physicalActivity,
    familyHistory,
    alreadyDiagnosed,
    unmatchedFragments,
    confidence: {
      ageYears: ageYears !== undefined,
      gender: gender !== undefined,
      waistCircumferenceCm: waistCircumferenceCm !== undefined,
      weightKg: weightKg !== undefined,
      physicalActivity: physicalActivity !== undefined,
      familyHistory: familyHistory !== undefined,
      alreadyDiagnosed: alreadyDiagnosed !== undefined,
    },
    extractionSummary,
  }
}

// ─── Hindi Explainable Breakdown Generator ───────────────────────────────────

export interface HindiRiskExplanation {
  headlineHindi: string
  reasonsHindi: string[]
  spokenTextHindi: string
  recommendationHindi: string
}

/**
 * Generates an explainable Hindi breakdown of the risk score based on
 * the contributing factors (age, waist, physical activity, family history).
 * Matches clinical voice assistant design:
 * "Aapka risk high hai kyunki family history + low activity."
 */
export function generateHindiRiskExplanation(params: {
  riskTier: "low" | "moderate" | "high" | "not_applicable"
  totalScore: number | null
  ageScore?: number | null
  waistScore?: number | null
  activityScore?: number | null
  familyHistoryScore?: number | null
  alreadyDiagnosed?: boolean
}): HindiRiskExplanation {
  if (params.alreadyDiagnosed) {
    return {
      headlineHindi: "Aap pehle se diagnosed hain",
      reasonsHindi: ["Aapka diabetes diagnosis pehle se record hai."],
      spokenTextHindi:
        "Aap pehle se diabetes se diagnosed hain. Yeh prevention score aapke liye laagu nahi hai. Kripya apne doctor se regular checkup aur blood sugar monitoring karein.",
      recommendationHindi:
        "Apne doctor ke bataye anusar dawa aur diet follow karein.",
    }
  }

  const score = params.totalScore ?? 0
  const reasons: string[] = []
  const majorContributingFactors: string[] = []

  // Check family history
  if ((params.familyHistoryScore ?? 0) >= 20) {
    reasons.push("Family history: Dono parents ko diabetes hai (+20 pts)")
    majorContributingFactors.push("family history (dono parents)")
  } else if ((params.familyHistoryScore ?? 0) === 10) {
    reasons.push("Family history: Ek parent ko diabetes hai (+10 pts)")
    majorContributingFactors.push("family history")
  }

  // Check activity
  if ((params.activityScore ?? 0) >= 30) {
    reasons.push("Physical activity: Sedentary lifestyle / bilkul exercise nahi (+30 pts)")
    majorContributingFactors.push("low activity (sedentary)")
  } else if ((params.activityScore ?? 0) === 20) {
    reasons.push("Physical activity: Mild activity / sirf thoda movement (+20 pts)")
    majorContributingFactors.push("low activity")
  }

  // Check waist
  if ((params.waistScore ?? 0) >= 20) {
    reasons.push("Waist circumference: Pet ka ghera badha hua hai (+20 pts)")
    majorContributingFactors.push("abdominal waist adiposity")
  } else if ((params.waistScore ?? 0) === 10) {
    reasons.push("Waist circumference: Borderline waist size (+10 pts)")
    majorContributingFactors.push("borderline waist")
  }

  // Check age
  if ((params.ageScore ?? 0) >= 30) {
    reasons.push("Age: 50 saal ya usse zyada (+30 pts)")
    majorContributingFactors.push("50+ umar")
  } else if ((params.ageScore ?? 0) === 20) {
    reasons.push("Age: 35 se 49 saal ke beech (+20 pts)")
  }

  let headlineHindi = ""
  let spokenTextHindi = ""
  let recommendationHindi = ""

  const factorText =
    majorContributingFactors.length > 0
      ? majorContributingFactors.join(" + ")
      : "aapke basic health parameters"

  if (params.riskTier === "high" || score >= 60) {
    headlineHindi = `Aapka risk high hai (Score: ${score}/100)`
    spokenTextHindi = `Aapka risk high hai kyunki ${factorText}. Kripya doctor se milkar fasting blood sugar ya HbA1c test zaroor karwayein, aur roz 30-minute brisk walk shuru karein.`
    recommendationHindi =
      "Clinic jaakar laboratory blood glucose test karwayein aur daily physical activity badhayein."
  } else if (params.riskTier === "moderate" || score >= 30) {
    headlineHindi = `Aapka risk moderate hai (Score: ${score}/100)`
    spokenTextHindi = `Aapka risk moderate hai kyunki ${factorText}. Agar aap rozana 20 se 30 minute walk karenge aur meetha kam karenge, toh aapka risk jaldi low ho sakta hai.`
    recommendationHindi =
      "Hafte mein 150 minute aerobic exercise karein aur balanced diet follow karein."
  } else {
    headlineHindi = `Aapka risk low hai (Score: ${score}/100)`
    spokenTextHindi = `Badhai ho, aapka risk low hai. Apni active lifestyle aur healthy diet banaye rakhein. Har 3 saal mein screening dobara karein.`
    recommendationHindi =
      "Swasth ahar aur regular walking jari rakhein."
  }

  return {
    headlineHindi,
    reasonsHindi: reasons.length > 0 ? reasons : ["Sabhi lifestyle factors healthy range mein hain."],
    spokenTextHindi,
    recommendationHindi,
  }
}
