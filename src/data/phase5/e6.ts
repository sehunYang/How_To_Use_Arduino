import { contactTroubleshooting, createProjectRecipe, oneWireConnections } from './shared'
import { e6Sketch } from './sketches'

export const e6Recipe = createProjectRecipe({
  id: 'e6-multi-point-temperature',
  title: '여러 지점 온도 동시 측정',
  subject: '화학·환경',
  difficulty: '고급',
  minutes: 70,
  sensors: ['ds18b20'],
  coreKeywords: ['다중 온도', 'DS18B20', '1-Wire', '온도 구배', '열전달'],
  connections: oneWireConnections(['DS18B20_1', 'DS18B20_2', 'DS18B20_3']),
  sketch: e6Sketch,
  tunable: { anchor: 'sensorCount', name: '센서 개수', hint: '연결하고 확인한 DS18B20 개수와 같게 설정하세요.' },
  overview: '고유한 64비트 주소를 가진 DS18B20 여러 개를 한 DATA 선에 연결해 위치별 온도를 거의 같은 시점에 기록합니다.',
  procedure: '각 센서를 한 용기에 나란히 넣어 센서 번호와 오프셋을 먼저 확인하세요. 이후 정한 위치에 고정하고 깊이, 벽과의 거리, 측정 간격을 일정하게 유지하세요.',
  science: '1-Wire 센서는 한 선을 공유하지만 각자 고유 주소로 구분됩니다. 변환 명령을 동시에 보낸 뒤 순서대로 읽으면 시차가 작습니다. 배선이 길어질수록 배선에 저장되는 전하와 잡음 때문에 통신이 불안정해질 수 있습니다.',
  applicationGuide: '물의 위·중간·아래 또는 단열재 양쪽에 센서를 놓아 시간에 따른 온도 구배와 열전달 방향을 비교하세요.',
  troubleshooting: [
    contactTroubleshooting,
    { symptom: '센서 순서가 재부팅 뒤 바뀌거나 하나가 -127°C임', cause: '인덱스 순서는 고정 식별자가 아니며 신호선을 기본 HIGH 상태로 유지하는 저항이 부족하거나 접촉이 불량하면 일부 주소를 읽지 못할 수 있습니다.', fix: '실험 전 각 센서의 64비트 주소를 기록해 주소로 읽고 DATA-5V 사이 4.7 kΩ 풀업 저항(신호선을 기본 HIGH 상태로 유지하는 저항)을 확인하세요.' },
  ],
})
