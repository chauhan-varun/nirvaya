"use client"

import { useSyncExternalStore } from "react"
import {
  defaultLocale,
  languageStorageKey,
  resolveLocale,
  type Locale,
} from "./languages"

const preferenceEvent = "carebridge:language-change"
let memoryPreference: Locale = defaultLocale
let storageUnavailable = false

function getSnapshot(): Locale {
  if (storageUnavailable) return memoryPreference
  try {
    return resolveLocale(window.localStorage.getItem(languageStorageKey))
  } catch {
    return memoryPreference
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === languageStorageKey || event.key === null) onChange()
  }
  window.addEventListener("storage", onStorage)
  window.addEventListener(preferenceEvent, onChange)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(preferenceEvent, onChange)
  }
}

function setLanguagePreference(locale: Locale) {
  memoryPreference = resolveLocale(locale)
  try {
    window.localStorage.setItem(languageStorageKey, memoryPreference)
    storageUnavailable = false
  } catch {
    // A blocked/full storage area must not prevent this session's selection.
    storageUnavailable = true
  }
  window.dispatchEvent(new Event(preferenceEvent))
}

export function useLanguagePreference() {
  const locale = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => defaultLocale
  )
  return { locale, setLocale: setLanguagePreference }
}
