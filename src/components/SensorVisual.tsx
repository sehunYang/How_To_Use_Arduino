import { createElement, type CSSProperties, type ReactNode } from 'react'
import '@wokwi/elements/dist/esm/mpu6050-element.js'
import '@wokwi/elements/dist/esm/hc-sr04-element.js'
import '@wokwi/elements/dist/esm/pir-motion-sensor-element.js'
import { Ina219Part, Tca9548aPart, Tsl2591Part } from './wokwiParts'

const nativeParts: Record<string, string> = {
  mpu6050: 'wokwi-mpu6050',
  'hc-sr501': 'wokwi-pir-motion-sensor',
  'hc-sr04': 'wokwi-hc-sr04',
}

const nativeScale: Record<string, number> = {
  mpu6050: 1.8,
  'hc-sr501': 1.65,
  'hc-sr04': 1.45,
}

function FullFrame({ children, label }: { children: ReactNode; label: string }) {
  return <svg viewBox="0 0 240 170" role="img" aria-label={label} className="block size-full">{children}</svg>
}

export function Bme280Visual() {
  return (
    <FullFrame label="BME280 온습도 기압 센서 모듈">
      <defs>
        <linearGradient id="bme-board" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#7c3fa0" /><stop offset="1" stopColor="#4d216d" /></linearGradient>
        <linearGradient id="bme-chip" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#f1f2ed" /><stop offset="1" stopColor="#9ca3a7" /></linearGradient>
      </defs>
      <rect x="38" y="14" width="164" height="126" rx="7" fill="url(#bme-board)" stroke="#351348" strokeWidth="3" />
      <circle cx="54" cy="30" r="7" fill="#d8b04e" /><circle cx="54" cy="30" r="3.5" fill="#18394b" />
      <circle cx="186" cy="30" r="7" fill="#d8b04e" /><circle cx="186" cy="30" r="3.5" fill="#18394b" />
      <rect x="88" y="48" width="54" height="48" rx="3" fill="url(#bme-chip)" stroke="#747a7d" strokeWidth="2" />
      <circle cx="101" cy="60" r="3" fill="#555b5d" /><circle cx="129" cy="60" r="3" fill="#555b5d" />
      <circle cx="101" cy="84" r="3" fill="#555b5d" /><circle cx="129" cy="84" r="3" fill="#555b5d" />
      <g fill="#d6d9d6">
        <rect x="57" y="58" width="18" height="7" rx="2" /><rect x="57" y="76" width="18" height="7" rx="2" />
        <rect x="155" y="50" width="22" height="9" rx="2" /><rect x="155" y="70" width="22" height="9" rx="2" />
      </g>
      <g fill="#232729"><rect x="54" y="96" width="25" height="16" rx="2" /><rect x="151" y="94" width="25" height="17" rx="2" /></g>
      <text x="120" y="126" textAnchor="middle" fill="#eef8ff" fontSize="11" fontWeight="700">BME280</text>
      {[0, 1, 2, 3].map((index) => <g key={index}><circle cx={88 + index * 21} cy="139" r="6" fill="#d9ae48" /><rect x={85.5 + index * 21} y="139" width="5" height="25" rx="2" fill="#c9c6ae" /></g>)}
      <g fill="#dff3ff" fontSize="7" textAnchor="middle"><text x="88" y="135">VIN</text><text x="109" y="135">GND</text><text x="130" y="135">SCL</text><text x="151" y="135">SDA</text></g>
    </FullFrame>
  )
}

export function To92Visual({ label }: { label: 'DS18B20' | 'HBE0704' }) {
  const gradientId = `to92-${label}`
  return (
    <FullFrame label={`${label} TO-92 센서`}>
      <defs><linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0"><stop stopColor="#111416" /><stop offset=".55" stopColor="#363b3e" /><stop offset="1" stopColor="#101214" /></linearGradient></defs>
      <path d="M76 82V49c0-24 19-38 44-38s44 14 44 38v33z" fill={`url(#${gradientId})`} stroke="#050607" strokeWidth="3" />
      <path d="M78 75h84v14H78z" fill="#171a1c" />
      <text x="120" y="48" textAnchor="middle" fill="#c8ccce" fontSize={label === 'DS18B20' ? 12 : 14} fontWeight="700">{label}</text>
      <text x="120" y="65" textAnchor="middle" fill="#93999c" fontSize="8">{label === 'DS18B20' ? 'DALLAS' : 'OH49E'}</text>
      <g stroke="#bbbcae" strokeWidth="7" strokeLinecap="round"><path d="M94 86v69" /><path d="M120 86v69" /><path d="M146 86v69" /></g>
      <g stroke="#eeeeea" strokeWidth="2" opacity=".65"><path d="M92 91v60" /><path d="M118 91v60" /><path d="M144 91v60" /></g>
    </FullFrame>
  )
}

export function CdsVisual() {
  return (
    <FullFrame label="CDS 2선 광저항">
      <defs><radialGradient id="cds-face"><stop stopColor="#f4e8a5" /><stop offset="1" stopColor="#c4a64c" /></radialGradient></defs>
      <circle cx="120" cy="64" r="53" fill="url(#cds-face)" stroke="#8e7430" strokeWidth="4" />
      <path d="M80 42h18v13h44v13H98v13h44v13H98v10" fill="none" stroke="#b0602d" strokeWidth="7" strokeLinejoin="round" />
      <path d="M80 42v62" fill="none" stroke="#b0602d" strokeWidth="7" />
      <g stroke="#bbbcae" strokeWidth="7" strokeLinecap="round"><path d="M96 103v56" /><path d="M144 103v56" /></g>
      <g stroke="#f0f0e8" strokeWidth="2" opacity=".65"><path d="M94 107v48" /><path d="M142 107v48" /></g>
      <g fill="#596064" fontSize="8" fontWeight="700" textAnchor="middle">
        <text x="96" y="169">L1</text><text x="144" y="169">L2</text>
      </g>
    </FullFrame>
  )
}

function NativeVisual({ sensorId, tag }: { sensorId: string; tag: string }) {
  const partStyle: CSSProperties = {
    display: 'block',
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: `translate(-50%, -50%) scale(${nativeScale[sensorId] ?? 1})`,
    transformOrigin: 'center',
  }
  return (
    <div className="relative size-full">
      {createElement(tag, { style: partStyle })}
    </div>
  )
}

export function SensorVisual({ sensorId }: { sensorId: string }) {
  const native = nativeParts[sensorId]
  return (
    <div className="grid size-full place-items-center overflow-hidden" aria-hidden="true">
      {native && <NativeVisual sensorId={sensorId} tag={native} />}
      {sensorId === 'ina219' && <Ina219Part />}
      {sensorId === 'tsl2591' && <Tsl2591Part />}
      {sensorId === 'tca9548a' && <Tca9548aPart />}
      {sensorId === 'bme280' && <Bme280Visual />}
      {sensorId === 'ds18b20' && <To92Visual label="DS18B20" />}
      {sensorId === 'hbe0704' && <To92Visual label="HBE0704" />}
      {sensorId === 'cds' && <CdsVisual />}
    </div>
  )
}
