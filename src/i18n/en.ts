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
   * and read German-style at camp ("8,00"), so an English UI still formats de-DE. One
   * field per locale to change that.
   */
  numberLocale: 'de-DE',

  /**
   * How dates are written. This one *does* follow the UI language — a German weekday in an
   * English sentence reads like a bug, while "8,00" does not. Day-first either way.
   */
  dateLocale: 'en-GB',

  app: {
    title: 'campfin',
    subtitle: 'Camp budget tracker',
    loading: 'Loading…',
  },

  auth: {
    title: 'Sign in',
    intro:
      "Enter your email and we'll send you a six-digit code. The first sign-in creates your account.",
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    sendCode: 'Send code',
    sending: 'Sending…',
    codeTitle: 'Enter your code',
    codeIntro: (email: string) => `We sent a code to ${email}. Paste it here.`,
    codeLabel: 'Verification code',
    codePlaceholder: '123456',
    verify: 'Sign in',
    otherEmail: '← Use a different email',
    signOut: 'Sign out',
    sendFailed: 'The code could not be sent. Check the address and try again.',
    verifyFailed: 'That code was not accepted. Ask for a new one and try again.',
  },

  join: {
    title: 'Join a camp',
    hint: 'Got a join code from the other leader? Type it here.',
    label: 'Join code',
    placeholder: 'MOOR-7F3K',
    searching: 'Looking…',
    notFound: 'No camp answers that code.',
    found: (name: string) => `Found "${name}".`,
    alreadyMember: (name: string) => `You are already in "${name}".`,
    join: 'Join',
    failed: 'Joining failed. Check the code and try again.',
  },

  share: {
    title: 'Share this camp',
    hint: 'The other leader types this code into their phone.',
    members: (count: number) => `${count} ${count === 1 ? 'leader' : 'leaders'} share this camp.`,
    export: 'Export JSON',
  },

  /** Anything the database refuses. A write that only queues offline says nothing here. */
  sync: {
    loadFailed: (message: string) => `Could not load this camp: ${message}`,
    writeFailed: 'That change could not be saved. Check your connection and try again.',
    createFailed: 'The camp could not be created. Try again.',
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
    noReceipts: 'No receipts yet.',
    openReceipts: 'Receipts →',
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
    namePlaceholder: 'Name, e.g. Group money',
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
        hint: 'Group money — people × days × rate',
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
     *  switching language later must never rename their pools. Deliberately the same
     *  wording as the per-person-per-day income that feeds it: one name, one pot. */
    everydayDefault: 'Group money',
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
    peoplePlaceholder: 'e.g. 12',
    rateLabel: 'Rate per person / day',
    ratePlaceholder: '€ e.g. 8,00',
    startLabel: 'Start date',
    endLabel: 'End date',
    add: '＋ Add block',
    personDays: (n: number) => `${n} person-day${n === 1 ? '' : 's'}`,
    personDaysUnknown: '— person-days',
    days: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
    peopleAtRate: (people: number, rate: string) => `${people} ppl × ${rate}/day`,
  },

  /** Granted vs actual attendance, inside the per-person-per-day card. */
  attendance: {
    granted: 'Granted',
    actual: 'Who came',
    /** Shown on the actual tab while no actual block exists — actual *is* granted then. */
    sameAsGranted: 'Nobody dropped out yet, so this matches what was granted.',
    copyFromGranted: '⧉ Copy from granted',
    edit: 'Edit who came',
    reset: '↺ Everybody came',
    save: 'Save',
    cancel: 'Cancel',
    hint: 'Drop the people who never came, or shorten a stay. What is left is what you may spend.',
    comparison: (granted: string, actual: string) => `Granted ${granted} · Actual ${actual}`,
    goesBack: (amount: string) => `${amount} goes back`,
    overAttended: (amount: string) =>
      `${amount} more was used than granted — more people came than were funded.`,
  },

  /** The spent/left bar under each pool. */
  bars: {
    spentOfFunded: (spent: string, funded: string) => `${spent} of ${funded} spent`,
    left: (amount: string) => `${amount} left`,
    over: (amount: string) => `${amount} over budget`,
    unfunded: 'Nothing granted to this pool yet.',
    /** The bar measures what may be spent, so money for absentees needs saying out loud. */
    unusable: (amount: string) => `${amount} of it was never ours to spend.`,
  },

  receipts: {
    title: 'Receipts',
    back: '← Back to camp',
    add: '＋ Add receipt',
    empty: 'No receipts yet — tap ＋ Add receipt.',
    dateLabel: 'Date',
    nameLabel: 'What was it?',
    namePlaceholder: 'e.g. Bakery',
    amountLabel: 'Amount',
    amountPlaceholder: '€ e.g. 8,00',
    poolLabel: 'Paid from',
    noteLabel: 'Note (optional)',
    notePlaceholder: 'e.g. paid in cash',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    editAction: (name: string) => `Edit ${name}`,
    deleteAction: (name: string) => `Delete ${name}`,
    spentTotal: 'Spent total',
    dayTotal: (amount: string) => `${amount} that day`,
    count: (n: number) => `${n} ${n === 1 ? 'receipt' : 'receipts'}`,
    unknownPool: 'Unknown pool',
    deleteTitle: (name: string) => `Delete "${name}"?`,
    deleteLine: (amount: string, pool: string) => `${amount} goes back into ${pool}.`,
    confirmDelete: 'Delete',
    issues: {
      name: 'Say what this receipt was for.',
      amount: 'Enter an amount in euros, e.g. 8,00.',
      date: 'Pick the date on the receipt.',
      pool: 'Choose which pool paid for it.',
    },
  },

  poolSelect: {
    label: 'Pool',
    newOption: '＋ New pool…',
    newNameLabel: 'New pool name',
    newNamePlaceholder: 'e.g. Bike deposit',
    copyName: '⧉ Same as income name',
  },
}
