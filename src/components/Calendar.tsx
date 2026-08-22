import { useState } from 'react'
import './Calendar.css'
import { useT } from '../i18n'
import { type CalendarDay, monthGrid } from '../lib/calendarGrid'
import { isWithin, todayIso } from '../lib/dates'

type SingleProps = {
  mode: 'single'
  value: string
  onSelect: (iso: string) => void
  /** Days inside get a highlight; days outside are still pickable but shown plain. */
  allowedRange?: { startIso: string; endIso: string }
}

type RangeProps = {
  mode: 'range'
  value: { start: string; end: string } | null
  onSelect: (range: { start: string; end: string }) => void
}

type Props = SingleProps | RangeProps

function monthOf(iso: string): { year: number; month: number } {
  const date = new Date(`${iso}T00:00:00`)
  return { year: date.getFullYear(), month: date.getMonth() }
}

/**
 * A month grid: today boxed, weekends red, and either a single pickable day or a two-click
 * range. Dumb by design — it knows nothing about popovers or the "outside camp dates"
 * warning; `DateField` wraps it with those.
 */
export function Calendar(props: Props) {
  const t = useT()
  const anchorIso = props.mode === 'single' ? props.value : (props.value?.start ?? todayIso())
  const [shown, setShown] = useState(() => monthOf(anchorIso || todayIso()))
  // The range's in-progress start, once the first of its two clicks has landed. Kept
  // outside `value` so a range survives navigating to a different month before its second
  // click — `value` only ever holds a *completed* pair.
  const [pendingStart, setPendingStart] = useState<string | null>(null)

  const weeks = monthGrid(shown.year, shown.month, todayIso())

  const changeMonth = (delta: number) => {
    setShown(({ year, month }) => {
      const date = new Date(year, month + delta, 1)
      return { year: date.getFullYear(), month: date.getMonth() }
    })
  }

  const previewRange =
    props.mode === 'range'
      ? pendingStart === null
        ? props.value
        : { start: pendingStart, end: pendingStart }
      : null

  const isSelected = (day: CalendarDay): boolean => {
    if (props.mode === 'single') return day.iso === props.value
    return previewRange !== null && isWithin(day.iso, previewRange.start, previewRange.end)
  }

  const isAllowed = (day: CalendarDay): boolean => {
    if (props.mode !== 'single' || props.allowedRange === undefined) return false
    return isWithin(day.iso, props.allowedRange.startIso, props.allowedRange.endIso)
  }

  const monthLabel = new Date(shown.year, shown.month, 1).toLocaleDateString(t.dateLocale, {
    month: 'long',
    year: 'numeric',
  })
  // Monday-first weekday initials, matching monthGrid's own week order.
  const weekdayLabels = weeks[0]?.map((day) =>
    new Date(`${day.iso}T00:00:00`).toLocaleDateString(t.dateLocale, { weekday: 'narrow' }),
  )

  const select = (iso: string) => {
    if (props.mode === 'single') {
      props.onSelect(iso)
      return
    }
    // First click of a fresh pair, or restarting after a completed range: remember it and
    // wait for the second click rather than committing a one-day range.
    if (pendingStart === null) {
      setPendingStart(iso)
      return
    }
    const [start, end] = pendingStart <= iso ? [pendingStart, iso] : [iso, pendingStart]
    setPendingStart(null)
    props.onSelect({ start, end })
  }

  return (
    <div className="calendar">
      <div className="calendar__header">
        <button
          type="button"
          className="calendar__nav"
          aria-label={t.calendar.prevMonth}
          onClick={() => changeMonth(-1)}
        >
          ‹
        </button>
        <span className="calendar__month">{monthLabel}</span>
        <button
          type="button"
          className="calendar__nav"
          aria-label={t.calendar.nextMonth}
          onClick={() => changeMonth(1)}
        >
          ›
        </button>
      </div>

      <div className="calendar__weekdays">
        {weekdayLabels?.map((label, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed 7-column header, never reordered
          <span key={index} className="calendar__weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="calendar__grid">
        {weeks.flat().map((day) => (
          <button
            key={day.iso}
            type="button"
            className="calendar__day"
            data-in-month={day.inMonth}
            data-weekend={day.isWeekend}
            data-today={day.isToday}
            data-selected={isSelected(day)}
            data-allowed={isAllowed(day)}
            onClick={() => select(day.iso)}
          >
            {Number(day.iso.slice(8, 10))}
          </button>
        ))}
      </div>
    </div>
  )
}
