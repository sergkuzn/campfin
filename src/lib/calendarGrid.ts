import { toIsoDate } from './dates'

/** One cell of a month grid. */
export type CalendarDay = {
  iso: string
  /** False for the lead-in/lead-out days of neighbouring months that pad the grid to whole
   *  weeks — shown, but dimmed, so the grid never has a ragged first or last row. */
  inMonth: boolean
  isWeekend: boolean
  isToday: boolean
}

const MS_PER_DAY = 86_400_000

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

/** True for Saturday and Sunday, the days the owner wants easy to spot at a glance. */
export function isWeekendIso(iso: string): boolean {
  const day = parseIso(iso).getDay()
  return day === 0 || day === 6
}

/**
 * A calendar-month grid as whole weeks, Monday first: the days of `month` (0-indexed, like
 * `Date`) padded at both ends with the neighbouring month's days so every row has 7 cells.
 * `todayIso` is passed in rather than read from the clock, keeping this pure and testable.
 */
export function monthGrid(year: number, month: number, todayIso: string): CalendarDay[][] {
  const firstOfMonth = new Date(year, month, 1)
  // getDay() is Sunday-first (0-6); shifting so Monday is 0 puts the grid's first column
  // where the header row below it says "Mon".
  const leadInDays = (firstOfMonth.getDay() + 6) % 7
  const gridStartMs = firstOfMonth.getTime() - leadInDays * MS_PER_DAY

  const days: CalendarDay[] = []
  for (let week = 0; week < 6; week++) {
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const date = new Date(gridStartMs + (week * 7 + dayOfWeek) * MS_PER_DAY)
      const iso = toIsoDate(date)
      days.push({
        iso,
        inMonth: date.getMonth() === month,
        isWeekend: isWeekendIso(iso),
        isToday: iso === todayIso,
      })
    }
  }

  // A 6-week grid can trail a whole row of next-month padding once the last real day is
  // behind it — drop it so short months (a 28-day February starting on a Monday) don't
  // show an empty row.
  const weeks: CalendarDay[][] = []
  for (let week = 0; week < 6; week++) {
    const row = days.slice(week * 7, week * 7 + 7)
    if (week >= 4 && row.every((d) => !d.inMonth)) break
    weeks.push(row)
  }
  return weeks
}
