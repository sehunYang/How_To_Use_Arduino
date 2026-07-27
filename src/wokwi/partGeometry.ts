import type { Point, ReadablePart } from './readableLayout'

/**
 * Ground truth for where Wokwi actually draws each part's pins.
 *
 * Without this table every coordinate in a ReadableLayout is an unchecked
 * assertion. Wokwi renders a wire starting from the REAL pin position and then
 * applies the relative h/v commands, so if the layout's model of a pin sits
 * somewhere else, the whole route is drawn translated by that error — and the
 * geometric rules, which reason entirely in model space, cannot see it. That
 * is how a layout with four wires converging on the Uno's power header passed
 * every rule while rendering as an unreadable bundle: the model claimed a 20px
 * pin pitch where the real header is 9.5px, below the declared minimum
 * clearance, so no legal layout of that header could ever have existed.
 *
 * Values are transcribed from wokwi-elements `pinInfo` (px, relative to the
 * part's own top-left as placed by `left`/`top`). Element sizes are the SVG's
 * mm dimensions converted at 96dpi.
 *
 * Parts absent from this table are NOT silently trusted — validation reports
 * `unknown-part-geometry`, so "we could not check this" never reads as
 * "we checked this and it was fine".
 */

export interface PartPin {
  name: string
  x: number
  y: number
}

export interface PartGeometry {
  /** Rendered size in px. */
  width: number
  height: number
  source: 'wokwi-elements' | 'measured'
  /** Maximum accepted route-to-pin coordinate error in px. */
  tolerance: number
  pins: PartPin[]
}

const pins = (entries: [string, number, number][]): PartPin[] =>
  entries.map(([name, x, y]) => ({ name, x, y }))

const PX_PER_MM = 96 / 25.4
const HEADER_PITCH = 9.6
const WOKWI_ELEMENTS_TOLERANCE = 0.01
const MEASURED_TOLERANCE = 0.5

function halfBreadboardGeometry(): PartGeometry {
  const terminalX0 = 26.3897637795
  const topY0 = 50.7897637795
  const bottomY0 = 118.7897637795
  const terminalPins: PartPin[] = []

  for (let column = 1; column <= 30; column += 1) {
    const x = terminalX0 + HEADER_PITCH * (column - 1)
    for (let row = 0; row < 5; row += 1) {
      terminalPins.push({
        name: `${column}t.${String.fromCharCode('a'.charCodeAt(0) + row)}`,
        x,
        y: topY0 + HEADER_PITCH * row,
      })
      terminalPins.push({
        name: `${column}b.${String.fromCharCode('f'.charCodeAt(0) + row)}`,
        x,
        y: bottomY0 + HEADER_PITCH * row,
      })
    }
  }

  const railPins: PartPin[] = []
  const rails = [
    ['tp', 12.6897637795],
    ['tn', 22.2897637795],
    ['bp', 186.4897637795],
    ['bn', 196.0897637795],
  ] as const
  for (let column = 1; column <= 25; column += 1) {
    const offset = column - 1
    const x =
      34.8897637795 +
      HEADER_PITCH * offset +
      HEADER_PITCH * Math.floor(offset / 5)
    for (const [rail, y] of rails) {
      railPins.push({ name: `${rail}.${column}`, x, y })
    }
  }

  return {
    width: 87 * PX_PER_MM,
    height: 55 * PX_PER_MM,
    source: 'measured',
    tolerance: MEASURED_TOLERANCE,
    pins: [...terminalPins, ...railPins],
  }
}

export function customChipGeometry(
  pinNames: string[],
  display: { width: number; height: number },
): PartGeometry {
  if (pinNames.length < 2 || pinNames.length % 2 !== 0) {
    throw new Error('Custom chip geometry requires an even number of pins.')
  }

  const rowCount = pinNames.length / 2
  const width = Math.max(30 * PX_PER_MM, display.width + 2 * PX_PER_MM)
  const boardHeight = rowCount * HEADER_PITCH + 2 * PX_PER_MM
  const pinY0 = 2.27 * PX_PER_MM
  const chipPins = pinNames.map((name, index) => {
    const onLeft = index < rowCount
    const row = onLeft ? index : pinNames.length - 1 - index
    return {
      name,
      x: onLeft ? HEADER_PITCH / 2 : width - HEADER_PITCH / 2,
      y: pinY0 + HEADER_PITCH * row,
    }
  })

  return {
    width,
    height: boardHeight + display.height,
    source: 'measured',
    tolerance: MEASURED_TOLERANCE,
    pins: chipPins,
  }
}

const conformanceChipGeometry = customChipGeometry(
  ['VCC', 'GND', 'SCL', 'SDA'],
  { width: 112, height: 73 },
)

export const PART_GEOMETRY: Record<string, PartGeometry> = {
  // 72.58mm x 53.34mm. Two 9.5px-pitch headers: digital along y=9, power and
  // analog along y=191.5.
  'wokwi-arduino-uno': {
    width: 274.34,
    height: 201.6,
    source: 'wokwi-elements',
    tolerance: WOKWI_ELEMENTS_TOLERANCE,
    pins: pins([
      ['A5.2', 87, 9],
      ['A4.2', 97, 9],
      ['AREF', 106, 9],
      ['GND.1', 115.5, 9],
      ['13', 125, 9],
      ['12', 134.5, 9],
      ['11', 144, 9],
      ['10', 153.5, 9],
      ['9', 163, 9],
      ['8', 173, 9],
      ['7', 189, 9],
      ['6', 198.5, 9],
      ['5', 208, 9],
      ['4', 217.5, 9],
      ['3', 227, 9],
      ['2', 236.5, 9],
      ['1', 246, 9],
      ['0', 255.5, 9],
      ['IOREF', 131, 191.5],
      ['RESET', 140.5, 191.5],
      ['3.3V', 150, 191.5],
      ['5V', 160, 191.5],
      ['GND.2', 169.5, 191.5],
      ['GND.3', 179, 191.5],
      ['VIN', 188.5, 191.5],
      ['A0', 208, 191.5],
      ['A1', 217.5, 191.5],
      ['A2', 227, 191.5],
      ['A3', 236.5, 191.5],
      ['A4', 246, 191.5],
      ['A5', 255.5, 191.5],
    ]),
  },

  // 21.6mm x 16.2mm. Single 9.6px-pitch header along the top edge, ordered
  // INT/AD0/XCL/XDA/SDA/SCL/GND/VCC left to right — note VCC is RIGHTMOST,
  // the mirror of how a GY-521 silkscreen is often sketched from memory.
  'wokwi-mpu6050': {
    width: 81.64,
    height: 61.23,
    source: 'wokwi-elements',
    tolerance: WOKWI_ELEMENTS_TOLERANCE,
    pins: pins([
      ['INT', 7.28, 5.78],
      ['AD0', 16.9, 5.78],
      ['XCL', 26.4, 5.78],
      ['XDA', 36.0, 5.78],
      ['SDA', 45.6, 5.78],
      ['SCL', 55.2, 5.78],
      ['GND', 64.8, 5.78],
      ['VCC', 74.4, 5.78],
    ]),
  },
  'wokwi-breadboard-half': halfBreadboardGeometry(),
  'chip-ina219': conformanceChipGeometry,
  'chip-tsl2591': conformanceChipGeometry,
}

/** Parts whose geometry this repo cannot source, with the reason recorded. */
export const GEOMETRY_UNAVAILABLE: Record<string, string> = {
  'wokwi-breadboard': 'built-in Wokwi part, not published in wokwi-elements',
  'wokwi-breadboard-mini': 'built-in Wokwi part, not published in wokwi-elements',
}

export function geometryFor(type: string): PartGeometry | undefined {
  return PART_GEOMETRY[type]
}

/** Absolute canvas position of a declared pin, or null if unresolvable. */
export function pinPosition(part: ReadablePart, pinName: string): Point | null {
  const geometry = geometryFor(part.type)
  if (!geometry) return null

  const pin = geometry.pins.find((entry) => entry.name === pinName)
  if (!pin) return null

  return { x: part.left + pin.x, y: part.top + pin.y }
}

/** Body rectangle derived from the real rendered size, not author-declared. */
export function partBounds(part: ReadablePart) {
  const geometry = geometryFor(part.type)
  if (!geometry) return null

  return {
    left: part.left,
    top: part.top,
    right: part.left + geometry.width,
    bottom: part.top + geometry.height,
  }
}

/**
 * Smallest centre-to-centre distance between any two pins of this part. Wires
 * landing on neighbouring header pins are forced this close no matter how they
 * are routed, so the parallel-clearance rule cannot demand more than this.
 */
export function minimumPinPitch(type: string): number | null {
  const geometry = geometryFor(type)
  if (!geometry || geometry.pins.length < 2) return null

  let smallest = Infinity
  for (let i = 0; i < geometry.pins.length; i += 1) {
    for (let j = i + 1; j < geometry.pins.length; j += 1) {
      const a = geometry.pins[i]
      const b = geometry.pins[j]
      smallest = Math.min(smallest, Math.hypot(a.x - b.x, a.y - b.y))
    }
  }
  return smallest
}
