import { useFormat, useT } from '../i18n'
import type { PerDiemTotals } from '../lib/budget'
import { distinctSourceName, sourceLabel } from '../lib/income'
import type { IncomeSource, PerDiemBlock, Pool } from '../lib/types'
import { BlockList } from './BlockList'
import { PerDiemAttendance } from './PerDiemAttendance'
import { RowMenu, type RowMenuItem } from './RowMenu'

/** The granted/actual half of a per-diem card. One optional prop group rather than six
 *  loose optional props, so "either a card has attendance or it doesn't" stays checkable. */
type Attendance = {
  actualBlocks: PerDiemBlock[]
  totals: PerDiemTotals
  editing: boolean
  onEdit: (seedFromGranted: boolean) => void
  renderForm: () => React.ReactNode
}

type BodyProps = {
  source: IncomeSource
  pool: Pool
  /** Granted blocks of this source; `[]` for a fixed grant or a deposit. */
  blocks: PerDiemBlock[]
  /** Another card is open for editing, so this one's buttons are inert. */
  disabled: boolean
  /** True when a heading right above already spells this income's name out, so the
   *  subtitle can stay a bare kind label instead of repeating it. */
  namedAbove: boolean
  /** Present only for the per-diem source, which is the only kind that has attendance. */
  attendance?: Attendance
}

/**
 * What one income says about itself, with no frame of its own: a subtitle naming its kind,
 * then its blocks or its attendance tabs.
 *
 * Split out from the card because a pool holding a single income is drawn as *one* thing —
 * the pool header carries the name, the amount and the menu, and this hangs underneath it.
 * A pool with two incomes wraps each of these in a card instead.
 */
export function IncomeSourceBody({
  source,
  pool,
  blocks,
  disabled,
  namedAbove,
  attendance,
}: BodyProps) {
  const t = useT()

  // Only worth printing when it says something the pool heading doesn't: an income named
  // after its pool — or, since the name became optional, not named at all — repeats it.
  const ownName = namedAbove ? undefined : distinctSourceName(source, pool)
  // Named above means this body sits under `IncomeSourceCard`'s own header, which already
  // shows the kind inline beside the name — repeating it here would say it twice. A
  // Kaution pool also wears a "Deposit" badge and holds nothing but its one deposit, so
  // naming the kind underneath would be the third time the same word appears there too.
  const kindLabel =
    namedAbove || (pool.role === 'deposit' && source.kind === 'deposit')
      ? undefined
      : t.income.kinds[source.kind].label

  const subtitle =
    kindLabel === undefined
      ? ownName
      : ownName === undefined
        ? kindLabel
        : t.income.kindWithName(ownName, kindLabel)

  return (
    <>
      {subtitle !== undefined && <p className="card__kind">{subtitle}</p>}

      {attendance === undefined ? (
        <BlockList blocks={blocks} />
      ) : (
        <PerDiemAttendance
          grantedBlocks={blocks}
          actualBlocks={attendance.actualBlocks}
          totals={attendance.totals}
          editing={attendance.editing}
          disabled={disabled}
          onEdit={attendance.onEdit}
          renderForm={attendance.renderForm}
        />
      )}
    </>
  )
}

type CardProps = Omit<BodyProps, 'namedAbove'> & {
  amountCents: number // from sourceAmountCents — do not recompute here
  menu: RowMenuItem[]
}

/** One saved income among siblings in the same pool: its own name, its own amount and its
 *  own ⋮, because the pool header above can only speak for the pool as a whole. */
export function IncomeSourceCard({ amountCents, menu, ...body }: CardProps) {
  const t = useT()
  const format = useFormat()
  const label = sourceLabel(body.source, body.pool)

  return (
    <article className="card">
      <header className="card__header">
        <span className="card__name">{label}</span>
        <span className="card__kind-inline">{t.income.kinds[body.source.kind].label}</span>
        <span className="card__amount">{format.euros(amountCents)}</span>
        <RowMenu label={label} disabled={body.disabled} items={menu} />
      </header>

      <IncomeSourceBody {...body} namedAbove={true} />
    </article>
  )
}
