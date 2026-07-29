import type { SearchIndexEntry } from '@/schema'
import { pendulumRecipe } from './canary'
import { buildIndexEntry } from '@/search'

/**
 * Stand-in search corpus for exercising the matching pipeline (US-008/010)
 * before Phase 5 authors the real 34 recipes. Titles/keywords are drawn
 * from the plan's actual v1 content list so test sentences are realistic,
 * but these are NOT authored recipe content (no wiring/sketch/body) — they
 * exist only to give the search scorer something varied to rank against.
 */
const stubEntries: SearchIndexEntry[] = [
  { id: 'free-fall', title: '자유낙하 가속도 g 구하기', subject: '물리', difficulty: '중급', minutes: 40, sensors: ['hc-sr04'], actuators: [], coreKeywords: ['자유낙하', '가속도', '거리'], imageUrl: 'wiring/free-fall.png', applicationGuideExcerpt: '낙하 높이를 바꾸며 중력가속도 측정값을 비교해보세요.' },
  { id: 'fan-control', title: '온습도에 따른 자동 환풍기 제어', subject: '화학·환경', difficulty: '중급', minutes: 50, sensors: ['bme280'], actuators: ['relay-module', 'dc-fan-5v'], coreKeywords: ['온도', '습도', '환풍기'], imageUrl: 'wiring/fan-control.png', applicationGuideExcerpt: '환풍기 작동 기준을 바꾸며 실내 환경 변화를 비교해보세요.' },
  { id: 'light-follow-car', title: '빛을 따라가는 자동차', subject: '공학·로봇', difficulty: '중급', minutes: 60, sensors: ['cds'], actuators: ['dc-motor-driver'], coreKeywords: ['빛', '자동차', '조도', '자율주행'], imageUrl: 'wiring/light-follow-car.png', applicationGuideExcerpt: '빛의 방향과 세기에 따른 자동차 움직임을 비교해보세요.' },
  { id: 'rpm-meter', title: '바퀴 회전수(RPM) 측정기', subject: '공학·로봇', difficulty: '중급', minutes: 45, sensors: ['hbe0704'], actuators: [], coreKeywords: ['회전수', '자석', 'RPM'], imageUrl: 'wiring/rpm-meter.png', applicationGuideExcerpt: '바퀴 크기와 회전수로 이동 속도를 계산해보세요.' },
  { id: 'obstacle-avoid-car', title: '장애물 회피 자율주행 자동차', subject: '공학·로봇', difficulty: '고급', minutes: 70, sensors: ['hc-sr04', 'mpu6050'], actuators: ['dc-motor-driver'], coreKeywords: ['장애물', '자율주행', '초음파', '거리'], imageUrl: 'wiring/obstacle-avoid-car.png', applicationGuideExcerpt: '회피 거리와 회전 각도를 조절하며 주행 안정성을 비교해보세요.' },
  { id: 'night-activity', title: '야행성 활동 감지', subject: '생물', difficulty: '초급', minutes: 30, sensors: ['hc-sr501', 'cds'], actuators: [], coreKeywords: ['야행성', '활동', '감지'], imageUrl: 'wiring/night-activity.png', applicationGuideExcerpt: '밝기와 시간대에 따른 활동 빈도를 기록해보세요.' },
  { id: 'cooling-curve', title: '물의 냉각 곡선 (뉴턴 냉각법칙)', subject: '화학·환경', difficulty: '중급', minutes: 55, sensors: ['ds18b20'], actuators: [], coreKeywords: ['냉각', '뉴턴', '온도'], imageUrl: 'wiring/cooling-curve.png', applicationGuideExcerpt: '용기 재질과 물의 양에 따른 냉각 속도를 비교해보세요.' },
  { id: 'plant-growth', title: '식물 생장 환경 기록기', subject: '생물', difficulty: '초급', minutes: 40, sensors: ['tsl2591', 'bme280'], actuators: [], coreKeywords: ['생장', '조도', '온도'], imageUrl: 'wiring/plant-growth.png', applicationGuideExcerpt: '빛과 온도 변화가 식물 생장에 미치는 영향을 기록해보세요.' },
  { id: 'parking-alarm', title: '주차 보조 거리 경보기', subject: '공학·로봇', difficulty: '초급', minutes: 35, sensors: ['hc-sr04'], actuators: ['buzzer', 'led'], coreKeywords: ['주차', '거리', '경보', '부저'], imageUrl: 'wiring/parking-alarm.png', applicationGuideExcerpt: '경보 거리와 소리 간격을 조절해 사용성을 비교해보세요.' },
]

export function buildTestIndex(): SearchIndexEntry[] {
  const pendulumEntry = buildIndexEntry(pendulumRecipe)
  return pendulumEntry ? [pendulumEntry, ...stubEntries] : stubEntries
}
