import type { Recipe, Sensor, Actuator, StaticIssue } from '@/schema'
import { parseManifest, resolveTunableAnchor } from './manifest'

/** Re-exported under the task's requested name; identical shape to StaticIssue (src/schema/simStatus.ts). */
export type Issue = StaticIssue

export interface Inventory {
  sensors: Sensor[]
  actuators: Actuator[]
}

export type ValidationMode = 'draft' | 'publish'

/**
 * Arduino Uno R3 pin surface (plan 1.3 check #3). Not yet modeled in the
 * inventory seed data, so hardcoded here as a small constant per the task
 * spec until a board-data source exists.
 */
const UNO_PINS = new Set([
  'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13',
  'A0', 'A1', 'A2', 'A3', 'A4', 'A5',
  '5V', '3.3V', 'GND', 'VIN',
])

/**
 * Pins that are legitimately shared by multiple wiring steps by nature
 * (the hardware I2C bus pins, and power/ground rails every component needs)
 * — excluded from the check #1 duplicate-pin conflict detection.
 */
const SHARED_PINS = new Set(['A4', 'A5', '5V', '3.3V', 'GND', 'VIN'])

const EXTERNAL_POWER_KEYWORDS = ['외부 전원', '배터리', '별도 전원']

/** Normalizes a raw pin token (e.g. "9", "D9", "a4") to a canonical form ("D9", "A4"). */
function normalizePin(raw: string): string {
  const trimmed = raw.trim().toUpperCase()
  if (/^\d+$/.test(trimmed)) return `D${trimmed}`
  return trimmed
}

/**
 * Wiring convention: `to` values that target the board itself are written
 * as `UNO.<PIN>` (see src/schema/schema.test.ts's validWiringStep fixture).
 * Sensor-to-sensor lines (e.g. a shared I2C bus routed sensor-to-sensor)
 * use a sensor id/token prefix instead and are not board pins.
 * Returns the normalized board pin, or null if `to` doesn't target the board.
 */
function boardPinFromTo(to: string): string | null {
  const dotIndex = to.indexOf('.')
  if (dotIndex === -1) return null
  const prefix = to.slice(0, dotIndex)
  if (prefix.toUpperCase() !== 'UNO') return null
  return normalizePin(to.slice(dotIndex + 1))
}

function issue(code: string, mode: ValidationMode, message: string): Issue {
  return { code, severity: mode === 'publish' ? 'error' : 'warning', message }
}

/** Check #1: two different single-purpose pins claimed by the same `to` target. */
function checkPinDuplication(recipe: Recipe, mode: ValidationMode): Issue[] {
  const byPin = new Map<string, number>()
  for (const step of recipe.wiring) {
    const pin = boardPinFromTo(step.to)
    if (!pin || SHARED_PINS.has(pin)) continue
    byPin.set(pin, (byPin.get(pin) ?? 0) + 1)
  }
  const issues: Issue[] = []
  for (const [pin, count] of byPin) {
    if (count > 1) {
      issues.push(issue('pin-duplicate', mode, `핀 ${pin}이(가) ${count}개의 서로 다른 배선 스텝에서 중복 사용되었습니다.`))
    }
  }
  return issues
}

/**
 * Check #2: I2C address conflict, generalized from the declarative
 * `addressing` field (plan N3) rather than hardcoded per-sensor logic.
 *
 * Heuristic (inherently approximate — the schema has no "quantity per
 * sensor" field): the sensor token of a `wiring[].from` entry is the
 * substring before the first `.` (e.g. `"TSL2591_1.SDA"` -> `"TSL2591_1"`).
 * We strip a trailing `_<digits>` or bare `<digits>` instance suffix (e.g.
 * `"TSL2591_1"` -> `"tsl2591"`, `"TSL2591_2"` -> `"tsl2591"`) and match the
 * result case-insensitively against inventory sensor ids.
 *
 * The conflict condition is `instances > sensor.addressing.maxOnBus`, read
 * directly off the schema (F2) rather than proxied by `mode === 'fixed'` —
 * a 'strapped' sensor wired 5 times with only 4 strap-pin addresses is
 * exactly as much a conflict as a 'fixed' sensor wired twice. The escape
 * hatch is any inventory sensor with `muxChannels > 0` present in
 * `recipe.sensors[]` (F3) — data-driven, so adding a second kind of
 * multiplexer to the inventory never requires editing this function.
 */
function checkI2cAddressConflict(recipe: Recipe, inventory: Inventory, mode: ValidationMode): Issue[] {
  const tokensBySensorId = new Map<string, Set<string>>()
  for (const step of recipe.wiring) {
    const dotIndex = step.from.indexOf('.')
    const rawToken = dotIndex === -1 ? step.from : step.from.slice(0, dotIndex)
    const baseToken = rawToken.toLowerCase().replace(/_?\d+$/, '')
    const sensor = inventory.sensors.find((s) => s.id.toLowerCase() === baseToken)
    if (!sensor) continue
    const set = tokensBySensorId.get(sensor.id) ?? new Set<string>()
    set.add(rawToken.toLowerCase())
    tokensBySensorId.set(sensor.id, set)
  }

  const hasMux = recipe.sensors.some((id) => {
    const sensor = inventory.sensors.find((s) => s.id === id)
    return sensor ? sensor.muxChannels > 0 : false
  })

  const issues: Issue[] = []
  for (const [sensorId, tokens] of tokensBySensorId) {
    const sensor = inventory.sensors.find((s) => s.id === sensorId)
    if (!sensor || sensor.addressing.mode === 'none') continue
    if (tokens.size <= sensor.addressing.maxOnBus) continue
    if (!hasMux) {
      issues.push(
        issue(
          'i2c-address-conflict',
          mode,
          `센서 ${sensor.name}이(가) ${tokens.size}회 배선되었지만 이 부품이 가진 최대 동시 사용 개수(${sensor.addressing.maxOnBus})를 넘고, 멀티플렉서도 없어 주소가 충돌합니다.`,
        ),
      )
    }
  }
  return issues
}

/** Check #3: a `to` targeting the board must reference a real Uno R3 pin. */
function checkNonexistentPin(recipe: Recipe, mode: ValidationMode): Issue[] {
  const issues: Issue[] = []
  for (const step of recipe.wiring) {
    const pin = boardPinFromTo(step.to)
    if (pin && !UNO_PINS.has(pin)) {
      issues.push(issue('nonexistent-pin', mode, `${step.to}은(는) Uno R3에 존재하지 않는 핀입니다.`))
    }
  }
  return issues
}

/** Check #4: every referenced sensor/actuator id must exist in the owned inventory. */
function checkUnownedComponent(recipe: Recipe, inventory: Inventory, mode: ValidationMode): Issue[] {
  const issues: Issue[] = []
  const sensorIds = new Set(inventory.sensors.map((s) => s.id))
  const actuatorIds = new Set(inventory.actuators.map((a) => a.id))
  for (const id of recipe.sensors) {
    if (!sensorIds.has(id)) {
      issues.push(issue('unowned-component', mode, `센서 "${id}"은(는) 보유 인벤토리에 없습니다.`))
    }
  }
  for (const id of recipe.actuators) {
    if (!actuatorIds.has(id)) {
      issues.push(issue('unowned-component', mode, `액추에이터 "${id}"은(는) 보유 인벤토리에 없습니다.`))
    }
  }
  return issues
}

/**
 * Check #5: publish-mode only. A draft is, by definition, allowed to have
 * an empty/incomplete wiring[] — enforcing this in draft mode would make it
 * impossible to save a draft at all (plan N1). Per-field non-emptiness
 * (from/to/color/text) is already guaranteed by WiringStepSchema's
 * `.min(1)` constraints, so the only meaningful runtime check left is
 * "the array itself isn't empty" in publish mode.
 */
function checkWiringRequiredForPublish(recipe: Recipe, mode: ValidationMode): Issue[] {
  if (mode !== 'publish') return []
  if (recipe.wiring.length === 0) {
    return [issue('wiring-empty', mode, '게시하려면 wiring[]이 비어 있으면 안 됩니다.')]
  }
  return []
}

/**
 * Check #6: duplicate focus rectangles (copy-paste mistake) AND
 * out-of-bounds focus rectangles. The bounds half was deferred in the
 * original implementation for lack of an image-dimensions field; F4 added
 * `Recipe.imageWidth`/`imageHeight`, so both halves run here now.
 */
function checkDuplicateFocusRect(recipe: Recipe, mode: ValidationMode): Issue[] {
  const issues: Issue[] = []

  const seen = new Map<string, number>()
  for (const step of recipe.wiring) {
    const key = JSON.stringify(step.focus)
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  for (const [key, count] of seen) {
    if (count > 1) {
      issues.push(issue('duplicate-focus-rect', mode, `동일한 focus 영역(${key})이 ${count}개의 배선 스텝에서 중복 사용되었습니다.`))
    }
  }

  for (const step of recipe.wiring) {
    const { x, y, w, h } = step.focus
    const inBounds =
      x >= 0 && y >= 0 && x + w <= recipe.imageWidth && y + h <= recipe.imageHeight
    if (!inBounds) {
      issues.push(
        issue(
          'focus-out-of-bounds',
          mode,
          `focus 영역 {x:${x},y:${y},w:${w},h:${h}}이(가) 이미지 크기(${recipe.imageWidth}x${recipe.imageHeight})를 벗어납니다.`,
        ),
      )
    }
  }

  return issues
}

/**
 * Check #7: manifest block (`// @pin` comments) <-> wiring[] cross-check,
 * in both directions. This only validates manifest-comment <-> wiring-data
 * consistency, NOT manifest <-> actual code literals (e.g. `#define TRIG 7`)
 * — parsing arbitrary C++ is explicitly out of scope here (plan N11); that
 * class of drift is L3's job (compensating control via simulated serial
 * assertions), documented as a design limitation in the plan (row 7-note).
 */
/**
 * Power/ground rails are never meaningful code literals — no sketch ever
 * does `pinMode(5V, ...)` — so requiring a `@pin` manifest entry for them
 * would fire this check on nearly every real recipe (every wired component
 * needs power) without ever catching a genuine mismatch. Excluded from the
 * wiring-implies-manifest direction (a power pin with no manifest entry is
 * fine). The reverse is NOT fine: a `@pin` entry naming a power rail is
 * always an authoring mistake regardless of what's wired, since it can
 * never correspond to a real code literal — that direction flags it
 * unconditionally (F1; a prior version of this comment claimed this
 * direction already caught it, which was false — verified by probe).
 */
const POWER_PINS = new Set(['5V', '3.3V', 'GND', 'VIN'])

function checkManifestWiringCrossCheck(recipe: Recipe, mode: ValidationMode): Issue[] {
  const manifest = parseManifest(recipe.sketch)
  const manifestPins = new Set(Object.values(manifest.pins).map(normalizePin))

  const wiringBoardPins = new Set<string>()
  for (const step of recipe.wiring) {
    const pin = boardPinFromTo(step.to)
    if (pin) wiringBoardPins.add(pin)
  }

  const issues: Issue[] = []
  for (const [name, rawPin] of Object.entries(manifest.pins)) {
    const pin = normalizePin(rawPin)
    if (POWER_PINS.has(pin)) {
      issues.push(
        issue(
          'manifest-wiring-mismatch',
          mode,
          `매니페스트의 @pin ${name}=${rawPin}은(는) 전원 핀입니다. @pin은 코드가 실제로 참조하는 핀에만 붙여야 합니다.`,
        ),
      )
      continue
    }
    if (!wiringBoardPins.has(pin)) {
      issues.push(
        issue(
          'manifest-wiring-mismatch',
          mode,
          `매니페스트의 @pin ${name}=${rawPin}에 대응하는 wiring[] 스텝이 없습니다.`,
        ),
      )
    }
  }
  for (const pin of wiringBoardPins) {
    if (POWER_PINS.has(pin)) continue
    if (!manifestPins.has(pin)) {
      issues.push(
        issue(
          'manifest-wiring-mismatch',
          mode,
          `wiring[]이 참조하는 보드 핀 ${pin}에 대응하는 @pin 매니페스트 항목이 없습니다.`,
        ),
      )
    }
  }
  return issues
}

/**
 * Check #8: if total current draw (actuators AND sensors — F6: a sensor's
 * own draw is real load on the same 5V rail and was previously omitted,
 * which meant e.g. servo(250)+relay(70)+PIR(65)+HC-SR04(15)=400mA actual
 * never fired because only the 320mA actuator-only subtotal was checked)
 * reaches 400mA, an external-power wiring step must be present.
 * Keyword-detected via Korean substrings ("외부 전원" / "배터리" / "별도 전원")
 * in any wiring step's `text` field — documented here since it's a keyword
 * heuristic, not a structured field.
 */
function checkExternalPowerRequired(recipe: Recipe, inventory: Inventory, mode: ValidationMode): Issue[] {
  const actuatorById = new Map(inventory.actuators.map((a) => [a.id, a]))
  const sensorById = new Map(inventory.sensors.map((s) => [s.id, s]))
  let totalMa = 0
  for (const id of recipe.actuators) {
    const actuator = actuatorById.get(id)
    if (actuator) totalMa += actuator.currentDrawMa
  }
  for (const id of recipe.sensors) {
    const sensor = sensorById.get(id)
    if (sensor) totalMa += sensor.currentDrawMa
  }
  if (totalMa < 400) return []

  const hasExternalPowerStep = recipe.wiring.some((step) =>
    EXTERNAL_POWER_KEYWORDS.some((kw) => step.text.includes(kw)),
  )
  if (!hasExternalPowerStep) {
    return [
      issue(
        'external-power-missing',
        mode,
        `액추에이터·센서 전류 합계가 ${totalMa}mA로 400mA 이상이지만 외부 전원 배선 스텝이 없습니다.`,
      ),
    ]
  }
  return []
}

/**
 * Check #9: every TunableParam.anchor must resolve to exactly one line via
 * resolveTunableAnchor() (spec A3.3) — 0 or >1 matches, or no following
 * code line, is an authoring mistake the student-facing highlight would
 * otherwise silently mis-point.
 */
function checkTunableAnchorResolution(recipe: Recipe, mode: ValidationMode): Issue[] {
  const issues: Issue[] = []
  for (const tunable of recipe.tunables) {
    const line = resolveTunableAnchor(recipe.sketch, tunable.anchor)
    if (line === null) {
      issues.push(
        issue(
          'tunable-anchor-unresolved',
          mode,
          `튜너블 "${tunable.anchor}"의 @tunable 마커가 스케치에서 정확히 한 곳으로 해석되지 않습니다.`,
        ),
      )
    }
  }
  return issues
}

/**
 * Check #10: the manifest's `@baud` value must equal `recipe.baudRate`
 * (both must exist and agree) — a mismatch means the code and the recipe's
 * declared baud rate have drifted, which reads as garbage in the student's
 * Serial Monitor even though everything else compiles and simulates fine.
 */
function checkBaudMismatch(recipe: Recipe, mode: ValidationMode): Issue[] {
  const manifest = parseManifest(recipe.sketch)
  if (manifest.baud === null) {
    return [issue('baud-mismatch', mode, '스케치 매니페스트에 @baud 항목이 없습니다.')]
  }
  if (manifest.baud !== recipe.baudRate) {
    return [
      issue(
        'baud-mismatch',
        mode,
        `매니페스트의 @baud ${manifest.baud}가 recipe.baudRate ${recipe.baudRate}와 일치하지 않습니다.`,
      ),
    ]
  }
  return []
}

/**
 * Check #11: publish-mode only. troubleshooting[]/applicationGuide are
 * exactly the fields A3.9/A4.3 require to be non-empty before a recipe is
 * considered complete; a draft is allowed to lack them (plan N1).
 */
function checkGuidanceRequiredForPublish(recipe: Recipe, mode: ValidationMode): Issue[] {
  if (mode !== 'publish') return []
  const issues: Issue[] = []
  if (recipe.troubleshooting.length === 0) {
    issues.push(issue('missing-guidance', mode, '게시하려면 troubleshooting[]이 비어 있으면 안 됩니다.'))
  }
  if (recipe.applicationGuide.trim().length === 0) {
    issues.push(issue('missing-guidance', mode, '게시하려면 applicationGuide가 비어 있으면 안 됩니다.'))
  }
  return issues
}

/**
 * L1 static validator (plan 1.3) — the 11 per-recipe checks. Corpus-level
 * invariants (subject distribution / sensor coverage / rationale coverage)
 * are deliberately NOT run here — see src/validation/corpusCheck.ts and its
 * module comment for the N2 rationale.
 *
 * In 'draft' mode all checks return 'warning' severity and this function
 * never throws or blocks saving. In 'publish' mode the same violations are
 * returned as 'error'. Checks #5 (empty wiring[]) and #11 (missing guidance
 * text) only run in publish mode — a draft is allowed to be incomplete.
 */
export function validateRecipe(recipe: Recipe, inventory: Inventory, mode: ValidationMode): Issue[] {
  return [
    ...checkPinDuplication(recipe, mode),
    ...checkI2cAddressConflict(recipe, inventory, mode),
    ...checkNonexistentPin(recipe, mode),
    ...checkUnownedComponent(recipe, inventory, mode),
    ...checkWiringRequiredForPublish(recipe, mode),
    ...checkDuplicateFocusRect(recipe, mode),
    ...checkManifestWiringCrossCheck(recipe, mode),
    ...checkExternalPowerRequired(recipe, inventory, mode),
    ...checkTunableAnchorResolution(recipe, mode),
    ...checkBaudMismatch(recipe, mode),
    ...checkGuidanceRequiredForPublish(recipe, mode),
  ]
}
