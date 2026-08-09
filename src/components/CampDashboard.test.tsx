import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import { emptyBurn } from '../lib/burn'
import type { PoolSummary } from '../lib/pools'
import type { Settlement } from '../lib/settlement'
import type { Camp } from '../lib/types'
import { CampDashboard } from './CampDashboard'

const camp: Camp = {
  id: 'c1',
  name: 'Moorwerder',
  joinCode: 'MOOR-7F3K',
  createdAt: 1_700_000_000_000,
}

/** The everyday pool a camp is born with: it exists from the first second and holds
 *  nothing, which is exactly the state the first-step screen is for. */
const emptyPool: PoolSummary = {
  pool: { id: 'pool-e', campId: 'c1', name: 'Group money', role: 'everyday', createdAt: 1 },
  sources: [],
  fundedCents: 0,
  entitledCents: 0,
  unusableCents: 0,
  spentCents: 0,
  remainingCents: 0,
}

const fundedPool: PoolSummary = {
  ...emptyPool,
  sources: [
    {
      id: 's1',
      campId: 'c1',
      poolId: 'pool-e',
      kind: 'fixed',
      name: 'Grant',
      amountCents: 30_000,
      createdAt: 1,
    },
  ],
  fundedCents: 30_000,
  entitledCents: 30_000,
  remainingCents: 30_000,
}

const settlement: Settlement = {
  receivedTotalCents: 0,
  spentTotalCents: 0,
  toReturnCents: 0,
  rows: [],
  warnings: [],
  pools: [],
}

function renderDashboard(props: Partial<React.ComponentProps<typeof CampDashboard>> = {}) {
  const onOpenIncome = vi.fn()
  const onOpenSettings = vi.fn()
  const onAddExpense = vi.fn()
  const onOpenReceipts = vi.fn()
  const onOpenMovements = vi.fn()
  const onOpenSettlement = vi.fn()
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <CampDashboard
        camp={camp}
        summaries={[emptyPool]}
        burn={emptyBurn}
        todayIso="2026-07-05"
        isLoading={false}
        error={null}
        hasExpenses={false}
        custody={{ statuses: [], volunteerHeldCents: 0, volunteerCount: 0 }}
        settlement={settlement}
        onAddExpense={onAddExpense}
        onBack={vi.fn()}
        onOpenIncome={onOpenIncome}
        onOpenReceipts={onOpenReceipts}
        onOpenMovements={onOpenMovements}
        onOpenSettlement={onOpenSettlement}
        onOpenSettings={onOpenSettings}
        {...props}
      />
    </I18nProvider>,
  )
  return {
    onOpenIncome,
    onOpenSettings,
    onAddExpense,
    onOpenReceipts,
    onOpenMovements,
    onOpenSettlement,
    user,
  }
}

/** A block header names itself "<visible title> <screen-reader-only destination>", so the
 *  destination alone identifies it — matched as a regex because the title comes first. */
function slotHeader(action: string) {
  return screen.getByRole('button', { name: new RegExp(action) })
}

describe('CampDashboard', () => {
  it('shows nothing but the first step while the camp has no money in it', () => {
    renderDashboard()

    expect(screen.getByRole('button', { name: en.dashboard.firstStep })).toBeInTheDocument()
    // The blocks that would all be empty stay away until there is something in them.
    expect(screen.queryByText(en.dashboard.spending)).not.toBeInTheDocument()
    expect(screen.queryByText(en.burn.title)).not.toBeInTheDocument()
    expect(screen.queryByText(en.settlement.toReturn)).not.toBeInTheDocument()
  })

  it('waits for the query before claiming the camp is empty', () => {
    // A funded camp mid-load looks exactly like a fresh one; telling the user to set up
    // income they already entered would be the wrong instruction, not just a flicker.
    renderDashboard({ isLoading: true })

    expect(screen.getByText(en.app.loading)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en.dashboard.firstStep })).not.toBeInTheDocument()
  })

  it('opens the income screen from the first step', async () => {
    const { user, onOpenIncome } = renderDashboard()
    await user.click(screen.getByRole('button', { name: en.dashboard.firstStep }))

    expect(onOpenIncome).toHaveBeenCalledOnce()
  })

  it('shows the money blocks once income has been set up', () => {
    renderDashboard({ summaries: [fundedPool] })

    expect(screen.getByText(en.dashboard.spending)).toBeInTheDocument()
    expect(screen.getByText(en.settlement.toReturn)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en.dashboard.firstStep })).not.toBeInTheDocument()
  })

  it('keeps the received total off the main screen — it lives in settings now', () => {
    renderDashboard({ summaries: [fundedPool] })

    expect(screen.queryByText(en.dashboard.receivedTotal)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en.dashboard.setUpIncome })).not.toBeInTheDocument()
    // The join code moved with it: the dashboard is money only.
    expect(screen.queryByText('MOOR-7F3K')).not.toBeInTheDocument()
  })

  it('shows the money blocks for a camp with receipts but no income yet', () => {
    // Unusual, but real: a receipt entered before the grant was recorded must not be
    // hidden behind the first-step screen.
    renderDashboard({ hasExpenses: true })

    expect(screen.getByText(en.dashboard.spending)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en.dashboard.firstStep })).not.toBeInTheDocument()
  })

  it('opens the settings screen from the gear', async () => {
    const { user, onOpenSettings } = renderDashboard()
    await user.click(screen.getByRole('button', { name: en.dashboard.openSettings }))

    expect(onOpenSettings).toHaveBeenCalledOnce()
  })

  it('shows no status pill while nothing dates the camp', () => {
    // The status pill reads the burn window, which is derived from the per-diem blocks.
    renderDashboard()
    expect(screen.queryByText(en.camps.status.running)).not.toBeInTheDocument()
    expect(screen.queryByText(en.camps.status.upcoming)).not.toBeInTheDocument()
    expect(screen.queryByText(en.camps.status.finished)).not.toBeInTheDocument()
  })

  it('adds a receipt to the pool whose ＋ was tapped, without a pool picker', async () => {
    const { user, onAddExpense } = renderDashboard({ summaries: [fundedPool] })

    await user.click(screen.getByRole('button', { name: en.bars.addTo(fundedPool.pool.name) }))
    // Which pool is settled by the button, so the dialog names it instead of asking.
    expect(screen.getByText(en.receipts.quickTitle('Group money'))).toBeInTheDocument()
    expect(screen.queryByLabelText(en.receipts.poolLabel)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(en.receipts.amountLabel), '8,00')
    await user.type(screen.getByLabelText(en.receipts.nameLabel), 'Bakery')
    await user.click(screen.getByRole('button', { name: en.receipts.save }))

    expect(onAddExpense).toHaveBeenCalledWith({
      existing: null,
      campId: 'c1',
      poolId: 'pool-e',
      name: 'Bakery',
      amountCents: 800, // euros as typed, cents on the way out
      date: '2026-07-05', // today, unasked
      note: undefined,
    })
  })

  it('will not save a receipt with no amount', async () => {
    const { user, onAddExpense } = renderDashboard({ summaries: [fundedPool] })
    await user.click(screen.getByRole('button', { name: en.bars.addTo(fundedPool.pool.name) }))

    // An untouched draft says nothing — the complaints appear only once something is typed.
    expect(screen.queryByText(en.receipts.issues.amount)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(en.receipts.nameLabel), 'Bakery')

    expect(screen.getByText(en.receipts.issues.amount)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: en.receipts.save }))
    expect(onAddExpense).not.toHaveBeenCalled()
  })

  it('drops the half-typed draft when the dialog is cancelled', async () => {
    const { user } = renderDashboard({ summaries: [fundedPool] })
    const add = screen.getByRole('button', { name: en.bars.addTo(fundedPool.pool.name) })

    await user.click(add)
    await user.type(screen.getByLabelText(en.receipts.nameLabel), 'Bakery')
    await user.click(screen.getByRole('button', { name: en.receipts.cancel }))

    await user.click(add)
    expect(screen.getByLabelText(en.receipts.nameLabel)).toHaveValue('')
  })

  it('opens each block’s screen from its title row', async () => {
    const { user, onOpenReceipts, onOpenMovements, onOpenSettlement } = renderDashboard({
      summaries: [fundedPool],
    })

    await user.click(slotHeader(en.dashboard.openReceipts))
    expect(onOpenReceipts).toHaveBeenCalledOnce()

    // The two custody blocks share one screen, so the header has to say which half.
    await user.click(slotHeader(en.custody.deposits.open))
    expect(onOpenMovements).toHaveBeenCalledWith('deposits')

    await user.click(slotHeader(en.custody.cash.open))
    expect(onOpenMovements).toHaveBeenLastCalledWith('cash')

    await user.click(slotHeader(en.settlement.open))
    expect(onOpenSettlement).toHaveBeenCalledOnce()
  })

  it('leaves the chart block with no way in — it has no screen of its own', () => {
    renderDashboard({
      summaries: [fundedPool],
      burn: { ...emptyBurn, window: { startIso: '2026-07-01', endIso: '2026-07-14' } },
    })

    expect(screen.getByText(en.burn.title)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: new RegExp(en.burn.title) }),
    ).not.toBeInTheDocument()
  })

  it('says the camp is running when today falls inside the block window', () => {
    renderDashboard({
      burn: { ...emptyBurn, window: { startIso: '2026-07-01', endIso: '2026-07-14' } },
    })
    expect(screen.getByText(en.camps.status.running)).toBeInTheDocument()
  })
})
