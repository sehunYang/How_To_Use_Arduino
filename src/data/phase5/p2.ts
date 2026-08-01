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
  overview: '진자에 붙인 MPU6050의 스케치는 타임스탬프와 3축 가속도, 그 크기(g_norm)를 CSV로 기록합니다. 최하점을 지날 때 나타나는 g_norm 봉우리에서 속력을 구하고, 놓은 높이의 위치에너지와 비교합니다.',
  procedure: '시리얼 모니터 속도를 115200으로 맞추세요. 추와 센서를 합친 질량, 실 길이, 놓는 높이를 먼저 재고 같은 높이에서 세 번 원시 CSV를 기록하세요. 자유롭게 흔들리는 센서는 가속도를 시간 적분해도 속도가 나오지 않습니다. 대신 최하점에서 센서가 읽는 겉보기 힘이 $1+v^2/(gL)$ (g 단위)이 되는 것을 이용해, g_norm 봉우리 값에서 속력을 계산하세요.',
  science: '마찰이 없다면 $mgh+\\frac{1}{2}mv^2$은 일정합니다. 가속도계는 좌표 가속도가 아니라 겉보기 힘을 읽으므로, 자유 낙하·자유 진동 중 접선 방향 값은 0에 가깝고 최하점의 반지름 방향 값은 $g+v^2/L$이 됩니다. 이 원심 성분이 속력을 알려 줍니다.',
  applicationGuide: '출발 높이와 표면 재질을 바꾸어 최대 속도와 에너지 손실률이 어떻게 달라지는지 비교하세요.',
  troubleshooting: [
    i2cTroubleshooting,
    contactTroubleshooting,
    { symptom: 'g_norm 봉우리가 뚜렷하지 않음', cause: '측정 간격이 길거나 센서가 헐겁게 붙어 흔들림이 섞였습니다.', fix: '측정 간격을 10~20 ms로 줄이고 센서를 추에 단단히 고정한 뒤 다시 기록하세요.' },
  ],
})
