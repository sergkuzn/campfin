import { useMemo, useState } from 'react'
import './IncomeSetup.css'
import type { UseIncome } from '../hooks/useIncome'
import { type Dict, useFormat, useT } from '../i18n'
import { blocksOf, perDiemTotals } from '../lib/budget'
import {
  inputAmountCents,
  type SaveBlocksInput,
  type SavePoolInput,
  type SaveSourceInput,
} from '../lib/drafts'
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
import { InfoToggle } from './InfoToggle'
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
  /** A group-money income waiting on "is that what arrived?". Held here, unsaved, while the
   *  form stays open behind the question — so "No" drops straight back into the draft. */
  const [checking, setChecking] = useState<SaveSourceInput | null>(null)
  // The pool whose colour is being picked, by id — looked up fresh on every render, so a
  // pool renamed or deleted by the other leader mid-sync retitles or closes the dialog.
  const [coloringPoolId, setColoringPoolId] = useState<string | null>(null)
  const coloringPool = pools.find((pool) => pool.id === coloringPoolId) ?? null

  // One form open at a time: every other action on the screen goes inert. This single
  // flag replaces every "you have unsaved changes" dialog.
  const locked = editing !== null

  const commitSave = (input: SaveSourceInput) => {
    income.saveSource(input)
    setEditing(null)
  }

  /**
   * Group money is the one income the whole budget runs on, and a per-diem grant is easy to
   * fill with who actually came instead of who it was paid for. So saving one first asks
   * whether that is the amount that arrived — unless an edit left the amount as it was,
   * which has nothing new to confirm.
   */
  const handleSave = (input: SaveSourceInput) => {
    const pool = pools.find((candidate) => candidate.id === input.poolId)
    const unchanged =
      input.existing !== null &&
      inputAmountCents(input) === sourceAmountCents(input.existing, blocks)
    if (pool?.role === 'everyday' && !unchanged) setChecking(input)
    else commitSave(input)
  }

  const handleConfirmReceived = () => {
    if (checking !== null) commitSave(checking)
    setChecking(null)
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
  const receivedContent = describeReceivedCheck(checking, summaries, blocks, t, format.euros)

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
        <h2 className="screen__title">{t.income.title}</h2>
        {/* On demand rather than always on screen: "what is a pool" is a question you have
            once, and a permanent paragraph would cost every later visit a scroll. */}
        <InfoToggle
          label={t.pools.aboutLabel}
          open={showPoolHint}
          controls="income-pools-hint"
          onToggle={() => setShowPoolHint((shown) => !shown)}
        />
        <button
          className="btn btn--primary income__add"
          type="button"
          disabled={locked}
          onClick={() => setEditing({ mode: 'pool' })}
        >
          {t.pools.add}
        </button>
      </header>

      {showPoolHint && (
        <ul className="income__hint" id="income-pools-hint">
          {t.pools.about.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

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

      <ConfirmDialog
        open={checking !== null}
        title={receivedContent.title}
        lines={receivedContent.lines}
        confirmLabel={t.pools.receivedConfirm}
        cancelLabel={t.pools.receivedChange}
        tone="primary"
        onConfirm={handleConfirmReceived}
        onCancel={() => setChecking(null)}
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

/**
 * The "is that what arrived?" question. It quotes the pool's total as it will be after the
 * save, since that is the sum the camp was actually handed — and, when other incomes share the
 * pool, how that total splits, so a leader comparing against one transfer is not misled.
 */
function describeReceivedCheck(
  input: SaveSourceInput | null,
  summaries: PoolSummary[],
  blocks: PerDiemBlock[],
  t: Dict,
  euros: (cents: number) => string,
): { title: string; lines: string[] } {
  if (input === null) return { title: '', lines: [] }

  const summary = summaries.find((s) => s.pool.id === input.poolId)
  const incomeCents = inputAmountCents(input)
  // Every other income in the pool, as stored — the one being edited is replaced by the draft.
  const restCents = (summary?.sources ?? [])
    .filter((source) => source.id !== input.existing?.id)
    .reduce((sum, source) => sum + sourceAmountCents(source, blocks), 0)

  return {
    title: t.pools.receivedTitle(
      euros(incomeCents + restCents),
      summary?.pool.name ?? t.pools.everydayDefault,
    ),
    lines: [
      ...(restCents > 0 ? [t.pools.receivedWithOthers(euros(incomeCents), euros(restCents))] : []),
      t.pools.receivedMatch,
      ...(input.kind === 'per_diem' ? [t.pools.receivedActual] : []),
    ],
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
  const isEveryday = pool.role === 'everyday'
  // The "how Group money works" explainer, revealed on demand on the everyday pool only.
  const [showAbout, setShowAbout] = useState(false)

  // The last word of the name and the ⓘ travel as one unbreakable unit, so a header squeezed
  // by a long amount wraps the name between words instead of dropping the ⓘ onto a line of
  // its own. Everything before that last word still wraps normally.
  const lastSpace = pool.name.lastIndexOf(' ')
  const nameHead = pool.name.slice(0, lastSpace + 1)
  const nameTail = pool.name.slice(lastSpace + 1)

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
          <span className="pool__label">
            {nameHead}
            <span className="pool__label-end">
              {nameTail}
              {/* Sits inside the heading, right after the name, so it reads as part of the
                  label rather than a control floating in the header. */}
              {isEveryday && (
                <InfoToggle
                  label={t.pools.everydayAboutLabel}
                  open={showAbout}
                  // Scoped to the pool: several cards render at once, and a duplicated id
                  // would point every ⓘ at the first card's paragraph.
                  controls={`pool-about-${pool.id}`}
                  onToggle={() => setShowAbout((shown) => !shown)}
                />
              )}
            </span>
          </span>
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

      {isEveryday && showAbout && (
        <ul className="pool__hint" id={`pool-about-${pool.id}`}>
          {t.pools.everydayAbout.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

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
