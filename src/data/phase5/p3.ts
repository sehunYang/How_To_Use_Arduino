import { contactTroubleshooting, createProjectRecipe, type Connection } from './shared'
import { p3Sketch } from './sketches'

const connections: Connection[] = [
  { from: 'HC-SR04.VCC', to: 'UNO.5V', color: 'red', text: 'HC-SR04 VCC를 아두이노 5V에 연결하세요.' },
  { from: 'HC-SR04.GND', to: 'UNO.GND', color: 'black', text: 'HC-SR04 GND를 아두이노 GND에 연결하세요.' },
  { from: 'HC-SR04.TRIG', to: 'UNO.D9', color: 'green', text: 'HC-SR04 TRIG를 아두이노 D9에 연결하세요.' },
  { from: 'HC-SR04.ECHO', to: 'UNO.D10', color: 'blue', text: 'HC-SR04 ECHO를 아두이노 D10에 연결하세요.' },
]

export const p3Recipe = createProjectRecipe({
  id: 'free-fall',
  title: '자유낙하 가속도 g 구하기',
  subject: '물리',
  difficulty: '중급',
  minutes: 60,
  sensors: ['hc-sr04'],
  coreKeywords: ['자유낙하', '중력가속도', '가속도', '물체', '떨어지는', '거리', '시간', '포물선'],
  connections,
  sketch: p3Sketch,
  tunable: { anchor: 'samplingIntervalMs', name: '측정 간격 (ms)', hint: '이전 초음파의 잔향과 겹치지 않도록 60 ms 이상으로 유지하세요.' },
  overview: '위쪽에 고정한 초음파 센서로 낙하 물체까지의 거리를 시간에 따라 재고 거리-시간 자료에서 중력가속도를 구합니다.',
  procedure: '넓고 평평한 반사판을 센서 축을 따라 안전하게 낙하시키세요. 낙하 전 거리를 원점으로 빼고, 시작 직후 여러 점에 $s=s_0+v_0t+\\frac{1}{2}gt^2$을 맞추세요.',
  science: '공기 저항을 무시하면 위치는 시간의 이차함수입니다. HC-SR04의 사각, 음속의 온도 의존성, 물체 기울어짐, 그리고 초음파 잔향 때문에 60 ms 아래로 줄이기 어려운 측정 간격이 주된 오차입니다. 1 m 낙하는 약 0.45초이므로 표본이 7개 남짓입니다. 낙하 거리를 늘려 표본 수를 확보하세요.',
  applicationGuide: '온도를 함께 기록해 음속 보정을 적용한 결과와 적용하지 않은 결과를 비교해보세요.',
  troubleshooting: [
    contactTroubleshooting,
    { symptom: '거리 값이 0이거나 갑자기 최대값으로 뜸', cause: '반사판이 초음파 빔에서 벗어났거나 에코 제한 시간 안에 반사가 돌아오지 않았습니다.', fix: '넓은 판을 센서와 평행하게 유지하고 측정 범위를 2~200 cm 안으로 줄이세요.' },
  ],
})
