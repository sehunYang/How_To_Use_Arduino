import { useEffect, useState, type FormEvent } from 'react'
import { SensorSchema, type Sensor } from '@/schema'
import type { AdminServices } from '@/admin/AdminServices'
import { Field, Input, Panel, Select, Textarea } from '@/admin/AdminFields'
import { Button } from '@/components/ui/button'

type SensorForm = {
  id: string
  name: string
  interface: Sensor['interface']
  addressingMode: Sensor['addressing']['mode']
  addresses: string
  strapPins: string
  maxOnBus: number
  pins: string
  currentDrawMa: number
  wokwiPart: string
  pinMap: string
  simSupported: boolean
  muxChannels: number
}

const initialForm: SensorForm = {
  id: '',
  name: '',
  interface: 'analog',
  addressingMode: 'none',
  addresses: '',
  strapPins: '',
  maxOnBus: 1,
  pins: 'VCC:power\nGND:power\nOUT:analog',
  currentDrawMa: 0,
  wokwiPart: '',
  pinMap: '',
  simSupported: false,
  muxChannels: 0,
}

const splitList = (value: string) => value.split(',').map((part) => part.trim()).filter(Boolean)
const linesToRecord = (value: string) => Object.fromEntries(
  value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [key, ...rest] = line.split(':')
    return [key.trim(), rest.join(':').trim()]
  }),
)

export function AdminSensorPage({ services }: { services: AdminServices }) {
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [form, setForm] = useState<SensorForm>(initialForm)
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    void services.getInventory().then((inventory) => setSensors(inventory.sensors))
  }, [services])

  const update = <K extends keyof SensorForm>(key: K, value: SensorForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    const addresses = splitList(form.addresses)
    const addressing = form.addressingMode === 'none'
      ? { mode: 'none' as const }
      : form.addressingMode === 'onewire'
        ? { mode: 'onewire' as const, maxOnBus: form.maxOnBus }
        : form.addressingMode === 'fixed'
          ? { mode: 'fixed' as const, addresses, maxOnBus: form.maxOnBus }
          : { mode: 'strapped' as const, addresses, strapPins: splitList(form.strapPins), maxOnBus: form.maxOnBus }
    const candidate = {
      id: form.id,
      name: form.name,
      interface: form.interface,
      addressing,
      pins: Object.entries(linesToRecord(form.pins)).map(([name, kind]) => ({ name, kind })),
      currentDrawMa: form.currentDrawMa,
      wokwi: {
        part: form.wokwiPart,
        pinMap: linesToRecord(form.pinMap),
        simSupported: form.simSupported,
      },
      muxChannels: form.muxChannels,
    }
    const result = SensorSchema.safeParse(candidate)
    if (!result.success) {
      setErrors(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`))
      setMessage('')
      return
    }
    try {
      await services.registerSensor(result.data)
      setSensors((current) => [...current.filter((sensor) => sensor.id !== result.data.id), result.data])
      setForm(initialForm)
      setErrors([])
      setMessage(`${result.data.name} 센서를 등록했습니다.`)
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '센서를 등록하지 못했습니다.')
    }
  }

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-2">
      <Panel title="센서 등록">
        <form className="space-y-5" onSubmit={(event) => void submit(event)} noValidate>
          {errors.length > 0 && (
            <div role="alert" className="rounded-card bg-danger-background p-3 text-danger">
              <p className="font-semibold">다음 항목을 확인하세요.</p>
              <ul className="list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
            </div>
          )}
          {message && <p role="status" className="rounded-card bg-muted-background p-3">{message}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="센서 ID"><Input value={form.id} onChange={(event) => update('id', event.target.value)} /></Field>
            <Field label="표시 이름"><Input value={form.name} onChange={(event) => update('name', event.target.value)} /></Field>
            <Field label="통신 방식">
              <Select value={form.interface} onChange={(event) => update('interface', event.target.value as Sensor['interface'])}>
                <option value="digital">디지털</option><option value="analog">아날로그</option><option value="i2c">I2C</option><option value="onewire">OneWire</option>
              </Select>
            </Field>
            <Field label="소비 전류(mA)"><Input type="number" min={0} step="any" value={form.currentDrawMa} onChange={(event) => update('currentDrawMa', Number(event.target.value))} /></Field>
            <Field label="주소 지정 방식">
              <Select value={form.addressingMode} onChange={(event) => update('addressingMode', event.target.value as SensorForm['addressingMode'])}>
                <option value="none">없음</option><option value="fixed">고정 주소</option><option value="strapped">핀 설정 주소</option><option value="onewire">OneWire</option>
              </Select>
            </Field>
            {form.addressingMode !== 'none' && <Field label="버스 최대 연결 수"><Input type="number" min={1} value={form.maxOnBus} onChange={(event) => update('maxOnBus', Number(event.target.value))} /></Field>}
            {(form.addressingMode === 'fixed' || form.addressingMode === 'strapped') && (
              <Field label="주소" hint="쉼표로 구분하세요. 예: 0x40, 0x41"><Input value={form.addresses} onChange={(event) => update('addresses', event.target.value)} /></Field>
            )}
            {form.addressingMode === 'strapped' && <Field label="주소 설정 핀" hint="쉼표로 구분하세요."><Input value={form.strapPins} onChange={(event) => update('strapPins', event.target.value)} /></Field>}
            <Field label="Wokwi 부품"><Input value={form.wokwiPart} onChange={(event) => update('wokwiPart', event.target.value)} /></Field>
            <Field label="멀티플렉서 채널 수"><Input type="number" min={0} value={form.muxChannels} onChange={(event) => update('muxChannels', Number(event.target.value))} /></Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="핀 구성" hint="한 줄에 하나씩 핀이름:종류 형식으로 입력하세요."><Textarea rows={6} value={form.pins} onChange={(event) => update('pins', event.target.value)} /></Field>
            <Field label="Wokwi 핀 매핑" hint="한 줄에 하나씩 센서핀:Wokwi핀 형식으로 입력하세요."><Textarea rows={6} value={form.pinMap} onChange={(event) => update('pinMap', event.target.value)} /></Field>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.simSupported} onChange={(event) => update('simSupported', event.target.checked)} />
            Wokwi 시뮬레이션 지원
          </label>
          <Button type="submit">센서 등록</Button>
        </form>
      </Panel>
      <aside className="rounded-card border border-border p-4">
        <h2 className="font-semibold">등록 센서 ({sensors.length})</h2>
        <ul className="mt-3 space-y-2">
          {sensors.map((sensor) => (
            <li key={sensor.id} className="rounded-card bg-muted-background p-3">
              <span className="font-medium">{sensor.name}</span>
              <span className="block text-caption text-muted">{sensor.id} · {sensor.interface}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
