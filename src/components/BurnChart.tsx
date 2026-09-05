import './BurnChart.css'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { useFormat, useT } from '../i18n'
import { axisTicks, niceAxisTop, spacedTicks } from '../lib/axis'
import type { Burn } from '../lib/burn'

type Props = {
  burn: Burn
  todayIso: string
}

/** The gap kept at the right edge, and the room the plot leaves above the highest point. */
const PLOT_MARGIN = { top: 4, right: 8, bottom: 0, left: 0 }

/** How many day labels the x-axis carries at most. Nine two-digit labels at 11px sit
 *  comfortably across the plot area of the narrowest phone this runs on; the days between
 *  them still get a point and a gridline, they just go unlabelled. */
const DAY_LABELS = 9

/** Room the money labels need, as an upper bound at 11px: the widest tick this chart will
 *  draw, plus the gap Recharts leaves between the text and the plot (its tick line and tick
 *  margin). Measured rather than fixed, so a €430 camp does not reserve the width a €10.000
 *  one needs and leave the curves floating in the middle of the box. */
function axisWidth(labels: string[]): number {
  const widest = labels.reduce((max, label) => Math.max(max, label.length), 0)
  return Math.ceil(widest * 6.6) + 10
}

/**
 * Cumulative allowance against cumulative spending, one point per camp day.
 *
 * `type="linear"` on purpose: a smoothed curve would invent values between days, and the
 * day *is* the unit of this data. The spending line stops at today (`actualCents` is
 * `null` afterwards, and `connectNulls={false}` respects that) rather than running flat
 * to the end of the camp, which would read as "we stopped spending".
 *
 * The chart takes no input at all — see `.burn__canvas` in the stylesheet.
 */
export function BurnChart({ burn, todayIso }: Props) {
  const t = useT()
  const format = useFormat()

  // Colour the spending line by the situation: over the allowance is the one state worth
  // spotting from across a room.
  const actualColor = burn.allowedTodayCents < 0 ? 'var(--danger)' : 'var(--ok-fill)'
  const todayLabel = burn.points.find((p) => p.date === todayIso)?.dayLabel

  // Recharts' own "auto" domain rounds the *step* up first and lets the top follow it, so
  // a €430 camp gets an axis to €600. Fixing the domain and the ticks ourselves keeps the
  // labels round while stopping just above the highest of the two series.
  const highestCents = burn.points.reduce(
    (max, p) => Math.max(max, p.theoreticalCents, p.actualCents ?? 0),
    0,
  )
  const scale = niceAxisTop(highestCents)
  const ticks = axisTicks(scale)
  const yAxisWidth = axisWidth(ticks.map(format.eurosRounded))

  return (
    <div className="burn">
      {/* No heading of its own: the section around it is already called "Daily burn" and
          the legend names both lines. The SVG carries no text an assistive tech can make
          sense of, so the whole chart is announced as one image; the numbers above it say
          where the camp stands. */}
      <div className="burn__canvas" role="img" aria-label={t.burn.chartAlt(burn.points.length)}>
        {/* ResponsiveContainer measures its parent, so the chart has to be given a height
            in CSS or as a prop — an SVG has no intrinsic size to fall back on. */}
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={burn.points} margin={PLOT_MARGIN}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="dayLabel"
              tickLine={false}
              stroke="var(--muted)"
              fontSize={11}
              // Long camps would crowd the axis; thinning labels keeps every *point*.
              // `interval={0}` means "draw exactly the ticks given" — without it Recharts
              // thins the list again by label width, which is what made the gaps ragged.
              ticks={spacedTicks(
                burn.points.map((p) => p.dayLabel),
                DAY_LABELS,
              )}
              interval={0}
            />
            <YAxis
              domain={[0, scale.topCents]}
              ticks={ticks}
              // `axisTicks` already caps the list at seven labels, which fit with room to
              // spare — so draw exactly those. Without it Recharts thins them again by
              // label height, and the grid does that arithmetic at the document's default
              // font size rather than the 11px drawn here, dropping the gridline under the
              // top one while its label stayed.
              interval={0}
              tickFormatter={format.eurosRounded}
              tickLine={false}
              axisLine={false}
              stroke="var(--muted)"
              fontSize={11}
              width={yAxisWidth}
            />
            {/* The legend's wrapper spans the whole SVG, so its centred text would sit over
                the plot *plus* the money axis — visibly left of the curves. Padding the
                wrapper by the axis width (and the plot's right margin) centres it over the
                plot area without moving the box itself. */}
            <Legend
              iconType="plainline"
              wrapperStyle={{
                fontSize: '0.75rem',
                boxSizing: 'border-box',
                paddingLeft: yAxisWidth,
                paddingRight: PLOT_MARGIN.right,
              }}
            />

            {todayLabel !== undefined && (
              <ReferenceLine x={todayLabel} stroke="var(--muted)" strokeDasharray="2 4" />
            )}

            <Line
              type="linear"
              dataKey="theoreticalCents"
              name={t.burn.theoretical}
              stroke="var(--accent)"
              // Thinner than the spending line and drawn solid: the allowance is the
              // reference the eye measures against, so it should not compete with the
              // curve that carries the news.
              strokeWidth={1.5}
              // A dot left to its defaults is drawn white with a coloured ring, which reads
              // as a hollow marker at this size; filling it makes each day one solid point.
              dot={{ r: 2.5, fill: 'var(--accent)', strokeWidth: 0 }}
            />
            <Line
              type="linear"
              dataKey="actualCents"
              name={t.burn.actual}
              stroke={actualColor}
              strokeWidth={2}
              dot={{ r: 2.5, fill: actualColor, strokeWidth: 0 }}
              // Without this a gap would be bridged, drawing spending we have not made.
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
