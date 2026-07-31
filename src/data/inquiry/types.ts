import type { ConceptId } from './concepts'

/** 탐구의 중심이 되는 식과, 그 식을 읽는 법. */
export interface InquiryFormula {
  /** 인라인 LaTeX 한 줄. `$...$`로 감쌉니다. */
  expression: string
  /** 식에 등장하는 기호를 빠짐없이 풀이합니다. 풀이 없는 기호를 남기지 않습니다. */
  symbols: Array<{ symbol: string; meaning: string; unit?: string }>
  /**
   * 식이 실험 결과에 대해 내놓는 구체적 예측. "무엇을 몇 배로 하면 무엇이 몇 배"
   * 형태로 씁니다. 학생이 측정 전에 답을 예상해 볼 수 있어야 합니다.
   */
  prediction: string
}

/** 결과가 예상과 다를 때 무엇을 의심할지 알려 주는 짝. */
export interface InquiryCheckpoint {
  /** 자료에서 눈으로 확인할 수 있는 증상. */
  sign: string
  /** 그 증상의 원인과 다음에 할 일. */
  meaning: string
}

/**
 * 확장 사다리. 같은 장비로 당장 할 수 있는 것에서 시작해 다른 탐구로 이어지도록
 * 세 칸을 반드시 채웁니다. `connect`에는 저장소에 실제로 있는 레시피 제목을
 * 적어, 학생이 다음에 무엇을 열어야 할지 알 수 있게 합니다.
 */
export interface InquiryExtensions {
  immediate: string
  broaden: string
  connect: string
}

export interface InquiryPlan {
  /** 이 탐구가 답하려는 질문 한 문장. 물음표로 끝냅니다. */
  question: string
  /** 센서로 재는 것. */
  measures: string
  /** 사람이 바꾸는 것. 조건을 바꾸지 않는 기록형 탐구는 "바꾸지 않습니다"로 씁니다. */
  changes: string
  /** 확인하려는 관계. */
  relation: string
  /** 이 탐구를 이해하는 데 필요한 개념. 2~4개를 고릅니다. */
  concepts: ConceptId[]
  formula?: InquiryFormula
  variables: {
    independent: string
    dependent: string
    controls: string[]
  }
  /** 저장한 CSV를 가지고 차례대로 수행할 계산. 번호 목록으로 렌더링됩니다. */
  analysis: string[]
  checkpoints: InquiryCheckpoint[]
  extensions: InquiryExtensions
}
