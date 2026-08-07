import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { ProjectionPoint } from '../domain/finance/projection'

const compact = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 2 })
const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })
const series = [
  { key: 'nominal', label: 'มูลค่าพอร์ตหลังภาษี' },
  { key: 'contributed', label: 'เงินต้นสะสม' },
  { key: 'real', label: 'หลังเงินเฟ้อ' },
  { key: 'deposit', label: 'ฝากประจำสุทธิ' },
] as const
type SeriesKey = (typeof series)[number]['key']

export function ProjectionChart({ points }: { points: ProjectionPoint[] }) {
  const width = 720
  const height = 260
  const pad = { left: 24, right: 18, top: 18, bottom: 28 }
  const max = Math.max(...points.map((point) => Math.max(point.nominal, point.deposit)), 1) * 1.08
  const lastYear = points.at(-1)?.year || 1
  const x = (year: number) => pad.left + (year / lastYear) * (width - pad.left - pad.right)
  const y = (value: number) => height - pad.bottom - (value / max) * (height - pad.top - pad.bottom)
  const path = (key: SeriesKey) => points.map((point, index) => `${index ? 'L' : 'M'}${x(point.year).toFixed(1)},${y(point[key]).toFixed(1)}`).join(' ')
  const area = `${path('nominal')} L${x(lastYear)},${height - pad.bottom} L${pad.left},${height - pad.bottom} Z`
  const ticks = [0, .33, .66, 1]
  const [activeIndex, setActiveIndex] = useState(Math.max(0, points.length - 1))
  const [visibleSeries, setVisibleSeries] = useState<Set<SeriesKey>>(() => new Set(series.map((item) => item.key)))
  const svgRef = useRef<SVGSVGElement | null>(null)
  const activePoint = points[activeIndex] ?? points.at(-1)

  useEffect(() => setActiveIndex((current) => Math.min(current, Math.max(0, points.length - 1))), [points.length])
  const activeValueText = useMemo(() => activePoint ? `ปี ${activePoint.year}, ${series.map((item) => `${item.label} ${money.format(activePoint[item.key])}`).join(', ')}` : 'ไม่มีข้อมูล', [activePoint])

  const selectFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds?.width || points.length === 0) return
    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
    const targetYear = ratio * lastYear
    let nearest = 0
    points.forEach((point, index) => { if (Math.abs(point.year - targetYear) < Math.abs((points[nearest]?.year ?? 0) - targetYear)) nearest = index })
    setActiveIndex(nearest)
  }

  const handleKeyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!points.length) return
    let next = activeIndex
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next -= 1
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next += 1
    else if (event.key === 'PageDown') next -= 5
    else if (event.key === 'PageUp') next += 5
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = points.length - 1
    else return
    event.preventDefault()
    setActiveIndex(Math.min(points.length - 1, Math.max(0, next)))
  }

  const toggleSeries = (key: SeriesKey) => setVisibleSeries((current) => {
    if (current.has(key) && current.size === 1) return current
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  return <>
    <div className="chart-shell" data-interactive-chart="projection">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        role="slider"
        tabIndex={0}
        aria-label="สำรวจกราฟประมาณการตามปี"
        aria-valuemin={points[0]?.year ?? 0}
        aria-valuemax={lastYear}
        aria-valuenow={activePoint?.year ?? 0}
        aria-valuetext={activeValueText}
        onKeyDown={handleKeyboard}
        onPointerMove={selectFromPointer}
        onPointerDown={selectFromPointer}
      >
        <defs><linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d7ff73" stopOpacity=".78" /><stop offset="1" stopColor="#d7ff73" stopOpacity=".04" /></linearGradient></defs>
        {ticks.map((tick) => { const lineY = pad.top + tick * (height - pad.top - pad.bottom); return <line key={tick} x1={pad.left} x2={width - pad.right} y1={lineY} y2={lineY} className="chart-grid" /> })}
        {visibleSeries.has('nominal') && <path d={area} fill="url(#portfolioFill)" className="chart-area" />}
        {series.map((item) => visibleSeries.has(item.key) && <path key={item.key} data-series={item.key} d={path(item.key)} className={`chart-line ${item.key}`} />)}
        {activePoint && <g className="chart-crosshair" aria-hidden="true">
          <line x1={x(activePoint.year)} x2={x(activePoint.year)} y1={pad.top} y2={height - pad.bottom} />
          {series.map((item) => visibleSeries.has(item.key) && <circle key={item.key} className={item.key} cx={x(activePoint.year)} cy={y(activePoint[item.key])} r="4" />)}
        </g>}
      </svg>
      <div className="chart-y-axis" aria-hidden="true">{ticks.map((tick) => { const lineY = pad.top + tick * (height - pad.top - pad.bottom); return <span key={tick} style={{ top: `${(lineY - 5) / height * 100}%`, left: `${pad.left / width * 100}%` }}>{compact.format(max * (1 - tick))}</span> })}</div>
      {activePoint && <div className={`chart-tooltip ${activePoint.year / lastYear > .72 ? 'align-end' : ''}`} style={{ left: `${x(activePoint.year) / width * 100}%` }} aria-hidden="true">
        <strong>ปี {activePoint.year}</strong>
        {series.map((item) => visibleSeries.has(item.key) && <span className={`${item.key}-key`} key={item.key}><i />{item.label}<b>{money.format(activePoint[item.key])}</b></span>)}
      </div>}
    </div>
    <div className="chart-x-axis" aria-hidden="true">{[0, Math.round(lastYear / 2), lastYear].map((year) => <span key={year}>ปี {year}</span>)}</div>
    <div className="legend" role="group" aria-label="เลือกเส้นข้อมูลในกราฟ">{series.map((item) => <button type="button" key={item.key} className={`${item.key}-key`} aria-pressed={visibleSeries.has(item.key)} onClick={() => toggleSeries(item.key)}><i aria-hidden="true" />{item.label}</button>)}</div>
    <p className="chart-help">แตะหรือเลื่อนเมาส์บนกราฟ · ใช้ปุ่มลูกศรเมื่อโฟกัส · กดชื่อเส้นเพื่อซ่อนหรือแสดง</p>
  </>
}
