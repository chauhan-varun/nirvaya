"use client"

import { useId } from "react"
import { Languages } from "lucide-react"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { languages, resolveLocale } from "@/lib/i18n/languages"
import { useLanguagePreference } from "@/lib/i18n/use-language-preference"
import { cn } from "@/lib/utils"

export function LanguageSelector({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
} = {}) {
  const id = useId()
  const { locale, setLocale } = useLanguagePreference()
  const selected = languages.find(({ code }) => code === locale)!

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center rounded-full border border-border/70 bg-muted/30 hover:bg-muted/60 pl-2.5 pr-1 h-8 transition-colors",
          className
        )}
      >
        <Languages
          className="size-3.5 shrink-0 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <NativeSelect
          id={id}
          size="sm"
          value={locale}
          aria-label="Language preference"
          aria-describedby={`${id}-status`}
          className="border-0 bg-transparent p-0 shadow-none w-auto"
          selectClassName="border-0 bg-transparent shadow-none dark:bg-transparent dark:hover:bg-transparent h-7 py-0 pl-1.5 pr-6 text-xs font-medium focus-visible:ring-0 focus:outline-none cursor-pointer w-auto min-w-[75px]"
          onChange={(event) => setLocale(resolveLocale(event.target.value))}
        >
          {languages.map(({ code, name }) => (
            <NativeSelectOption key={code} value={code}>
              {name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span id={`${id}-status`} className="sr-only">
          {locale === "en"
            ? "English content. Other translations on request."
            : `${selected.name} selected. Translation is not connected; content remains English.`}
        </span>
      </div>
    )
  }

  return (
    <div className={cn("w-full max-w-56 text-left sm:w-52", className)}>
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
