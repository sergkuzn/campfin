import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import { formatEuros } from '../lib/budget'
import { type Burn, emptyBurn } from '../lib/burn'
import { AllowedToday } from './AllowedToday'

/**
 * Amounts are asserted through the same formatter the component uses: the euro sign's
 * side and the decimal comma are the locale's business, not this test's.
 *
 * `Intl` separates the amount from the sign with a non-breaking space, which Testing
 * Library's text matching normalises to an ordinary one — so the expectation is
 * normalised the same way.
 */
const euros = (cents: number) => plain(formatEuros(cents, en.numberLocale))

function plain(text: string): string {
  return text.replace(/\u00a0/g, ' ')
}

function renderHeadline(burn: Partial<Burn>, remainingCents: number) {
  render(
    <I18nProvider>
      <AllowedToday burn={{ ...emptyBurn, ...burn }} remainingCents={remainingCents} />
    </I18nProvider>,
  )
}

/** The value rendered under a stat label — the two live in the same cell, so the label's
 *  parent is the row to read the figure from. */
function statValue(label: string): string {
  return plain(screen.getByText(label).parentElement?.textContent?.replace(label, '') ?? '')
}

describe('AllowedToday', () => {
  it('shows the four figures behind the headline', () => {
    renderHeadline(
      { allowedTodayCents: 4250, spentTodayCents: 1800, medianDayCents: 6000, remainingDays: 4 },
      18_000,
    )

    expect(screen.getByText(euros(4250))).toBeInTheDocument()
    expect(statValue(en.burn.spentToday)).toBe(euros(1800))
    expect(statValue(en.burn.medianDay)).toBe(euros(6000))
    expect(statValue(en.burn.daysLeft)).toBe('4')
    expect(statValue(en.burn.moneyLeft)).toBe(euros(18_000))
  })

  it('names an overspend instead of showing a minus sign', () => {
    renderHeadline({ allowedTodayCents: -4000 }, -800)

    expect(screen.getByText(en.burn.overspentBy(euros(4000)))).toBeInTheDocument()
    // An overspent pool has nothing left rather than a negative amount left.
    expect(statValue(en.burn.moneyLeft)).toBe(euros(0))
  })
})
