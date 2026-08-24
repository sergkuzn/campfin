import { useState } from 'react'
import { useFormat, useT } from '../i18n'
import type { PerDiemTotals } from '../lib/budget'
import type { PerDiemBlock, PerDiemVariant } from '../lib/types'
import { BlockList } from './BlockList'

type Props = {
  grantedBlocks: PerDiemBlock[]
  actualBlocks: PerDiemBlock[]
  /** From `perDiemTotals` — this component does no arithmetic of its own. */
  totals: PerDiemTotals
  /** The actual editor is open for this source, so the form replaces everything else. */
  editing: boolean
  renderForm: () => React.ReactNode
}

/**
 * One per-diem card: the comparison line always shows (it's the one number worth reading
 * without asking), and the granted/actual block breakdown sits behind a disclosure so the
 * main screen stays about the total rather than the paperwork behind it. Editing either
 * side opens through the card's ⋮ menu, not from here.
 */
export function PerDiemAttendance({
  grantedBlocks,
  actualBlocks,
  totals,
  editing,
  renderForm,
}: Props) {
  const t = useT()
  const format = useFormat()
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<PerDiemVariant>('granted')

  if (editing) return <div className="attendance">{renderForm()}</div>

  return (
    <div className="attendance">
      <button
        className="attendance__toggle"
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((shown) => !shown)}
      >
        {t.attendance.toggleBlocks(expanded)}
      </button>

      {expanded && (
        <>
          {/* Toggle buttons with `aria-pressed` rather than the ARIA tab pattern: that one
              owes the reader arrow-key navigation and a labelled panel, which is more
              machinery than two lists of blocks need. */}
          <div className="attendance__tabs">
            {(['granted', 'actual'] as const).map((variant) => (
              <button
                key={variant}
                type="button"
                aria-pressed={tab === variant}
                className={
                  tab === variant ? 'attendance__tab attendance__tab--on' : 'attendance__tab'
                }
                onClick={() => setTab(variant)}
              >
                {variant === 'granted' ? t.attendance.granted : t.attendance.actual}
              </button>
            ))}
          </div>

          {tab === 'granted' && <BlockList blocks={grantedBlocks} />}
          {tab === 'actual' &&
            (totals.hasActual ? (
              <BlockList blocks={actualBlocks} />
            ) : (
              <p className="attendance__hint">{t.attendance.sameAsGranted}</p>
            ))}
        </>
      )}

      {/* Only worth a line once the two numbers differ, in either direction; while actual is
          granted it would just restate the amount in the header. */}
      {(totals.unusableCents > 0 || totals.overAttendedCents > 0) && (
        <p className="attendance__compare">
          <span>
            {t.attendance.comparison(
              format.euros(totals.grantedCents),
              format.euros(totals.entitledCents),
            )}
          </span>
          {totals.unusableCents > 0 && (
            <strong className="attendance__goes-back">
              {t.attendance.goesBack(format.euros(totals.unusableCents))}
            </strong>
          )}
        </p>
      )}

      {totals.overAttendedCents > 0 && (
        <p className="attendance__warning">
          {t.attendance.overAttended(format.euros(totals.overAttendedCents))}
        </p>
      )}
    </div>
  )
}
