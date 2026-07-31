import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  convertSerialTextToCsv,
  downloadSerialCsv,
  type SerialCsvResult,
} from '@/lib/serialCsv'

const example = `time_ms,temperature_c,humidity_pct
0,21.5,48.2
1000,21.7,48.0`

export function DataConverterPage() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<SerialCsvResult | null>(null)

  function convert() {
    const nextResult = convertSerialTextToCsv(input)
    setResult(nextResult)
    if (nextResult.ok) downloadSerialCsv(nextResult.csv)
  }

  function reset() {
    setInput('')
    setResult(null)
  }

  return (
    <div className="mx-auto max-w-4xl py-8 md:py-12">
      <p className="text-caption font-semibold uppercase tracking-widest text-accent">시리얼 데이터 정리</p>
      <h1 className="mt-3 text-3xl font-semibold md:text-4xl">데이터 변환하기</h1>
      <p className="mt-4 max-w-3xl text-body text-muted">
        Arduino IDE 시리얼 모니터에서 전체 내용을 복사해 아래에 붙여넣으세요. 첫 줄을 열 이름으로 사용하고,
        측정값을 CSV 파일로 저장합니다.
      </p>

      <section aria-labelledby="converter-guide" className="mt-8 rounded-card border border-border bg-muted-background p-5">
        <h2 id="converter-guide" className="text-heading font-semibold">붙여넣기 형식</h2>
        <pre className="mt-3 overflow-x-auto whitespace-pre rounded-card border border-border bg-background p-4 text-caption"><code>{example}</code></pre>
        <p className="mt-3 text-caption text-muted">쉼표는 값과 값 사이에만 넣고, 각 행의 마지막에는 넣지 않습니다.</p>
      </section>

      <div className="mt-8">
        <label htmlFor="serial-data" className="text-body font-semibold">시리얼 모니터 내용</label>
        <textarea
          id="serial-data"
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            setResult(null)
          }}
          className="mt-2 min-h-80 w-full resize-y rounded-card border border-border bg-background p-4 font-mono text-caption outline-none focus:border-accent"
          placeholder="시리얼 모니터에서 Ctrl+A, Ctrl+C로 복사한 내용을 붙여넣으세요."
          spellCheck={false}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button size="lg" onClick={convert} disabled={!input.trim()}>변환하여 CSV 저장</Button>
        <Button size="lg" variant="outline" onClick={reset} disabled={!input && !result}>초기화</Button>
      </div>

      {result && !result.ok && (
        <div role="alert" className="mt-6 rounded-card border border-danger bg-danger-background p-4 text-danger">
          <p className="font-semibold">변환할 수 없습니다.</p>
          <p className="mt-1">{result.error}</p>
        </div>
      )}

      {result?.ok && (
        <div role="status" className="mt-6 rounded-card border border-success bg-success-background p-4 text-success">
          <p className="font-semibold">CSV 파일을 저장했습니다.</p>
          <p className="mt-1">{result.columnCount}개 열, {result.dataRowCount.toLocaleString('ko-KR')}개 데이터 행을 변환했습니다.</p>
        </div>
      )}

      {result && result.excludedRows.length > 0 && (
        <aside aria-labelledby="excluded-rows" className="mt-4 rounded-card border border-warning bg-warning-background p-4 text-warning">
          <h2 id="excluded-rows" className="font-semibold">{result.excludedRows.length}개 행을 제외했습니다.</h2>
          <p className="mt-1 text-caption">제외된 행: {result.excludedRows.map((row) => row.lineNumber).join(', ')}</p>
          <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-caption">
            {result.excludedRows.map((row) => (
              <li key={row.lineNumber}>{row.lineNumber}번째 줄: {row.reason}</li>
            ))}
          </ul>
        </aside>
      )}

      <p className="mt-8 text-caption text-muted">붙여넣은 내용은 이 브라우저 안에서만 변환되며 서버나 Firebase로 전송되지 않습니다.</p>
    </div>
  )
}
