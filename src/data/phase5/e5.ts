import { contactTroubleshooting, createProjectRecipe, i2cTroubleshooting, type Connection } from './shared'
import { e5Sketch } from './sketches'

const connections: Connection[] = [
  { from: 'TCA9548A.VCC', to: 'UNO.5V', color: 'red', text: 'TCA9548A VCC를 아두이노 5V에 연결하세요.' },
  { from: 'TCA9548A.GND', to: 'UNO.GND', color: 'black', text: 'TCA9548A GND를 아두이노 GND에 연결하세요.' },
  { from: 'TCA9548A.SDA', to: 'UNO.A4', color: 'green', text: 'TCA9548A SDA를 아두이노 A4에 연결하세요.' },
  { from: 'TCA9548A.SCL', to: 'UNO.A5', color: 'yellow', text: 'TCA9548A SCL을 아두이노 A5에 연결하세요.' },
  { from: 'TSL2591_1.SDA', to: 'TCA9548A.SD0', color: 'green', text: '첫 번째 TSL2591 SDA를 TCA9548A SD0에 연결하세요.' },
  { from: 'TSL2591_1.SCL', to: 'TCA9548A.SC0', color: 'yellow', text: '첫 번째 TSL2591 SCL을 TCA9548A SC0에 연결하세요.' },
  { from: 'TSL2591_2.SDA', to: 'TCA9548A.SD1', color: 'green', text: '두 번째 TSL2591 SDA를 TCA9548A SD1에 연결하세요.' },
  { from: 'TSL2591_2.SCL', to: 'TCA9548A.SC1', color: 'yellow', text: '두 번째 TSL2591 SCL을 TCA9548A SC1에 연결하세요.' },
  { from: 'TSL2591_3.SDA', to: 'TCA9548A.SD2', color: 'green', text: '세 번째 TSL2591 SDA를 TCA9548A SD2에 연결하세요.' },
  { from: 'TSL2591_3.SCL', to: 'TCA9548A.SC2', color: 'yellow', text: '세 번째 TSL2591 SCL을 TCA9548A SC2에 연결하세요.' },
  { from: 'TSL2591_ALL.VCC', to: 'UNO.5V', color: 'red', text: '세 TSL2591 모듈의 VCC를 공통 5V 레일에 연결하세요.' },
  { from: 'TSL2591_ALL.GND', to: 'UNO.GND', color: 'black', text: '세 TSL2591 모듈의 GND를 공통 GND 레일에 연결하세요.' },
]

export const e5Recipe = createProjectRecipe({
  id: 'e5-spatial-light-map',
  title: '위치별 광량 분포 측정',
  subject: '화학·환경',
  difficulty: '고급',
  minutes: 90,
  sensors: ['tca9548a', 'tsl2591'],
  coreKeywords: ['광량 분포', '조도', 'TCA9548A', '다중 센서', '공간 측정'],
  connections,
  sketch: e5Sketch,
  tunable: { anchor: 'channelSettleMs', name: '채널 안정화 시간 (ms)', hint: '채널 전환 후 첫 값이 불안정하면 25 ms에서 조금씩 늘리세요.' },
  overview: '고정된 세 위치의 TSL2591을 TCA9548A 채널로 분리해 같은 시간대의 광량 분포를 비교합니다.',
  procedure: '세 센서의 방향과 높이를 같게 고정하고 위치 번호를 기록하세요. 센서를 나란히 두어 상호 보정 계수를 먼저 구한 뒤 측정 위치로 옮기고 여러 시점의 평균을 비교하세요.',
  science: 'TSL2591은 주소가 0x29로 고정되어 같은 I2C 버스에 직접 여러 개 연결할 수 없습니다. 멀티플렉서는 한 번에 한 채널만 버스에 연결합니다. 센서 간 감도 차이와 입사각 차이는 공간 차이처럼 보일 수 있습니다.',
  applicationGuide: '교실 격자 좌표에 보정 조도를 표시해 등조도선 지도를 만들고 조명 배치 개선안을 제안하세요.',
  troubleshooting: [
    i2cTroubleshooting,
    contactTroubleshooting,
    { symptom: '세 위치가 같은 값이거나 일부 채널만 응답함', cause: '채널 선택 비트가 바뀌지 않았거나 SDx/SCx 쌍이 서로 다른 채널에 연결되었습니다.', fix: '채널 0~2를 하나씩 선택하고 SDA=SDx, SCL=SCx가 같은 번호인지 확인하세요.' },
  ],
})
