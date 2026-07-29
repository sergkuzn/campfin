/**
 * The English dictionary — and, via `Dict = typeof en`, the contract every other
 * language must satisfy. A future `de.ts` typed `const de: Dict` fails `tsc` when it
 * misses a key, instead of rendering `undefined` at camp.
 *
 * Interpolation is done with functions rather than `{placeholder}` templates: the
 * arguments are type-checked, there is no template parser, and a missing variable is a
 * compile error rather than a hole in the sentence.
 */
export const en = {
  /**
   * How amounts are written. Deliberately not tied to the UI language: euros are typed
   * and read German-style at camp ("12,50"), so an English UI still formats de-DE. One
   * field per locale to change that.
   */
  numberLocale: 'de-DE',

  app: {
    title: 'campfin',
    subtitle: 'Camp budget tracker',
  },

  camps: {
    nameLabel: 'New camp name',
    namePlaceholder: 'New camp name…',
    create: 'Create',
    empty: 'No camps yet. Create one above.',
    nameTaken: (name: string) => `A camp named "${name}" already exists.`,
    status: {
      draft: 'No dates yet',
      upcoming: 'Upcoming',
      running: 'Running',
      finished: 'Finished',
    },
  },

  dashboard: {
    back: '← All camps',
    joinCode: 'Join code',
    receivedTotal: 'Received total',
    noIncome: 'No income sources yet.',
    setUpIncome: 'Set up income →',
    spending: 'Spending',
    noQuittungs: 'No quittungs yet.',
    rename: 'Rename',
    renamePrompt: 'Rename camp',
    delete: 'Delete camp',
    deleteConfirm: (name: string) => `Delete "${name}"? This cannot be undone.`,
  },

  income: {
    back: '← Back to camp',
    title: 'Set up income',
    add: '＋ Add income',
    empty: 'No income yet — tap ＋ Add income.',
    receivedTotal: 'Received total',
    nameLabel: 'Income name',
    namePlaceholder: 'Name, e.g. Verpflegungspauschale',
    amountLabel: 'Amount',
    amountPlaceholder: '€ e.g. 300,00',
    personDaysTotal: 'Total person-days',
    sourceTotal: 'Source total',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    kinds: {
      per_diem: {
        label: 'Per person, per day',
        hint: 'Verpflegungspauschale — people × days × rate',
      },
      fixed: {
        label: 'Fixed amount',
        hint: 'One lump sum for the camp',
      },
      deposit: {
        label: 'Deposit',
        hint: 'You hand it back at the end',
      },
    },
    issues: {
      name: 'Give this income a name.',
      poolName: 'Name the new pool.',
      noBlocks: 'Add at least one block of people and days.',
      invalidBlock: 'Every block needs people, dates (start before end) and a rate.',
      amount: 'Enter an amount in euros, e.g. 120,00.',
    },
  },

  pools: {
    /** Seeded into the camp's everyday pool at creation, then owned by the user —
     *  switching language later must never rename their pools. */
    everydayDefault: 'Everyday',
    actions: (name: string) => `Actions for ${name}`,
    rename: 'Rename pool',
    renamePrompt: 'Rename pool',
    delete: 'Delete pool',
    confirmDelete: 'Delete',
    deleteTitle: (name: string) => `Delete the ${name} pool?`,
    deleteTitleFallback: 'Delete pool?',
    deleteSources: (count: number, amount: string) =>
      `Its ${count} income ${count === 1 ? 'source' : 'sources'} worth ${amount} will be deleted too.`,
    sourceDeleteTitle: (name: string) => `Delete "${name}"?`,
    sourceDeleteTitleFallback: 'Delete this income?',
    sourceDeleteLine: (amount: string, pool: string) =>
      `This removes ${amount} from the ${pool} pool.`,
    sourceDeleteLastLine: (pool: string) =>
      `The ${pool} pool goes with it — it has no other income.`,
  },

  blocks: {
    empty: 'No blocks yet — add one below.',
    legend: (index: number) => `Block ${index}`,
    remove: (index: number) => `Remove block ${index}`,
    fallbackLabel: 'Block',
    nameLabel: 'Block name',
    namePlaceholder: 'e.g. Participants',
    peopleLabel: 'Number of people',
    peoplePlaceholder: 'e.g. 24',
    rateLabel: 'Rate per person / day',
    ratePlaceholder: '€ e.g. 12,50',
    startLabel: 'Start date',
    endLabel: 'End date',
    add: '＋ Add block',
    personDays: (n: number) => `${n} person-day${n === 1 ? '' : 's'}`,
    personDaysUnknown: '— person-days',
    days: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
    peopleAtRate: (people: number, rate: string) => `${people} ppl × ${rate}/day`,
  },

  poolSelect: {
    label: 'Pool',
    newOption: '＋ New pool…',
    newNameLabel: 'New pool name',
    newNamePlaceholder: 'e.g. Everyday',
    copyName: '⧉ Same as income name',
  },
}
