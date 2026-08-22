import { render, screen, within } from '@testing-library/react'
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

/** Somebody else's money passing through: it belongs to the deposits block, never to the
 *  spending bars. */
const depositPool: PoolSummary = {
  ...emptyPool,
  pool: { id: 'pool-d', campId: 'c1', name: 'Bus deposit', role: 'deposit', createdAt: 2 },
  fundedCents: 20_000,
  entitledCents: 20_000,
  remainingCents: 20_000,
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

  it('opens the whole receipt list from anywhere on the spending card', async () => {
    const { user, onOpenReceipts } = renderDashboard({ summaries: [fundedPool, depositPool] })

    // The card is one button; a pool's own figures are part of its accessible name, so
    // pressing on a bar is pressing the card.
    await user.click(screen.getByRole('button', { name: new RegExp(fundedPool.pool.name) }))
    expect(onOpenReceipts).toHaveBeenCalledWith(null)
  })

  it('leaves the pool bars as a readout rather than controls of their own', async () => {
    const { user, onOpenReceipts } = renderDashboard({ summaries: [fundedPool] })

    // One button for the card, not one per pool: a nested control would be both invalid
    // inside a <button> and a second target on a row that is only there to be read.
    const spending = screen.getByRole('button', { name: new RegExp(en.dashboard.spending) })
    expect(within(spending).queryAllByRole('button')).toHaveLength(0)

    await user.click(screen.getByText(fundedPool.pool.name))
    expect(onOpenReceipts).toHaveBeenCalledWith(null)
  })

  it('keeps deposits out of the spending block — they have a block of their own', () => {
    renderDashboard({ summaries: [fundedPool, depositPool] })

    expect(screen.getByText(fundedPool.pool.name)).toBeInTheDocument()
    expect(screen.queryByText(depositPool.pool.name)).not.toBeInTheDocument()
  })

  it('offers no way to enter a receipt from the dashboard itself', () => {
    // The block header leads to the receipts screen; nothing here writes one.
    renderDashboard({ summaries: [fundedPool] })
    expect(screen.queryByLabelText(en.receipts.amountLabel)).not.toBeInTheDocument()
  })

  it('opens each block’s screen from its title row', async () => {
    const { user, onOpenReceipts, onOpenMovements, onOpenSettlement } = renderDashboard({
      summaries: [fundedPool],
    })

    // Null, not a pool: the header opens the list whole.
    await user.click(slotHeader(en.dashboard.openReceipts))
    expect(onOpenReceipts).toHaveBeenCalledWith(null)

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
