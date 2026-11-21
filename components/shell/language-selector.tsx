"use client"

import { useId } from "react"
import { Languages } from "lucide-react"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { languages, resolveLocale } from "@/lib/i18n/languages"
import { useLanguagePreference } from "@/lib/i18n/use-language-preference"

export function LanguageSelector() {
  const id = useId()
  const { locale, setLocale } = useLanguagePreference()
  const selected = languages.find(({ code }) => code === locale)!

  return (
    <div className="w-full max-w-56 text-left sm:w-52">
      <label
        htmlFor={id}
        className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
      >
        <Languages className="size-3.5" aria-hidden="true" /> Language
        preference
      </label>
      <NativeSelect
        className="w-full bg-card"
        id={id}
        value={locale}
        aria-describedby={`${id}-status`}
        onChange={(event) => setLocale(resolveLocale(event.target.value))}
      >
        {languages.map(({ code, name }) => (
          <NativeSelectOption key={code} value={code}>
            {name}
            {code === "en" ? " (default)" : ""}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <p
        id={`${id}-status`}
        role="status"
        className="mt-1 text-[10px] leading-relaxed text-muted-foreground"
      >
        {locale === "en"
          ? "English content. Other translations on request."
          : `${selected.name} selected. Translation is not connected; content remains English.`}
      </p>
    </div>
  )
}
