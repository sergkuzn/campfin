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

  /** Shared by every modal, so the same word is not spelled out per screen. */
  confirm: {
    cancel: 'Cancel',
  },

  /** The ⋮ menu carrying a list row's actions. Shared by the receipt and custody rows —
   *  the words are the same on both, so they are written once. */
  rowMenu: {
    open: (name: string) => `Actions for ${name}`,
    edit: 'Edit',
    delete: 'Delete',
  },

  app: {
    title: 'campfin',
    subtitle: 'Camp budget tracker',
    loading: 'Loading…',
    /** Names the version line for screen readers — the string itself is not prose. */
    versionLabel: 'App version',
  },

  /** The toast shown once a new build has downloaded and is waiting to take over. */
  update: {
    available: 'New version available',
    reload: 'Reload',
    dismiss: 'Later',
    /** Names the toast for screen readers; it announces itself as it appears. */
    label: 'App update',
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
    hint: 'The other leader types this code into their phone.',
    members: (count: number) => `${count} ${count === 1 ? 'leader' : 'leaders'} share this camp.`,
    /** On the join-code button itself, under the code — it has to say what the tap does. */
    copy: '⧉ Tap to copy join code',
    copied: '✓ Copied',
    /** The clipboard API is missing outside a secure context; reading the code aloud
     *  still works, so say that rather than showing a dead end. */
    copyFailed: 'Copying is not available here — read the code out instead.',
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
    /** Restoring an exported dump. It always lands as a *new* camp, never a merge. */
    import: '⤒ Restore from a file',
    importHint: 'Reads a JSON file exported from campfin and adds it as a new camp.',
    importFailed: {
      json: 'That file is not readable — pick the .json file campfin exported.',
      format: 'That file is not a campfin export.',
      version: 'That file was written by a newer version of campfin. Update this app first.',
    },
    /** Only the dated statuses: an undated camp shows no pill at all. */
    status: {
      upcoming: 'Upcoming',
      running: 'Running',
      finished: 'Finished',
    },
  },

  dashboard: {
    back: '← All camps',
    receivedTotal: 'Received total',
    noIncome: 'No income sources yet.',
    setUpIncome: 'Set up income →',
    /** The whole dashboard while the camp has no money in it yet: one thing to do, said
     *  large, instead of five empty blocks. */
    firstStepTitle: 'Start here',
    firstStep: 'Set up income',
    firstStepHint: 'Enter the money your camp was granted. Everything else follows from it.',
    spending: 'Spending',
    noReceipts: 'No receipts yet.',
    /** Not drawn: the block's title row is the button, and this is what names its
     *  destination for a screen reader, which cannot read a chevron. */
    openReceipts: 'Open receipts',
    /** Shown until the camp has its daily grant — nothing per-day can be computed
     *  without it, so the chart and "allowed today" stay hidden. */
    setupCallout: 'Add the daily grant to start tracking.',
    openSettings: 'Camp settings',
  },

  /** The camp's own screen: what it is called, who can reach it, and how to be rid of it —
   *  everything that changes the camp rather than its money. */
  campSettings: {
    title: 'Camp settings',
    back: '← Back to camp',
    nameSection: 'Name',
    nameLabel: 'Camp name',
    save: 'Save',
    shareSection: 'Join code',
    incomeSection: 'Income',
    dangerSection: 'Danger zone',
    delete: 'Delete camp',
    deleteTitle: 'Delete camp',
    deleteConfirm: (name: string) => `Delete "${name}"? This cannot be undone.`,
    deleteLine: 'Its income, receipts and movements go with it.',
    deleteConfirmLabel: 'Delete',
  },

  income: {
    // Reachable from both the dashboard and camp settings, and ← returns to whichever it
    // was — so the label cannot name a destination the way the other screens' do.
    back: '← Back',
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
    /** Colours are how a pool is recognised in a list of receipts, so every pool gets one
     *  at creation and this is where it is changed. */
    color: 'Colour',
    colorTitle: (name: string) => `Colour for ${name}`,
    colorNames: {
      blue: 'Blue',
      teal: 'Teal',
      green: 'Green',
      amber: 'Amber',
      orange: 'Orange',
      rose: 'Rose',
      violet: 'Violet',
      slate: 'Slate',
    },
    colorDone: 'Done',
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
    /** Not drawn: the whole bar is the button into that pool's receipts, and this is the
     *  hidden word that says so — the figures on the row are read out first. */
    openPool: 'Open its receipts',
  },

  /** The day-by-day allowance: the headline number and the chart under it. */
  burn: {
    title: 'Daily burn',
    allowedToday: 'Allowed today',
    /** The headline goes red rather than negative-with-a-minus: "you are €40 over" is
     *  what a leader needs to read, not "−40 allowed". */
    overspentBy: (amount: string) => `${amount} over`,
    /** The four figures beside the headline are labelled, not spelled out in sentences:
     *  a leader reads this table at a till, and a label next to a number is quicker than
     *  prose around it. Kept short so two of them fit across a phone. */
    spentToday: 'Spent today',
    medianDay: 'Median day',
    daysLeft: 'Days left',
    moneyLeft: 'Total left',
    theoretical: 'Allowed',
    actual: 'Spent',
    today: 'Today',
    /** Screen-reader replacement for the chart: the curve is decorative for anyone who
     *  cannot see it, and the numbers above already say where the camp stands. */
    chartAlt: (days: number) => `Cumulative allowance and spending over ${days} camp days.`,
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
    /** The number written on the paper slip, so the folder and the app can be matched
     *  row by row. Optional — a receipt is worth entering before it is filed. */
    numberLabel: 'Receipt no. (optional)',
    numberPlaceholder: 'e.g. 12',
    /** Fills the field with the next free number, which is the whole point of the button:
     *  nobody should have to remember where the folder got to. */
    numberSuggest: (n: number) => `Next: #${n}`,
    numberTag: (n: number) => `#${n}`,
    noteLabel: 'Note (optional)',
    notePlaceholder: 'e.g. paid in cash',
    save: 'Save',
    cancel: 'Cancel',
    spentTotal: 'Spent total',
    dayTotal: (amount: string) => `${amount} that day`,
    count: (n: number) => `${n} ${n === 1 ? 'receipt' : 'receipts'}`,
    unknownPool: 'Unknown pool',
    /** Sorting and filtering the list. The totals below the list follow the filter, so the
     *  wording says which receipts are being counted. */
    sortLabel: 'Sort by',
    sorts: {
      date_desc: 'Date — newest first',
      date_asc: 'Date — oldest first',
      number_asc: 'Number — 1 upwards',
      number_desc: 'Number — highest first',
    },
    filterLabel: 'Show pools',
    /** Tapping every chip off is the same as tapping every chip on: both mean "no filter",
     *  which is what makes the chips safe to switch off one at a time. */
    filterAll: 'All',
    filterCount: (shown: number, total: number) => `${shown} of ${total} receipts shown`,
    emptyFiltered: 'No receipts in the pools you picked.',
    deleteTitle: (name: string) => `Delete "${name}"?`,
    deleteLine: (amount: string, pool: string) => `${amount} goes back into ${pool}.`,
    confirmDelete: 'Delete',
    issues: {
      name: 'Say what this receipt was for.',
      amount: 'Enter an amount in euros, e.g. 8,00.',
      date: 'Pick the date on the receipt.',
      pool: 'Choose which pool paid for it.',
      number: 'A receipt number is a whole number: 1, 2, 3 — or leave it empty.',
      numberTaken: 'Another receipt already has that number.',
    },
  },

  /**
   * Cash that changes hands without being spent: a Kaution and volunteers' money. The
   * wording deliberately avoids "spent" and "budget" — this money is held, not consumed.
   */
  movements: {
    back: '← Back to camp',
    /** One screen, opened on one half of the custody money — the labels follow the half. */
    deposits: {
      title: 'Deposits',
      add: '＋ Record a deposit move',
      empty: 'No deposit handed over or returned yet.',
      /** Shown instead of the form: without a deposit source there is no Kaution to move. */
      noDeposits: 'Add a deposit under income first — then you can hand it over here.',
    },
    cash: {
      title: 'Volunteer cash',
      add: '＋ Record cash collected',
      empty: 'No volunteer money collected yet.',
    },
    kindLabel: 'What happened?',
    kinds: {
      deposit_out: 'Deposit handed over',
      deposit_in: 'Deposit came back',
      volunteer_in: 'Volunteer money collected',
    },
    dateLabel: 'Date',
    nameLabel: 'Who?',
    namePlaceholder: 'e.g. Bike shop',
    amountLabel: 'Amount',
    amountPlaceholder: '€ e.g. 200,00',
    poolLabel: 'Which deposit',
    completesLabel: 'This is the full deposit',
    completesHint: 'Tick when the counterparty asked for less than the deposit you were given.',
    noteLabel: 'Note (optional)',
    notePlaceholder: 'e.g. paid in cash',
    save: 'Save',
    cancel: 'Cancel',
    count: (n: number) => `${n} ${n === 1 ? 'movement' : 'movements'}`,
    unknownPool: 'Unknown deposit',
    deleteTitle: (name: string) => `Delete "${name}"?`,
    deleteLine: (kind: string, amount: string) => `${kind}, ${amount}.`,
    confirmDelete: 'Delete',
    issues: {
      name: 'Say who the money went to or came from.',
      amount: 'Enter an amount in euros, e.g. 200,00.',
      date: 'Pick the date this happened.',
      pool: 'Choose which deposit this belongs to.',
    },
  },

  /**
   * The two custody blocks: money passing through your hands, split by where it goes next.
   * A deposit travels to a counterparty and comes back; volunteers' cash only goes onward
   * to the organisation.
   */
  custody: {
    deposits: {
      title: 'Deposits',
      empty: 'No deposit set up yet.',
      /** Screen-reader-only, like every block's `open` — see `dashboard.openReceipts`. */
      open: 'Open deposits',
      /** The two steps of a deposit's life, ticked off in the order the money moves. */
      stepOut: 'Handed over',
      stepBack: 'Came back',
      /** How far a step has got: what has moved, out of what it should be. */
      stepAmount: (done: string, target: string) => `${done} of ${target}`,
      /** More moved than expected — a bookkeeping mistake worth naming. */
      stepOverOut: (amount: string) => `${amount} more handed over than the deposit`,
      stepOverBack: (amount: string) => `${amount} more came back than went out`,
      forfeited: (amount: string) => `${amount} kept for damage`,
    },
    cash: {
      title: 'Volunteer cash',
      empty: 'No volunteer money collected.',
      open: 'Open volunteer cash',
      held: 'To hand over to the organisation',
      count: (n: number) => `${n} ${n === 1 ? 'handover' : 'handovers'}`,
    },
  },

  /**
   * The end-of-camp sheet. Every row says *why* an amount is on it — the sheet is read once,
   * by someone who has to justify the transfer back to the organisation.
   */
  settlement: {
    title: 'Settle up',
    back: '← Back to camp',
    open: 'Open the settlement sheet',
    /** The dashboard block's title, above the figure the sheet explains. */
    toReturn: 'To return',
    intro: 'What goes back, and where each amount comes from.',
    columnCategory: 'Category',
    columnAmount: 'Amount',
    columnWhy: 'Why',
    received: 'Received',
    spent: 'Spent',
    total: 'Total to return',
    empty: 'Nothing goes back — every pot is spent to the cent.',
    rows: {
      poolUnspent: (pool: string) => `${pool} — unspent`,
      poolUnusable: (pool: string) => `${pool} — not ours to spend`,
      depositReturn: (pool: string) => `Deposit ${pool} — coming back`,
      volunteer: 'Volunteer money to hand over',
    },
    why: {
      poolUnspent: 'What arrived, minus what was spent from it',
      poolUnusable: 'Granted for people who never came',
      depositReturn: 'The deposit, minus what was kept for damage',
      volunteer: 'Collected from volunteers, passed on to the organisation',
    },
    warningsTitle: 'Check these before you transfer',
    warnings: {
      depositAtVendor: (pool: string, amount: string) =>
        `${amount} of ${pool} is still with the counterparty — get it back first.`,
      poolOverspent: (pool: string, amount: string) => `${pool} is ${amount} over budget.`,
      overAttended: (pool: string, amount: string) =>
        `${pool}: ${amount} more was used than granted — more people came than were funded.`,
    },
    exportJson: '⤓ Export JSON',
    exportCsv: '⤓ Export CSV',
    print: '⎙ Print',
    /** Column headings inside the CSV file, for whoever opens it in a spreadsheet. */
    csv: {
      category: 'Category',
      amount: 'Amount (EUR)',
      why: 'Why',
      receiptsTitle: 'Receipts',
      /** First column, so a printed sheet can be read against the numbered paper folder. */
      number: 'No.',
      date: 'Date',
      pool: 'Pool',
      name: 'What',
      note: 'Note',
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
