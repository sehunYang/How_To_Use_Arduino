import { CodeBlock } from '@/components/ui/CodeBlock'
import { SafeMarkdown } from '@/components/ui/SafeMarkdown'
import { firstReadingFor } from '@/recipes/firstReading'
import { ARDUINO_IDE_URL, firstRunSteps } from '@/recipes/firstRun'
import { glossaryFor } from '@/recipes/glossary'
import { librariesFor } from '@/recipes/libraries'
import { pinMapFor } from '@/recipes/pinMap'
import { sketchSummary } from '@/recipes/sketchSummary'
import { useRecipeContext } from './RecipeContext'
import { GlossaryList, PinMap } from './shared'

export function CodePage() {
  const { recipe } = useRecipeContext()
  const libraries = librariesFor(recipe.sketch)
  const steps = firstRunSteps(libraries.install.length > 0)
  const reading = firstReadingFor(recipe)
  const glossary = glossaryFor(recipe)
  const summary = sketchSummary(recipe)
  const pins = pinMapFor(recipe)

  return (
    <div>
      {/* 두 번째 레시피부터는 이미 아는 내용이라 늘 펼쳐 두면 코드가 화면 밖으로
          밀려납니다. 접어 두되 요약 줄만 읽고도 열지 말지 고를 수 있게 합니다. */}
      <details className="max-w-3xl rounded-card border border-border p-4">
        <summary className="cursor-pointer font-semibold">아두이노가 처음이라면: IDE 설치부터 시리얼 모니터 열기까지</summary>
        <ol className="mt-3 space-y-3">
          {steps.map((step, index) => (
            <li key={step.title} className="grid grid-cols-[1.75rem_minmax(0,1fr)]">
              <span aria-hidden="true" className="font-semibold text-muted">{index + 1}.</span>
              <span>
                <strong>{step.title}</strong>
                <span className="mt-1 block text-caption text-muted">{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-caption">
          아두이노 IDE 내려받는 곳:{' '}
          <a className="text-accent hover:underline" href={ARDUINO_IDE_URL} target="_blank" rel="noreferrer noopener">arduino.cc/en/software</a>
        </p>
      </details>

      {/* 설치할 것이 없으면 절 자체를 내보내지 않습니다. "없습니다"라는 줄은
          학생이 읽고 나서 할 일이 없는 문장입니다. 이름은 요약 줄에 적어 두어
          이미 설치한 학생은 열지 않고도 넘어갈 수 있게 합니다. */}
      {libraries.install.length > 0 && (
        <details className="mt-4 max-w-3xl rounded-card border border-border p-4">
          <summary className="cursor-pointer font-semibold">
            필요한 라이브러리 {libraries.install.length}개: {libraries.install.map((library) => library.search).join(', ')}
          </summary>
          <ul className="mt-3 space-y-3">
            {libraries.install.map((library) => (
              <li key={library.header}>
                <strong>[도구] → [라이브러리 관리]에서 <code className="text-syntax-string">{library.search}</code> 검색</strong>
                <span className="mt-1 block text-caption text-muted">
                  코드의 <code>{library.header}</code> 줄이 이 라이브러리를 부릅니다.{library.note ? ` ${library.note}` : ''}
                </span>
              </li>
            ))}
          </ul>
          {libraries.builtin.length > 0 && (
            <p className="mt-3 text-caption text-muted">
              아두이노 IDE에 들어 있어 설치하지 않아도 되는 것: <code>{libraries.builtin.join(', ')}</code>
            </p>
          )}
        </details>
      )}

      {/* 스케치·업로드·시리얼 모니터·baud·라이브러리는 모두 이 단계에서 처음 나오는
          말입니다. 사전이 배선 쪽에만 있던 때에는, 되돌아가지 않는 학생이 "9600
          baud로 맞추세요"를 뜻도 모른 채 지나갔습니다. */}
      <GlossaryList title="이 단계에 나오는 말의 뜻" entries={glossary.code} />

      {/* 속도만은 접지 않습니다. 맞추지 않으면 시리얼 모니터에 깨진 기호만 나오고,
          학생은 무엇이 잘못됐는지 짐작할 단서를 얻지 못합니다. */}
      <p className="mt-4 max-w-3xl text-caption">
        <strong>시리얼 모니터 속도 {recipe.baudRate} baud</strong>
        <span className="text-muted"> · 업로드 뒤 [도구] → [시리얼 모니터]를 열고 오른쪽 아래에서 맞추세요.</span>
      </p>

      {/* 코드를 처음 보는 학생에게 스케치는 복사할 덩어리일 뿐입니다. 흐름을
          먼저 알려 주어야 노란 줄을 바꿀 때 무엇이 달라지는지 짐작할 수 있습니다. */}
      <div className="mt-4 max-w-3xl rounded-card border border-border p-4">
        <h3 className="font-semibold">이 코드가 하는 일</h3>
        <div className="prose mt-2">
          <SafeMarkdown source={summary.map((line) => `- ${line}`).join('\n')} />
        </div>
      </div>

      <PinMap lines={pins} recipeId={recipe.id} />

      <div className="mt-3 overflow-hidden rounded-card border border-border"><CodeBlock code={recipe.sketch} tunables={recipe.tunables} /></div>

      {/* 값이 나오기만 하면 측정이 되고 있다고 믿기 쉽습니다. 고장났을 때만 나오는
          값을 여기에서 걸러 내지 못하면 한 시간을 헛측정하고 데이터 화면에서야 압니다. */}
      <section aria-labelledby="first-reading-title" className="mt-6 max-w-3xl rounded-card border border-border p-5">
        <h3 id="first-reading-title" className="font-semibold">처음 나온 값이 정상인지 확인하기</h3>
        {reading.normal.length > 0 && (
          <ul className="mt-3 space-y-2">
            {reading.normal.map((line) => (
              <li key={line}>
                <span className="font-semibold text-success">정상</span>
                <span className="ml-2">{line}</span>
              </li>
            ))}
          </ul>
        )}
        <table className="mt-4 w-full text-left">
          <caption className="sr-only">시리얼 모니터에 나온 값과 그 뜻</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-4 font-semibold">이런 값이 나오면</th>
              <th scope="col" className="py-2 font-semibold">무엇을 다시 보나</th>
            </tr>
          </thead>
          <tbody>
            {reading.signals.map((signal) => (
              <tr key={signal.sign} className="border-b border-border align-top">
                <td className="py-2 pr-4">{signal.sign}</td>
                <td className="py-2 text-muted">{signal.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
