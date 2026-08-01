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
        onOpenReceipts={vi.fn()}
        onOpenMovements={vi.fn()}
        onOpenSettlement={vi.fn()}
        onOpenSettings={onOpenSettings}
        {...props}
      />
    </I18nProvider>,
  )
  return { onOpenIncome, onOpenSettings, user }
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

  it('says the camp has no dates yet when nothing dates it', () => {
    // The status pill reads the burn window, which is derived from the per-diem blocks.
    renderDashboard()
    expect(screen.getByText(en.camps.status.draft)).toBeInTheDocument()
  })

  it('says the camp is running when today falls inside the block window', () => {
    renderDashboard({
      burn: { ...emptyBurn, window: { startIso: '2026-07-01', endIso: '2026-07-14' } },
    })
    expect(screen.getByText(en.camps.status.running)).toBeInTheDocument()
  })
})
