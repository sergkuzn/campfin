import { useState } from 'react'
import './PfandScreen.css'
import type { UsePfand } from '../hooks/usePfand'
import { useFormat, useT } from '../i18n'
import type { CampWindow } from '../lib/camps'
import { todayIso } from '../lib/dates'
import { isSamePayer } from '../lib/payers'
import { isReceiptTxn, type PfandBalance, type PfandTxn, type SavePfandInput } from '../lib/pfand'
import { ConfirmDialog } from './ConfirmDialog'
import { PfandEntryForm } from './PfandEntryForm'
import { PfandIcon } from './PfandIcon'
import { RowMenu } from './RowMenu'
import { Screen } from './Screen'
import { Toast } from './Toast'

type Props = {
  campId: string
  pfand: UsePfand
  /** The whole ledger, receipts included — computed by the parent so the dashboard figure
   *  and this screen cannot disagree. */
  txns: PfandTxn[]
  balances: PfandBalance[]
  /** Who holds the camp cash, so their row can be marked. */
  moneyHolder: string | undefined
  /** The camp's span, for the date picker in the form. `null` until per-diem income dates
   *  the camp. */
  campWindow: CampWindow | null
  onBack: () => void
}

/**
 * Which row is unlocked, and what a fresh one starts as. `seed` rides along on `new`
 * because a balance row's Refund button is the only way in — it opens the form already
 * answered, so refunding Anna's whole deposit is one tap and then Save.
 */
type PfandSeed = { payer: string; amountCents: number }

type Editing = { mode: 'new'; seed: PfandSeed } | { mode: 'edit'; entryId: string }

/** What an edit form is handed instead of a seed: it reads the stored row, not this. */
const BLANK_SEED: PfandSeed = { payer: '', amountCents: 0 }

/**
 * The pfand ledger: what each person is out of pocket on deposits, over the transactions
 * that got them there.
 *
 * A screen of its own rather than a corner of the receipts list, because the balance is the
 * question — what each person is still owed — and it is a running total across receipts,
 * not a fact about any one of them.
 *
 * Only one kind of row is written here: a refund at a shop. Everything a receipt says about
 * a deposit — what it charged, what it gave back, and whose pocket it sits in once the
 * holder has paid that person back — is derived from the receipt itself, so those lines are
 * read-only and change the moment the receipt does.
 */
export function PfandScreen({
  campId,
  pfand,
  txns,
  balances,
  moneyHolder,
  campWindow,
  onBack,
}: Props) {
  const t = useT()
  const format = useFormat()

  const [editing, setEditing] = useState<Editing | null>(null)
  // Ids only: the confirm question derives its numbers at render time, so it can never
  // quote a stale amount.
  const [pendingId, setPendingId] = useState<string | null>(null)

  const refunds = pfand.entries
  const editingRow =
    editing?.mode === 'edit' ? (refunds.find((e) => e.id === editing.entryId) ?? null) : null
  // `find` gives undefined once the row is gone — deleted here or by the other leader
  // mid-sync — and the dialog simply closes rather than quoting a row that no longer exists.
  const pending = pendingId === null ? undefined : refunds.find((e) => e.id === pendingId)
  // A row can vanish under an open form. Nothing is unlocked then, so the rest of the
  // screen must not stay inert with no form to cancel.
  const locked = editing?.mode === 'new' || editingRow !== null

  const handleSave = (input: SavePfandInput) => {
    pfand.saveEntry(input)
    setEditing(null)
  }

  const handleConfirmDelete = () => {
    if (pendingId !== null) pfand.deleteEntry(pendingId)
    setPendingId(null)
  }

  const startNew = (payer: string, amountCents: number) =>
    setEditing({ mode: 'new', seed: { payer, amountCents } })

  /** Where the edit form goes in the list: in the slot of the line it belongs to, so
   *  nothing above it moves. A refund draws exactly one line, so there is one slot. */
  const editingTxnId =
    editingRow === null ? null : (txns.find((txn) => txn.rowId === editingRow.id)?.id ?? null)

  const renderForm = () => (
    <PfandEntryForm
      campId={campId}
      entry={editingRow}
      seed={editing?.mode === 'new' ? editing.seed : BLANK_SEED}
      // Read at the edge and passed down, so nothing below here touches the clock.
      todayIso={todayIso()}
      campWindow={campWindow}
      onSave={handleSave}
      onCancel={() => setEditing(null)}
    />
  )

  return (
    <Screen name="pfand" back={{ label: t.pfand.back, onClick: onBack }}>
      <header className="pfand__header">
        <h2 className="screen__title">
          {t.pfand.title}
          <PfandIcon className="pfand-icon--title" />
        </h2>
      </header>

      <p className="slot-card__hint">{t.pfand.intro}</p>

      {/* A write that only failed to *sync* says nothing — Instant queues it. This is for a
          write the server actually rejected. */}
      {pfand.error !== null && <Toast key={pfand.error} message={pfand.error} />}

      {balances.length > 0 && (
        <section className="pfand__balances">
          <h3 className="pfand__section-title">{t.pfand.balancesTitle}</h3>
          <ul className="pfand__balance-rows">
            {balances.map((balance) => (
              <li key={balance.name}>
                {/* The form opens in the row it was asked for, so the name it is about is
                    the one still on screen directly above it. */}
                {editing?.mode === 'new' && editing.seed.payer === balance.name ? (
                  renderForm()
                ) : (
                  <BalanceRow
                    balance={balance}
                    moneyHolder={moneyHolder}
                    locked={locked}
                    onRefund={() => startNew(balance.name, balance.outstandingCents)}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* "Nothing here yet" would be a lie for the first second, so the loading line wins
          while the query is still out. */}
      {txns.length === 0 && !locked && (
        <p className="income__empty">{pfand.isLoading ? t.app.loading : t.pfand.empty}</p>
      )}

      {txns.length > 0 && (
        <section className="pfand__txns">
          <h3 className="pfand__section-title">{t.pfand.txnsTitle}</h3>
          <ul className="pfand__txn-rows">
            {txns.map((txn) => {
              // No `pfand-txn` class on the form's slot: the form brings its own card frame,
              // and the row's border around it would read as a box inside a box.
              if (txn.id === editingTxnId) return <li key={txn.id}>{renderForm()}</li>
              return (
                <TxnRow
                  key={txn.id}
                  txn={txn}
                  locked={locked}
                  onEdit={() => setEditing({ mode: 'edit', entryId: txn.rowId })}
                  onDelete={() => setPendingId(txn.rowId)}
                />
              )
            })}
          </ul>
          <p className="pfand__total">
            <span>{t.pfand.count(txns.length)}</span>
          </p>
        </section>
      )}

      <ConfirmDialog
        open={pending !== undefined}
        title={pending === undefined ? '' : t.pfand.deleteTitle(pending.payer)}
        lines={
          pending === undefined
            ? []
            : [t.pfand.deleteLine(t.pfand.kinds.refund, format.euros(pending.amountCents))]
        }
        confirmLabel={t.pfand.confirmDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingId(null)}
      />
    </Screen>
  )
}

type BalanceProps = {
  balance: PfandBalance
  moneyHolder: string | undefined
  locked: boolean
  onRefund: () => void
}

/**
 * One person's standing. Refund is a visible button rather than an item in a ⋮ menu: the
 * whole reason to open this screen is to settle somebody up, so the way to do it should not
 * be one tap further away than the number that prompted it.
 *
 * A balance below zero gets no button. More has come back than went out, which is not
 * something another refund would fix — the row that is wrong is a receipt or a refund, and
 * it is corrected where it was written.
 */
function BalanceRow({ balance, moneyHolder, locked, onRefund }: BalanceProps) {
  const t = useT()
  const format = useFormat()

  const isHolder = isSamePayer(balance.name, moneyHolder)

  return (
    // A <div>, not the <li>: the list item is the slot the refund form takes over, so the
    // row and the form can swap places without either owning the bullet.
    <div className="pfand-balance">
      <div className="pfand-balance__main">
        <span className="pfand-balance__name">
          {isHolder ? t.pfand.holderTag(balance.name) : balance.name}
        </span>
        {/* Zero and below-zero both need a word: a bare "0,00 €" reads as a row nobody has
            got round to, and a bare minus sign is easy to skim past. */}
        {balance.outstandingCents === 0 && (
          <span className="pfand-balance__note">{t.pfand.settled}</span>
        )}
        {balance.outstandingCents < 0 && (
          <span className="pfand-balance__note">{t.pfand.overRefunded}</span>
        )}
      </div>

      <span className="pfand-balance__amount">{format.euros(balance.outstandingCents)}</span>

      <span className="pfand-balance__actions">
        {balance.outstandingCents > 0 && (
          <button
            className="pfand-balance__action"
            type="button"
            disabled={locked}
            onClick={onRefund}
          >
            {t.pfand.refundAction}
          </button>
        )}
      </span>
    </div>
  )
}

type TxnProps = {
  txn: PfandTxn
  locked: boolean
  onEdit: () => void
  onDelete: () => void
}

/** One line of the ledger. Receipt-derived lines say where they came from instead of
 *  offering a menu — they are edited on the receipt that carries them, and a refund is the
 *  only row this screen owns. */
function TxnRow({ txn, locked, onEdit, onDelete }: TxnProps) {
  const t = useT()
  const format = useFormat()

  const fromReceipt = isReceiptTxn(txn.kind)
  const kinds = t.pfand.txnKinds
  // `subject` is the receipt's item; a refund names no purchase, so its label is a plain
  // string rather than a function.
  const subject = txn.subject ?? ''
  const label =
    txn.kind === 'receipt_paid'
      ? kinds.receipt_paid(subject)
      : txn.kind === 'receipt_returned'
        ? kinds.receipt_returned(subject)
        : kinds.refund

  return (
    <li className={`pfand-txn pfand-txn--${txn.deltaCents < 0 ? 'back' : 'out'}`}>
      <div className="pfand-txn__main">
        <span className="pfand-txn__payer">{txn.payer}</span>
        <span className="pfand-txn__kind">{label}</span>
        <span className="pfand-txn__meta">
          {format.day(txn.date)}
          {fromReceipt && ` · ${t.pfand.fromReceipt}`}
          {/* Only on a receipt somebody else paid and has since been settled: without it
              the holder's balance would name a shop trip they never made. */}
          {txn.via !== undefined && ` · ${t.pfand.viaPayer(txn.via)}`}
        </span>
        {txn.note !== undefined && <span className="pfand-txn__note">{txn.note}</span>}
      </div>

      {/* The sign is the whole point of the line — money out of a pocket or back into it —
          so it is written out rather than left to the currency formatter's minus. */}
      <span className="pfand-txn__amount">
        {txn.deltaCents < 0 ? '−' : '+'}
        {format.euros(Math.abs(txn.deltaCents))}
      </span>

      {fromReceipt ? (
        // Keeps the row's right-hand column the same width as the ones that do have a menu,
        // so the amounts stay in a column down the list.
        <span className="pfand-txn__no-menu" aria-hidden="true" />
      ) : (
        <RowMenu
          label={txn.payer}
          disabled={locked}
          items={[
            { label: t.rowMenu.edit, onSelect: onEdit },
            { label: t.rowMenu.delete, danger: true, onSelect: onDelete },
          ]}
        />
      )}
    </li>
  )
}
