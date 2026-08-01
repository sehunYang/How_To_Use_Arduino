import type { Recipe, WiringStep } from '@/schema'

const IMAGE = {
  imageWidth: 800,
  imageHeight: 600,
} as const

const updatedAt = '2026-07-30T00:00:00.000Z'

type ExampleInput = Omit<
  Recipe,
  | 'type'
  | 'subject'
  | 'board'
  | 'actuators'
  | 'imageUrl'
  | 'imageWidth'
  | 'imageHeight'
  | 'baudRate'
  | 'status'
  | 'reviewedOnDevice'
  | 'commentReviewed'
  | 'updatedAt'
>

function example(input: ExampleInput): Recipe {
  return {
    ...input,
    type: 'sensor-example',
    subject: null,
    board: 'uno-r3',
    actuators: [],
    ...IMAGE,
    imageUrl: `wiring/${input.id}.svg`,
    baudRate: 9600,
    // Phase 5 content stays a draft until the required phone and comment
    // reviews are performed and their current verifyHash values are recorded.
    status: 'draft',
    reviewedOnDevice: null,
    commentReviewed: null,
    updatedAt,
  }
}

function focus(index: number) {
  return { x: 30 + (index % 4) * 185, y: 30 + Math.floor(index / 4) * 90, w: 150, h: 60 }
}

function wire(from: string, to: string, color: string, text: string, index: number): WiringStep {
  return { from, to, color, text, focus: focus(index) }
}

function i2cWiring(part: string): WiringStep[] {
  const powerPin = part === 'TSL2591' || part === 'TCA9548A' ? 'VIN' : 'VCC'
  return [
    wire(`${part}.${powerPin}`, 'UNO.5V', 'red', `${part} ${powerPin}을 아두이노 5V에 연결하세요.`, 0),
    wire(`${part}.GND`, 'UNO.GND', 'black', `${part} GND를 아두이노 GND에 연결하세요.`, 1),
    wire(`${part}.SDA`, 'UNO.A4', 'green', `${part} SDA를 아두이노 A4에 연결하세요.`, 2),
    wire(`${part}.SCL`, 'UNO.A5', 'yellow', `${part} SCL을 아두이노 A5에 연결하세요.`, 3),
  ]
}

function guidance(sensor: string, extraFix: string) {
  return [
    {
      symptom: '시리얼 모니터에 값이 나오지 않음',
      cause: `${sensor}의 전원, 접지 또는 신호선이 빠졌거나 시리얼 속도가 다를 수 있습니다.`,
      fix: '배선을 한 가닥씩 확인하고 시리얼 모니터를 9600 baud로 맞추세요.',
    },
    {
      symptom: '측정값이 심하게 흔들림',
      cause: '접촉 불량, 전원 잡음 또는 측정 대상의 실제 변동이 섞였을 수 있습니다.',
      fix: extraFix,
    },
  ]
}

const s1Sketch = `#include <Wire.h>
#include <MPU6050.h>
#include <math.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

MPU6050 mpu;
// @tunable samplingIntervalMs
int samplingIntervalMs = 100;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  mpu.initialize();
  Serial.println("time_ms,roll_deg,pitch_deg");
}

void loop() {
  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);
  float roll = atan2((float)ay, (float)az) * 180.0 / PI;
  float pitch = atan2(-(float)ax, sqrt((float)ay * ay + (float)az * az)) * 180.0 / PI;
  Serial.print(millis()); Serial.print(',');
  Serial.print(roll, 1); Serial.print(',');
  Serial.println(pitch, 1);
  delay(samplingIntervalMs);
}
`

const s2Sketch = `// @pin TRIG=D7
// @pin ECHO=D6
// @baud 9600

const byte TRIG_PIN = 7;
const byte ECHO_PIN = 6;
// @tunable measurementIntervalMs
int measurementIntervalMs = 200;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.println("time_ms,distance_cm");
}

void loop() {
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long durationUs = pulseIn(ECHO_PIN, HIGH, 30000);
  if (durationUs == 0) Serial.println("# out-of-range");
  else {
    float distanceCm = durationUs * 0.0343 / 2.0;
    Serial.print(millis()); Serial.print(',');
    Serial.println(distanceCm, 1);
  }
  delay(measurementIntervalMs);
}
`

const s3Sketch = `// @pin PIR=D2
// @baud 9600

const byte PIR_PIN = 2;
// @tunable holdoffMs
int holdoffMs = 250;

void setup() {
  Serial.begin(9600);
  pinMode(PIR_PIN, INPUT);
  delay(30000);
  Serial.println("time_ms,motion");
}

void loop() {
  Serial.print(millis()); Serial.print(',');
  // 숫자 0/1로 남겨야 표 계산 프로그램에서 바로 세고 그릴 수 있습니다.
  Serial.println(digitalRead(PIR_PIN) == HIGH ? 1 : 0);
  delay(holdoffMs);
}
`

const s4Sketch = `// @pin LIGHT=A0
// @baud 9600

const byte LIGHT_PIN = A0;
// @tunable samples
int samples = 10;

void setup() {
  Serial.begin(9600);
  Serial.println("time_ms,light_adc");
}

void loop() {
  long sum = 0;
  for (int i = 0; i < samples; ++i) {
    sum += analogRead(LIGHT_PIN);
    delay(5);
  }
  Serial.print(millis()); Serial.print(',');
  Serial.println(sum / samples);
  delay(200);
}
`

const s5Sketch = `#include <OneWire.h>
#include <DallasTemperature.h>

// @pin ONE_WIRE=D4
// @baud 9600

OneWire oneWire(4);
DallasTemperature sensors(&oneWire);
// @tunable conversionIntervalMs
int conversionIntervalMs = 1000;

void setup() {
  Serial.begin(9600);
  sensors.begin();
  Serial.println("time_ms,water_c");
}

void loop() {
  sensors.requestTemperatures();
  float celsius = sensors.getTempCByIndex(0);
  if (celsius == DEVICE_DISCONNECTED_C) Serial.println("# sensor-error");
  else {
    Serial.print(millis()); Serial.print(',');
    Serial.println(celsius, 2);
  }
  delay(conversionIntervalMs);
}
`

const s6Sketch = `#include <Wire.h>
#include <Adafruit_BME280.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

Adafruit_BME280 bme;
// @tunable samplingIntervalMs
int samplingIntervalMs = 1000;

void setup() {
  Serial.begin(9600);
  if (!bme.begin(0x76)) Serial.println("# BME280_ERROR");
  Serial.println("time_ms,temperature_c,humidity_pct,pressure_hpa");
}

void loop() {
  Serial.print(millis()); Serial.print(',');
  Serial.print(bme.readTemperature(), 2); Serial.print(',');
  Serial.print(bme.readHumidity(), 2); Serial.print(',');
  Serial.println(bme.readPressure() / 100.0, 2);
  delay(samplingIntervalMs);
}
`

const s7Sketch = `#include <Wire.h>
#include <Adafruit_INA219.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

Adafruit_INA219 ina219;
// @tunable samplingIntervalMs
int samplingIntervalMs = 500;

void setup() {
  Serial.begin(9600);
  if (!ina219.begin()) Serial.println("# INA219_ERROR");
  Serial.println("time_ms,voltage_v,current_ma,power_mw");
}

void loop() {
  float busV = ina219.getBusVoltage_V();
  float currentMa = ina219.getCurrent_mA();
  Serial.print(millis()); Serial.print(',');
  Serial.print(busV, 3); Serial.print(',');
  Serial.print(currentMa, 2); Serial.print(',');
  Serial.println(busV * currentMa, 2);
  delay(samplingIntervalMs);
}
`

const s8Sketch = `#include <Wire.h>
#include <Adafruit_TSL2591.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

Adafruit_TSL2591 tsl(2591);
// @tunable samplingIntervalMs
int samplingIntervalMs = 500;

void setup() {
  Serial.begin(9600);
  if (!tsl.begin()) Serial.println("# TSL2591_ERROR");
  // 신호 증폭 정도와 측정 시간은 아래 두 줄을 바꿔 조절합니다.
  // 밝은 곳: GAIN_LOW, 어두운 곳: GAIN_HIGH. lux가 -1이면 범위를 넘은 것입니다.
  tsl.setGain(TSL2591_GAIN_MED);
  tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  Serial.println("time_ms,lux");
}

void loop() {
  uint32_t lum = tsl.getFullLuminosity();
  uint16_t ir = lum >> 16;
  uint16_t full = lum & 0xffff;
  Serial.print(millis()); Serial.print(',');
  Serial.println(tsl.calculateLux(full, ir), 2);
  delay(samplingIntervalMs);
}
`

const s9Sketch = `#include <Wire.h>
#include <Adafruit_TSL2591.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

Adafruit_TSL2591 tsl(2591);
// @tunable channelDelayMs
int channelDelayMs = 120;

void selectChannel(byte channel) {
  Wire.beginTransmission(0x70);
  Wire.write(1 << channel);
  Wire.endTransmission();
}

void readChannel(byte channel) {
  selectChannel(channel);
  delay(channelDelayMs);
  uint32_t lum = tsl.getFullLuminosity();
  Serial.print(millis()); Serial.print(',');
  Serial.print(channel); Serial.print(',');
  Serial.println(lum & 0xffff);
}

void setup() {
  Serial.begin(9600);
  Wire.begin();
  // 채널마다 begin()을 불러야 두 센서의 신호 증폭 정도와 측정 시간이 같아집니다.
  // 채널 0에서만 부르면 채널 1 센서는 전원투입 기본 설정으로 남아 두 위치의
  // 값을 그대로 비교할 수 없습니다.
  for (byte channel = 0; channel < 2; ++channel) {
    selectChannel(channel);
    if (!tsl.begin()) Serial.println("# TSL2591_ERROR");
    tsl.setGain(TSL2591_GAIN_MED);
    tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  }
  Serial.println("time_ms,channel,light_raw");
}

void loop() {
  readChannel(0);
  readChannel(1);
  delay(500);
}
`

const s10Sketch = `// @pin HALL=A0
// @baud 9600

const byte HALL_PIN = A0;
// @tunable zeroLevel
int zeroLevel = 512;

void setup() {
  Serial.begin(9600);
  Serial.println("raw,polarity,relative_strength");
}

void loop() {
  int raw = analogRead(HALL_PIN);
  int signedLevel = raw - zeroLevel;
  Serial.print(raw); Serial.print(',');
  Serial.print(signedLevel >= 0 ? "positive" : "negative");
  Serial.print(','); Serial.println(abs(signedLevel));
  delay(100);
}
`

export const sensorExampleRecipes: Recipe[] = [
  example({
    id: 'S1',
    title: 'MPU6050으로 기울기와 흔들림 읽기',
    difficulty: '중급',
    minutes: 30,
    sensors: ['mpu6050'],
    coreKeywords: ['MPU6050', '가속도', '기울기', '흔들림', 'I2C'],
    wiring: i2cWiring('MPU6050'),
    sketch: s1Sketch,
    tunables: [{ anchor: 'samplingIntervalMs', name: '측정 간격', hint: '빠른 흔들림을 보려면 값을 줄이세요.' }],
    body: `## 기울기와 흔들림 읽기

정지해 있을 때 가속도계는 중력가속도의 방향을 측정하므로 roll과 pitch를 계산할 수 있습니다. 움직이는 동안에는 운동 가속도도 함께 섞이므로 값의 빠른 변화는 흔들림으로 해석합니다.

:::toggle 계산 원리와 한계
roll은 y축과 z축 가속도의 비, pitch는 x축과 나머지 두 축의 합성 가속도로 구합니다. 센서가 빠르게 움직이면 중력만 측정한다는 가정이 깨지므로 정확한 자세에는 자이로 융합이 필요합니다.
:::`,
    applicationGuide: '센서를 물체에 고정하고 정지 상태의 기울기와 흔드는 동안의 변화를 비교하세요.',
    troubleshooting: guidance('MPU6050', '센서를 단단히 고정하고 SDA/SCL 풀업과 I2C 주소 0x68 또는 0x69를 확인하세요.'),
  }),
  example({
    id: 'S2',
    title: 'HC-SR04 초음파로 거리 재기',
    difficulty: '초급',
    minutes: 25,
    sensors: ['hc-sr04'],
    coreKeywords: ['초음파', '거리', '왕복시간', 'HC-SR04'],
    wiring: [
      wire('HC-SR04.VCC', 'UNO.5V', 'red', 'VCC를 아두이노 5V에 연결하세요.', 0),
      wire('HC-SR04.GND', 'UNO.GND', 'black', 'GND를 아두이노 GND에 연결하세요.', 1),
      wire('HC-SR04.TRIG', 'UNO.D7', 'blue', 'TRIG를 디지털 7번 핀에 연결하세요.', 2),
      wire('HC-SR04.ECHO', 'UNO.D6', 'green', 'ECHO를 디지털 6번 핀에 연결하세요.', 3),
    ],
    sketch: s2Sketch,
    tunables: [{ anchor: 'measurementIntervalMs', name: '측정 간격', hint: '반사파가 겹치지 않도록 너무 짧게 줄이지 마세요.' }],
    body: `## 초음파의 왕복 시간으로 거리 구하기

센서가 짧은 초음파를 보내고 반사파가 돌아오는 시간을 잽니다. 소리가 물체까지 갔다가 돌아오므로 이동 거리를 2로 나눕니다.

:::toggle 계산과 오차
20 °C 공기에서 음속을 약 343 m/s로 두면 거리(cm)는 왕복시간(µs) × 0.0343 ÷ 2입니다. 온도, 비스듬한 표면, 천이나 작은 물체는 오차를 키웁니다.
:::`,
    applicationGuide: '자를 함께 놓고 여러 거리에서 센서값과 실제 거리를 비교해 보정식을 만들 수 있습니다.',
    troubleshooting: guidance('HC-SR04', '센서를 평평한 단단한 표면에 수직으로 향하게 하고 측정 간격을 늘리세요.'),
  }),
  example({
    id: 'S3',
    title: 'HC-SR501로 사람이 지나가면 감지하기',
    difficulty: '초급',
    minutes: 25,
    sensors: ['hc-sr501'],
    coreKeywords: ['PIR', '인체감지', '적외선', '디지털'],
    wiring: [
      wire('HC-SR501.VCC', 'UNO.5V', 'red', 'VCC를 아두이노 5V에 연결하세요.', 0),
      wire('HC-SR501.GND', 'UNO.GND', 'black', 'GND를 아두이노 GND에 연결하세요.', 1),
      wire('HC-SR501.OUT', 'UNO.D2', 'yellow', 'OUT을 디지털 2번 핀에 연결하세요.', 2),
    ],
    sketch: s3Sketch,
    tunables: [{ anchor: 'holdoffMs', name: '판독 간격', hint: '출력 유지 시간을 관찰하려면 값을 조절하세요.' }],
    body: `## 움직이는 사람 감지하기

인체 움직임 감지용 적외선(PIR) 센서는 사람 자체를 식별하지 않고, 렌즈 구역 사이에서 변하는 적외선 복사를 감지해 디지털 HIGH를 냅니다. 전원을 켠 뒤 센서가 안정화되는 시간이 필요합니다.

:::toggle 알아둘 한계
가만히 있는 사람은 놓칠 수 있고 난방기, 햇빛, 뜨거운 공기의 움직임에도 반응할 수 있습니다. 따라서 보안용 단독 판정 장치로 쓰면 안 됩니다.
:::`,
    applicationGuide: '출입구 방향과 감지 거리 조절 노브를 바꾸며 감지 영역을 지도처럼 기록하세요.',
    troubleshooting: guidance('HC-SR501', '전원을 켠 뒤 약 30초 기다리고, 햇빛과 난방기에서 센서 방향을 돌리세요.'),
  }),
  example({
    id: 'S4',
    title: 'CDS로 밝기를 아날로그로 재기',
    difficulty: '초급',
    minutes: 25,
    sensors: ['cds'],
    coreKeywords: ['CDS', '조도', '아날로그', '분압'],
    wiring: [
      wire('CDS.L1', 'UNO.5V', 'red', 'CDS의 한쪽 다리 L1을 5V에 연결하세요.', 0),
      wire('CDS.L2', 'CDS_RESISTOR.1', 'green', 'CDS의 다른 다리 L2를 10 kΩ 분압 저항 한쪽과 연결하세요.', 1),
      wire('CDS_RESISTOR.1', 'UNO.A0', 'green', 'L2와 저항이 만나는 전압 측정 지점을 A0에 연결하세요.', 2),
      wire('CDS_RESISTOR.2', 'UNO.GND', 'black', '분압 저항의 다른 쪽을 GND에 연결하세요.', 3),
    ],
    sketch: s4Sketch,
    tunables: [{ anchor: 'samples', name: '평균 표본 수', hint: '늘리면 값은 안정되지만 반응은 느려집니다.' }],
    body: `## 밝기에 따른 저항 변화 읽기

CDS의 저항은 빛에 따라 변합니다. CDS와 외부 10 kΩ 저항으로 분압 회로를 만들면 아두이노가 두 저항 사이 전압을 0~1023의 숫자(ADC 값)로 변환합니다.

:::toggle 값 해석
아날로그 전압을 숫자로 바꾼 값(ADC 값)은 회로에서 CDS가 위쪽과 아래쪽 중 어디에 있는지에 따라 밝을수록 커지거나 작아집니다. 보정하지 않은 값을 lux라고 부르면 안 됩니다.
:::`,
    applicationGuide: '같은 거리에서 종이 필터를 겹치며 아날로그 전압을 숫자로 바꾼 값의 상대 변화를 비교하세요.',
    troubleshooting: guidance('CDS', 'L2와 10 kΩ 저항이 만나는 접점을 A0에 연결했는지 확인하고 여러 값을 평균내세요.'),
  }),
  example({
    id: 'S5',
    title: 'DS18B20으로 물의 온도 재기',
    difficulty: '중급',
    minutes: 35,
    sensors: ['ds18b20'],
    coreKeywords: ['DS18B20', '수온', '1-Wire', '온도'],
    wiring: [
      wire('DS18B20.VCC', 'UNO.5V', 'red', 'VCC를 아두이노 5V에 연결하세요.', 0),
      wire('DS18B20.GND', 'UNO.GND', 'black', 'GND를 아두이노 GND에 연결하세요.', 1),
      wire('DS18B20.DATA', 'UNO.D4', 'green', 'DATA를 D4에 연결하세요.', 2),
      wire('DS18B20.DATA', 'RESISTOR_4700.1', 'green', 'DATA와 4.7 kΩ 저항의 한쪽 다리를 브레드보드의 같은 열에 꽂으세요. 이 저항이 신호선을 기본 HIGH 상태로 유지합니다.', 3),
      wire('RESISTOR_4700.2', 'UNO.5V', 'red', '4.7 kΩ 저항의 남은 다리를 5V에 연결하세요. 이 저항이 없으면 1-Wire 통신이 시작되지 않습니다.', 4),
    ],
    sketch: s5Sketch,
    tunables: [{ anchor: 'conversionIntervalMs', name: '측정 간격', hint: '기본 12비트 변환 시간보다 충분히 길게 두세요.' }],
    body: `## 방수 프로브로 수온 읽기

DS18B20은 내부에서 온도를 디지털 값으로 바꾸고 각 센서의 고유 64비트 주소로 1-Wire 버스에서 통신합니다. 금속 프로브와 물 사이의 열평형을 기다려야 합니다.

:::toggle 정확한 측정을 위해
12비트 설정의 분해능은 0.0625 °C이지만 이것이 곧 정확도는 아닙니다. 프로브별 오차, 반응 지연, 용기 벽과 손의 열을 함께 고려하세요.
:::`,
    applicationGuide: '얼음물과 실온 물에서 기준 온도계와 비교하고 프로브의 보정값을 구하세요.',
    troubleshooting: guidance('DS18B20', 'DATA-5V 사이 4.7 kΩ 풀업과 방수 프로브의 실제 선 색상 표를 확인하세요.'),
  }),
  example({
    id: 'S6',
    title: 'BME280으로 온도·습도·기압 읽기',
    difficulty: '중급',
    minutes: 35,
    sensors: ['bme280'],
    coreKeywords: ['BME280', '온도', '상대습도', '기압', 'I2C'],
    wiring: i2cWiring('BME280'),
    sketch: s6Sketch,
    tunables: [{ anchor: 'samplingIntervalMs', name: '측정 간격', hint: '환경 변화는 느리므로 보통 1초 이상이 적절합니다.' }],
    body: `## 세 가지 환경량 함께 읽기

BME280은 온도, 상대습도, 절대기압을 함께 측정합니다. 상대습도는 같은 수증기량에서도 온도에 따라 달라지고, 기압은 고도와 날씨 모두의 영향을 받습니다.

:::toggle 측정 해석
센서의 자체 발열과 손의 열을 피하고 공기가 통하게 두세요. 해면기압과 현지 절대기압은 다르므로 날씨 앱과 비교할 때 고도 보정 여부를 맞춰야 합니다.
:::`,
    applicationGuide: '실내외를 오가며 세 값의 안정화 시간과 상관관계를 기록하세요.',
    troubleshooting: guidance('BME280', 'I2C 스캐너로 모듈 주소가 0x76인지 0x77인지 확인하고 코드와 맞추세요. 전압 조정기가 없는 3.3 V 전용 모듈은 5 V에 연결하면 손상되므로 3.3 V 핀에 연결하세요.'),
  }),
  example({
    id: 'S7',
    title: 'INA219로 전압·전류·전력 측정하기',
    difficulty: '중급',
    minutes: 40,
    sensors: ['ina219'],
    coreKeywords: ['INA219', '전압', '전류', '전력', '전류 측정용 저항'],
    wiring: [
      ...i2cWiring('INA219'),
      wire('INA219.VIN+', 'UNO.5V', 'red', '측정 전원의 양극을 INA219 VIN+에 연결하세요.', 4),
      wire('INA219.VIN-', 'LOAD.POSITIVE', 'orange', 'INA219 VIN-를 측정 부하의 양극에 연결하세요.', 5),
      wire('LOAD.NEGATIVE', 'UNO.GND', 'black', '부하 음극을 공통 GND에 연결해 직렬 경로를 완성하세요.', 6),
    ],
    sketch: s7Sketch,
    tunables: [{ anchor: 'samplingIntervalMs', name: '측정 간격', hint: '부하 변화 속도에 맞춰 조절하세요.' }],
    body: `## 부하의 전력 측정하기

INA219는 전류 측정용 작은 저항(션트 저항) 양단의 전압 차로 전류를 구하고 회로 쪽 전압도 측정합니다. 전력은 같은 순간의 전압과 전류를 곱해 계산합니다.

:::callout warn
부하는 VIN+와 VIN- 사이에 직렬로 연결해야 합니다. 센서 입력에 허용되는 전체 전압 범위와 전류 측정 경로의 정격 전류를 넘기지 마세요. LED를 부하로 쓸 때는 반드시 220 Ω 저항을 직렬로 연결하세요. 저항 없이 5 V에 직접 연결하면 LED가 타 버립니다.
:::

:::toggle 단위 확인
코드의 전압은 V, 전류는 mA이므로 둘을 곱하면 mW가 됩니다. 에너지를 구하려면 전력을 시간에 대해 누적해야 합니다.
:::`,
    applicationGuide: '저항이나 LED 부하를 바꾸며 부품을 지날 때 생기는 전압 차이, 전류, 전력의 관계를 비교하세요.',
    troubleshooting: guidance('INA219', 'VIN+/VIN-의 부하 경로와 기본 주소 0x40을 확인하고 모든 장치의 GND를 공유하세요.'),
  }),
  example({
    id: 'S8',
    title: 'TSL2591로 밝기를 정밀하게 재기',
    difficulty: '중급',
    minutes: 35,
    sensors: ['tsl2591'],
    coreKeywords: ['TSL2591', 'lux', '조도', '적외선', 'I2C'],
    wiring: i2cWiring('TSL2591'),
    sketch: s8Sketch,
    tunables: [{ anchor: 'samplingIntervalMs', name: '측정 간격', hint: '빛을 모아 측정하는 시간보다 길게 유지하세요.' }],
    body: `## 넓은 범위의 조도 측정하기

TSL2591은 전체광 채널과 적외선 채널을 함께 읽어 사람 눈의 감도에 가까운 lux를 계산합니다. 신호 증폭 정도와 빛을 모아 측정하는 시간은 어두운 곳의 분해능과 밝은 곳에서 측정 범위를 넘어 값이 최댓값에 머무는 현상 사이를 조절합니다.

:::toggle 측정 범위 초과와 보정
센서가 읽은 가공 전 채널값이 측정 범위를 넘어 최댓값에 머물면 lux 계산은 유효하지 않습니다. 광원의 스펙트럼, 입사각, 센서 덮개에 따라 표준 조도계와 차이가 생길 수 있습니다.
:::`,
    applicationGuide: '같은 광원을 거리별로 측정하고 값이 최댓값에 머물지 않는 신호 증폭 정도와 측정 시간을 찾으세요.',
    troubleshooting: guidance('TSL2591', '강한 빛에서는 신호 증폭 정도나 빛을 모아 측정하는 시간을 낮추고 고정 주소 0x29가 응답하는지 확인하세요.'),
  }),
  example({
    id: 'S9',
    title: 'TCA9548A로 주소가 같은 TSL2591 두 개 연결하기',
    difficulty: '고급',
    minutes: 50,
    sensors: ['tca9548a', 'tsl2591'],
    coreKeywords: ['TCA9548A', 'TSL2591', 'I2C', '주소충돌', '채널 선택 장치'],
    wiring: [
      ...i2cWiring('TCA9548A'),
      wire('TSL2591_1.VIN', 'TCA9548A.VIN', 'red', '첫 번째 TSL2591에 공통 전원을 연결하세요.', 4),
      wire('TSL2591_1.GND', 'TCA9548A.GND', 'black', '첫 번째 TSL2591에 공통 접지를 연결하세요.', 5),
      wire('TSL2591_1.SDA', 'TCA9548A.SD0', 'green', '첫 번째 센서 SDA를 채널 0의 SD0에 연결하세요.', 6),
      wire('TSL2591_1.SCL', 'TCA9548A.SC0', 'yellow', '첫 번째 센서 SCL을 채널 0의 SC0에 연결하세요.', 7),
      wire('TSL2591_2.VIN', 'TCA9548A.VIN', 'red', '두 번째 TSL2591에 공통 전원을 연결하세요.', 8),
      wire('TSL2591_2.GND', 'TCA9548A.GND', 'black', '두 번째 TSL2591에 공통 접지를 연결하세요.', 9),
      wire('TSL2591_2.SDA', 'TCA9548A.SD1', 'green', '두 번째 센서 SDA를 채널 1의 SD1에 연결하세요.', 10),
      wire('TSL2591_2.SCL', 'TCA9548A.SC1', 'yellow', '두 번째 센서 SCL을 채널 1의 SC1에 연결하세요.', 11),
    ],
    sketch: s9Sketch,
    tunables: [{ anchor: 'channelDelayMs', name: '채널 전환 대기', hint: '적분이 끝날 시간을 확보하도록 조절하세요.' }],
    body: `## 고정 주소 센서를 채널로 분리하기

TSL2591 두 개는 모두 고정 주소 0x29를 사용하므로 같은 I2C 버스에 직접 병렬 연결하면 동시에 응답합니다. TCA9548A는 한 번에 선택한 하위 채널만 상위 버스에 연결해 충돌을 막습니다.

:::callout warn
이 조합은 현재 Wokwi 시뮬레이션 미지원입니다. 실물에서 채널별 응답과 풀업 전압을 확인하세요.
:::

:::toggle 채널 전환 원리
주소 0x70에 한 바이트를 쓰며 각 비트가 채널 0~7을 켭니다. 한 채널만 쓸 때 1을 채널 번호만큼 왼쪽으로 이동한 값을 보냅니다.
:::`,
    applicationGuide: '센서를 서로 다른 위치에 놓고 채널별 조도를 번갈아 읽어 공간 분포를 비교하세요.',
    troubleshooting: [
      { symptom: '두 채널 값이 같거나 한 센서만 응답함', cause: '두 센서가 같은 채널에 연결되었거나 채널 선택 바이트가 틀렸을 수 있습니다.', fix: 'SDA/SCL을 각각 SD0/SC0, SD1/SC1에 연결하고 1 << channel 값을 확인하세요.' },
      { symptom: 'I2C 장치가 불규칙하게 사라짐', cause: '신호선을 기본 HIGH 상태로 유지하는 저항이 없거나 너무 많이 겹쳐 있고, 배선이 길거나 전원 접촉이 불량할 수 있습니다.', fix: '공통 GND와 전압을 확인하고 배선을 짧게 하며 신호선을 HIGH 상태로 유지하는 전체 저항값을 점검하세요.' },
    ],
  }),
  example({
    id: 'S10',
    title: 'HBE0704로 자기장 세기와 극성 읽기',
    difficulty: '중급',
    minutes: 35,
    sensors: ['hbe0704'],
    coreKeywords: ['HBE0704', '홀효과', '자기장', '극성', '아날로그'],
    wiring: [
      wire('HBE0704.VCC', 'UNO.5V', 'red', '모듈 사양을 확인한 뒤 VCC를 5V에 연결하세요.', 0),
      wire('HBE0704.GND', 'UNO.GND', 'black', 'GND를 아두이노 GND에 연결하세요.', 1),
      wire('HBE0704.OUT', 'UNO.A0', 'green', '아날로그 출력 OUT을 A0에 연결하세요.', 2),
    ],
    sketch: s10Sketch,
    tunables: [{ anchor: 'zeroLevel', name: '영점 ADC 값', hint: '자석이 멀리 있을 때 아날로그 전압을 숫자로 바꾼 값의 평균으로 바꾸세요.' }],
    body: `## 홀 센서로 상대 자기장 읽기

선형 홀 센서는 자기장 방향에 따라 영점 전압보다 높거나 낮은 전압을 냅니다. 자석이 없을 때 아날로그 전압을 숫자로 바꾼 값(ADC 값)의 평균을 영점으로 삼아 부호로 극성 방향을, 절댓값으로 상대 세기를 표시합니다.

:::callout warn
Wokwi에서는 가변저항이 아날로그 입력만 대신합니다. 핀 라벨과 물리적 자기장 반응은 실제 HBE0704와 다릅니다.
:::

:::toggle 물리량으로 보정하기
아날로그 전압을 숫자로 바꾼 값의 차이를 테슬라로 바꾸려면 해당 모듈 데이터시트의 감도와 실제 공급전압, 기준 자석 또는 교정 장비가 필요합니다. 이 예제의 relative_strength는 자기장 단위가 아닙니다.
:::`,
    applicationGuide: '자석의 N극과 S극을 번갈아 가까이 대고 부호와 거리별 상대 세기를 기록하세요.',
    troubleshooting: guidance('HBE0704', '자석을 멀리 둔 상태에서 여러 번 평균내 영점을 다시 정하고 센서 방향을 고정하세요.'),
  }),
]

export const [
  s1Mpu6050Recipe,
  s2HcSr04Recipe,
  s3HcSr501Recipe,
  s4CdsRecipe,
  s5Ds18b20Recipe,
  s6Bme280Recipe,
  s7Ina219Recipe,
  s8Tsl2591Recipe,
  s9MultiTsl2591Recipe,
  s10Hbe0704Recipe,
] = sensorExampleRecipes
