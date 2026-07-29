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

function HeaderPins() {
  return (
    <g>
      {[0, 1, 2, 3].map((index) => (
        <g key={index}>
          <rect x={39 + index * 11} y="60" width="8" height="12" rx="1" fill="#25282a" />
          <rect x={41 + index * 11} y="61" width="4" height="11" fill="#dfad45" />
        </g>
      ))}
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
      <HeaderPins />
    </svg>
  )
}

export function Ina219Part() {
  return (
    <SensorBoard boardColor="#17639a" label="INA219 전류 센서 모듈">
      <path d="M22 17h31v11m1 13h31" fill="none" stroke={WOKWI_GOLD} strokeWidth="2" />
      <rect x="16" y="21" width="19" height="28" rx="2" fill="#1f7b4c" />
      <circle cx="25.5" cy="29" r="4" fill="#90aeb1" />
      <circle cx="25.5" cy="41" r="4" fill="#90aeb1" />
      <rect x="43" y="26" width="27" height="21" rx="2" fill="#23272a" />
      <rect x="47" y="30" width="19" height="13" rx="1" fill="#353a3d" />
      <rect x="74" y="19" width="27" height="17" rx="2" fill="#d2d5d5" />
      <rect x="77" y="23" width="21" height="9" fill="#aeb2b2" />
      <text x="56" y="12" textAnchor="middle" fontSize="7" fontWeight="700" fill={WOKWI_SILK}>INA219</text>
      <text x="88" y="51" textAnchor="middle" fontSize="5" fill={WOKWI_SILK}>CURRENT</text>
    </SensorBoard>
  )
}

export function Tsl2591Part() {
  return (
    <SensorBoard boardColor="#202830" label="TSL2591 조도 센서 모듈">
      <path d="M22 19h28v9m0 17h39" fill="none" stroke={WOKWI_GOLD} strokeWidth="2" />
      <rect x="40" y="18" width="34" height="33" rx="2" fill="#cda044" />
      <rect x="45" y="23" width="24" height="23" rx="2" fill="#292d30" />
      <circle cx="57" cy="34.5" r="8" fill="#0d0f10" />
      <circle cx="57" cy="34.5" r="5" fill="#574666" />
      <rect x="80" y="17" width="15" height="9" rx="1" fill="#555a5b" />
      <rect x="83" y="20" width="9" height="3" fill="#bdc1bc" />
      <text x="57" y="12" textAnchor="middle" fontSize="7" fontWeight="700" fill={WOKWI_SILK}>TSL2591</text>
      <text x="88" y="54" textAnchor="middle" fontSize="5" fill={WOKWI_SILK}>LIGHT</text>
    </SensorBoard>
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
    </svg>
  )
}
