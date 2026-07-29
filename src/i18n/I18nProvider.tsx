import { useMemo } from 'react'
import { dictFor, I18nContext, type Locale } from '.'

type Props = {
  /** Fixed to English for now; the prop is the seam a language switcher plugs into. */
  locale?: Locale
  children: React.ReactNode
}

export function I18nProvider({ locale = 'en', children }: Props) {
  // The context value is an object, so without useMemo every render of the provider
  // would hand its consumers a new identity and re-render the whole tree.
  const value = useMemo(() => ({ locale, t: dictFor(locale) }), [locale])

  // React 19 renders a context directly as the provider — no `.Provider` needed.
  return <I18nContext value={value}>{children}</I18nContext>
}
