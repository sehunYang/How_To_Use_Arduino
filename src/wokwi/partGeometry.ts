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
  pins: PartPin[]
}

const pins = (entries: [string, number, number][]): PartPin[] =>
  entries.map(([name, x, y]) => ({ name, x, y }))

export const PART_GEOMETRY: Record<string, PartGeometry> = {
  // 72.58mm x 53.34mm. Two 9.5px-pitch headers: digital along y=9, power and
  // analog along y=191.5.
  'wokwi-arduino-uno': {
    width: 274.34,
    height: 201.6,
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
}

/** Parts whose geometry this repo cannot source, with the reason recorded. */
export const GEOMETRY_UNAVAILABLE: Record<string, string> = {
  'wokwi-breadboard': 'built-in Wokwi part, not published in wokwi-elements',
  'wokwi-breadboard-half': 'built-in Wokwi part, not published in wokwi-elements',
  'wokwi-breadboard-mini': 'built-in Wokwi part, not published in wokwi-elements',
  'chip-ina219': 'custom chip; Wokwi generates its body and pin placement at load time',
  'chip-tsl2591': 'custom chip; Wokwi generates its body and pin placement at load time',
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
