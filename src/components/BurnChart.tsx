import './BurnChart.css'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useFormat, useT } from '../i18n'
import { axisTicks, niceAxisTop } from '../lib/axis'
import type { Burn, BurnPoint } from '../lib/burn'

type Props = {
  burn: Burn
  todayIso: string
}

/** Room reserved for the money labels, and the gap kept at the right edge. Shared by the
 *  axis, the chart margin and the legend, which has to know where the plot area starts and
 *  ends to sit over its middle rather than the whole SVG's. */
const AXIS_WIDTH = 64
const PLOT_MARGIN = { top: 4, right: 8, bottom: 0, left: 0 }

/**
 * Cumulative allowance against cumulative spending, one point per camp day.
 *
 * `type="linear"` on purpose: a smoothed curve would invent values between days, and the
 * day *is* the unit of this data. The spending line stops at today (`actualCents` is
 * `null` afterwards, and `connectNulls={false}` respects that) rather than running flat
 * to the end of the camp, which would read as "we stopped spending".
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
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              domain={[0, scale.topCents]}
              ticks={axisTicks(scale)}
              tickFormatter={format.eurosRounded}
              tickLine={false}
              axisLine={false}
              stroke="var(--muted)"
              fontSize={11}
              width={AXIS_WIDTH}
            />
            <Tooltip
              formatter={(value) => (typeof value === 'number' ? format.euros(value) : '')}
              labelFormatter={(_label, payload) => {
                // Recharts hands back the whole row it drew, so the tooltip can show the
                // real date even though the axis only carries the day of the month.
                const point = payload?.[0]?.payload as BurnPoint | undefined
                return point === undefined ? '' : format.day(point.date)
              }}
              contentStyle={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '0.75rem',
              }}
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
                paddingLeft: AXIS_WIDTH,
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
              strokeWidth={2}
              strokeDasharray="5 4"
              // A dot left to its defaults is drawn white with a coloured ring, which reads
              // as a hollow marker at this size; filling it makes each day one solid point.
              dot={{ r: 2.5, fill: 'var(--accent)', strokeWidth: 0 }}
              activeDot={{ r: 4, fill: 'var(--accent)', strokeWidth: 0 }}
            />
            <Line
              type="linear"
              dataKey="actualCents"
              name={t.burn.actual}
              stroke={actualColor}
              strokeWidth={2}
              dot={{ r: 2.5, fill: actualColor, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: actualColor, strokeWidth: 0 }}
              // Without this a gap would be bridged, drawing spending we have not made.
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
