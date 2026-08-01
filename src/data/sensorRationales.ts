import type { SensorRationale } from '@/schema'
import { canaryRationales } from '@/data/canary/rationales'
import { phase5Rationales } from '@/data/phase5/rationales'

/**
 * 학생 화면에 보여 줄 "추천 이유"의 정본.
 *
 * 과목마다 따로 쓴 문구(phase5)를 앞에 두고, 과목을 가리지 않는 문구(canary)를 뒤에 둡니다.
 * 조회는 먼저 맞는 것을 고르므로, 같은 센서라도 물리 레시피와 생물 레시피가 서로 다른
 * 이유를 보여 주고, 해당 과목 문구가 없을 때만 과목 중립 문구로 내려갑니다.
 *
 * 레시피 목록은 Firestore에서 오지만 이 문구들은 앱에 함께 담깁니다. 검색 화면이
 * 카나리 레시피용 문구만 들고 있으면, 실제 카탈로그의 생물·공학 레시피가 쓰는 센서에
 * 붙일 이유를 찾지 못합니다. (레시피 데이터를 끌어오지 않도록 목록 파일에서 직접 가져옵니다.)
 */
export const sensorRationales: SensorRationale[] = [...phase5Rationales, ...canaryRationales]
