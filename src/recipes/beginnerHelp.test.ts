import { describe, expect, it } from 'vitest'
import { studentRecipes } from '@/data/studentCatalog'
import { phase5Recipes } from '@/data/phase5'
import { phase6Recipes } from '@/data/phase6'
import { phase7Recipes } from '@/data/phase7'
import { sensors } from '@/data/inventory-seed/sensors'
import { studentSimulationFor } from '@/wokwi/studentSimulation'
import { CLASS_MINUTES, helpCardText, lessonPlan } from './classroom'
import { firstReadingFor, sensorsWithReadingGuide } from './firstReading'
import { glossaryFor } from './glossary'
import { splitEndpoint } from './parts'
import { powerChecks } from './powerCheck'
import { describeBands, resistorBands } from './resistorBands'
import { loopIntervalMs, sketchSummary } from './sketchSummary'

/**
 * 앞선 `beginnerFlow.test.ts`와 같은 잣대입니다. 레시피 하나가 예쁘게 나오는지가
 * 아니라, **모든 레시피가 빠짐없이** 아두이노를 처음 여는 학생이 멈추는 자리를
 * 메우는지를 봅니다.
 */
const allRecipes = [...studentRecipes, ...phase5Recipes, ...phase6Recipes, ...phase7Recipes]

describe('저항 색띠', () => {
  it('값을 네 색띠로 옮긴다', () => {
    expect(describeBands(resistorBands(4700)!)).toBe('노랑 · 보라 · 빨강 · 금색')
    expect(describeBands(resistorBands(220)!)).toBe('빨강 · 빨강 · 갈색 · 금색')
    expect(describeBands(resistorBands(10_000)!)).toBe('갈색 · 검정 · 주황 · 금색')
  })

  it('색띠로 적을 수 없는 값에는 그럴듯한 그림을 지어내지 않는다', () => {
    // 유효숫자가 세 자리인 값은 네 띠 표기로 옮길 수 없습니다.
    expect(resistorBands(123)).toBeNull()
    expect(resistorBands(0)).toBeNull()
    expect(resistorBands(Number.NaN)).toBeNull()
  })
})

describe('전원 넣기 전 점검', () => {
  it('모든 레시피가 점검 목록을 받고, 마지막은 언제나 안전 안내다', () => {
    for (const recipe of allRecipes) {
      const checks = powerChecks(recipe)
      expect(checks.length, recipe.id).toBeGreaterThanOrEqual(3)
      expect(checks.at(-1)?.question, recipe.id).toContain('탄 냄새')
      for (const check of checks) {
        expect(check.detail.length, `${recipe.id} · ${check.question}`).toBeGreaterThan(0)
      }
    }
  })

  it('점검 문항의 끝점을 배선에서 그대로 가져온다', () => {
    for (const recipe of allRecipes) {
      const endpoints = new Set(recipe.wiring.flatMap((step) => [step.from, step.to]))
      const listed = powerChecks(recipe)
        .flatMap((check) => check.question.split('—')[1]?.split(',') ?? [])
        .map((entry) => entry.trim())
        .filter(Boolean)

      for (const endpoint of listed) {
        expect(endpoints.has(endpoint), `${recipe.id}: ${endpoint}`).toBe(true)
      }
    }
  })

  it('브레드보드 전원 레일을 쓰는 레시피는 레일 기준으로 합선을 묻는다', () => {
    const railRecipe = allRecipes.find((recipe) =>
      recipe.wiring.some((step) => /^BB\.(tp|bp)\./.test(step.from) || /^BB\.(tp|bp)\./.test(step.to)),
    )
    expect(railRecipe).toBeDefined()
    expect(powerChecks(railRecipe!).map((check) => check.question).join('\n')).toContain('빨간 줄과 파란 줄')
  })
})

describe('처음 나온 값 점검', () => {
  it('재고의 모든 센서가 정상값과 고장 신호를 갖고 있다', () => {
    for (const sensor of sensors) {
      expect(sensorsWithReadingGuide, sensor.id).toContain(sensor.id)
    }
  })

  it('센서를 쓰는 레시피는 견줄 정상값을 받는다', () => {
    for (const recipe of allRecipes.filter((entry) => entry.sensors.length > 0)) {
      const reading = firstReadingFor(recipe)
      expect(reading.normal.length, recipe.id).toBe(recipe.sensors.length)
      expect(reading.signals.length, recipe.id).toBeGreaterThan(recipe.sensors.length)
    }
  })

  it('센서가 없는 레시피에도 공통 증상은 남는다', () => {
    const reading = firstReadingFor({ sensors: [] })
    expect(reading.normal).toEqual([])
    expect(reading.signals.map((signal) => signal.sign)).toContain('아무 줄도 나오지 않습니다')
  })
})

describe('용어 사전', () => {
  it('배선에 나온 핀 이름만 골라 뜻을 붙인다', () => {
    for (const recipe of allRecipes) {
      const terms = glossaryFor(recipe).map((entry) => entry.term)
      const pins = new Set(
        recipe.wiring
          .flatMap((step) => [step.from, step.to])
          .map((endpoint) => splitEndpoint(endpoint).pin.toUpperCase()),
      )

      // 배선에 없는 핀 이름을 사전에 올리지 않습니다.
      for (const term of terms.filter((entry) => /^[A-Z+-]+$/.test(entry))) {
        expect(pins.has(term), `${recipe.id}: ${term}`).toBe(true)
      }
      // 레시피와 상관없이 반드시 만나는 말은 언제나 들어 있습니다.
      expect(terms, recipe.id).toContain('시리얼 모니터')
    }
  })

  it('GND를 쓰는 레시피는 GND의 뜻을 받는다', () => {
    const recipe = allRecipes.find((entry) => entry.wiring.some((step) => step.to === 'UNO.GND'))
    expect(recipe).toBeDefined()
    expect(glossaryFor(recipe!).map((entry) => entry.term)).toContain('GND')
  })
})

describe('코드 요약', () => {
  it('되풀이 한 바퀴의 쉬는 시간을 loop 안에서만 센다', () => {
    const sketch = [
      'void setup() {',
      '  Serial.begin(9600);',
      '  delay(5000);',
      '}',
      'void loop() {',
      '  delay(500);',
      '  delay(500);',
      '}',
    ].join('\n')
    expect(loopIntervalMs(sketch)).toBe(1000)
  })

  it('모든 레시피가 setup과 loop를 설명하는 두 줄 이상을 받는다', () => {
    for (const recipe of allRecipes) {
      const summary = sketchSummary(recipe)
      expect(summary.length, recipe.id).toBeGreaterThanOrEqual(2)
      expect(summary[0], recipe.id).toContain(String(recipe.baudRate))
      expect(summary[1], recipe.id).toContain('loop()')
    }
  })
})

describe('교실에서 쓰는 안내', () => {
  it('한 차시를 넘는 레시피는 차시 수를 올려 잡는다', () => {
    expect(lessonPlan({ minutes: CLASS_MINUTES }).classes).toBe(1)
    expect(lessonPlan({ minutes: CLASS_MINUTES + 1 }).classes).toBe(2)
  })

  it('단계별 시간을 5분 단위로 끊어 적는다', () => {
    for (const recipe of allRecipes) {
      for (const stage of lessonPlan(recipe).stages) {
        expect(stage.minutes % 5, `${recipe.id}: ${stage.title}`).toBe(0)
      }
    }
  })

  it('도움 카드는 화면이 아는 것만 채우고 빈칸을 남긴다', () => {
    const recipe = studentRecipes[0]
    const card = helpCardText({ recipe, checkedSteps: 2 })
    expect(card).toContain(recipe.title)
    expect(card).toContain(`${recipe.baudRate} baud`)
    expect(card).toContain(`${recipe.wiring.length}단계 중 2단계`)
    expect(card).toContain('무엇이 안 되나요: ')
  })
})

describe('시뮬레이터 파일', () => {
  it('우리가 만든 칩 모형이 필요한 레시피에는 내주지 않는다', () => {
    // TSL2591·INA219·BME280은 공개 Wokwi에 없는 커스텀 칩으로 돕니다.
    const customChipRecipes = allRecipes.filter((recipe) =>
      recipe.sensors.some((sensorId) => ['tsl2591', 'ina219', 'bme280'].includes(sensorId)),
    )
    expect(customChipRecipes.length).toBeGreaterThan(0)
    for (const recipe of customChipRecipes) {
      expect(studentSimulationFor(recipe, sensors), recipe.id).toBeNull()
    }
  })

  it('공개 부품만 쓰는 레시피에는 두 파일을 그대로 내준다', () => {
    const openRecipes = allRecipes.filter((recipe) => studentSimulationFor(recipe, sensors) !== null)
    expect(openRecipes.length).toBeGreaterThan(0)

    const simulation = studentSimulationFor(openRecipes[0], sensors)!
    expect(JSON.parse(simulation.diagram).parts.length).toBeGreaterThan(0)
    expect(simulation.sketch).toContain('void loop')
  })
})
