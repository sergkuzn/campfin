import { useMemo, useRef, useState } from 'react'
import './IncomeSetup.css'
import type { UseIncome } from '../hooks/useIncome'
import { formatEuros } from '../lib/budget'
import type { SaveSourceInput } from '../lib/drafts'
import { campSlice } from '../lib/income'
import {
  type PoolSummary,
  receivedTotalCents,
  sourceAmountCents,
  summarisePools,
} from '../lib/pools'
import type { IncomeKind, IncomeSource, PerDiemBlock } from '../lib/types'
import { ConfirmDialog } from './ConfirmDialog'
import { IncomeSourceCard } from './IncomeSourceCard'
import { IncomeSourceForm } from './IncomeSourceForm'
import { INCOME_TYPES } from './incomeTypes'

type Props = {
  campId: string
  income: UseIncome
  onBack: () => void
}

/** Which card is unlocked. Only one at a time — that is the whole lock model. */
type Editing = { mode: 'new'; kind: IncomeKind } | { mode: 'edit'; sourceId: string }

/** What the confirm dialog is about. Ids only: the numbers get derived at render time,
 *  so the question can never quote a stale amount. */
type Pending = { target: 'source'; sourceId: string } | { target: 'pool'; poolId: string }

export function IncomeSetup({ campId, income, onBack }: Props) {
  const { pools, sources, blocks } = income

  const slice = useMemo(
    () => campSlice({ pools, sources, blocks }, campId),
    [pools, sources, blocks, campId],
  )
  // No expenses until milestone 4; an empty array is the honest input, and received
  // money is independent of spending anyway.
  const summaries = useMemo(
    () => summarisePools(slice.pools, slice.sources, slice.blocks, []),
    [slice],
  )

  const [editing, setEditing] = useState<Editing | null>(null)
  const [picking, setPicking] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)

  // One card open at a time: every other Edit, Delete and ＋ Add income goes inert.
  // This single flag replaces every "you have unsaved changes" dialog.
  const locked = editing !== null

  const handleSave = (input: SaveSourceInput) => {
    income.saveSource(input)
    setEditing(null)
  }

  const handleAdd = (kind: IncomeKind) => {
    setPicking(false)
    setEditing({ mode: 'new', kind })
  }

  const handleRenamePool = (poolId: string, currentName: string) => {
    const next = window.prompt('Rename pool', currentName)
    // `prompt` returns null on cancel — an empty string means "cleared it", also a no-op.
    if (next !== null && next.trim() !== '') income.renamePool(poolId, next.trim())
  }

  const handleConfirm = () => {
    if (pending === null) return
    if (pending.target === 'source') income.deleteSource(pending.sourceId)
    else income.deletePool(pending.poolId)
    setPending(null)
  }

  const confirmContent = describePending(pending, summaries, slice.blocks)

  return (
    <div className="income">
      <button className="dashboard__back" type="button" onClick={onBack}>
        ← Back to camp
      </button>

      <header className="income__header">
        <h2 className="income__title">Set up income</h2>
        <button
          className="income-form__button"
          type="button"
          disabled={locked}
          onClick={() => setPicking((open) => !open)}
        >
          ＋ Add income
        </button>
      </header>

      {picking && (
        <div className="type-menu">
          {INCOME_TYPES.map((option) => (
            <button
              key={option.kind}
              className="type-menu__option"
              type="button"
              onClick={() => handleAdd(option.kind)}
            >
              <span className="type-menu__label">{option.label}</span>
              <span className="type-menu__hint">{option.hint}</span>
            </button>
          ))}
        </div>
      )}

      {summaries.length === 0 && !picking && editing === null && (
        <p className="income__empty">No income yet — tap ＋ Add income.</p>
      )}

      {summaries.map((summary) => (
        <PoolSection
          key={summary.pool.id}
          summary={summary}
          blocks={slice.blocks}
          locked={locked}
          editingSourceId={editing?.mode === 'edit' ? editing.sourceId : null}
          onEdit={(sourceId) => setEditing({ mode: 'edit', sourceId })}
          onDeleteSource={(sourceId) => setPending({ target: 'source', sourceId })}
          onRenamePool={() => handleRenamePool(summary.pool.id, summary.pool.name)}
          onDeletePool={() => setPending({ target: 'pool', poolId: summary.pool.id })}
          renderForm={(source) => (
            <IncomeSourceForm
              // Re-seed the draft when the user switches to a different card.
              key={source.id}
              campId={campId}
              kind={source.kind}
              source={source}
              blocks={slice.blocks.filter((b) => b.sourceId === source.id)}
              pools={slice.pools}
              defaultPool={summary.pool}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
            />
          )}
        />
      ))}

      {editing?.mode === 'new' && (
        <IncomeSourceForm
          // Switching type while the menu is open re-seeds the draft.
          key={`new:${editing.kind}`}
          campId={campId}
          kind={editing.kind}
          source={null}
          blocks={[]}
          pools={slice.pools}
          // Everyday money joins the pot that already exists; a fixed grant or a
          // deposit starts its own, so it gets no pre-selection.
          defaultPool={editing.kind === 'per_diem' ? slice.pools[0] : undefined}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      <footer className="income__totals">
        <p className="income__total-row">
          <span>Received total</span>
          <strong>{formatEuros(receivedTotalCents(summaries))}</strong>
        </p>
      </footer>

      <ConfirmDialog
        open={pending !== null}
        title={confirmContent.title}
        lines={confirmContent.lines}
        confirmLabel="Delete"
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}

/**
 * The confirm question, composed from the current summaries so it always quotes the
 * amount the button is actually about to remove.
 */
function describePending(
  pending: Pending | null,
  summaries: PoolSummary[],
  blocks: PerDiemBlock[],
): { title: string; lines: string[] } {
  if (pending === null) return { title: '', lines: [] }

  if (pending.target === 'pool') {
    const summary = summaries.find((s) => s.pool.id === pending.poolId)
    if (summary === undefined) return { title: 'Delete pool?', lines: [] }
    const count = summary.sources.length
    return {
      title: `Delete the ${summary.pool.name} pool?`,
      lines: [
        `Its ${count} income ${count === 1 ? 'source' : 'sources'} worth ${formatEuros(summary.fundedCents)} will be deleted too.`,
      ],
    }
  }

  const summary = summaries.find((s) => s.sources.some((src) => src.id === pending.sourceId))
  const source = summary?.sources.find((src) => src.id === pending.sourceId)
  if (summary === undefined || source === undefined) {
    return { title: 'Delete this income?', lines: [] }
  }

  const lines = [
    `This removes ${formatEuros(sourceAmountCents(source, blocks))} from the ${summary.pool.name} pool.`,
  ]
  // The reducer drops a pool once nothing feeds it — say so before it happens.
  if (summary.sources.length === 1) {
    lines.push(`The ${summary.pool.name} pool goes with it — it has no other income.`)
  }
  return { title: `Delete "${source.name}"?`, lines }
}

type PoolSectionProps = {
  summary: PoolSummary
  blocks: PerDiemBlock[]
  locked: boolean
  editingSourceId: string | null
  onEdit: (sourceId: string) => void
  onDeleteSource: (sourceId: string) => void
  onRenamePool: () => void
  onDeletePool: () => void
  /** A render prop: the parent owns `editing` and the form's props, this section owns
   *  the layout, so it stays ignorant of drafts and saving. */
  renderForm: (source: IncomeSource) => React.ReactNode
}

function PoolSection({
  summary,
  blocks,
  locked,
  editingSourceId,
  onEdit,
  onDeleteSource,
  onRenamePool,
  onDeletePool,
  renderForm,
}: PoolSectionProps) {
  const menuRef = useRef<HTMLDetailsElement>(null)

  // <details> keeps its open state in the DOM, exactly like <dialog>. Closing it after
  // an action is a one-line reach through a ref rather than a second piece of state.
  const closeMenu = () => {
    if (menuRef.current !== null) menuRef.current.open = false
  }

  return (
    <section className="pool">
      <header className="pool__header">
        <h3 className="pool__name">{summary.pool.name}</h3>
        <span className="pool__total">{formatEuros(summary.fundedCents)}</span>
        <details className="pool__menu" ref={menuRef}>
          <summary className="pool__menu-button" aria-label={`Actions for ${summary.pool.name}`}>
            ⋯
          </summary>
          <div className="pool__menu-items">
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                closeMenu()
                onRenamePool()
              }}
            >
              Rename pool
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                closeMenu()
                onDeletePool()
              }}
            >
              Delete pool
            </button>
          </div>
        </details>
      </header>

      {summary.sources.map((source) =>
        source.id === editingSourceId ? (
          renderForm(source)
        ) : (
          <IncomeSourceCard
            key={source.id}
            source={source}
            blocks={blocks.filter((b) => b.sourceId === source.id)}
            amountCents={sourceAmountCents(source, blocks)}
            disabled={locked}
            onEdit={() => onEdit(source.id)}
            onDelete={() => onDeleteSource(source.id)}
          />
        ),
      )}
    </section>
  )
}
