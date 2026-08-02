import type { Recipe, Sensor } from '@/schema'
import { librariesFor } from '@/recipes/libraries'
import { buildDiagram } from './buildDiagram'

/**
 * 부품이 없는 학생이 브라우저에서 먼저 해 볼 수 있게 파일을 만들어 줍니다.
 *
 * 이 저장소는 이미 회로도를 Wokwi 형식(`diagram.json`)으로 만들 줄 압니다.
 * 다만 그것은 검증용이었고 학생 화면에는 나오지 않았습니다. 집에 부품이 없거나
 * 수업 전에 예습하려는 학생에게는 이 파일 두 개면 충분합니다.
 *
 * **다만 아무 레시피에나 열어 주면 안 됩니다.** BME280·INA219·TSL2591처럼 우리가
 * 직접 만든 칩 모형으로 도는 부품은 공개 Wokwi에 없어서, 학생이 그대로 열면
 * 부품 자리가 비어 있는 회로를 받습니다. 할 수 없는 일을 시키는 안내가 되므로
 * 공개 부품만으로 그려지는 레시피에만 내보냅니다.
 */

/** 공개 Wokwi에 실제로 있는 부품의 이름은 모두 이 접두사로 시작합니다. */
const PUBLIC_PART_PREFIX = 'wokwi-'

export const WOKWI_NEW_PROJECT_URL = 'https://wokwi.com/projects/new/arduino-uno'

export interface StudentSimulation {
  /** `diagram.json`에 그대로 넣을 내용 */
  diagram: string
  /** `sketch.ino`에 그대로 넣을 내용 */
  sketch: string
  /** 시뮬레이터의 라이브러리 관리자에 더할 이름. 필요 없으면 빈 배열입니다. */
  libraries: string[]
}

/**
 * 공개 부품만으로 그려지는 레시피면 시뮬레이터용 파일을, 아니면 `null`을 돌려줍니다.
 * 회로를 그리다 실패하는 레시피도 `null`입니다. 반쯤 그려진 회로는 학생이
 * 틀린 곳을 찾느라 시간을 쓰게 만듭니다.
 */
export function studentSimulationFor(recipe: Recipe, sensors: Sensor[]): StudentSimulation | null {
  let diagram
  try {
    diagram = buildDiagram(recipe, sensors)
  } catch {
    return null
  }

  if (!diagram.parts.every((part) => part.type.startsWith(PUBLIC_PART_PREFIX))) return null

  return {
    diagram: `${JSON.stringify(diagram, null, 2)}\n`,
    sketch: recipe.sketch.trimEnd() + '\n',
    libraries: librariesFor(recipe.sketch).install.map((library) => library.search),
  }
}
