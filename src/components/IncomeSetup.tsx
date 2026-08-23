import { useMemo, useState } from 'react'
import './IncomeSetup.css'
import type { UseIncome } from '../hooks/useIncome'
import { type Dict, useFormat, useT } from '../i18n'
import { blocksOf, perDiemTotals } from '../lib/budget'
import type { SaveBlocksInput, SavePoolInput, SaveSourceInput } from '../lib/drafts'
import { addableKinds, sourceLabel } from '../lib/income'
import {
  type PoolSummary,
  receivedTotalCents,
  sourceAmountCents,
  summarisePools,
} from '../lib/pools'
import type { IncomeKind, IncomeSource, PerDiemBlock, Pool, PoolColor } from '../lib/types'
import { ActualBlocksForm } from './ActualBlocksForm'
import { ConfirmDialog } from './ConfirmDialog'
import { IncomeSourceBody, IncomeSourceCard } from './IncomeSourceCard'
import { IncomeSourceForm } from './IncomeSourceForm'
import { PoolColorDialog } from './PoolColorDialog'
import { PoolForm } from './PoolForm'
import { PoolTag } from './PoolTag'
import { RowMenu, type RowMenuItem } from './RowMenu'
import { Screen } from './Screen'
import { Toast } from './Toast'

type Props = {
  campId: string
  income: UseIncome
  onBack: () => void
}

/**
 * Which form is open. Only one at a time — that is the whole lock model. `actual` opens
 * the attendance editor rather than the source form; `seedFromGranted` remembers whether the
 * user got there via "Copy from granted".
 */
type Editing =
  | { mode: 'pool' }
  | { mode: 'new'; poolId: string; kind: IncomeKind }
  | { mode: 'edit'; sourceId: string }
  | { mode: 'actual'; sourceId: string; seedFromGranted: boolean }

/** What the confirm dialog is about. Ids only: the numbers get derived at render time,
 *  so the question can never quote a stale amount. */
type Pending = { target: 'source'; sourceId: string } | { target: 'pool'; poolId: string }

export function IncomeSetup({ campId, income, onBack }: Props) {
  const t = useT()
  const format = useFormat()
  // `income` is already this camp's rows — the query behind it is scoped by campId, so
  // there is nothing left to filter here.
  const { pools, sources, blocks } = income

  // This screen is about money that arrived, which is independent of spending — so the
  // summaries are built with no expenses at all.
  const summaries = useMemo(
    () => summarisePools(pools, sources, blocks, []),
    [pools, sources, blocks],
  )

  const [editing, setEditing] = useState<Editing | null>(null)
  const [showPoolHint, setShowPoolHint] = useState(false)
  /** The pool whose "which kind?" menu is open — only ever the everyday pool, and only
   *  while its per-diem grant doesn't exist yet. */
  const [pickingPoolId, setPickingPoolId] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  // The pool whose colour is being picked, by id — looked up fresh on every render, so a
  // pool renamed or deleted by the other leader mid-sync retitles or closes the dialog.
  const [coloringPoolId, setColoringPoolId] = useState<string | null>(null)
  const coloringPool = pools.find((pool) => pool.id === coloringPoolId) ?? null

  // One form open at a time: every other action on the screen goes inert. This single
  // flag replaces every "you have unsaved changes" dialog.
  const locked = editing !== null

  const handleSave = (input: SaveSourceInput) => {
    income.saveSource(input)
    setEditing(null)
  }

  const handleSaveBlocks = (input: SaveBlocksInput) => {
    income.saveBlocks(input)
    setEditing(null)
  }

  /**
   * A new pool, then straight into its income form. The write is local-first and mints the
   * id up front, so the second step needs no round trip — and a pool with nothing in it is
   * not what anyone opened the form for.
   */
  const handleSavePool = (input: SavePoolInput) => {
    const poolId = income.createPool(input)
    setEditing({ mode: 'new', poolId, kind: input.role === 'deposit' ? 'deposit' : 'fixed' })
  }

  /** ＋ on a pool. The pool decides the kind, so the user is only asked in the one case
   *  where two answers are genuinely open — see `addableKinds`. */
  const handleAddIncome = (pool: Pool) => {
    const kinds = addableKinds(pool, sources)
    const only = kinds.length === 1 ? kinds[0] : undefined
    // Only one picker at a time: tapping ＋ on a second pool must not leave the first
    // pool's menu hanging open behind it.
    setPickingPoolId(only === undefined ? pool.id : null)
    if (only !== undefined) setEditing({ mode: 'new', poolId: pool.id, kind: only })
  }

  const handlePickKind = (poolId: string, kind: IncomeKind) => {
    setPickingPoolId(null)
    setEditing({ mode: 'new', poolId, kind })
  }

  const handleRenamePool = (poolId: string, currentName: string) => {
    const next = window.prompt(t.pools.renamePrompt, currentName)
    // `prompt` returns null on cancel — an empty string means "cleared it", also a no-op.
    if (next !== null && next.trim() !== '') income.renamePool(poolId, next.trim())
  }

  // The dialog can outlive its pool by a moment — the other leader deleted it mid-sync —
  // so the write is guarded rather than aimed at whatever id is left over.
  const handlePickColor = (color: PoolColor) => {
    if (coloringPool === null) return
    income.setPoolColor(coloringPool.id, color)
  }

  const handleConfirm = () => {
    if (pending === null) return
    if (pending.target === 'source') income.deleteSource(pending.sourceId)
    else income.deletePool(pending.poolId)
    setPending(null)
  }

  const confirmContent = describePending(pending, summaries, blocks, t, format.euros)

  /**
   * One saved income: either the source form in its place, or the income itself. Written
   * here rather than inside `PoolSection` because everything it needs — which form is
   * open, the save handlers — lives in this component.
   *
   * `merged` says the pool holds this one income alone, so the pool header is already
   * showing its name, amount and menu and only the body belongs here.
   */
  const renderSource = (source: IncomeSource, pool: Pool, merged: boolean): React.ReactNode => {
    // Granted blocks only. The actual-attendance rows have their own tab and must never
    // appear as extra rows in the grant's editor.
    const grantedBlocks = blocksOf(blocks, source.id, 'granted')

    if (editing?.mode === 'edit' && editing.sourceId === source.id) {
      return (
        <IncomeSourceForm
          // Re-seed the draft when the user switches to a different card.
          key={source.id}
          campId={campId}
          kind={source.kind}
          pool={pool}
          source={source}
          blocks={grantedBlocks}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )
    }

    // Narrowed once and reused: inside the `renderForm` closure below, `editing` is no
    // longer narrowed by TypeScript, since it could have changed by the time it runs.
    const editingActual =
      editing?.mode === 'actual' && editing.sourceId === source.id ? editing : null

    const body = {
      source,
      pool,
      blocks: grantedBlocks,
      attendance:
        source.kind !== 'per_diem'
          ? undefined
          : {
              actualBlocks: blocksOf(blocks, source.id, 'actual'),
              totals: perDiemTotals(blocks, source.id),
              editing: editingActual !== null,
              renderForm: () => (
                <ActualBlocksForm
                  key={source.id}
                  campId={campId}
                  sourceId={source.id}
                  grantedBlocks={grantedBlocks}
                  actualBlocks={blocksOf(blocks, source.id, 'actual')}
                  seedFromGranted={editingActual?.seedFromGranted ?? false}
                  onSave={handleSaveBlocks}
                  onCancel={() => setEditing(null)}
                />
              ),
            },
    }

    if (merged) return <IncomeSourceBody key={source.id} {...body} namedAbove={false} />

    return (
      <IncomeSourceCard
        key={source.id}
        {...body}
        disabled={locked}
        amountCents={sourceAmountCents(source, blocks)}
        menu={[
          {
            label: t.rowMenu.edit,
            onSelect: () => setEditing({ mode: 'edit', sourceId: source.id }),
          },
          ...(source.kind === 'per_diem'
            ? [
                {
                  label: t.rowMenu.editActual,
                  onSelect: () =>
                    setEditing({ mode: 'actual', sourceId: source.id, seedFromGranted: false }),
                },
              ]
            : []),
          {
            label: t.rowMenu.delete,
            danger: true,
            onSelect: () => setPending({ target: 'source', sourceId: source.id }),
          },
        ]}
      />
    )
  }

  return (
    <Screen name="income" back={{ label: t.income.back, onClick: onBack }}>
      <header className="income__header">
        <h2 className="screen__title income__title">{t.income.title}</h2>
        {/* On demand rather than always on screen: "what is a pool" is a question you have
            once, and a permanent paragraph would cost every later visit a scroll. */}
        <button
          className="info-button"
          type="button"
          aria-expanded={showPoolHint}
          aria-label={t.pools.aboutLabel}
          onClick={() => setShowPoolHint((shown) => !shown)}
        >
          ⓘ
        </button>
        <button
          className="btn btn--primary"
          type="button"
          disabled={locked}
          onClick={() => setEditing({ mode: 'pool' })}
        >
          {t.pools.add}
        </button>
      </header>

      {showPoolHint && <p className="income__hint">{t.pools.about}</p>}

      {/* A write that only failed to *sync* says nothing — Instant queues it. This is for
          a write the server actually rejected. */}
      {income.error !== null && <Toast key={income.error} message={income.error} />}

      {editing?.mode === 'pool' && (
        <PoolForm campId={campId} onSave={handleSavePool} onCancel={() => setEditing(null)} />
      )}

      {/* Every camp is born with its everyday pool, so an empty list means the query is
          still out — "nothing here yet" would be a lie for that first second. */}
      {pools.length === 0 && (
        <p className="income__empty">{income.isLoading ? t.app.loading : t.income.empty}</p>
      )}

      {summaries.map((summary) => (
        <PoolSection
          key={summary.pool.id}
          summary={summary}
          locked={locked}
          kinds={addableKinds(summary.pool, sources)}
          // A picker left open behind a form would offer choices that go nowhere.
          picking={!locked && pickingPoolId === summary.pool.id}
          onAddIncome={() => handleAddIncome(summary.pool)}
          onPickKind={(kind) => handlePickKind(summary.pool.id, kind)}
          onEditIncome={(sourceId) => setEditing({ mode: 'edit', sourceId })}
          onEditActual={(sourceId) =>
            setEditing({ mode: 'actual', sourceId, seedFromGranted: false })
          }
          onDeleteIncome={(sourceId) => setPending({ target: 'source', sourceId })}
          onRenamePool={() => handleRenamePool(summary.pool.id, summary.pool.name)}
          onColorPool={() => setColoringPoolId(summary.pool.id)}
          onDeletePool={() => setPending({ target: 'pool', poolId: summary.pool.id })}
          renderSource={(source, merged) => renderSource(source, summary.pool, merged)}
          renderNewForm={
            editing?.mode === 'new' && editing.poolId === summary.pool.id
              ? // A fresh draft per kind: switching kinds re-seeds it rather than carrying
                // half a per-diem grant into a fixed one.
                () => (
                  <IncomeSourceForm
                    key={`new:${editing.kind}`}
                    campId={campId}
                    kind={editing.kind}
                    pool={summary.pool}
                    source={null}
                    blocks={[]}
                    onSave={handleSave}
                    onCancel={() => setEditing(null)}
                  />
                )
              : undefined
          }
        />
      ))}

      <footer className="income__totals">
        <p className="income__total-row">
          <span>{t.income.receivedTotal}</span>
          <strong>{format.euros(receivedTotalCents(summaries))}</strong>
        </p>
      </footer>

      <PoolColorDialog
        pool={coloringPool}
        onPick={handlePickColor}
        onClose={() => setColoringPoolId(null)}
      />

      <ConfirmDialog
        open={pending !== null}
        title={confirmContent.title}
        lines={confirmContent.lines}
        confirmLabel={t.pools.confirmDelete}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />
    </Screen>
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
      lines:
        summary.sources.length === 0
          ? [t.pools.deleteEmpty]
          : [t.pools.deleteSources(summary.sources.length, euros(summary.fundedCents))],
    }
  }

  const summary = summaries.find((s) => s.sources.some((src) => src.id === pending.sourceId))
  const source = summary?.sources.find((src) => src.id === pending.sourceId)
  if (summary === undefined || source === undefined) {
    return { title: t.pools.sourceDeleteTitleFallback, lines: [] }
  }

  // The pool stays behind, empty — it was created deliberately and carries the colour every
  // receipt in it wears, so say where the money goes from rather than implying it vanishes.
  return {
    title: t.pools.sourceDeleteTitle(sourceLabel(source, summary.pool)),
    lines: [t.pools.sourceDeleteLine(euros(sourceAmountCents(source, blocks)), summary.pool.name)],
  }
}

type PoolSectionProps = {
  summary: PoolSummary
  locked: boolean
  /** What this pool can still take. Empty when it is full — a Kaution pool that already
   *  has its one income — which is what hides its ＋. */
  kinds: IncomeKind[]
  /** True while this pool's "which kind?" menu is open. Only ever the everyday pool. */
  picking: boolean
  onAddIncome: () => void
  onPickKind: (kind: IncomeKind) => void
  onEditIncome: (sourceId: string) => void
  onEditActual: (sourceId: string) => void
  onDeleteIncome: (sourceId: string) => void
  onRenamePool: () => void
  onColorPool: () => void
  onDeletePool: () => void
  /** A render prop: the parent owns every card's props, this section owns the pool header
   *  and layout, so it stays ignorant of drafts, blocks and saving. `merged` tells the
   *  parent that this section's header is already naming the income. */
  renderSource: (source: IncomeSource, merged: boolean) => React.ReactNode
  /** Present only while a brand-new income is being added to *this* pool. */
  renderNewForm?: () => React.ReactNode
}

function PoolSection({
  summary,
  locked,
  kinds,
  picking,
  onAddIncome,
  onPickKind,
  onEditIncome,
  onEditActual,
  onDeleteIncome,
  onRenamePool,
  onColorPool,
  onDeletePool,
  renderSource,
  renderNewForm,
}: PoolSectionProps) {
  const t = useT()
  const format = useFormat()
  const { pool, sources } = summary
  // The everyday pool outlives every source in it, so it offers no Delete at all.
  const deletable = pool.role !== 'everyday'
  const isDeposit = pool.role === 'deposit'

  // A pool holding exactly one income is one thing, not a box inside a box: the header
  // speaks for both, so the income's Edit and Delete join the pool's own menu.
  const merged = sources.length === 1 ? sources[0] : undefined

  const menu: RowMenuItem[] = [
    ...(merged === undefined
      ? []
      : [{ label: t.pools.editIncome, onSelect: () => onEditIncome(merged.id) }]),
    ...(merged === undefined || merged.kind !== 'per_diem'
      ? []
      : [{ label: t.rowMenu.editActual, onSelect: () => onEditActual(merged.id) }]),
    { label: t.pools.rename, onSelect: onRenamePool },
    { label: t.pools.color, onSelect: onColorPool },
    ...(merged === undefined
      ? []
      : [{ label: t.pools.deleteIncome, danger: true, onSelect: () => onDeleteIncome(merged.id) }]),
    ...(deletable ? [{ label: t.pools.delete, danger: true, onSelect: onDeletePool }] : []),
  ]

  return (
    <section className={isDeposit ? 'pool pool--deposit' : 'pool'}>
      <header className="pool__header">
        <h3 className="pool__name">
          <PoolTag pool={pool} variant="dot" />
          {pool.name}
          {/* Money that is only passing through: it is in the camp's hands but never the
              camp's to spend, which is worth saying on the pot itself. */}
          {isDeposit && <span className="pool__badge">{t.pools.roles.deposit.label}</span>}
        </h3>
        <span className="pool__total">{format.euros(summary.fundedCents)}</span>
        {kinds.length > 0 && (
          <button
            className="pool__add"
            type="button"
            disabled={locked}
            aria-label={t.pools.addIncomeTo(pool.name)}
            onClick={onAddIncome}
          >
            ＋
          </button>
        )}
        <RowMenu label={pool.name} disabled={locked} items={menu} />
      </header>

      {isDeposit && sources.length > 0 && <p className="pool__note">{t.pools.depositNote}</p>}

      {picking && (
        <div className="type-menu">
          {kinds.map((kind) => (
            <button
              key={kind}
              className="type-menu__option"
              type="button"
              onClick={() => onPickKind(kind)}
            >
              <span className="type-menu__label">{t.income.kinds[kind].label}</span>
              <span className="type-menu__hint">{t.income.kinds[kind].hint}</span>
            </button>
          ))}
        </div>
      )}

      {sources.map((source) => renderSource(source, merged !== undefined))}

      {renderNewForm?.()}

      {/* A pool is created before it is funded, so an empty one is a normal state — but a
          silent empty box would read as something failing to load. */}
      {sources.length === 0 && renderNewForm === undefined && !picking && (
        <p className="pool__empty">{t.pools.emptyPool}</p>
      )}
    </section>
  )
}
