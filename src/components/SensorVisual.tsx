import { createElement } from 'react'
import '@wokwi/elements/dist/esm/mpu6050-element.js'
import '@wokwi/elements/dist/esm/hc-sr04-element.js'
import '@wokwi/elements/dist/esm/pir-motion-sensor-element.js'
import '@wokwi/elements/dist/esm/photoresistor-sensor-element.js'
import { Ina219Part, Tca9548aPart, Tsl2591Part } from './wokwiParts'

const nativeParts: Record<string, string> = {
  mpu6050: 'wokwi-mpu6050',
  cds: 'wokwi-photoresistor-sensor',
  'hc-sr501': 'wokwi-pir-motion-sensor',
  'hc-sr04': 'wokwi-hc-sr04',
}

function ModuleBoard({ label, kind }: { label: string; kind: 'bme' | 'temperature' | 'hall' }) {
  return (
    <svg viewBox="0 0 180 120" className="size-full" aria-hidden="true">
      <rect x="8" y="8" width="164" height="104" rx="8" fill={kind === 'temperature' ? '#262b2f' : '#17639a'} />
      <circle cx="22" cy="22" r="8" fill="#d6a84b" /><circle cx="22" cy="22" r="4" fill="#2c3135" />
      <circle cx="158" cy="22" r="8" fill="#d6a84b" /><circle cx="158" cy="22" r="4" fill="#2c3135" />
      {kind === 'temperature' && <rect x="78" y="28" width="24" height="55" rx="10" fill="#b9bec0" />}
      {kind === 'bme' && <><rect x="65" y="36" width="50" height="42" rx="4" fill="#c8c9c5" /><circle cx="77" cy="48" r="3" fill="#777" /><circle cx="103" cy="66" r="3" fill="#777" /></>}
      {kind === 'hall' && <><rect x="75" y="31" width="30" height="48" rx="3" fill="#24282b" /><path d="M82 79v22m8-22v22m8-22v22" stroke="#d6a84b" strokeWidth="4" /></>}
      <text x="90" y="98" textAnchor="middle" fill="#f5f5f5" fontSize="12" fontWeight="700">{label}</text>
    </svg>
  )
}

export function SensorVisual({ sensorId }: { sensorId: string }) {
  const native = nativeParts[sensorId]
  return (
    <div className="grid size-full place-items-center" aria-hidden="true">
      {native && createElement(native, { style: { width: '80%', height: '80%', display: 'block' } })}
      {sensorId === 'ina219' && <Ina219Part />}
      {sensorId === 'tsl2591' && <Tsl2591Part />}
      {sensorId === 'tca9548a' && <Tca9548aPart />}
      {sensorId === 'bme280' && <ModuleBoard label="BME280" kind="bme" />}
      {sensorId === 'ds18b20' && <ModuleBoard label="DS18B20" kind="temperature" />}
      {sensorId === 'hbe0704' && <ModuleBoard label="HBE0704" kind="hall" />}
    </div>
  )
}
