import type { Recipe } from '@/schema'
import { withInquiryWorkbook } from '@/data/inquiryGuide'
import { canaryPlans } from '@/data/inquiry/plansCanary'

const sketch = `#include <Wire.h>
#include <MPU6050.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

MPU6050 mpu;

// 진자가 흔들리는 동안 몇 밀리초마다 값을 잴지 정합니다.
// 숫자를 줄이면 더 촘촘하게, 늘리면 더 듬성듬성 측정합니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 10;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  mpu.initialize();
  Serial.println("# WOKWI_READY");
  if (mpu.testConnection()) {
    Serial.println("# MPU6050_OK");
  } else {
    Serial.println("# MPU6050_ERROR");
  }
  Serial.println("accel_x_raw,accel_y_raw,accel_z_raw");
}

void loop() {
  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);
  Serial.print(ax); Serial.print(",");
  Serial.print(ay); Serial.print(",");
  Serial.println(az);
  delay(samplingIntervalMs);
}
`

export const pendulumRecipe: Recipe = withInquiryWorkbook(canaryPlans)({
  id: 'pendulum',
  type: 'project',
  title: '단진자의 주기 측정하기',
  subject: '물리',
  difficulty: '중급',
  minutes: 60,
  board: 'uno-r3',
  sensors: ['mpu6050'],
  actuators: [],
  coreKeywords: ['진자', '주기', '에너지', '가속도'],
  imageUrl: 'wiring/circuit.svg',
  imageWidth: 800,
  imageHeight: 600,
  wiring: [
    { from: 'MPU6050.VCC', to: 'UNO.5V', color: 'red', focus: { x: 120, y: 60, w: 140, h: 60 }, text: '빨간 점퍼선을 센서 VCC에서 아두이노 5V로 연결하세요' },
    { from: 'MPU6050.GND', to: 'UNO.GND', color: 'black', focus: { x: 120, y: 140, w: 140, h: 60 }, text: '검은 점퍼선을 센서 GND에서 아두이노 GND로 연결하세요' },
    { from: 'MPU6050.SDA', to: 'UNO.A4', color: 'green', focus: { x: 120, y: 220, w: 140, h: 60 }, text: '초록 점퍼선을 센서 SDA에서 아두이노 A4로 연결하세요' },
    { from: 'MPU6050.SCL', to: 'UNO.A5', color: 'yellow', focus: { x: 120, y: 300, w: 140, h: 60 }, text: '노란 점퍼선을 센서 SCL에서 아두이노 A5로 연결하세요' },
  ],
  sketch,
  baudRate: 9600,
  tunables: [
    {
      anchor: 'samplingIntervalMs',
      name: '샘플링 간격 (ms)',
      hint: '숫자를 줄이면 더 자주 측정합니다. 진자의 주기보다 충분히 짧게 유지하세요.',
    },
  ],
  body: `## 이 탐구는 무엇을 하나요

진자가 흔들릴 때 위치에너지와 운동에너지가 서로 바뀌며 보존됩니다. MPU6050 센서로 진자의 기울기를 재면 흔들리는 주기를 계산할 수 있습니다.

:::callout warn
VCC를 3.3V가 아니라 5V에 꽂으세요. 이 보드는 5V 기준으로 동작합니다.
:::

:::toggle 수식으로 보기 (고등학생)
단진자의 주기는 $T=2\\pi\\sqrt{L/g}$로 근사할 수 있습니다.
:::`,
  applicationGuide: '진자의 길이를 바꿔가며 측정하면 주기와 길이의 관계를 확인할 수 있습니다. 추의 무게를 바꿔도 주기가 거의 변하지 않는지도 비교해보세요.',
  troubleshooting: [
    { symptom: '시리얼 모니터에 아무 값도 안 나옴', cause: 'SDA/SCL이 A4/A5에 정확히 꽂혔는지 확인이 필요합니다', fix: 'A4=SDA, A5=SCL 배선을 다시 확인하세요' },
    { symptom: '값이 이상하게 튐', cause: 'MPU6050 모듈에 따라 I2C 주소가 0x68 또는 0x69로 다를 수 있습니다', fix: 'AD0 핀 연결 여부를 확인하고 라이브러리의 주소 설정을 맞추세요' },
  ],
  status: 'published',
  reviewedOnDevice: null,
  commentReviewed: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
})
