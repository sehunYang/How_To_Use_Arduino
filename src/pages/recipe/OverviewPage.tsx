import { Link } from 'react-router-dom'
import { SafeMarkdown } from '@/components/ui/SafeMarkdown'
import { splitGuide } from '@/data/inquiryGuide'
import { useRecipeContext } from './RecipeContext'
import { RECIPE_STEPS, stepHeading, stepPath } from './steps'

/**
 * 레시피에 들어와 처음 만나는 화면.
 *
 * 여기에는 할 일이 없습니다. 무엇을 왜 재는 탐구인지 읽고, 어느 단계부터 할지
 * 고르는 자리입니다. 아이디어를 찾으러 온 학생은 이 화면만 보고 나갈 수 있어야
 * 하고, 어제 배선까지 해 둔 학생은 여기에서 배선 다음으로 바로 갈 수 있어야
 * 합니다.
 */
export function OverviewPage() {
  const { recipe, machine } = useRecipeContext()
  const guide = splitGuide(recipe.body)
  const wiringDone = machine.checked.filter(Boolean).length
  const steps = RECIPE_STEPS.filter((step) => step.path)

  return (
    <div className="max-w-3xl">
      {guide.overview && (
        <section aria-labelledby="overview-title" className="prose">
          <h2 id="overview-title" className="text-2xl font-semibold">한눈에 보기</h2>
          <SafeMarkdown source={guide.overview} />
        </section>
      )}

      <section aria-labelledby="steps-title" className="mt-10">
        <h2 id="steps-title" className="text-2xl font-semibold">어디부터 할까요</h2>
        <ol className="mt-4 space-y-3">
          {steps.map((step) => (
            <li key={step.path}>
              <Link
                to={stepPath(recipe.id, step)}
                className="flex items-center justify-between gap-4 rounded-card border border-border p-4 hover:border-accent"
              >
                <span className="font-semibold">{stepHeading(step)}</span>
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
