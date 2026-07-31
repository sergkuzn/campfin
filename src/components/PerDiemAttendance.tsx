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
  /** The actual editor is open for this source, so the actual tab shows the form. */
  editing: boolean
  /** Another card is open, so every button here is inert. */
  disabled: boolean
  /** `seedFromGranted` is true when the user asked to copy the grant across. */
  onEdit: (seedFromGranted: boolean) => void
  renderForm: () => React.ReactNode
}

/**
 * The granted/actual halves of one per-diem card: two tabs over the same block list, and
 * the comparison line underneath. The comparison is the feature — the difference between
 * what was funded and who turned up is exactly the money that has to go back.
 */
export function PerDiemAttendance({
  grantedBlocks,
  actualBlocks,
  totals,
  editing,
  disabled,
  onEdit,
  renderForm,
}: Props) {
  const t = useT()
  const format = useFormat()

  // Which tab is open is view state for this one card, so it lives here rather than in the
  // screen above. Editing forces the actual tab: that is the tab the form belongs to.
  const [selected, setSelected] = useState<PerDiemVariant>('granted')
  const tab = editing ? 'actual' : selected

  const tabs: PerDiemVariant[] = ['granted', 'actual']

  return (
    <div className="attendance">
      {/* Toggle buttons with `aria-pressed` rather than the ARIA tab pattern: that one owes
          the reader arrow-key navigation and a labelled panel, which is more machinery than
          two lists of blocks need. */}
      <div className="attendance__tabs">
        {tabs.map((variant) => (
          <button
            key={variant}
            type="button"
            aria-pressed={tab === variant}
            className={tab === variant ? 'attendance__tab attendance__tab--on' : 'attendance__tab'}
            onClick={() => setSelected(variant)}
          >
            {variant === 'granted' ? t.attendance.granted : t.attendance.actual}
          </button>
        ))}
      </div>

      {tab === 'granted' && <BlockList blocks={grantedBlocks} />}

      {tab === 'actual' &&
        (editing ? (
          renderForm()
        ) : totals.hasActual ? (
          <>
            <BlockList blocks={actualBlocks} />
            <div className="attendance__actions">
              <button
                className="attendance__button"
                type="button"
                disabled={disabled}
                onClick={() => onEdit(false)}
              >
                {t.attendance.edit}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="attendance__hint">{t.attendance.sameAsGranted}</p>
            <div className="attendance__actions">
              <button
                className="attendance__button"
                type="button"
                disabled={disabled}
                onClick={() => onEdit(true)}
              >
                {t.attendance.copyFromGranted}
              </button>
            </div>
          </>
        ))}

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
