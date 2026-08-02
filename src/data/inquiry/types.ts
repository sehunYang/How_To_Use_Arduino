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
  /**
   * 배선을 마친 뒤 **장치를 실제로 놓고 조립하는** 단계. 탐구 가이드의
   * "탐구 순서" 앞부분이 되고, 레시피가 쓴 측정 방법이 그 뒤에 이어집니다.
   *
   * 탐구가 서툰 학생이 그대로 따라 할 수 있도록 씁니다.
   * - 한 줄에 **하나의 동작**만 담고 명령형(`…합니다.`)으로 끝냅니다.
   * - 눈에 보이는 물건과 자리를 이름으로 부릅니다. "장치를 설치합니다"가 아니라
   *   "수평한 책상 위에 1 m 길이의 레일을 놓고 수평계로 수평을 맞춥니다".
   * - 배선 단계는 여기서 되풀이하지 않습니다. 화면의 "2. 배선하기"가 이미 합니다.
   */
  setup: string[]
  /**
   * 조건 하나를 **어떻게** 기록하는지. 조건을 바꿔 가며 견주는 탐구에만 씁니다.
   *
   * 적지 않으면 "조건을 바꾸고 값이 안정되기를 기다린 뒤 정해진 개수를 읽는다"로
   * 봅니다. 대부분의 탐구가 그렇습니다.
   *
   * `'curve'`는 조건 하나가 그 자체로 시간에 따라 변해 가는 탐구입니다. 냉각
   * 곡선, 발효로 오르는 압력, 되먹임이 목표로 돌아오기까지의 시간처럼
   * **변해 가는 모양이나 걸린 시간이 곧 답**인 경우이며, 값이 끝내 안정되지
   * 않으므로 "안정된 뒤 30개"라는 지시를 따를 수 없습니다. 이때는 조건을 시작한
   * 순간부터 변화가 멎을 때까지 통째로 기록하라고 안내합니다.
   */
  recording?: 'curve'
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
