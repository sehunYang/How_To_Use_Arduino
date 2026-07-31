/**
 * 그래프 계열 색과 점 모양.
 *
 * 색은 계열의 성격에 따라 두 가지로 나눠 씁니다. 서로 다른 측정값(온도·습도)은 순서가
 * 없으므로 서로 구별되는 색을 고정된 순서로 쓰고, 실험 회차는 1회차·2회차처럼 순서가
 * 있으므로 같은 파랑을 옅은 쪽에서 짙은 쪽으로 단계지어 씁니다. 어느 쪽이든 색만으로
 * 구분하지 않도록 점 모양도 함께 다르게 그립니다.
 *
 * 색 목록은 순서 자체가 안전장치입니다. 계열을 빼거나 더해도 남은 계열의 색이 바뀌지
 * 않아야 "파란 점이 온도"라는 기억이 계속 맞습니다.
 */

/** 서로 다른 측정값용. 모든 색 쌍이 색약에서도 구분되는 한계가 세 가지입니다. */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a'] as const

/** 실험 회차용. 순서가 있는 값이라 한 가지 색을 옅은 단계에서 짙은 단계로 씁니다. */
export const TRIAL_COLORS = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'] as const

export const SERIES_SHAPE_NAMES = ['원', '마름모', '삼각형', '사각형', '역삼각형'] as const

/** 평균 뒤에 옅게 깔아 두는 회차별 원본 측정값의 색. 평균선을 가리지 않을 만큼만 보입니다. */
export const CONTEXT_COLOR = '#9a9a95'

export const MAX_SERIES = SERIES_COLORS.length
export const MAX_TRIAL_SERIES = TRIAL_COLORS.length

export type SeriesPalette = 'variable' | 'trial'

export function seriesPaletteColors(palette: SeriesPalette): readonly string[] {
  return palette === 'trial' ? TRIAL_COLORS : SERIES_COLORS
}
