import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import { emptyBurn } from '../lib/burn'
import type { PoolSummary } from '../lib/pools'
import type { Camp } from '../lib/types'
import { CampDashboard } from './CampDashboard'

const camp: Camp = {
  id: 'c1',
  name: 'Moorwerder',
  joinCode: 'MOOR-7F3K',
  createdAt: 1_700_000_000_000,
}

/** A camp past the first of the two setup steps. The default for every test that is not
 *  about the checklist, since the hub only appears once somebody holds the money. */
const heldCamp: Camp = { ...camp, moneyHolder: 'Anna' }

/** The everyday pool a camp is born with: it exists from the first second and holds
 *  nothing, which is exactly the state the setup checklist is for. */
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
 *  pool bars. */
const depositPool: PoolSummary = {
  ...emptyPool,
  pool: { id: 'pool-d', campId: 'c1', name: 'Bus deposit', role: 'deposit', createdAt: 2 },
  fundedCents: 20_000,
  entitledCents: 20_000,
  remainingCents: 20_000,
}

function renderDashboard(props: Partial<React.ComponentProps<typeof CampDashboard>> = {}) {
  const onOpenIncome = vi.fn()
  const onOpenSettings = vi.fn()
  const onOpenReceipts = vi.fn()
  const onOpenMovements = vi.fn()
  const onOpenReport = vi.fn()
  const onChangeHolder = vi.fn()
  const onSetHiddenEntries = vi.fn()
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <CampDashboard
        camp={heldCamp}
        summaries={[emptyPool]}
        burn={emptyBurn}
        todayIso="2026-07-05"
        isLoading={false}
        error={null}
        hasExpenses={false}
        otherExpensesTotalCents={0}
        custody={{ statuses: [], feeHeldCents: 0, feeCount: 0 }}
        onBack={vi.fn()}
        onOpenIncome={onOpenIncome}
        onChangeHolder={onChangeHolder}
        onOpenReceipts={onOpenReceipts}
        onOpenMovements={onOpenMovements}
        onOpenOtherExpenses={vi.fn()}
        onOpenReport={onOpenReport}
        onOpenSettings={onOpenSettings}
        onSetHiddenEntries={onSetHiddenEntries}
        {...props}
      />
    </I18nProvider>,
  )
  return {
    onOpenIncome,
    onOpenSettings,
    onOpenReceipts,
    onOpenMovements,
    onOpenReport,
    onChangeHolder,
    onSetHiddenEntries,
    user,
  }
}

/** A block header names itself "<visible title> <screen-reader-only destination>", so the
 *  destination alone identifies it — matched as a regex because the title comes first. */
function slotHeader(action: string) {
  return screen.getByRole('button', { name: new RegExp(action) })
}

describe('CampDashboard', () => {
  it('shows nothing but the setup checklist while the camp has no money in it', () => {
    renderDashboard()

    expect(screen.getByText(en.setup.title)).toBeInTheDocument()
    // The blocks that would all be empty stay away until there is something in them.
    expect(screen.queryByText(en.dashboard.receipts)).not.toBeInTheDocument()
    expect(screen.queryByText(en.burn.title)).not.toBeInTheDocument()
    expect(screen.queryByText(en.report.title)).not.toBeInTheDocument()
  })

  it('keeps a funded camp on the checklist while nobody holds the money', () => {
    // Both answers are compulsory: income alone is not enough, because every "owed"
    // marker on the hub is measured against the holder.
    renderDashboard({ camp, summaries: [fundedPool] })

    expect(screen.getByText(en.setup.title)).toBeInTheDocument()
    expect(screen.queryByText(en.dashboard.receipts)).not.toBeInTheDocument()
  })

  it('waits for the query before claiming the camp is empty', () => {
    // A funded camp mid-load looks exactly like a fresh one; telling the user to set up
    // income they already entered would be the wrong instruction, not just a flicker.
    renderDashboard({ isLoading: true })

    expect(screen.getByText(en.app.loading)).toBeInTheDocument()
    expect(screen.queryByText(en.setup.title)).not.toBeInTheDocument()
  })

  it('opens the income screen from the checklist', async () => {
    const { user, onOpenIncome } = renderDashboard()
    await user.click(screen.getByRole('button', { name: en.setup.incomeGo }))

    expect(onOpenIncome).toHaveBeenCalledOnce()
  })

  it('names the money holder from the checklist, trimmed', async () => {
    const { user, onChangeHolder } = renderDashboard({ camp })
    await user.type(screen.getByLabelText(en.campSettings.holderNewNameLabel), '  Anna  ')
    await user.click(screen.getByRole('button', { name: en.campSettings.holderSave }))

    expect(onChangeHolder).toHaveBeenCalledExactlyOnceWith('Anna')
  })

  it('ticks the finished step and keeps it on the list', () => {
    // The holder is already named here, so its step shows the name rather than the field.
    renderDashboard()

    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.queryByLabelText(en.campSettings.holderNewNameLabel)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.campSettings.holderChange })).toBeInTheDocument()
  })

  it('shows the money blocks once both setup steps are answered', () => {
    renderDashboard({ summaries: [fundedPool] })

    expect(screen.getByText(en.dashboard.receipts)).toBeInTheDocument()
    expect(screen.getByText(en.report.title)).toBeInTheDocument()
    expect(screen.queryByText(en.setup.title)).not.toBeInTheDocument()
  })

  it('keeps the received total off the main screen — it lives in settings now', () => {
    renderDashboard({ summaries: [fundedPool] })

    expect(screen.queryByText(en.dashboard.receivedTotal)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en.dashboard.setUpIncome })).not.toBeInTheDocument()
    // The join code moved with it: the dashboard is money only.
    expect(screen.queryByText('MOOR-7F3K')).not.toBeInTheDocument()
  })

  it('keeps a camp with receipts but no income on the checklist', () => {
    // A receipt entered before the grant does not complete the setup: its pool bar and
    // its "owed" marker have nothing to be measured against yet.
    renderDashboard({ hasExpenses: true })

    expect(screen.getByText(en.setup.title)).toBeInTheDocument()
    expect(screen.queryByText(en.dashboard.receipts)).not.toBeInTheDocument()
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

  it('opens the whole receipt list from anywhere on the receipts card', async () => {
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
    const receipts = screen.getByRole('button', { name: new RegExp(en.dashboard.receipts) })
    expect(within(receipts).queryAllByRole('button')).toHaveLength(0)

    await user.click(screen.getByText(fundedPool.pool.name))
    expect(onOpenReceipts).toHaveBeenCalledWith(null)
  })

  it('keeps deposits out of the receipts block — they have a block of their own', () => {
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
    const { user, onOpenReceipts, onOpenMovements, onOpenReport } = renderDashboard({
      summaries: [fundedPool],
    })

    // Null, not a pool: the header opens the list whole.
    await user.click(slotHeader(en.dashboard.openReceipts))
    expect(onOpenReceipts).toHaveBeenCalledWith(null)

    // The two custody blocks share one screen, so the header has to say which half.
    await user.click(slotHeader(en.custody.deposits.open))
    expect(onOpenMovements).toHaveBeenCalledWith('deposits')

    await user.click(slotHeader(en.custody.fee.open))
    expect(onOpenMovements).toHaveBeenLastCalledWith('fee')

    await user.click(slotHeader(en.report.open))
    expect(onOpenReport).toHaveBeenCalledOnce()
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

  it('leaves a hidden card out of the group', () => {
    renderDashboard({
      camp: { ...heldCamp, hiddenEntries: 'fee,other' },
      summaries: [fundedPool],
    })

    expect(screen.getByText(en.dashboard.receipts)).toBeInTheDocument()
    expect(screen.getByText(en.custody.deposits.title)).toBeInTheDocument()
    expect(screen.queryByText(en.custody.fee.title)).not.toBeInTheDocument()
    expect(screen.queryByText(en.otherExpenses.title)).not.toBeInTheDocument()
  })

  it('brings every card back while customising, so a hidden screen is still reachable', async () => {
    const { user } = renderDashboard({
      camp: { ...heldCamp, hiddenEntries: 'fee' },
      summaries: [fundedPool],
    })
    await user.click(screen.getByRole('button', { name: en.dashboard.customiseEntries }))

    expect(screen.getByText(en.custody.fee.title)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.dashboard.doneCustomising })).toBeInTheDocument()
  })

  it('hides a card from its own toggle, writing the whole set', async () => {
    const { user, onSetHiddenEntries } = renderDashboard({
      camp: { ...heldCamp, hiddenEntries: 'other' },
      summaries: [fundedPool],
    })
    await user.click(screen.getByRole('button', { name: en.dashboard.customiseEntries }))
    await user.click(
      screen.getByRole('button', { name: en.dashboard.hideEntry(en.custody.fee.title) }),
    )

    // The whole set, in slot order — a partial write would let two phones customising at
    // once settle on a half-hidden group.
    expect(onSetHiddenEntries).toHaveBeenCalledExactlyOnceWith('fee,other')
  })

  it('shows a hidden card again, clearing the field when it was the last one', async () => {
    const { user, onSetHiddenEntries } = renderDashboard({
      camp: { ...heldCamp, hiddenEntries: 'fee' },
      summaries: [fundedPool],
    })
    await user.click(screen.getByRole('button', { name: en.dashboard.customiseEntries }))
    await user.click(
      screen.getByRole('button', { name: en.dashboard.showEntry(en.custody.fee.title) }),
    )

    expect(onSetHiddenEntries).toHaveBeenCalledExactlyOnceWith('')
  })

  it('draws the bare verb but still announces which card it acts on', async () => {
    const { user } = renderDashboard({
      camp: { ...heldCamp, hiddenEntries: 'fee' },
      summaries: [fundedPool],
    })
    await user.click(screen.getByRole('button', { name: en.dashboard.customiseEntries }))

    // The card's title sits beside the button, so the eye needs no more than "Show" — but a
    // screen reader reaches the button alone, and the label is what names the card for it.
    const show = screen.getByRole('button', {
      name: en.dashboard.showEntry(en.custody.fee.title),
    })
    expect(show).toHaveTextContent(en.dashboard.show)
    expect(show).not.toHaveTextContent(en.custody.fee.title)
  })

  it('offers no toggle for receipts — every camp writes them', async () => {
    const { user } = renderDashboard({ summaries: [fundedPool] })
    await user.click(screen.getByRole('button', { name: en.dashboard.customiseEntries }))

    expect(
      screen.queryByRole('button', { name: en.dashboard.hideEntry(en.dashboard.receipts) }),
    ).not.toBeInTheDocument()
    // It also keeps leading somewhere, unlike the cards being configured around it.
    expect(slotHeader(en.dashboard.openReceipts)).toBeInTheDocument()
  })

  it('stops a card being configured from leading anywhere', async () => {
    // A button inside a button is invalid HTML, so a card wearing a toggle is a plain
    // section: the toggle is the only thing on it to press.
    const { user, onOpenMovements } = renderDashboard({ summaries: [fundedPool] })
    await user.click(screen.getByRole('button', { name: en.dashboard.customiseEntries }))

    expect(
      screen.queryByRole('button', { name: new RegExp(en.custody.deposits.open) }),
    ).not.toBeInTheDocument()
    expect(onOpenMovements).not.toHaveBeenCalled()
  })

  it('says the camp is running when today falls inside the block window', () => {
    renderDashboard({
      burn: { ...emptyBurn, window: { startIso: '2026-07-01', endIso: '2026-07-14' } },
    })
    expect(screen.getByText(en.camps.status.running)).toBeInTheDocument()
  })
})
