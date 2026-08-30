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

  /** The popover month-grid behind every date field. */
  calendar: {
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    /** Shown while `DateField` waits for the user to confirm a day outside the camp's
     *  known span — picking one is allowed, just double-checked. */
    outsideRangeTitle: 'Outside the camp dates',
    outsideRangeLine: 'This date falls outside the camp — use it anyway?',
    outsideRangeConfirm: 'Use this date',
  },

  /** The ⋮ menu carrying a list row's actions. Shared by the receipt and custody rows —
   *  the words are the same on both, so they are written once. */
  rowMenu: {
    open: (name: string) => `Actions for ${name}`,
    edit: 'Edit',
    editActual: 'Edit actual',
    delete: 'Delete',
  },

  /** The day/night switch in the shell's corner. Each label names where a tap goes,
   *  which is what the icon shows — not the theme currently in force. */
  theme: {
    switchToDark: 'Switch to night mode',
    switchToLight: 'Switch to day mode',
  },

  app: {
    title: 'campfin',
    subtitle: 'Camp budget tracker',
    loading: 'Loading…',
    /** Names the version line for screen readers — the string itself is not prose. */
    versionLabel: 'App version',
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
    hint: 'Got a join code? Type it here.',
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
    members: (count: number) =>
      `${count} ${count === 1 ? 'person shares' : 'people share'} this camp.`,
    /** On the join-code button itself, under the code — it has to say what the tap does. */
    copy: '⧉ Copy join code',
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
    /** Only the dated statuses: an undated camp shows no pill at all. */
    status: {
      upcoming: 'Upcoming',
      running: 'Running',
      finished: 'Finished',
    },
  },

  /** What a signed-in account may do app-wide: start camps, and how many more. Joining a
   *  camp by code needs none of this, so nothing here ever blocks an invited co-leader. */
  access: {
    lockedTitle: 'Your account is not activated yet',
    lockedBody:
      'You can join any camp whose code you have been given. Starting a camp of your own needs permission from the admin.',
    left: (n: number) => `${n} more ${n === 1 ? 'camp' : 'camps'} you can start.`,
    usedUp: 'You have started as many camps as your account allows. Ask for a higher limit.',
    notAllowed: 'Your account is not allowed to start any camps. Ask the admin for a quota.',
  },

  admin: {
    open: 'Admin',
    /** The same button when people are queued behind it — the badge shows a bare number,
     *  so the count has to be said in full for a screen reader. */
    openWaiting: (n: number) => `Admin — ${n} ${n === 1 ? 'person' : 'people'} waiting`,
    title: 'Admin',
    back: '← All camps',
    /** On the camp list, not in here: it changes what that list shows. */
    showAllCamps: 'Show every camp',
    /** The to-do panel above the roster: only the people whose turn it is on you. Titled
     *  with the count, because the number is the reason the panel is there at all. */
    waitingTitle: (n: number) => `Waiting for activation (${n})`,
    waitingBody: 'They signed in and can only join camps by code until you activate them.',
    peopleTitle: 'People',
    peopleEmpty: 'Nobody has signed in yet.',
    grantLabel: 'Email to activate',
    grantPlaceholder: 'them@example.com',
    grant: 'Activate',
    badEmail: 'That does not look like an email address.',
    alreadyGranted: (email: string) => `${email} is already activated.`,
    /** Someone with a grant written to their address who has never signed in. */
    pending: 'Invited — not signed in yet',
    notActivated: 'Not activated',
    adminBadge: 'Admin — no limit',
    /** A line under the address, not a control: the two ways to change it live in the row's
     *  ⋮ menu, so this has to say what the number means on its own. */
    quotaLabel: (n: number) => `${n} ${n === 1 ? 'camp' : 'camps'} allowed`,
    quotaUp: 'Allow one more camp',
    quotaDown: 'Allow one camp fewer',
    revoke: 'Revoke',
    revokeTitle: 'Revoke access',
    revokeConfirm: (email: string) =>
      `Revoke ${email}? They keep every camp they are already in — this only stops them starting new ones.`,
    campsTitle: (n: number) => `All camps (${n})`,
    campsEmpty: 'No camps in the database.',
    /** Under a person's address, when they are in no camp at all. The camps they are in
     *  are listed by name, one per line, and need no wording of their own. */
    inNoCamps: 'In no camps',
    /** Who can open this camp. */
    campMembersEmpty: 'Nobody has joined yet',
    /** Members whose account no longer exists — named by nothing but their membership. */
    unknownMembers: (n: number) => `${n} unknown ${n === 1 ? 'member' : 'members'}`,
  },

  dashboard: {
    back: '← All camps',
    receivedTotal: 'Received total',
    noIncome: 'No income sources yet.',
    setUpIncome: 'Set up income →',
    spending: 'Spending',
    noReceipts: 'No receipts yet.',
    /** Not drawn: the block's title row is the button, and this is what names its
     *  destination for a screen reader, which cannot read a chevron. */
    openReceipts: 'Open receipts',
    /** Shown until the camp has its daily grant — nothing per-day can be computed
     *  without it, so the chart and "allowed today" stay hidden. */
    setupCallout: 'Add the daily group allowance income to start tracking.',
    openSettings: 'Camp settings',
  },

  /** The whole dashboard until the camp can track anything: the two compulsory answers,
   *  in the order they matter, each ticked as it lands. */
  setup: {
    title: 'Set up this camp',
    hint: 'Two answers before the money can be tracked.',
    holderStep: 'Money holder',
    /** Read out after a step's title in place of the tick, which says nothing aloud. */
    done: 'done',
    incomeStep: 'Income',
    incomeTodo: 'Enter the money your camp was granted. Everything else follows from it.',
    incomeGo: 'Set up income',
    incomeEdit: 'Edit income →',
  },

  /** The camp's own screen: what it is called, who can reach it, and how to be rid of it —
   *  everything that changes the camp rather than its money. */
  campSettings: {
    title: 'Camp settings',
    back: '← Back to camp',
    nameSection: 'Camp name',
    nameLabel: 'Camp name',
    save: 'Save',
    shareSection: 'Join code',
    /** The camp's own dates. Read-only: they are the span of the per-person-per-day
     *  income's days, so the note says where they come from and where to change them. */
    datesSection: 'Camp dates',
    datesFrom: 'Taken from the dates on the per-person-per-day income.',
    datesDays: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
    /** No per-diem income yet, so nothing dates the camp — the chart and the date pickers
     *  have no span to draw either. */
    datesNone: 'No dates yet — add a per-person-per-day income to date the camp.',
    incomeSection: 'Income',
    /** Who carries the cash. Camp-wide, and the thing every "owed" marker is measured
     *  against — so it lives with the camp's other once-per-camp settings. */
    holderSection: 'Money holder',
    holderHint: 'The leader carrying the camp cash.',
    /** Who has the wallet, stated rather than picked from a list: it changes once a camp
     *  at most, so the screen offers only the two things you would ever do to it. The name
     *  is drawn separately, so this is only what follows it. */
    holderHolds: 'holds the money.',
    /** Only reachable from the gear on the setup screen — every camp past setup has one. */
    holderNone: 'Nobody holds the money yet.',
    holderSet: 'Set money holder',
    holderChange: 'Change holder',
    holderCancel: 'Cancel',
    holderNewNameLabel: 'Name',
    holderNewNamePlaceholder: 'e.g. Anna',
    holderSave: 'Save holder',
    /** Handing the wallet over rewrites no receipt, but it does flip who owes whom — so
     *  the question says how many rows change, in both directions. The wallet can only
     *  change hands, never be put down: every "owed" marker is measured against it. */
    holderChangeTitle: (name: string) => `Make ${name} the money holder?`,
    holderReplaces: (current: string) => `${current} holds it now.`,
    holderStopOwing: (n: number) =>
      `${n} ${n === 1 ? 'receipt stops' : 'receipts stop'} showing as owed.`,
    holderStartOwing: (n: number) =>
      `${n} ${n === 1 ? 'receipt starts' : 'receipts start'} showing as owed.`,
    holderNoChange: 'No receipt changes.',
    /** Distinct from the button that opens the name field, so the dialog's own action is
     *  never the same words as the control behind it. */
    holderConfirm: 'Confirm change',
    dangerSection: 'Danger zone',
    delete: 'Delete camp',
    deleteTitle: 'Delete camp',
    deleteConfirm: (name: string) => `Delete "${name}"? This cannot be undone.`,
    deleteLine: 'Its income, receipts and movements go with it.',
    deleteTypeLabel: (name: string) => `Type "${name}" to confirm`,
    deleteConfirmLabel: 'Delete',
  },

  income: {
    // Reachable from both the dashboard and camp settings, and ← returns to whichever it
    // was — so the label cannot name a destination the way the other screens' do.
    back: '← Back',
    title: 'Set up income',
    /** Only ever seen if a camp somehow has no pools at all — every camp is born with one. */
    empty: 'No pools yet — tap ＋ Add pool.',
    receivedTotal: 'Received total',
    nameLabel: 'Income name',
    nameHintLabel: 'What if I leave the name blank?',
    nameHint: "Leave blank and it goes by the pool's name.",
    /** The subtitle of an income shown under a heading that does not name it. */
    kindWithName: (name: string, kind: string) => `${name} · ${kind}`,
    amountLabel: 'Amount (€)',
    amountPlaceholder: 'e.g. 300,00',
    personDaysTotal: 'Total person-days',
    sourceTotal: 'Source total',
    save: 'Save',
    cancel: 'Cancel',
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
      poolName: 'Give the pool a name.',
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
    add: '＋ Add pool',
    addTitle: 'New pool',
    addSave: 'Create pool',
    nameLabel: 'Pool name',
    namePlaceholder: 'e.g. Bike hire',
    roleLabel: 'What is this pot for?',
    roles: {
      earmarked: {
        label: 'Normal',
        hint: 'Money the camp spends.',
      },
      deposit: {
        label: 'Deposit',
        hint: 'A Deposit - you hand over and get back.',
      },
    },
    aboutLabel: 'What is a pool?',
    about: [
      'An income pool is a separate wallet of money for a specific category of spending (e.g. "Group money", "Bike hire").',
      "An income pool can consist of one or several income sources — in most cases it's just one.",
      'Each receipt is assigned to one particular income pool.',
      '"Deposit" is a type of income pool that has to be fully returned at the end of the camp.',
      '"Group money" is a built-in income pool for daily purchases that every camp has.',
      'The "Group money" pool has a "granted" section describing what money was given, and an "actual" section reflecting the real composition of the camp when it differs from the plan (e.g. some participants did not come, or left early). Money that can no longer be used is then reserved for returning and left out of the remaining-to-spend total.',
    ],
    addIncomeTo: (name: string) => `Add income to ${name}`,
    editIncome: 'Edit income',
    deleteIncome: 'Delete income',
    emptyPool: 'No income yet — tap ＋ to say what came in.',
    depositNote: 'Handed back at the end of camp.',
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
    deleteEmpty: 'Nothing funds it, so no income goes with it.',
    sourceDeleteTitle: (name: string) => `Delete "${name}"?`,
    sourceDeleteTitleFallback: 'Delete this income?',
    sourceDeleteLine: (amount: string, pool: string) =>
      `This removes ${amount} from the ${pool} pool. The pool itself stays.`,
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
    rateLabel: 'Rate per person / day (€)',
    ratePlaceholder: 'e.g. 8,00',
    datesLabel: 'Dates',
    datesPlaceholder: 'Pick a start and end date',
    add: '＋ Add empty block',
    copyLast: '＋ Copy previous block',
    personDays: (n: number) => `${n} person-day${n === 1 ? '' : 's'}`,
    personDaysUnknown: '— person-days',
    days: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
    peopleAtRate: (people: number, rate: string) => `${people} ppl × ${rate}/day`,
  },

  /** Granted vs actual attendance, inside the per-person-per-day card. */
  attendance: {
    granted: 'Granted',
    actual: 'Actual',
    /** The disclosure over the block breakdown, collapsed by default — the comparison line
     *  below it already says what changed, so the blocks themselves are opt-in detail. */
    toggleBlocks: (open: boolean) => (open ? '▾ Granted / actual' : '▸ Granted / actual'),
    /** Shown on the actual tab while no actual block exists — actual *is* granted then. */
    sameAsGranted: 'Matches what was granted.',
    copyFromGranted: '⧉ Copy from granted',
    reset: '↺ Everybody came',
    save: 'Save',
    cancel: 'Cancel',
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
  },

  /** The day-by-day allowance: the headline number and the chart under it. */
  burn: {
    title: 'Daily burn',
    allowedToday: 'Left today',
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
    nameLabel: 'Item',
    namePlaceholder: 'e.g. Bakery',
    amountLabel: 'Amount (€)',
    amountPlaceholder: 'e.g. 8,00',
    poolLabel: 'Paid from',
    /** The number written on the paper slip, so the folder and the app can be matched
     *  row by row. Optional — a receipt is worth entering before it is filed. */
    numberLabel: 'Receipt no.',
    numberPlaceholder: 'e.g. 12',
    numberTag: (n: number) => `${n}.`,
    noteLabel: 'Note',
    notePlaceholder: 'e.g. paid in cash',
    save: 'Save',
    cancel: 'Cancel',
    spentTotal: 'Spent total',
    /** Whose wallet the money came out of, and what the holder still owes them. */
    payer: {
      label: 'Paid by',
      /** The two answers. Nothing is picked to begin with — a receipt has to say whose
       *  money it was, so the choice is made rather than defaulted into. The emoji stands
       *  in for "holds the camp money" so the option reads as one short line instead of two
       *  words of explanation after every name. */
      holderOption: (name: string) => `👑 ${name}`,
      /** Not shown as text — the second radio sits directly beside the name field, so the
       *  field itself says what picking it means. Kept as the radio's accessible name. */
      otherOption: 'Someone else',
      /** Not shown — the input's placeholder already says "name", so a label above it would
       *  repeat itself. Kept as the accessible name for a screen reader. */
      newNameLabel: 'Their name',
      newNamePlaceholder: 'e.g. Ben',
      /** Shown instead of the first option when no holder has been named yet. */
      noHolder: 'No money holder yet — name one in camp settings, then this becomes a choice.',
      /** On the row itself. Only ever shown when someone other than the holder paid, so
       *  the common case costs no words at all. */
      paidByRow: (name: string) => `Paid by ${name}`,
      returnButton: 'Return',
      returnedButton: 'Returned',
      /** Both directions ask first: the button sits in a list you scroll past. */
      confirmReturnTitle: (name: string) => `Return the money to ${name}?`,
      confirmReturnLine: (amount: string) => `${amount} will be returned.`,
      confirmReturnLabel: 'Yes, returned',
      confirmUndoTitle: (name: string) => `Undo the return to ${name}?`,
      confirmUndoLine: (amount: string) => `${amount} goes back to being owed.`,
      confirmUndoLabel: 'Undo',
      /**
       * Returning somebody's money settles what that receipt left them out, deposit
       * included — so the question says what will happen to the deposit rather than
       * offering it as an option. Two lines, because a receipt that gave back more deposit
       * than it charged moves the other way: the holder takes on a refund that person has
       * already had.
       */
      confirmReturnPfandLine: (amount: string, holder: string) =>
        `Its ${amount} of pfand moves to ${holder} too — it is ${holder}'s to reclaim from now on.`,
      confirmReturnPfandOwedLine: (amount: string, holder: string) =>
        `${holder} also takes on ${amount} of pfand already taken back.`,
      /** Undoing a return hands the deposit back with the debt: the pfand follows the
       *  receipt's flag, so there is never a transfer left standing on its own. */
      confirmUndoPfandLine: (amount: string, name: string) =>
        `Its ${amount} of pfand goes back to ${name} too.`,
      /** Under the list, beside the spent total. */
      owedTotal: 'Owed to others',
      filterUnpaid: 'Not repaid',
      emptyUnpaid: 'Nothing is waiting to be paid back.',
    },
    /**
     * The deposit on a receipt. Folded away behind one button, because nearly every receipt
     * carries none, and the common case must not pay for the rare one.
     */
    pfand: {
      /** The button that opens the block, and the one that takes the pfand off again. */
      add: '＋ Pfand',
      remove: 'Remove the pfand',
      legend: 'Pfand',
      /** Which number went into the amount box above. Asked as two options rather than
       *  guessed: a printed slip has the deposit inside its total, but a receipt
       *  typed up afterwards is often the goods alone. */
      modeLabel: 'The amount above is',
      modeInTotal: 'the total, pfand included',
      modeOnTop: 'the goods only, pfand on top',
      paidLabel: 'Deposit charged (€)',
      returnedLabel: 'Deposit refunded (€)',
      amountPlaceholder: 'e.g. 1,00',
      /** The live readout under the block: the one number that tells the two modes apart. */
      groupLine: (amount: string) => `Group money spent: ${amount}`,
      /** On the receipt row. Both directions appear only when the receipt has both. */
      rowPaid: (amount: string) => `Pfand +${amount}`,
      rowReturned: (amount: string) => `Pfand −${amount}`,
      rowBoth: (paid: string, returned: string) => `Pfand +${paid} / −${returned}`,
      /** The figure printed on the paper slip, so a row here can be checked against the
       *  folder — the headline amount beside it is the group's money, which is different. */
      rowTotal: (amount: string) => `receipt total ${amount}`,
    },
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
    /** Tapping every chip on is the same as tapping every chip off, so the chips settle on
     *  "none lit" for both — there is no all-lit state to explain, and no All chip. */
    filterLabel: 'Show pools',
    filterCount: (shown: number, total: number) => `${shown} of ${total} receipts shown`,
    emptyFiltered: 'No receipts match the filters you picked.',
    deleteTitle: (name: string) => `Delete "${name}"?`,
    deleteLine: (amount: string, pool: string) => `${amount} goes back into ${pool}.`,
    /** What else disappears with the receipt. Both lines are about the deposit, and
     *  neither appears on a receipt that never had one — which is nearly all of them.
     *  The amount is signed, because the deposit can move a balance either way. */
    deletePfandLine: (name: string, amount: string) =>
      `${name}'s pfand balance changes by ${amount} — the deposit on this receipt goes with it.`,
    confirmDelete: 'Delete',
    issues: {
      name: 'Say what this receipt was for.',
      amount: 'Enter an amount in euros, e.g. 8,00.',
      date: 'Pick the date on the receipt.',
      pool: 'Choose which pool paid for it.',
      number: 'A receipt number is a whole number: 1, 2, 3 — or leave it empty.',
      numberTaken: 'Another receipt already has that number.',
      paidBy: 'Say whose money paid for this — the money holder, or somebody else by name.',
      pfand: 'A pfand amount is euros, e.g. 1,00 — or leave it empty.',
      pfandOverAmount:
        'The pfand is the whole amount, so no group money was spent. Record it on the pfand screen instead.',
    },
  },

  /**
   * Cash that changes hands without being spent: a Kaution and the participation fees. The
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
      nameLabel: 'Counterparty',
      namePlaceholder: 'e.g. Bike shop',
    },
    fee: {
      title: 'Participation fee',
      add: '＋ Record a fee collected',
      empty: 'No participation fee collected yet.',
      nameLabel: 'Paid by',
      namePlaceholder: 'e.g. Alex',
    },
    kindLabel: 'What happened?',
    /** The two radios on the deposits form: which way this money went. */
    directionLabel: 'Direction',
    kinds: {
      deposit_out: 'Deposit handed over',
      deposit_in: 'Deposit came back',
      volunteer_in: 'Participation fee collected',
    },
    dateLabel: 'Date',
    amountLabel: 'Amount (€)',
    amountPlaceholder: 'e.g. 200,00',
    poolLabel: 'Which deposit',
    /** A soft warning, not a blocked save: topping a Kaution up out of camp cash is fine
     *  as long as all of it comes back. */
    overDeposit: (amount: string) =>
      `${amount} more than this deposit holds. Fine if all of it comes back — check the amount.`,
    noteLabel: 'Note',
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
   * The deposit, tracked per person rather than per pool. It is never the camp's
   * money — whoever paid is out their own until it is reclaimed — so the wording here
   * avoids "spent" and "budget" entirely, exactly as the custody screens do.
   */
  pfand: {
    title: 'Pfand',
    back: '← Back to camp',
    /** Above the balances: what this screen is for, in one line. It has to say where a row
     *  comes from, because *Refund* on a balance is the only way to write one. */
    intro:
      'Pfand (deposit) money, calculated from the receipts every time. Tap Refund on a balance to record money taken back at a shop with nothing bought.',
    balancesTitle: 'Out of pocket',
    /** The money holder's row is marked, the same crown the receipt form uses. */
    holderTag: (name: string) => `👑 ${name}`,
    outstandingTotal: 'Total still out',
    /** A balance below zero: more deposit came back than went out. Rare and worth naming
     *  rather than drawing as a minus sign nobody notices. */
    overRefunded: "got someone else's pfand money",
    settled: 'settled',
    /** The one action on a balance row. A balance below zero gets none: more has come back
     *  than went out, and the row to correct is a receipt or a refund, not this. */
    refundAction: 'Refund',
    txnsTitle: 'Transactions',
    empty: 'Nothing here yet — pfand on a receipt shows up on its own.',
    /** What each ledger line is. `item` is the receipt the deposit was charged on. */
    txnKinds: {
      receipt_paid: (item: string) => `Deposit charged — ${item}`,
      receipt_returned: (item: string) => `Deposit refunded — ${item}`,
      refund: 'Refunded at the shop',
    },
    /** Receipt-derived lines are edited on the receipts screen, so their row says so
     *  instead of offering a menu that cannot change anything. */
    fromReceipt: 'from a receipt',
    /** On a receipt somebody else paid and has since been paid back for: the deposit is the
     *  holder's now, and the line has to say whose till trip it was. */
    viaPayer: (name: string) => `taken over from ${name}`,
    /** The one thing a stored row can be. Named rather than inlined so the delete question
     *  and the form's heading cannot drift apart. */
    kinds: {
      refund: 'Refunded at the shop',
    },
    /** The form's heading. It names the person because the form no longer asks — it opened
     *  from that person's balance row. */
    formTitle: (name: string) => `Refunded at the shop — ${name}`,
    dateLabel: 'Date',
    amountLabel: 'Amount (€)',
    amountPlaceholder: 'e.g. 1,00',
    noteLabel: 'Note',
    notePlaceholder: 'e.g. returned at Rewe',
    save: 'Save',
    cancel: 'Cancel',
    count: (n: number) => `${n} ${n === 1 ? 'transaction' : 'transactions'}`,
    deleteTitle: (name: string) => `Delete this pfand row for ${name}?`,
    deleteLine: (kind: string, amount: string) => `${kind}, ${amount}.`,
    confirmDelete: 'Delete',
    issues: {
      payer: 'Say whose money this is.',
      amount: 'Enter an amount in euros, e.g. 1,00.',
      date: 'Pick the date this happened.',
    },
  },

  /**
   * The two custody blocks: money passing through your hands, split by where it goes next.
   * A deposit travels to a counterparty and comes back; the participation fees only go
   * onward to the organisation.
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
    fee: {
      title: 'Participation fee',
      empty: 'No participation fee collected yet.',
      open: 'Open the participation fee',
      held: 'To hand over to the organisation',
      count: (n: number) => `${n} ${n === 1 ? 'payment' : 'payments'}`,
    },
    pfand: {
      title: 'Pfand',
      empty: 'No deposit recorded yet.',
      open: 'Open the pfand ledger',
      /** The dashboard figure: what the camp's people are collectively out of pocket. */
      out: 'Deposit still out',
      settled: 'Every deposit is settled.',
      count: (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`,
    },
  },

  /**
   * The end-of-camp report: income, expenses, and the difference between them. Read once,
   * by someone who has to justify the transfer back to the organisation — so every
   * difference line says *why* it is on the report.
   */
  report: {
    title: 'Financial report',
    back: '← Back to camp',
    open: 'Open the financial report',
    /** On the dashboard card, in place of a figure: the report is three tables, and no one
     *  of them is the headline. */
    hint: 'Income, expenses and what is left over.',
    /** Column headings, shared by all three tables. */
    columnItem: 'Item',
    columnAmount: 'Amount',
    income: {
      title: 'Income',
      /** Everything the organisation sent: the daily grant, the fixed grants, the deposits. */
      advance: 'Cash advance',
      advanceTotal: 'Cash advance total',
      fee: 'Participation fee',
      feeTotal: 'Participation fee total',
      total: 'Total income',
      empty: 'No income recorded yet.',
    },
    expenses: {
      title: 'Expenses',
      /** A receipt whose pool was deleted: still money out, so still on the report. */
      unknownPool: 'Deleted pool',
      total: 'Total expenses',
      empty: 'No receipts yet.',
    },
    difference: {
      title: 'Cash rest',
      total: 'Total cash rest',
      empty: 'Nothing left over — every pot is spent to the cent.',
      rows: {
        poolUnspent: (pool: string) => `${pool} — unspent`,
        poolUnusable: (pool: string) => `${pool} — not eligible for spending`,
        depositReturn: (pool: string) => `Deposit ${pool} — to be refunded`,
        fee: 'Participation fee to hand over',
        orphanSpent: 'Spent from a deleted pool',
      },
    },
    /** The report is arithmetic over what was typed in, which is not the same as what
     *  happened — so it says so, on screen and in print. */
    disclaimer:
      'These figures are only as good as what was entered in the app, and not every accounting case is covered yet — check the report against your receipts and bank statements before filling the forms.',
    exportCsv: '⤓ Export CSV',
    print: '⎙ Print',
    /** Headings inside the CSV file, for whoever opens it in a spreadsheet. */
    csv: {
      item: 'Item',
      amount: 'Amount (EUR)',
      receiptsTitle: 'Receipts',
      /** First column, so a printed report can be read against the numbered paper folder. */
      number: 'No.',
      date: 'Date',
      pool: 'Pool',
      name: 'What',
      note: 'Note',
      paidBy: 'Paid by',
      /** One column, three answers: "yes", "no" while it is owed, empty when nobody
       *  fronted the money. */
      repaid: 'Repaid',
      repaidYes: 'yes',
      repaidNo: 'no',
    },
  },

  /**
   * What actually goes back to the organisation: each pool floored on its own, so an
   * overspend in one pot cannot eat another's leftover. The dashboard headline and the
   * checks under the report's difference table.
   */
  settlement: {
    warningsTitle: 'Check these',
    warnings: {
      depositAtVendor: (pool: string, amount: string) =>
        `${amount} of ${pool} is still with the counterparty — get it back first.`,
      poolOverspent: (pool: string, amount: string) => `${pool} is ${amount} over budget.`,
      overAttended: (pool: string, amount: string) =>
        `${pool}: ${amount} more was used than granted — more people came than were funded.`,
      /** Not money for the organisation — an IOU between the leaders. It still belongs on
       *  the report: until it is settled, the cash box holds somebody else's money. */
      owedToPayer: (name: string, amount: string) =>
        `${name} is still owed ${amount} for receipts they paid themselves.`,
      /** Deposit money not yet reclaimed. Never the camp's money — but it is the thing
       *  everyone forgets, and the report is read once. */
      pfandOut: (name: string, amount: string) =>
        `${name} still has ${amount} of pfand out, not yet reclaimed.`,
    },
  },
}
