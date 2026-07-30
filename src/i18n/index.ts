/**
 * The i18n seam: the locale type, the dictionary contract, the context, and the two
 * hooks components use. Nothing outside this folder knows how `t` is produced, so
 * swapping in a real i18n library later touches only `I18nProvider`.
 */

import { createContext, useContext, useMemo } from 'react'
import { formatEuros } from '../lib/budget'
import { formatDay } from '../lib/dates'
import { en } from './en'

export type Locale = 'en' | 'de'

/** The shape every dictionary must have, taken from the English one. */
export type Dict = typeof en

export type I18n = {
  locale: Locale
  t: Dict
}

/** No German dictionary yet (D8) — `de` falls back to English rather than to nothing. */
export function dictFor(locale: Locale): Dict {
  switch (locale) {
    case 'de':
    case 'en':
      return en
    default: {
      const _never: never = locale
      return _never
    }
  }
}

/**
 * `null` as the default rather than a working dictionary: a component rendered outside
 * the provider is a wiring bug, and failing loudly at the first render beats shipping
 * a screen that silently reads from a fallback.
 */
export const I18nContext = createContext<I18n | null>(null)

function useI18n(): I18n {
  const value = useContext(I18nContext)
  if (value === null) throw new Error('useT/useFormat must be used inside <I18nProvider>')
  return value
}

/** Every user-facing string: `const t = useT()` … `t.income.add`. */
export function useT(): Dict {
  return useI18n().t
}

/**
 * Formatters bound to the active locale, so components never pass one. `useMemo` keeps
 * the returned object's identity stable across renders — a fresh object every render
 * would invalidate any dependency array it lands in.
 */
export function useFormat(): {
  euros: (cents: number) => string
  day: (iso: string) => string
} {
  const { t } = useI18n()
  return useMemo(
    () => ({
      euros: (cents: number) => formatEuros(cents, t.numberLocale),
      day: (iso: string) => formatDay(iso, t.dateLocale),
    }),
    [t],
  )
}
