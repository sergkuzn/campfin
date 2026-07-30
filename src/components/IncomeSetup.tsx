import { useMemo, useRef, useState } from 'react'
import './IncomeSetup.css'
import type { UseIncome } from '../hooks/useIncome'
import { type Dict, useFormat, useT } from '../i18n'
import type { SaveSourceInput } from '../lib/drafts'
import { hasPerDiemSource, INCOME_KINDS } from '../lib/income'
import {
  everydayPool,
  type PoolSummary,
  receivedTotalCents,
  sourceAmountCents,
  summarisePools,
} from '../lib/pools'
import type { IncomeKind, IncomeSource, PerDiemBlock } from '../lib/types'
import { ConfirmDialog } from './ConfirmDialog'
import { IncomeSourceCard } from './IncomeSourceCard'
import { IncomeSourceForm } from './IncomeSourceForm'

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
  const t = useT()
  const format = useFormat()
  // `income` is already this camp's rows — the query behind it is scoped by campId, so
  // there is nothing left to filter here.
  const { pools, sources, blocks } = income

  // No expenses until stage 08; an empty array is the honest input, and received money is
  // independent of spending anyway.
  const summaries = useMemo(
    () => summarisePools(pools, sources, blocks, []),
    [pools, sources, blocks],
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
    const next = window.prompt(t.pools.renamePrompt, currentName)
    // `prompt` returns null on cancel — an empty string means "cleared it", also a no-op.
    if (next !== null && next.trim() !== '') income.renamePool(poolId, next.trim())
  }

  const handleConfirm = () => {
    if (pending === null) return
    if (pending.target === 'source') income.deleteSource(pending.sourceId)
    else income.deletePool(pending.poolId)
    setPending(null)
  }

  const confirmContent = describePending(pending, summaries, blocks, t, format.euros)

  // The per-diem grant is the camp's spine and there is exactly one of it, so the menu
  // stops offering it once it exists rather than letting a second one be created.
  const offeredKinds = INCOME_KINDS.filter(
    (kind) => kind !== 'per_diem' || !hasPerDiemSource(sources),
  )

  return (
    <div className="income">
      <button className="dashboard__back" type="button" onClick={onBack}>
        {t.income.back}
      </button>

      <header className="income__header">
        <h2 className="income__title">{t.income.title}</h2>
        <button
          className="income-form__button"
          type="button"
          disabled={locked}
          onClick={() => setPicking((open) => !open)}
        >
          {t.income.add}
        </button>
      </header>

      {/* A write that only failed to *sync* says nothing — Instant queues it. This is for
          a write the server actually rejected. */}
      {income.error !== null && (
        <p className="income__error" role="alert">
          {income.error}
        </p>
      )}

      {picking && (
        <div className="type-menu">
          {offeredKinds.map((kind) => (
            <button
              key={kind}
              className="type-menu__option"
              type="button"
              onClick={() => handleAdd(kind)}
            >
              <span className="type-menu__label">{t.income.kinds[kind].label}</span>
              <span className="type-menu__hint">{t.income.kinds[kind].hint}</span>
            </button>
          ))}
        </div>
      )}

      {/* "Nothing here yet" would be a lie for the first second, so the loading line wins
          while the query is still out. */}
      {sources.length === 0 && !picking && editing === null && (
        <p className="income__empty">{income.isLoading ? t.app.loading : t.income.empty}</p>
      )}

      {summaries.map((summary) => (
        <PoolSection
          key={summary.pool.id}
          summary={summary}
          blocks={blocks}
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
              // Granted blocks only — the actual-attendance ones get their own tab in a
              // later stage and must not appear as extra rows in this editor.
              blocks={blocks.filter((b) => b.sourceId === source.id && b.variant === 'granted')}
              pools={pools}
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
          pools={pools}
          // Per-diem money always lands in the everyday pool; a fixed grant or a deposit
          // starts its own, so it gets no pre-selection.
          defaultPool={editing.kind === 'per_diem' ? everydayPool(pools, campId) : undefined}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      <footer className="income__totals">
        <p className="income__total-row">
          <span>{t.income.receivedTotal}</span>
          <strong>{format.euros(receivedTotalCents(summaries))}</strong>
        </p>
      </footer>

      <ConfirmDialog
        open={pending !== null}
        title={confirmContent.title}
        lines={confirmContent.lines}
        confirmLabel={t.pools.confirmDelete}
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
  t: Dict,
  euros: (cents: number) => string,
): { title: string; lines: string[] } {
  if (pending === null) return { title: '', lines: [] }

  if (pending.target === 'pool') {
    const summary = summaries.find((s) => s.pool.id === pending.poolId)
    if (summary === undefined) return { title: t.pools.deleteTitleFallback, lines: [] }
    return {
      title: t.pools.deleteTitle(summary.pool.name),
      lines: [t.pools.deleteSources(summary.sources.length, euros(summary.fundedCents))],
    }
  }

  const summary = summaries.find((s) => s.sources.some((src) => src.id === pending.sourceId))
  const source = summary?.sources.find((src) => src.id === pending.sourceId)
  if (summary === undefined || source === undefined) {
    return { title: t.pools.sourceDeleteTitleFallback, lines: [] }
  }

  const lines = [
    t.pools.sourceDeleteLine(euros(sourceAmountCents(source, blocks)), summary.pool.name),
  ]
  // The reducer drops a pool once nothing feeds it — say so before it happens. The
  // everyday pool is the exception: it stays whether or not anything funds it.
  if (summary.sources.length === 1 && summary.pool.role !== 'everyday') {
    lines.push(t.pools.sourceDeleteLastLine(summary.pool.name))
  }
  return { title: t.pools.sourceDeleteTitle(source.name), lines }
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
  const t = useT()
  const format = useFormat()
  const menuRef = useRef<HTMLDetailsElement>(null)
  // The everyday pool outlives every source in it, so it offers no Delete at all.
  const deletable = summary.pool.role !== 'everyday'

  // <details> keeps its open state in the DOM, exactly like <dialog>. Closing it after
  // an action is a one-line reach through a ref rather than a second piece of state.
  const closeMenu = () => {
    if (menuRef.current !== null) menuRef.current.open = false
  }

  return (
    <section className="pool">
      <header className="pool__header">
        <h3 className="pool__name">{summary.pool.name}</h3>
        <span className="pool__total">{format.euros(summary.fundedCents)}</span>
        <details className="pool__menu" ref={menuRef}>
          <summary className="pool__menu-button" aria-label={t.pools.actions(summary.pool.name)}>
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
              {t.pools.rename}
            </button>
            {deletable && (
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  closeMenu()
                  onDeletePool()
                }}
              >
                {t.pools.delete}
              </button>
            )}
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
