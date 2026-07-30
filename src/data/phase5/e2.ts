import { contactTroubleshooting, createProjectRecipe, oneWireConnections } from './shared'
import { e2Sketch } from './sketches'

export const e2Recipe = createProjectRecipe({
  id: 'e2-reaction-temperature',
  title: '발열·흡열 반응의 온도 변화 기록',
  subject: '화학·환경',
  difficulty: '중급',
  minutes: 55,
  sensors: ['ds18b20'],
  coreKeywords: ['발열 반응', '흡열 반응', '온도 변화', '열량', 'DS18B20'],
  connections: oneWireConnections(['DS18B20']),
  sketch: e2Sketch,
  tunable: { anchor: 'samplingIntervalMs', name: '기록 간격 (ms)', hint: 'DS18B20의 변환 시간을 고려해 750~1000 ms 이상을 권장합니다.' },
  overview: '안전한 용해 과정 전후의 온도를 연속 기록해 발열 또는 흡열 여부와 최대 온도 변화를 확인합니다.',
  procedure: '같은 질량의 물을 단열 컵에 넣고 초기 온도가 안정되면 기록을 시작하세요. 교사가 승인한 안전한 물질을 정해진 양만 넣고 일정하게 저으며 최고 또는 최저 온도까지 기록하세요.',
  science: '용액이 얻거나 잃은 열은 대략 q = mcΔT로 추정할 수 있지만 컵, 센서, 공기와의 열교환도 포함됩니다. 온도가 오르면 용액 관점에서 발열, 내려가면 흡열 과정의 증거입니다.',
  applicationGuide: '물의 질량과 물질 양을 기록해 물질 1 g당 겉보기 열량을 비교하되, 화학물질은 교사 지시와 안전자료를 따르세요.',
  troubleshooting: [
    contactTroubleshooting,
    { symptom: '-127°C 또는 85°C가 계속 표시됨', cause: '1-Wire 센서를 찾지 못했거나 온도 변환이 끝나기 전에 읽었습니다.', fix: 'DATA-5V 사이 4.7 kΩ 풀업과 D2 배선을 확인하고 변환 간격을 750 ms 이상으로 두세요.' },
  ],
})
