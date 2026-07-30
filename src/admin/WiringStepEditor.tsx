import type { WiringStep } from '@/schema'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from './AdminFields'
import { FocusRegionEditor } from './FocusRegionEditor'

export type WiringErrors = Record<number, Partial<Record<keyof WiringStep, string>>>

export function WiringStepEditor({
  steps,
  errors,
  imageUrl,
  imageWidth,
  imageHeight,
  endpointOptions,
  onChange,
}: {
  steps: WiringStep[]
  errors: WiringErrors
  imageUrl: string
  imageWidth: number
  imageHeight: number
  endpointOptions: string[]
  onChange(steps: WiringStep[]): void
}) {
  const update = (index: number, patch: Partial<WiringStep>) =>
    onChange(steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step))

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <fieldset key={index} className="rounded-card border border-border p-4">
          <legend className="px-2 font-semibold">배선 단계 {index + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="출발 핀" error={errors[index]?.from}>
              <Select value={step.from} onChange={(event) => update(index, { from: event.target.value })}>
                <option value="">출발 핀 선택</option>
                {!endpointOptions.includes(step.from) && step.from && <option value={step.from}>{step.from}</option>}
                {endpointOptions.map((endpoint) => <option key={endpoint} value={endpoint}>{endpoint}</option>)}
              </Select>
            </Field>
            <Field label="도착 핀" error={errors[index]?.to}>
              <Select value={step.to} onChange={(event) => update(index, { to: event.target.value })}>
                <option value="">도착 핀 선택</option>
                {!endpointOptions.includes(step.to) && step.to && <option value={step.to}>{step.to}</option>}
                {endpointOptions.map((endpoint) => <option key={endpoint} value={endpoint}>{endpoint}</option>)}
              </Select>
            </Field>
            <Field label="전선 색상" error={errors[index]?.color}>
              <Input value={step.color} onChange={(event) => update(index, { color: event.target.value })} />
            </Field>
            <Field label="설명" error={errors[index]?.text}>
              <Input value={step.text} onChange={(event) => update(index, { text: event.target.value })} />
            </Field>
          </div>
          <div className="mt-4">
            <FocusRegionEditor
              imageUrl={imageUrl}
              naturalWidth={imageWidth}
              naturalHeight={imageHeight}
              value={step.focus}
              onChange={(focus) => update(index, { focus })}
            />
          </div>
          <Button className="mt-3" variant="ghost" size="sm" onClick={() => onChange(steps.filter((_, stepIndex) => stepIndex !== index))}>
            단계 삭제
          </Button>
        </fieldset>
      ))}
      <Button
        variant="outline"
        onClick={() => onChange([...steps, { from: '', to: '', color: '#2563eb', text: '', focus: { x: 0, y: 0, w: 1, h: 1 } }])}
      >
        배선 단계 추가
      </Button>
    </div>
  )
}
