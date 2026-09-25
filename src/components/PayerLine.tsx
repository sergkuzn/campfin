import './PayerLine.css'
import { useT } from '../i18n'
import { owedPayerName, type PayerRow } from '../lib/payers'

type Props = {
  /** The row this line is about — a receipt or an out-of-pocket expense; both answer
   *  "who fronted this, and is it settled?" the same way. */
  row: PayerRow
  /** The leader holding the cash. Undefined until one is named, and then no row can owe. */
  moneyHolder: string | undefined
  /** True while a form is open: the button goes inert with the rest of the list. */
  locked: boolean
  /** Tick the row off as settled, or un-tick it. The argument is the direction the tap
   *  means, so the caller need not work out which way round the button was. Absent in the
   *  read-only participant view, where the same words appear as a plain label. */
  onToggleRepaid?: (repaid: boolean) => void
}

/**
 * Who fronted the money for one row, and the button that settles it. Shared by the receipt
 * list and the other-expenses list rather than written twice: the two screens ask the
 * identical question, and two copies would eventually answer it in two different words.
 *
 * Renders nothing at all when the money holder paid — nearly every row — so the ordinary
 * one still costs no extra line. The name is plain text beside the button rather than one
 * coloured pill doing both jobs: a row you only want to read should not look like a row
 * that wants tapping.
 */
export function PayerLine({ row, moneyHolder, locked, onToggleRepaid }: Props) {
  const t = useT()

  // Both derived during render rather than stored: the line is a pure function of the row
  // and the camp's holder, so an optimistic write re-renders it with no state to keep in
  // step.
  //
  // `payerName` is who to *show* — anybody but the holder, settled or not, since a tick has
  // to be undoable. Asking the same question of an unsettled copy of the row is what keeps
  // "who counts as a payer" one definition instead of two that could drift apart.
  // `owedTo` is the narrower question of whether that money is still out, and it is what
  // the button's direction hangs on.
  const payerName = owedPayerName({ ...row, reimbursed: false }, moneyHolder)
  const owedTo = owedPayerName(row, moneyHolder)

  if (payerName === null) return null

  const statusClass = owedTo === null ? 'payer-line__button--done' : 'payer-line__button--owed'

  // Same look, no control: a viewer still sees who is owed, but a thing that looks tappable
  // and does nothing would read as broken. "Return" is a command, so the owed state gets a
  // word of its own here.
  if (onToggleRepaid === undefined) {
    return (
      <span className="payer-line">
        <span className="payer-line__name">{t.receipts.payer.paidByRow(payerName)}</span>
        <span className={`payer-line__button payer-line__status ${statusClass}`}>
          {owedTo === null ? t.receipts.payer.returnedButton : t.receipts.payer.owedStatus}
        </span>
      </span>
    )
  }

  return (
    <span className="payer-line">
      <span className="payer-line__name">{t.receipts.payer.paidByRow(payerName)}</span>
      <button
        className={`payer-line__button ${statusClass}`}
        type="button"
        disabled={locked}
        onClick={() => onToggleRepaid(owedTo !== null)}
      >
        {owedTo === null ? t.receipts.payer.returnedButton : t.receipts.payer.returnButton}
      </button>
    </span>
  )
}
