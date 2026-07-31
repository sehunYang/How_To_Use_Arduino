import { describe, expect, it } from 'vitest'
import { recipeVerifyHash, validatePublish } from '@/admin/authoring'
import { actuators } from '@/data/inventory-seed/actuators'
import { sensors } from '@/data/inventory-seed/sensors'
import { computeInventoryVersion } from '@/lib/verifyHash'
import { RecipeSchema } from '@/schema'
import { buildDiagram } from '@/wokwi/buildDiagram'
import { phase6PhysicsRecipes, phase6PinRecipes, phase6Recipes } from '.'

function functionBody(sketch: string, name: 'setup' | 'loop') {
  const signatureIndex = sketch.indexOf(`void ${name}()`)
  const openBraceIndex = sketch.indexOf('{', signatureIndex)
  let depth = 0

  for (let index = openBraceIndex; index < sketch.length; index += 1) {
    if (sketch[index] === '{') depth += 1
    if (sketch[index] === '}') depth -= 1
    if (depth === 0) return sketch.slice(openBraceIndex + 1, index)
  }

  return ''
}

describe('Phase 6 recipe expansion', () => {
  it('contains the approved pin-coverage and current-inventory physics groups', () => {
    expect(phase6PinRecipes).toHaveLength(6)
    expect(phase6PhysicsRecipes).toHaveLength(35)
    expect(phase6Recipes).toHaveLength(41)
    expect(new Set(phase6Recipes.map((recipe) => recipe.id)).size).toBe(41)
  })

  it('parses every recipe and preserves draft review state', () => {
    for (const recipe of phase6Recipes) {
      expect(RecipeSchema.safeParse(recipe).success, recipe.id).toBe(true)
      expect(recipe.status, recipe.id).toBe('draft')
      expect(recipe.reviewedOnDevice, recipe.id).toBeNull()
      expect(recipe.commentReviewed, recipe.id).toBeNull()
      expect(recipe.body, recipe.id).toContain('## 한눈에 보기')
      expect(recipe.body, recipe.id).toContain('## 1. 과학 이론 쉽게 이해하기')
      expect(recipe.body, recipe.id).toContain('변인 설계')
      expect(recipe.body, recipe.id).toContain('데이터 처리와 그래프')
      expect(recipe.body, recipe.id).toContain('실험 실행 계획')
      expect(recipe.body, recipe.id).not.toContain('## 측정 기록표')
      expect(recipe.body, recipe.id).not.toContain('## 계산과 그래프')
      expect(recipe.body, recipe.id).not.toContain('표본 표준편차')
      expect(recipe.body, recipe.id).not.toContain('relative error')
    }
  })

  it('emits one CSV header from setup and keeps serial text CSV-safe', () => {
    for (const recipe of phase6Recipes) {
      const setup = functionBody(recipe.sketch, 'setup')
      const loop = functionBody(recipe.sketch, 'loop')
      const headers = [...setup.matchAll(/Serial\.println\("([^"\r\n]+,[^"\r\n]+)"\)/g)]

      expect(headers, recipe.id).toHaveLength(1)
      expect(headers[0][1], recipe.id).not.toMatch(/^,|,$/)
      expect(headers[0][1].split(',').every((column) => /^[A-Za-z][A-Za-z0-9_]*$/.test(column)), recipe.id).toBe(true)

      for (const match of loop.matchAll(/Serial\.(?:print|println)\("([^"\r\n]*)"\)/g)) {
        const text = match[1]
        expect(text.startsWith('#') || text.endsWith(','), `${recipe.id}: ${text}`).toBe(true)
      }
    }
  })

  it('renders authored scientific equations as LaTeX without nested delimiters', () => {
    const rcRecipe = phase6PhysicsRecipes.find((recipe) => recipe.id === 'ph21-rc-time-constant')
    expect(rcRecipe?.body).toContain('$V=V_0\\left(1-e^{-t/(RC)}\\right)$')
    expect(rcRecipe?.body).toContain('$V=V_0e^{-t/(RC)}$')

    for (const recipe of phase6Recipes) {
      expect(recipe.body, recipe.id).not.toContain('$$')
      expect(recipe.body, recipe.id).not.toMatch(/V=V₀|e\^-|T=2π|ΔP≈|I=I₀|A=-log₁₀/)
    }
  })

  it('resolves every endpoint into a complete breadboard diagram', () => {
    for (const recipe of phase6Recipes) {
      const diagram = buildDiagram(recipe, sensors)
      expect(diagram.parts.some((part) => part.id === 'bb'), recipe.id).toBe(true)
      expect(diagram.connections.length, recipe.id).toBeGreaterThanOrEqual(recipe.wiring.length)
    }
  })

  it('uses a filtered PWM sweep only for the low-current Ohm law experiment', () => {
    const ohmsLaw = phase6PhysicsRecipes.find((recipe) => recipe.id === 'ph17-ohms-law')
    expect(ohmsLaw).toBeDefined()
    expect(ohmsLaw?.wiring).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'RESISTOR_100.1', to: 'UNO.D9' }),
      expect.objectContaining({ from: 'RESISTOR_100.2', to: 'CAPACITOR.1' }),
      expect.objectContaining({ from: 'CAPACITOR.2', to: 'UNO.GND' }),
      expect.objectContaining({ from: 'INA219.VIN-', to: 'RESISTOR_1000.1' }),
    ]))
    expect(ohmsLaw?.wiring.some((step) => step.from.startsWith('BATTERY.'))).toBe(false)
    expect(ohmsLaw?.sketch).toContain('analogWrite(PWM_OUT, duty)')
    expect(ohmsLaw?.sketch).toContain('float busV = (readIna(0x02) >> 3) * 0.004f')
    expect(ohmsLaw?.sketch).toContain('delay(settlingMs)')
    expect(ohmsLaw?.body).toContain('1 kΩ 이상')

    const unsuitableForUnoPwm = [
      'ph18-series-parallel-resistance',
      'ph19-kirchhoff-laws',
      'ph20-joule-heating',
      'ph22-battery-internal-resistance',
      'ph23-solar-iv-mpp',
      'ph24-solenoid-current-field',
    ]
    for (const id of unsuitableForUnoPwm) {
      const recipe = phase6PhysicsRecipes.find((candidate) => candidate.id === id)
      expect(recipe?.sketch, id).not.toContain('analogWrite(')
      expect(recipe?.wiring.some((step) => step.from === 'UNO.D9' || step.to === 'UNO.D9'), id).toBe(false)
    }
  })

  it('keeps electricity and magnetism guides aligned with their physical conditions and CSV labels', () => {
    const byId = (id: string) => phase6PhysicsRecipes.find((recipe) => recipe.id === id)!
    for (const id of [
      'ph17-ohms-law',
      'ph18-series-parallel-resistance',
      'ph19-kirchhoff-laws',
      'ph20-joule-heating',
      'ph21-rc-time-constant',
      'ph22-battery-internal-resistance',
      'ph23-solar-iv-mpp',
      'ph24-solenoid-current-field',
      'ph25-coil-turns-field',
    ]) {
      expect(byId(id).sketch, id).toContain('condition_id')
      expect(byId(id).sketch, id).toContain('conditionId')
    }

    expect(byId('ph18-series-parallel-resistance').wiring).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'RESISTOR_220.2', to: 'RESISTOR_1000.1' }),
    ]))
    expect(byId('ph19-kirchhoff-laws').wiring).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'INA219.VIN-', to: 'RESISTOR_220.1' }),
      expect.objectContaining({ from: 'INA219.VIN-', to: 'RESISTOR_470.1' }),
    ]))
    expect(byId('ph20-joule-heating').wiring).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'DS18B20.DATA', to: 'UNO.D2' }),
      expect.objectContaining({ from: 'INA219.VIN-', to: 'RESISTOR_10.1' }),
    ]))
    expect(byId('ph21-rc-time-constant').wiring).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'BATTERY.+', to: 'RESISTOR_10000.1' }),
      expect.objectContaining({ from: 'INA219.VIN-', to: 'CAPACITOR.1' }),
      expect.objectContaining({ from: 'CAPACITOR.1', to: 'UNO.A0' }),
    ]))
    expect(byId('ph21-rc-time-constant').sketch).toContain('analogRead(CAPACITOR_VOLTAGE_PIN)')
    expect(byId('ph22-battery-internal-resistance').body).toContain('NO_LOAD')
    expect(byId('ph22-battery-internal-resistance').body).toContain('LOAD_100')
    expect(byId('ph23-solar-iv-mpp').wiring).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'PANEL.POSITIVE', to: 'INA219.VIN+' }),
      expect.objectContaining({ from: 'TSL2591.SDA', to: 'UNO.A4' }),
    ]))
    for (const id of ['ph24-solenoid-current-field', 'ph25-coil-turns-field']) {
      expect(byId(id).wiring).toEqual(expect.arrayContaining([
        expect.objectContaining({ from: 'HBE0704.OUT', to: 'UNO.A0' }),
        expect.objectContaining({ from: 'INA219.VIN-', to: 'LOAD.POSITIVE' }),
      ]))
    }
  })

  it('mounts the RC filter parts on breadboard terminal strips', () => {
    const ohmsLaw = phase6PhysicsRecipes.find((recipe) => recipe.id === 'ph17-ohms-law')!
    const diagram = buildDiagram(ohmsLaw, sensors)
    expect(diagram.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'capacitor', type: 'visual-capacitor' }),
      expect.objectContaining({ id: 'resistor_100', type: 'wokwi-resistor' }),
      expect.objectContaining({ id: 'resistor_1000', type: 'wokwi-resistor' }),
    ]))
    for (const partId of ['capacitor', 'resistor_100', 'resistor_1000']) {
      const connections = diagram.connections.filter(([from, to]) =>
        from.startsWith(`${partId}:`) || to.startsWith(`${partId}:`),
      )
      expect(connections, partId).toHaveLength(2)
      expect(
        connections.every(([from, to]) => from.startsWith('bb:') || to.startsWith('bb:')),
        partId,
      ).toBe(true)
    }
  })

  it('covers every formerly unused pin in a real recipe connection', () => {
    const endpoints = new Set(
      phase6PinRecipes.flatMap((recipe) =>
        recipe.wiring.flatMap((step) => [step.from, step.to]),
      ),
    )
    for (const endpoint of [
      'TSL2591.3VO',
      'TSL2591.INT',
      'MPU6050_1.AD0',
      'MPU6050_2.AD0',
      'MPU6050.INT',
      'MPU6050.XDA',
      'MPU6050.XCL',
      'TCA9548A_1.RST',
      'TCA9548A_1.A0',
      'TCA9548A_1.A1',
      'TCA9548A_1.A2',
      ...Array.from({ length: 8 }, (_, channel) => `TCA9548A.SD${channel}`),
      ...Array.from({ length: 8 }, (_, channel) => `TCA9548A.SC${channel}`),
    ]) {
      expect(endpoints.has(endpoint), endpoint).toBe(true)
    }
  })

  it('passes the publication gate after the approved reviews and verification ledger are recorded', () => {
    const inventory = { sensors, actuators }
    const inventoryVersion = computeInventoryVersion(inventory)
    for (const recipe of phase6Recipes) {
      const verifyHash = recipeVerifyHash(recipe, inventoryVersion)
      const reviewed = {
        ...recipe,
        status: 'published' as const,
        reviewedOnDevice: { at: '2026-07-31T00:00:00.000Z', verifyHash },
        commentReviewed: { at: '2026-07-31T00:00:00.000Z', verifyHash },
      }
      const validation = validatePublish(reviewed, inventory, inventoryVersion, {
        verifyHash,
        compilePass: true,
        simPass: null,
        logicPass: true,
        staticIssues: [],
        verifiedAt: '2026-07-31T00:00:00.000Z',
      })
      expect(validation.issues, recipe.id).toEqual([])
      expect(validation.canPublish, recipe.id).toBe(true)
    }
  })
})
