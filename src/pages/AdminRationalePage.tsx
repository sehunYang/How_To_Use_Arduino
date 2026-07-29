import { useEffect, useState } from 'react'
import { SubjectSchema, type Sensor, type SensorRationale, type Subject } from '@/schema'
import type { AdminServices } from '@/admin/AdminServices'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/admin/AdminFields'

const subjects: Array<Subject | null> = [null, ...SubjectSchema.options]
const rationaleKey = (sensorId: string, subject: Subject | null) => `${sensorId}::${subject ?? 'general'}`

export function AdminRationalePage({ services }: { services: AdminServices }) {
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')

  useEffect(() => {
    void Promise.all([services.getInventory(), services.getRationales()]).then(([inventory, rationales]) => {
      setSensors(inventory.sensors)
      setValues(Object.fromEntries(rationales.map((item) => [rationaleKey(item.sensorId, item.subject), item.whyText])))
    })
  }, [services])

  async function save() {
    const rationales: SensorRationale[] = []
    for (const sensor of sensors) {
      for (const subject of subjects) {
        const whyText = values[rationaleKey(sensor.id, subject)]?.trim()
        if (whyText) rationales.push({ sensorId: sensor.id, subject, whyText })
      }
    }
    try {
      await services.saveRationales(rationales)
      setMessage('센서 활용 근거를 저장했습니다.')
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '센서 활용 근거를 저장하지 못했습니다.')
    }
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-heading font-semibold">센서 활용 근거표</h2>
          <p className="text-muted">학습 맥락별로 이 센서를 사용하는 이유를 작성합니다.</p>
        </div>
        <Button onClick={() => void save()}>활용 근거 저장</Button>
      </div>
      {message && <p className="mb-4 rounded-card bg-muted-background p-3" role="status">{message}</p>}
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="min-w-screen border-collapse text-left">
          <thead className="bg-muted-background">
            <tr>
              <th className="sticky left-0 z-10 bg-muted-background p-3">센서</th>
              {subjects.map((subject) => <th key={subject ?? 'general'} className="min-w-64 p-3">{subject ?? '공통'}</th>)}
            </tr>
          </thead>
          <tbody>
            {sensors.map((sensor) => (
              <tr key={sensor.id} className="border-t border-border align-top">
                <th className="sticky left-0 bg-background p-3">{sensor.name}</th>
                {subjects.map((subject) => {
                  const key = rationaleKey(sensor.id, subject)
                  return (
                    <td key={key} className="p-2">
                      <Textarea
                        rows={4}
                        aria-label={`${sensor.name}, ${subject ?? '공통'} 활용 근거`}
                        value={values[key] ?? ''}
                        onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
