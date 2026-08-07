import { ArrowRight, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { quickProjection } from '../domain/finance/quickProjection'

const baht = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })
const plain = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 })

const defaults = { monthly: 10_000, years: 20, rate: 7 }

interface SliderProps {
  id: string
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

function Slider({ id, label, value, display, min, max, step, onChange }: SliderProps) {
  return (
    <div className="calc-field">
      <label htmlFor={id}>
        <span>{label}</span>
        <strong>{display}</strong>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

/**
 * The try-before-you-sign-up control in the hero.
 *
 * The arithmetic is `quickProjection`, which a test pins to the planner's real
 * engine — so the number shown here is the number the product would produce for
 * the same inputs, not a marketing approximation.
 */
export function HeroCalculator() {
  const [monthly, setMonthly] = useState(defaults.monthly)
  const [years, setYears] = useState(defaults.years)
  const [rate, setRate] = useState(defaults.rate)

  const result = useMemo(
    () => quickProjection({ initial: 0, monthly, years, annualReturnPercent: rate }),
    [monthly, years, rate],
  )
  const isDefault = monthly === defaults.monthly && years === defaults.years && rate === defaults.rate
  const growthShare = result.futureValue > 0 ? Math.round((result.growth / result.futureValue) * 100) : 0

  const reset = () => { setMonthly(defaults.monthly); setYears(defaults.years); setRate(defaults.rate) }

  return (
    <section className="hero-calc" aria-labelledby="hero-calc-title">
      <header>
        <div>
          <span className="eyebrow">ลองเล่นดูก่อน</span>
          <h2 id="hero-calc-title">ถ้าลงทุนแบบนี้ จะได้เท่าไหร่</h2>
        </div>
        {!isDefault && (
          <button type="button" className="calc-reset" onClick={reset}>
            <RotateCcw />รีเซ็ต
          </button>
        )}
      </header>

      <div className="calc-fields">
        <Slider
          id="calc-monthly" label="ลงทุนต่อเดือน" value={monthly} display={`${plain.format(monthly)} บาท`}
          min={1_000} max={100_000} step={1_000} onChange={setMonthly}
        />
        <Slider
          id="calc-years" label="ระยะเวลา" value={years} display={`${years} ปี`}
          min={1} max={40} step={1} onChange={setYears}
        />
        <Slider
          id="calc-rate" label="ผลตอบแทนคาดหวัง" value={rate} display={`${rate.toFixed(1)}% ต่อปี`}
          min={0} max={15} step={0.5} onChange={setRate}
        />
      </div>

      <div className="calc-result" role="status" aria-live="polite">
        <span>มูลค่าประมาณการเมื่อครบ {years} ปี</span>
        <strong>{baht.format(result.futureValue)}</strong>
        <div className="calc-split">
          <span><i className="calc-dot contributed" />เงินต้นสะสม {baht.format(result.contributed)}</span>
          <span><i className="calc-dot growth" />ผลตอบแทน {baht.format(result.growth)} ({growthShare}%)</span>
        </div>
        <div className="calc-bar" aria-hidden="true">
          <i style={{ width: `${100 - growthShare}%` }} />
        </div>
      </div>

      <p className="calc-note">
        ตัวอย่างนี้ยังไม่รวมค่าธรรมเนียม ภาษี เงินเฟ้อ และความผันผวน — เปิดแอปเพื่อดูโมเดลเต็มพร้อม Monte Carlo และที่มาของทุกตัวเลข
      </p>
      <a className="calc-cta" href="/sign-up">
        คำนวณแผนจริงของคุณ<ArrowRight />
      </a>
    </section>
  )
}
