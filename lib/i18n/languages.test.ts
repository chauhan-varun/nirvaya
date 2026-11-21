import { describe, expect, it } from "vitest"
import {
  defaultLocale,
  getContentLocale,
  isLocale,
  languages,
  resolveLocale,
} from "./languages"

describe("English-first language registry", () => {
  it("defaults to English and includes all 22 scheduled Indian languages", () => {
    expect(defaultLocale).toBe("en")
    expect(languages).toHaveLength(23)
    expect(languages.map(({ code }) => code).sort()).toEqual(
      [
        "en",
        "as",
        "bn",
        "brx",
        "doi",
        "gu",
        "hi",
        "kn",
        "ks",
        "kok",
        "mai",
        "ml",
        "mni",
        "mr",
        "ne",
        "or",
        "pa",
        "sa",
        "sat",
        "sd",
        "ta",
        "te",
        "ur",
      ].sort()
    )
    expect(new Set(languages.map(({ code }) => code)).size).toBe(23)
  })

  it("validates stored preferences rather than trusting arbitrary values", () => {
    for (const { code } of languages) {
      expect(isLocale(code)).toBe(true)
      expect(resolveLocale(code)).toBe(code)
    }
    for (const invalid of [
      undefined,
      null,
      "",
      "unknown",
      "EN",
      "constructor",
      1,
      {},
    ]) {
      expect(isLocale(invalid)).toBe(false)
      expect(resolveLocale(invalid)).toBe("en")
    }
  })

  it("does not label unavailable translations as translated content", () => {
    for (const { code } of languages) expect(getContentLocale(code)).toBe("en")
  })
})
