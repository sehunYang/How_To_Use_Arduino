import type { ReactNode } from 'react'

const WOKWI_SILK = '#f5f5f5'
const WOKWI_GOLD = '#d6a84b'
const WOKWI_HOLE = '#2c3135'

function MountingHole({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="6" fill={WOKWI_GOLD} />
      <circle cx={x} cy={y} r="3.2" fill={WOKWI_HOLE} />
    </g>
  )
}

function PinHole({ x, y, label, labelY }: { x: number; y: number; label: string; labelY: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="4.3" fill={WOKWI_GOLD} />
      <circle cx={x} cy={y} r="2.2" fill={WOKWI_HOLE} />
      <text x={x} y={labelY} textAnchor="middle" fontSize="4.2" fill={WOKWI_SILK}>{label}</text>
    </g>
  )
}

function SensorBoard({
  boardColor,
  children,
  label,
}: {
  boardColor: string
  children: ReactNode
  label: string
}) {
  return (
    <svg viewBox="0 0 112 73" role="img" aria-label={label} className="size-full">
      <rect width="112" height="73" rx="2.5" fill={boardColor} />
      <MountingHole x={9} y={9} />
      <MountingHole x={103} y={9} />
      <MountingHole x={9} y={63} />
      <MountingHole x={103} y={63} />
      {children}
    </svg>
  )
}

export function Ina219Part() {
  const header = ['VCC', 'GND', 'SCL', 'SDA', 'VIN+', 'VIN-']
  return (
    <SensorBoard boardColor="#17639a" label="INA219 전류 센서 모듈">
      <text x="16" y="20" fontSize="6" fontWeight="700" fill={WOKWI_SILK}>INA219 DC</text>
      <text x="16" y="27" fontSize="5" fill={WOKWI_SILK}>Current Sensor</text>
      <rect x="47" y="10" width="24" height="13" rx="2" fill="#263035" />
      <rect x="52" y="13" width="14" height="7" fill="#d7d2c2" />
      <text x="59" y="19" textAnchor="middle" fontSize="4" fill="#404040">R100</text>
      <rect x="48" y="29" width="20" height="16" rx="2" fill="#202427" />
      <circle cx="52" cy="33" r="1.3" fill="#d8d8d5" />
      <path d="M21 34h23m27 0h22M59 23v6" fill="none" stroke={WOKWI_GOLD} strokeWidth="1.3" />
      <PinHole x={50} y={7} label="VIN-" labelY={5} />
      <PinHole x={68} y={7} label="VIN+" labelY={5} />
      {header.map((label, index) => (
        <PinHole key={label} x={28 + index * 11} y={72} label={label} labelY={64} />
      ))}
    </SensorBoard>
  )
}

export function Tsl2591Part() {
  const header = ['VIN', 'GND', '3VO', 'INT', 'SDA', 'SCL']
  return (
    <SensorBoard boardColor="#17639a" label="TSL2591 조도 센서 모듈">
      <text x="56" y="12" textAnchor="middle" fontSize="8" fontWeight="700" fill={WOKWI_SILK}>TSL2591</text>
      <text x="56" y="20" textAnchor="middle" fontSize="6" fill={WOKWI_SILK}>Lux Sensor</text>
      <rect x="47" y="27" width="20" height="20" rx="2" fill="#d8aa42" />
      <rect x="51" y="31" width="12" height="12" rx="2" fill="#24282b" />
      <circle cx="57" cy="37" r="4" fill="#554261" />
      <path d="M27 29h14v16H27m46-16h14v16H73" fill="none" stroke={WOKWI_GOLD} strokeWidth="1.2" />
      {header.map((label, index) => (
        <PinHole key={label} x={28 + index * 11} y={72} label={label} labelY={64} />
      ))}
    </SensorBoard>
  )
}

export function Tca9548aPart() {
  const topPins = ['SC7', 'SD7', 'SC6', 'SD6', 'SC5', 'SD5', 'SC4', 'SD4', 'SC3', 'SD3', 'SC2', 'SD2']
  const bottomPins = ['VIN', 'GND', 'SDA', 'SCL', 'RST', 'A0', 'A1', 'A2', 'SD0', 'SC0', 'SD1', 'SC1']

  return (
    <svg viewBox="0 0 240 150" role="img" aria-label="TCA9548A 24핀 I2C 채널 선택 장치" className="size-full">
      <rect width="240" height="150" rx="4" fill="#6d2b78" />
      <MountingHole x={22} y={75} />
      <MountingHole x={218} y={75} />
      <rect x="95" y="52" width="50" height="38" rx="3" fill="#24282b" />
      <circle cx="101" cy="58" r="2" fill="#d8d8d5" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((index) => (
        <g key={index}>
          <rect x={92 + index * 5} y="49" width="3" height="4" fill="#c9c6bd" />
          <rect x={92 + index * 5} y="89" width="3" height="4" fill="#c9c6bd" />
        </g>
      ))}
      <text x="48" y="82" transform="rotate(-90 48 82)" textAnchor="middle" fontSize="9" fontWeight="700" fill={WOKWI_SILK}>TCA9548A</text>
      <text x="120" y="105" textAnchor="middle" fontSize="6" fill={WOKWI_SILK}>8-CHANNEL I2C MULTIPLEXER</text>
      {topPins.map((label, index) => (
        <g key={label}>
          <circle cx={15 + index * 19} cy="5" r="4.2" fill={WOKWI_GOLD} />
          <circle cx={15 + index * 19} cy="5" r="2.1" fill={WOKWI_HOLE} />
          <text x={15 + index * 19} y="15" textAnchor="middle" fontSize="4.5" fill={WOKWI_SILK}>{label}</text>
        </g>
      ))}
      {bottomPins.map((label, index) => (
        <g key={label}>
          <circle cx={15 + index * 19} cy="145" r="4.2" fill={WOKWI_GOLD} />
          <circle cx={15 + index * 19} cy="145" r="2.1" fill={WOKWI_HOLE} />
          <text x={15 + index * 19} y="137" textAnchor="middle" fontSize="4.5" fill={WOKWI_SILK}>{label}</text>
        </g>
      ))}
      <path d="M63 24h48v22m66-22h-48v22M63 122h48V96m66 26h-48V96" fill="none" stroke={WOKWI_GOLD} strokeWidth="1.4" opacity=".7" />
    </svg>
  )
}

export function HalfBreadboardPart() {
  const terminalColumns = Array.from({ length: 30 }, (_, index) => index)
  const railColumns = Array.from({ length: 25 }, (_, index) => index)
  const terminalRows = [50.79, 60.39, 69.99, 79.59, 89.19, 118.79, 128.39, 137.99, 147.59, 157.19]
  const railRows = [
    { y: 12.69, color: '#e34c4c' },
    { y: 22.29, color: '#4078bd' },
    { y: 186.49, color: '#e34c4c' },
    { y: 196.09, color: '#4078bd' },
  ]

  return (
    <svg viewBox="0 0 328.82 207.87" role="img" aria-label="하프 브레드보드" className="size-full">
      <rect x="1" y="1" width="326.82" height="205.87" rx="8" fill="#f2f1ed" stroke="#d7d4cd" strokeWidth="2" />
      <rect x="20" y="99" width="289" height="10" rx="2" fill="#d7d4cd" />
      {railRows.map((rail) => (
        <line key={rail.y} x1="27" x2="301" y1={rail.y} y2={rail.y} stroke={rail.color} strokeWidth="1.5" opacity=".75" />
      ))}
      {terminalColumns.flatMap((column) =>
        terminalRows.map((y) => (
          <circle key={`${column}-${y}`} cx={26.39 + column * 9.6} cy={y} r="2.1" fill="#55585a" stroke="#c7c4bc" strokeWidth=".7" />
        )),
      )}
      {railColumns.flatMap((column) =>
        railRows.map((rail) => (
          <circle
            key={`${column}-${rail.y}`}
            cx={34.89 + column * 9.6 + Math.floor(column / 5) * 9.6}
            cy={rail.y}
            r="2.1"
            fill="#55585a"
            stroke="#c7c4bc"
            strokeWidth=".7"
          />
        )),
      )}
      {[1, 5, 10, 15, 20, 25, 30].map((column) => (
        <g key={column} fill="#77766f" fontSize="4.8" textAnchor="middle">
          <text x={26.39 + (column - 1) * 9.6} y="43">{column}</text>
          <text x={26.39 + (column - 1) * 9.6} y="171">{column}</text>
        </g>
      ))}
      {['a', 'b', 'c', 'd', 'e'].map((label, index) => (
        <text key={label} x="14" y={52.5 + index * 9.6} fill="#77766f" fontSize="5">{label}</text>
      ))}
      {['f', 'g', 'h', 'i', 'j'].map((label, index) => (
        <text key={label} x="14" y={120.5 + index * 9.6} fill="#77766f" fontSize="5">{label}</text>
      ))}
    </svg>
  )
}
