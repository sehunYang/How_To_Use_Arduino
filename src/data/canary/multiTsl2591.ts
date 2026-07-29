import type { Recipe } from '@/schema'

const sketch = `#include <Wire.h>
#include <TCA9548A.h>
#include <Adafruit_TSL2591.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

TCA9548A mux;
Adafruit_TSL2591 tsl = Adafruit_TSL2591(2591);

// 멀티플렉서 채널을 바꾼 직후 센서가 준비될 때까지 기다리는 시간입니다.
// 값이 불안정하면 이 숫자를 늘려보세요.
// @tunable channelDelayMs
int channelDelayMs = 20;

void readChannel(uint8_t channel) {
  mux.openChannel(channel);
  delay(channelDelayMs);
  uint32_t lum = tsl.getFullLuminosity();
  Serial.print("channel "); Serial.print(channel); Serial.print(": ");
  Serial.println(lum);
  mux.closeChannel(channel);
}

void setup() {
  Serial.begin(9600);
  Wire.begin();
  tsl.begin();
}

void loop() {
  readChannel(0);
  readChannel(1);
  delay(500);
}
`

/**
 * S9-equivalent sensor example: demonstrates WHY a multiplexer is needed —
 * TSL2591 has a fixed I2C address (0x29), so two of them cannot share one
 * bus without TCA9548A. This is the draft-status canary (plan errata: 3→4
 * gate needs both a draft and a published fixture exercised).
 */
export const multiTsl2591Recipe: Recipe = {
  id: 'multi-tsl2591',
  type: 'sensor-example',
  title: '주소가 같은 센서 여러 개 연결하기',
  subject: null,
  difficulty: '고급',
  minutes: 45,
  board: 'uno-r3',
  sensors: ['tca9548a', 'tsl2591'],
  actuators: [],
  coreKeywords: ['멀티플렉서', '조도', '다중연결', 'I2C'],
  imageUrl: 'wiring/circuit.svg',
  imageWidth: 800,
  imageHeight: 600,
  wiring: [
    { from: 'TCA9548A.VCC', to: 'UNO.5V', color: 'red', focus: { x: 100, y: 60, w: 140, h: 60 }, text: '빨간 점퍼선을 멀티플렉서 VCC에서 아두이노 5V로 연결하세요' },
    { from: 'TCA9548A.GND', to: 'UNO.GND', color: 'black', focus: { x: 100, y: 140, w: 140, h: 60 }, text: '검은 점퍼선을 멀티플렉서 GND에서 아두이노 GND로 연결하세요' },
    { from: 'TCA9548A.SDA', to: 'UNO.A4', color: 'green', focus: { x: 100, y: 220, w: 140, h: 60 }, text: '초록 점퍼선을 멀티플렉서 SDA에서 아두이노 A4로 연결하세요' },
    { from: 'TCA9548A.SCL', to: 'UNO.A5', color: 'yellow', focus: { x: 100, y: 300, w: 140, h: 60 }, text: '노란 점퍼선을 멀티플렉서 SCL에서 아두이노 A5로 연결하세요' },
    { from: 'TSL2591_1.SDA', to: 'TCA9548A.SD0', color: 'green', focus: { x: 300, y: 60, w: 140, h: 60 }, text: '첫 번째 조도센서의 SDA를 멀티플렉서 채널 0(SD0)에 연결하세요' },
    { from: 'TSL2591_1.SCL', to: 'TCA9548A.SC0', color: 'yellow', focus: { x: 300, y: 140, w: 140, h: 60 }, text: '첫 번째 조도센서의 SCL을 멀티플렉서 채널 0(SC0)에 연결하세요' },
    { from: 'TSL2591_2.SDA', to: 'TCA9548A.SD1', color: 'green', focus: { x: 300, y: 220, w: 140, h: 60 }, text: '두 번째 조도센서의 SDA를 멀티플렉서 채널 1(SD1)에 연결하세요' },
    { from: 'TSL2591_2.SCL', to: 'TCA9548A.SC1', color: 'yellow', focus: { x: 300, y: 300, w: 140, h: 60 }, text: '두 번째 조도센서의 SCL을 멀티플렉서 채널 1(SC1)에 연결하세요' },
  ],
  sketch,
  baudRate: 9600,
  tunables: [
    {
      anchor: 'channelDelayMs',
      name: '채널 전환 지연 (ms)',
      hint: '멀티플렉서 채널을 바꾼 직후 값이 불안정하면 이 숫자를 늘려보세요.',
    },
  ],
  body: `## 이 예제는 무엇을 하나요

TSL2591은 I2C 주소가 0x29로 고정되어 있어서, 두 개를 동시에 쓰려면 TCA9548A 멀티플렉서로 채널을 나눠줘야 합니다.

:::callout warn
TSL2591을 멀티플렉서 없이 두 개 연결하면 주소가 충돌해 둘 다 응답하지 않습니다.
:::

:::toggle 왜 멀티플렉서가 필요한가요?
INA219는 A0/A1 점퍼로 주소를 바꿀 수 있지만, TSL2591은 그럴 수 없습니다. 멀티플렉서는 이렇게 주소를 바꿀 수 없는 센서를 여러 개 쓸 때 필요합니다.
:::`,
  applicationGuide: '채널 수를 늘려 3개 이상의 조도센서를 동시에 읽어 교실 여러 지점의 밝기를 비교할 수 있습니다.',
  troubleshooting: [
    { symptom: '두 센서가 같은 값만 나옴', cause: '채널 전환(openChannel/closeChannel)이 제대로 되지 않았을 수 있습니다', fix: '한 채널을 닫고 다음 채널을 여는 순서를 확인하세요' },
    { symptom: '센서가 아예 응답하지 않음', cause: '멀티플렉서의 채널 핀(SD0/SC0 등)과 센서 배선이 뒤바뀌었을 수 있습니다', fix: 'SDA는 SDx, SCL은 SCx에 연결되어 있는지 다시 확인하세요' },
  ],
  status: 'published',
  reviewedOnDevice: null,
  commentReviewed: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
}
