import { Link } from 'react-router-dom'
import { SectionHeading, StepBadge } from '@/components/ui/guide'
import { SafeMarkdown } from '@/components/ui/SafeMarkdown'
import { APPARATUS_MARKERS, splitGuide } from '@/data/inquiryGuide'
import { apparatusFor } from '@/recipes/parts'
import { useRecipeContext } from './RecipeContext'
import { RECIPE_STEPS, stepPath } from './steps'

/** 요약 본문에서 준비물 덩어리를 뺍니다. 그 목록은 이 화면이 따로 절로 그립니다. */
function withoutApparatus(overview: string): string {
  const start = overview.indexOf(APPARATUS_MARKERS.start)
  const end = overview.indexOf(APPARATUS_MARKERS.end)
  if (start === -1 || end === -1) return overview
  return `${overview.slice(0, start)}${overview.slice(end + APPARATUS_MARKERS.end.length)}`.trim()
}

/**
 * 레시피에 들어와 처음 만나는 화면.
 *
 * 여기에는 할 일이 없습니다. 무엇을 왜 재는 탐구인지 읽고, 어느 단계부터 할지
 * 고르는 자리입니다. 아이디어를 찾으러 온 학생은 이 화면만 보고 나갈 수 있어야
 * 하고, 어제 배선까지 해 둔 학생은 여기에서 배선 다음으로 바로 갈 수 있어야
 * 합니다. 절 제목과 단계 번호는 탐구 설계·측정 화면과 같은 모양입니다.
 */
export function OverviewPage() {
  const { recipe, machine } = useRecipeContext()
  const guide = splitGuide(recipe.body)
  const apparatus = apparatusFor(recipe.body)
  const wiringDone = machine.checked.filter(Boolean).length
  const steps = RECIPE_STEPS.filter((step) => step.path)

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-semibold">한눈에 보기</h2>

      {guide.overview && (
        <section aria-labelledby="overview-title">
          <SectionHeading id="overview-title" badge="요약">이 탐구에서 하는 일</SectionHeading>
          <SafeMarkdown source={withoutApparatus(guide.overview)} />
        </section>
      )}

      {apparatus.length > 0 && (
        <section aria-labelledby="apparatus-title">
          <SectionHeading id="apparatus-title" badge="준비물">전자 부품 밖의 준비물</SectionHeading>
          <ul className="my-3 list-disc space-y-1.5 pl-6 marker:text-accent">
            {apparatus.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p className="text-caption text-muted">전자 부품은 <Link className="text-accent hover:underline" to={stepPath(recipe.id, RECIPE_STEPS[1])}>1. 준비물</Link>에 모아 두었습니다.</p>
        </section>
      )}

      <section aria-labelledby="steps-title">
        <SectionHeading id="steps-title" badge="순서">어디부터 할까요</SectionHeading>
        <ol className="mt-4 space-y-3">
          {steps.map((step) => (
            <li key={step.path}>
              <Link
                to={stepPath(recipe.id, step)}
                className="flex items-center justify-between gap-4 rounded-card border border-border p-4 hover:border-accent"
              >
                <span className="flex items-center gap-3 font-semibold">
                  <StepBadge>{step.number}</StepBadge>
                  <span><span className="sr-only">{step.number}.</span> {step.title}</span>
                </span>
                {/* 배선만 진행이 숫자로 남습니다. 나머지 단계는 끝났는지를 화면이
                    알 방법이 없어, 아는 척하지 않고 아무 말도 하지 않습니다. */}
                {step.path === 'wiring' && recipe.wiring.length > 0 && (
                  <span className="shrink-0 text-caption text-muted">{wiringDone}/{recipe.wiring.length} 완료</span>
                )}
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
