import { contactTroubleshooting, createProjectRecipe, i2cConnections, i2cTroubleshooting } from './shared'
import { p2Sketch } from './sketches'

export const p2Recipe = createProjectRecipe({
  id: 'p2-mechanical-energy',
  title: '역학적 에너지 보존 확인하기',
  subject: '물리',
  difficulty: '고급',
  minutes: 75,
  sensors: ['mpu6050'],
  coreKeywords: ['역학적 에너지', '운동에너지', '위치에너지', '가속도', '손실'],
  connections: i2cConnections('MPU6050'),
  sketch: p2Sketch,
  tunable: { anchor: 'samplingIntervalMs', name: '측정 간격 (ms)', hint: '빠른 운동을 놓치지 않도록 10~25 ms 범위에서 시작하세요.' },
  overview: '진자 또는 수레에 붙인 MPU6050으로 운동 상태를 기록하고 위치에너지 감소와 운동에너지 증가를 비교합니다.',
  procedure: '질량과 기준 높이를 먼저 재고 같은 출발점에서 세 번 반복하세요. 센서 가속도를 그대로 속도로 보지 말고, 정지 구간의 영점을 보정한 뒤 운동축 성분을 시간 적분하세요.',
  science: '마찰이 없다면 mgh + ½mv²는 일정합니다. 가속도 적분에는 영점 오차가 누적되므로 짧은 구간을 쓰고, 별도로 잰 위치 또는 주기 조건과 함께 해석해야 합니다.',
  applicationGuide: '출발 높이와 표면 재질을 바꾸어 최대 속도와 에너지 손실률이 어떻게 달라지는지 비교하세요.',
  troubleshooting: [
    i2cTroubleshooting,
    contactTroubleshooting,
    { symptom: '계산한 속도가 시간이 갈수록 한쪽으로 계속 커짐', cause: '가속도 센서 영점 편향이 적분 과정에서 누적되었습니다.', fix: '실험 직전 정지 구간 평균을 빼고 한 번의 짧은 운동 구간만 적분하세요.' },
  ],
})
