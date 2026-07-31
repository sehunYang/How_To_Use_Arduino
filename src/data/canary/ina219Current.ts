import type { Recipe } from '@/schema'
import { withInquiryWorkbook } from '@/data/inquiryGuide'
import { canaryPlans } from '@/data/inquiry/plansCanary'

const sketch = `#include <Wire.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

const uint8_t INA219_ADDRESS = 0x40;

uint16_t readRegister(uint8_t reg) {
  Wire.beginTransmission(INA219_ADDRESS);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(INA219_ADDRESS, (uint8_t)2);
  return ((uint16_t)Wire.read() << 8) | Wire.read();
}

void writeRegister(uint8_t reg, uint16_t value) {
  Wire.beginTransmission(INA219_ADDRESS);
  Wire.write(reg);
  Wire.write(value >> 8);
  Wire.write(value & 0xff);
  Wire.endTransmission();
}

// @tunable samplingIntervalMs
int samplingIntervalMs = 50;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  writeRegister(0x05, 4096);
  Serial.println("# WOKWI_READY");
  Serial.println("time_ms,current_raw");
}

void loop() {
  Serial.print(millis()); Serial.print(',');
  Serial.println(readRegister(0x04));
  delay(samplingIntervalMs);
}
`

export const ina219CurrentRecipe: Recipe = withInquiryWorkbook(canaryPlans)({
  id: 'ina219-current',
  type: 'sensor-example',
  title: 'INA219로 전류 변화 읽기',
  subject: null,
  difficulty: '중급',
  minutes: 30,
  board: 'uno-r3',
  sensors: ['ina219'],
  actuators: [],
  coreKeywords: ['전류', '전압', '전력', 'I2C'],
  imageUrl: 'wiring/circuit.svg',
  imageWidth: 800,
  imageHeight: 600,
  wiring: [
    { from: 'INA219.VCC', to: 'UNO.5V', color: 'red', focus: { x: 120, y: 60, w: 140, h: 60 }, text: '빨간 점퍼선을 INA219 VCC에서 아두이노 5V로 연결하세요' },
    { from: 'INA219.GND', to: 'UNO.GND', color: 'black', focus: { x: 120, y: 140, w: 140, h: 60 }, text: '검은 점퍼선을 INA219 GND에서 아두이노 GND로 연결하세요' },
    { from: 'INA219.SDA', to: 'UNO.A4', color: 'green', focus: { x: 120, y: 220, w: 140, h: 60 }, text: '초록 점퍼선을 INA219 SDA에서 아두이노 A4로 연결하세요' },
    { from: 'INA219.SCL', to: 'UNO.A5', color: 'yellow', focus: { x: 120, y: 300, w: 140, h: 60 }, text: '노란 점퍼선을 INA219 SCL에서 아두이노 A5로 연결하세요' },
    { from: 'INA219.VIN+', to: 'UNO.5V', color: 'red', focus: { x: 120, y: 360, w: 140, h: 60 }, text: '측정 전원의 양극을 INA219 VIN+에 연결하세요' },
    { from: 'INA219.VIN-', to: 'LOAD.POSITIVE', color: 'orange', focus: { x: 300, y: 360, w: 140, h: 60 }, text: 'INA219 VIN-를 측정할 부하의 양극에 연결하세요' },
    { from: 'LOAD.NEGATIVE', to: 'UNO.GND', color: 'black', focus: { x: 480, y: 360, w: 140, h: 60 }, text: '부하의 음극을 공통 GND에 연결해 직렬 측정 경로를 완성하세요' },
  ],
  sketch,
  baudRate: 9600,
  tunables: [
    {
      anchor: 'samplingIntervalMs',
      name: '측정 간격 (ms)',
      hint: '값을 줄이면 전류 변화를 더 자주 읽지만 시리얼 출력량이 늘어납니다.',
    },
  ],
  body: `## 이 예제는 무엇을 하나요

INA219의 전류 레지스터를 I2C로 읽어 부하 변화가 측정값에 반영되는지 확인합니다.

:::callout warn
실물 회로에서는 측정할 부하를 INA219의 VIN+와 VIN- 사이에 연결해야 합니다.
:::`,
  applicationGuide: '모터나 LED 부하를 바꿔가며 전류와 전력의 관계를 비교할 수 있습니다.',
  troubleshooting: [
    { symptom: '값이 계속 0으로 나옴', cause: '캘리브레이션 레지스터가 설정되지 않았거나 측정 부하가 없을 수 있습니다', fix: '0x05 캘리브레이션 쓰기와 VIN+/VIN- 부하 연결을 확인하세요' },
    { symptom: '센서가 응답하지 않음', cause: 'SDA/SCL 배선이나 I2C 주소가 맞지 않을 수 있습니다', fix: 'A4=SDA, A5=SCL과 기본 주소 0x40을 확인하세요' },
  ],
  status: 'published',
  reviewedOnDevice: null,
  commentReviewed: null,
  updatedAt: '2026-07-27T00:00:00.000Z',
})
