import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DifficultySchema, SubjectSchema, type Actuator, type Recipe, type Sensor } from '@/schema'
import { readFieldErrors, type AdminRecipeDraft, type AdminRecipeVersion, type AdminServices } from '@/admin/AdminServices'
import { markCurrentReview, recipeVerifyHash } from '@/admin/authoring'
import { Field, Input, Panel, Select, Textarea } from '@/admin/AdminFields'
import { MarkdownEditor } from '@/admin/MarkdownEditor'
import { WiringStepEditor, type WiringErrors } from '@/admin/WiringStepEditor'
import { Button } from '@/components/ui/button'
import { computeInventoryVersion } from '@/lib/verifyHash'

const emptyRecipe: AdminRecipeDraft = {
  id: '',
  title: '',
  type: 'project',
  subject: '',
  difficulty: '',
  minutes: 45,
  board: 'uno-r3',
  sensors: [],
  actuators: [],
  coreKeywords: [],
  imageUrl: '',
  imageWidth: 0,
  imageHeight: 0,
  wiring: [],
  sketch: '',
  baudRate: 9600,
  tunables: [],
  body: '',
  applicationGuide: '',
  troubleshooting: [],
  status: 'draft',
  reviewedOnDevice: null,
  commentReviewed: null,
  updatedAt: new Date(0).toISOString(),
}

type Errors = Partial<Record<keyof AdminRecipeDraft, string>> & { wiringSteps?: WiringErrors }

function validate(recipe: AdminRecipeDraft): Errors {
  const errors: Errors = {}
  if (!recipe.id.trim()) errors.id = '고정해서 사용할 레시피 ID를 입력하세요.'
  if (!/^[a-z0-9-]+$/.test(recipe.id)) errors.id = '영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.'
  if (!recipe.title.trim()) errors.title = '제목을 입력하세요.'
  if (!recipe.subject) errors.subject = '교과 영역을 선택하세요.'
  if (!recipe.difficulty) errors.difficulty = '난이도를 선택하세요.'
  if (recipe.minutes < 1) errors.minutes = '수업 시간은 1분 이상이어야 합니다.'
  if (!recipe.imageUrl) errors.imageUrl = '배선 이미지를 업로드하세요.'
  if (!recipe.sketch.trim()) errors.sketch = '아두이노 스케치를 입력하세요.'
  if (!recipe.body.trim()) errors.body = '수업 본문을 입력하세요.'

  const wiringSteps: WiringErrors = {}
  recipe.wiring.forEach((step, index) => {
    const stepErrors: WiringErrors[number] = {}
    if (!step.from.trim()) stepErrors.from = '출발 핀을 입력하세요.'
    if (!step.to.trim()) stepErrors.to = '도착 핀을 입력하세요.'
    if (!step.color.trim()) stepErrors.color = '전선 색상을 입력하세요.'
    if (!step.text.trim()) stepErrors.text = '단계 설명을 입력하세요.'
    if (step.focus.x + step.focus.w > recipe.imageWidth || step.focus.y + step.focus.h > recipe.imageHeight) {
      stepErrors.focus = '강조 영역은 원본 이미지 범위 안에 있어야 합니다.'
    }
    if (Object.keys(stepErrors).length) wiringSteps[index] = stepErrors
  })
  if (Object.keys(wiringSteps).length) errors.wiringSteps = wiringSteps
  return errors
}

function mergeServiceErrors(current: Errors, fieldErrors: Record<string, string>): Errors {
  const merged: Errors = { ...current, wiringSteps: { ...(current.wiringSteps ?? {}) } }
  for (const [path, message] of Object.entries(fieldErrors)) {
    const match = path.match(/^wiring(?:\.|\[)(\d+)\]?\.(from|to|color|text|focus)$/)
    if (match) {
      const index = Number(match[1])
      merged.wiringSteps![index] = { ...merged.wiringSteps![index], [match[2]]: message }
    } else if (path in emptyRecipe) {
      Object.assign(merged, { [path]: message })
    }
  }
  if (Object.keys(merged.wiringSteps ?? {}).length === 0) delete merged.wiringSteps
  return merged
}

function InventorySelect({
  label,
  items,
  selected,
  onChange,
}: {
  label: string
  items: Array<{ id: string; name: string }>
  selected: string[]
  onChange(value: string[]): void
}) {
  return (
    <fieldset>
      <legend className="mb-2 font-medium">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-2 rounded-card border border-border p-3">
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={(event) => onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))}
            />
            <span>{item.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function AdminRecipeEditorPage({ services }: { services: AdminServices }) {
  const { id = 'new' } = useParams()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<AdminRecipeDraft>(emptyRecipe)
  const [inventory, setInventory] = useState<{ sensors: Sensor[]; actuators: Actuator[] }>({ sensors: [], actuators: [] })
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [publishCheck, setPublishCheck] = useState<{
    recipeKey: string
    canPublish: boolean
    messages: string[]
  } | null>(null)
  const [versions, setVersions] = useState<AdminRecipeVersion[]>([])

  useEffect(() => {
    void services.getInventory().then(setInventory)
    if (id !== 'new') {
      void services.getRecipe(id).then((value) => value ? setRecipe(value) : setMessage('레시피를 찾을 수 없습니다.'))
      void services.listRecipeVersions(id).then(setVersions).catch(() => setVersions([]))
    }
  }, [id, services])

  const update = <K extends keyof AdminRecipeDraft>(key: K, value: AdminRecipeDraft[K]) =>
    setRecipe((current) => ({ ...current, [key]: value }))

  const inventoryVersion = computeInventoryVersion(inventory)
  const currentVerifyHash = recipeVerifyHash(recipe as Recipe, inventoryVersion)
  const deviceReviewCurrent = recipe.reviewedOnDevice?.verifyHash === currentVerifyHash
  const commentReviewCurrent = recipe.commentReviewed?.verifyHash === currentVerifyHash
  const layoutEndpoints = recipe.layout?.parts.flatMap((part) =>
    (part.pins ?? []).map((pin) => `${part.id}.${pin}`),
  ) ?? []
  const inventoryEndpoints = [
    ...inventory.sensors
      .filter((sensor) => recipe.sensors.includes(sensor.id))
      .flatMap((sensor) => sensor.pins.map((pin) => `${sensor.id.toUpperCase()}.${pin.name}`)),
    ...inventory.actuators
      .filter((actuator) => recipe.actuators.includes(actuator.id))
      .flatMap((actuator) => actuator.pins.map((pin) => `${actuator.id.toUpperCase()}.${pin.name}`)),
  ]
  const boardEndpoints = [
    'UNO.3.3V', 'UNO.5V', 'UNO.GND', 'UNO.A0', 'UNO.A1', 'UNO.A2', 'UNO.A3',
    'UNO.A4', 'UNO.A5', 'UNO.D2', 'UNO.D3', 'UNO.D4', 'UNO.D5', 'UNO.D6',
    'UNO.D7', 'UNO.D8', 'UNO.D9', 'UNO.D10', 'UNO.D11', 'UNO.D12', 'UNO.D13',
  ]
  const endpointOptions = [...new Set([...layoutEndpoints, ...inventoryEndpoints, ...boardEndpoints])].sort()
  const recipeKey = JSON.stringify(recipe)
  const publishReady = publishCheck?.recipeKey === recipeKey && publishCheck.canPublish

  function confirmReview(kind: 'reviewedOnDevice' | 'commentReviewed') {
    setRecipe((current) => markCurrentReview(current as Recipe, kind, inventoryVersion))
  }

  async function persist(action: 'save' | 'publish') {
    const nextErrors = validate(recipe)
    setErrors(nextErrors)
    setMessage('')
    if (Object.keys(nextErrors).length) {
      setMessage('표시된 항목을 확인하세요.')
      return
    }
    setBusy(true)
    try {
      const saved = action === 'publish' ? await services.publishRecipe(recipe) : await services.saveRecipe(recipe)
      setRecipe(saved)
      setMessage(action === 'publish' ? '레시피를 공개했습니다.' : '임시 저장했습니다.')
      if (id === 'new') navigate(`/admin/recipes/${saved.id}`, { replace: true })
    } catch (reason) {
      setErrors((current) => mergeServiceErrors(current, readFieldErrors(reason)))
      setMessage(reason instanceof Error ? reason.message : '레시피를 저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const result = await services.uploadImage(file)
      setRecipe((current) => ({ ...current, imageUrl: result.url, imageWidth: result.width, imageHeight: result.height }))
      setMessage(`이미지를 업로드했습니다. 원본 크기: ${result.width} × ${result.height}px`)
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '이미지를 업로드하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function checkPublish() {
    setBusy(true)
    try {
      const result = await services.checkPublishReadiness(recipe)
      setPublishCheck({
        recipeKey,
        canPublish: result.canPublish,
        messages: result.issues.map((issue) => issue.message),
      })
      setMessage(result.canPublish ? '현재 버전은 공개할 수 있습니다.' : '공개 조건을 충족하지 못했습니다.')
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '공개 조건을 확인하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void persist('save') }} className="space-y-6" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-caption text-muted">{recipe.status === 'draft' ? '작성 중' : '공개됨'}</p>
          <h2 className="text-heading font-semibold">{id === 'new' ? '새 레시피' : `${recipe.title || recipe.id} 편집`}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" disabled={busy}>임시 저장</Button>
          <Button type="button" onClick={() => void persist('publish')} disabled={busy || !publishReady}>공개</Button>
          <Button type="button" variant="outline" onClick={() => void checkPublish()} disabled={busy}>
            공개 조건 확인
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || id === 'new'}
            onClick={() => void services.requestVerification(recipe.id).then(() => setMessage('기기 검증을 요청했습니다.')).catch(() => setMessage('기기 검증을 요청하지 못했습니다.'))}
          >
            기기 검증 요청
          </Button>
        </div>
      </div>
      {message && <p role="status" className="rounded-card bg-muted-background p-3">{message}</p>}
      {publishCheck?.recipeKey === recipeKey && publishCheck.messages.length > 0 && (
        <ul className="rounded-card border border-border p-4 text-caption" aria-label="공개 조건 검사 결과">
          {publishCheck.messages.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}

      <Panel title="공개 전 사람 검토">
        <p className="text-body text-muted">
          현재 배선·코드 버전을 직접 확인한 뒤 각 항목을 완료하세요. 내용을 수정하면 확인 상태가 자동으로 만료됩니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            aria-pressed={deviceReviewCurrent}
            onClick={() => confirmReview('reviewedOnDevice')}
          >
            {deviceReviewCurrent ? '실제 기기 검토 완료' : '실제 기기 검토 확인'}
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-pressed={commentReviewCurrent}
            onClick={() => confirmReview('commentReviewed')}
          >
            {commentReviewCurrent ? '코드 주석 검토 완료' : '코드 주석 검토 확인'}
          </Button>
        </div>
      </Panel>

      <Panel title="레시피 기본 정보">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="레시피 ID" error={errors.id} hint="URL에 계속 사용되는 고정 식별자입니다.">
            <Input value={recipe.id} disabled={id !== 'new'} onChange={(event) => update('id', event.target.value)} />
          </Field>
          <Field label="제목" error={errors.title}>
            <Input value={recipe.title} onChange={(event) => update('title', event.target.value)} />
          </Field>
          <Field label="유형">
            <Select value={recipe.type} onChange={(event) => update('type', event.target.value as AdminRecipeDraft['type'])}>
              <option value="project">프로젝트</option>
              <option value="sensor-example">센서 예제</option>
            </Select>
          </Field>
          <Field label="교과 영역" error={errors.subject}>
            <Select value={recipe.subject ?? ''} onChange={(event) => update('subject', event.target.value as AdminRecipeDraft['subject'])}>
              <option value="">교과 영역 선택</option>
              {SubjectSchema.options.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </Select>
          </Field>
          <Field label="난이도" error={errors.difficulty}>
            <Select value={recipe.difficulty} onChange={(event) => update('difficulty', event.target.value as AdminRecipeDraft['difficulty'])}>
              <option value="">난이도 선택</option>
              {DifficultySchema.options.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
            </Select>
          </Field>
          <Field label="예상 수업 시간(분)" error={errors.minutes}>
            <Input type="number" min={1} value={recipe.minutes} onChange={(event) => update('minutes', Number(event.target.value))} />
          </Field>
          <Field label="핵심 검색어" hint="쉼표로 구분하세요.">
            <Input value={recipe.coreKeywords.join(', ')} onChange={(event) => update('coreKeywords', event.target.value.split(',').map((part) => part.trim()).filter(Boolean))} />
          </Field>
          <Field label="통신 속도(baud)">
            <Input type="number" min={1} value={recipe.baudRate} onChange={(event) => update('baudRate', Number(event.target.value))} />
          </Field>
        </div>
        <div className="mt-6 space-y-5">
          <InventorySelect label="센서" items={inventory.sensors} selected={recipe.sensors} onChange={(value) => update('sensors', value)} />
          <InventorySelect label="구동 장치" items={inventory.actuators} selected={recipe.actuators} onChange={(value) => update('actuators', value)} />
        </div>
      </Panel>

      <Panel title="배선 이미지와 단계">
        <Field label="배선 이미지" error={errors.imageUrl} hint={recipe.imageUrl ? `원본 크기 ${recipe.imageWidth} × ${recipe.imageHeight}px` : undefined}>
          <Input type="file" accept="image/*" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} />
        </Field>
        <div className="mt-5">
          <WiringStepEditor
            steps={recipe.wiring}
            errors={errors.wiringSteps ?? {}}
            imageUrl={recipe.imageUrl}
            imageWidth={recipe.imageWidth}
            imageHeight={recipe.imageHeight}
            endpointOptions={endpointOptions}
            onChange={(value) => update('wiring', value)}
          />
        </div>
      </Panel>

      <Panel title="수업 본문">
        <MarkdownEditor value={recipe.body} onChange={(value) => update('body', value)} error={errors.body} />
      </Panel>

      <Panel title="스케치와 활용 안내">
        <div className="space-y-4">
          <Field label="아두이노 스케치" error={errors.sketch}>
            <Textarea rows={16} className="font-mono" value={recipe.sketch} onChange={(event) => update('sketch', event.target.value)} />
          </Field>
          <Field label="활용 안내">
            <Textarea rows={6} value={recipe.applicationGuide} onChange={(event) => update('applicationGuide', event.target.value)} />
          </Field>
        </div>
      </Panel>

      <Panel title="조정값 안내">
        <div className="space-y-4">
          {recipe.tunables.map((tunable, index) => (
            <fieldset key={index} className="grid gap-3 rounded-card border border-border p-4 md:grid-cols-3">
              <legend className="px-2 font-semibold">조정값 {index + 1}</legend>
              <Field label="코드 기준점">
                <Input value={tunable.anchor} onChange={(event) => update('tunables', recipe.tunables.map((item, itemIndex) => itemIndex === index ? { ...item, anchor: event.target.value } : item))} />
              </Field>
              <Field label="이름">
                <Input value={tunable.name} onChange={(event) => update('tunables', recipe.tunables.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
              </Field>
              <Field label="조정 도움말">
                <Input value={tunable.hint} onChange={(event) => update('tunables', recipe.tunables.map((item, itemIndex) => itemIndex === index ? { ...item, hint: event.target.value } : item))} />
              </Field>
              <Button className="justify-self-start" variant="ghost" size="sm" onClick={() => update('tunables', recipe.tunables.filter((_, itemIndex) => itemIndex !== index))}>조정값 삭제</Button>
            </fieldset>
          ))}
          <Button variant="outline" onClick={() => update('tunables', [...recipe.tunables, { anchor: '', name: '', hint: '' }])}>조정값 추가</Button>
        </div>
      </Panel>

      <Panel title="문제 해결">
        <div className="space-y-4">
          {recipe.troubleshooting.map((item, index) => (
            <fieldset key={index} className="grid gap-3 rounded-card border border-border p-4 md:grid-cols-3">
              <legend className="px-2 font-semibold">문제 해결 {index + 1}</legend>
              <Field label="증상">
                <Input value={item.symptom} onChange={(event) => update('troubleshooting', recipe.troubleshooting.map((entry, itemIndex) => itemIndex === index ? { ...entry, symptom: event.target.value } : entry))} />
              </Field>
              <Field label="원인">
                <Input value={item.cause} onChange={(event) => update('troubleshooting', recipe.troubleshooting.map((entry, itemIndex) => itemIndex === index ? { ...entry, cause: event.target.value } : entry))} />
              </Field>
              <Field label="해결 방법">
                <Input value={item.fix} onChange={(event) => update('troubleshooting', recipe.troubleshooting.map((entry, itemIndex) => itemIndex === index ? { ...entry, fix: event.target.value } : entry))} />
              </Field>
              <Button className="justify-self-start" variant="ghost" size="sm" onClick={() => update('troubleshooting', recipe.troubleshooting.filter((_, itemIndex) => itemIndex !== index))}>항목 삭제</Button>
            </fieldset>
          ))}
          <Button variant="outline" onClick={() => update('troubleshooting', [...recipe.troubleshooting, { symptom: '', cause: '', fix: '' }])}>문제 해결 항목 추가</Button>
        </div>
      </Panel>

      {id !== 'new' && (
        <Panel title="버전 이력">
          {versions.length > 0 ? (
            <ol className="space-y-2">
              {versions.map((version) => (
                <li key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border p-3">
                  <span>{new Date(version.savedAt).toLocaleString('ko-KR')}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void services.restoreRecipeVersion(recipe.id, version.id)
                      .then((restored) => {
                        setRecipe(restored)
                        setMessage('선택한 버전을 초안으로 복원했습니다.')
                      })
                      .catch((reason: unknown) => setMessage(reason instanceof Error ? reason.message : '버전을 복원하지 못했습니다.'))}
                  >
                    이 버전 복원
                  </Button>
                </li>
              ))}
            </ol>
          ) : <p className="text-muted">저장된 이전 버전이 없습니다.</p>}
        </Panel>
      )}
    </form>
  )
}
