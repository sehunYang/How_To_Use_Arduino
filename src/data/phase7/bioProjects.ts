import type { Recipe } from '@/schema'
import {
  bme280,
  cdsDivider,
  ds18b20Bus,
  led,
  mpu6050,
  tsl2591,
  ultrasonic,
} from './connections'
import {
  contactTroubleshooting,
  createPhase7Recipe,
  i2cTroubleshooting,
  type Connection,
} from './shared'

/**
 * B 묶음 — 생물 8건.
 *
 * 78건 가운데 생물은 4건뿐이었습니다. 물리 49건에 견주면 학생이 고를 것이
 * 거의 없었고, 있는 4건도 식물 재배 기록에 몰려 있었습니다. 여기서는
 * **살아 있는 것이 하는 일을 숫자로 남기는** 쪽을 여덟 가지로 넓힙니다.
 *
 * 생물 탐구는 대상이 스스로 변하므로 되풀이해도 같은 값이 나오지 않습니다.
 * 그래서 여덟 건 모두 "한 번 재고 끝"이 아니라 **반복과 대조군**을 설계에
 * 넣었고, 살아 있는 대상을 다루는 레시피에는 되돌려 보내는 절차를 적었습니다.
 */

const yeastSketch = `#include <Wire.h>
#include <Adafruit_BME280.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// @pin SDA=A4
// @pin SCL=A5
// @pin ONE_WIRE=D4
// @baud 9600

Adafruit_BME280 bme;
OneWire oneWire(4);
DallasTemperature probe(&oneWire);
// 표본 간격입니다. 발효는 분 단위로 진행하므로 촘촘히 잴 필요가 없습니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 2000;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  if (!bme.begin(0x76)) Serial.println("# BME280_ERROR");
  probe.begin();
  Serial.println("time_ms,water_c,pressure_hpa");
}

void loop() {
  probe.requestTemperatures();
  Serial.print(millis()); Serial.print(',');
  Serial.print(probe.getTempCByIndex(0), 2); Serial.print(',');
  // 기압계는 용기 안 공기의 압력을 잽니다. 효모가 내놓은 이산화탄소가
  // 쌓이면 이 값이 오릅니다.
  Serial.println(bme.readPressure() / 100.0, 2);
  delay(samplingIntervalMs);
}
`

const transpirationSketch = `#include <Wire.h>
#include <Adafruit_BME280.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

Adafruit_BME280 bme;
// 표본 간격입니다. 습도는 천천히 오르므로 길게 잡아도 모양을 놓치지 않습니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 5000;

void setup() {
  Serial.begin(9600);
  if (!bme.begin(0x76)) Serial.println("# BME280_ERROR");
  Serial.println("time_ms,temperature_c,humidity_pct");
}

void loop() {
  // 온도를 함께 남깁니다. 같은 수증기량이라도 온도가 오르면 상대습도는
  // 내려가므로, 온도 없이 습도만 보면 증산이 멈춘 것처럼 읽힙니다.
  Serial.print(millis()); Serial.print(',');
  Serial.print(bme.readTemperature(), 2); Serial.print(',');
  Serial.println(bme.readHumidity(), 2);
  delay(samplingIntervalMs);
}
`

const photosynthesisSketch = `#include <Wire.h>
#include <Adafruit_BME280.h>
#include <Adafruit_TSL2591.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

Adafruit_BME280 bme;
Adafruit_TSL2591 tsl(2591);
// 표본 간격입니다. 한 조건을 10분 이상 기록해야 기울기가 보입니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 5000;

void setup() {
  Serial.begin(9600);
  if (!bme.begin(0x76)) Serial.println("# BME280_ERROR");
  if (!tsl.begin()) Serial.println("# TSL2591_ERROR");
  tsl.setGain(TSL2591_GAIN_LOW);
  tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  Serial.println("time_ms,lux,pressure_hpa,temperature_c");
}

void loop() {
  uint32_t lum = tsl.getFullLuminosity();
  uint16_t ir = lum >> 16, full = lum & 0xffff;
  Serial.print(millis()); Serial.print(',');
  Serial.print(tsl.calculateLux(full, ir), 2); Serial.print(',');
  Serial.print(bme.readPressure() / 100.0, 2); Serial.print(',');
  // 압력은 온도만 올라도 오릅니다. 기체가 늘어난 것과 구분하려면
  // 용기 안 온도를 반드시 함께 남겨야 합니다.
  Serial.println(bme.readTemperature(), 2);
  delay(samplingIntervalMs);
}
`

const reactionSketch = `// @pin LED=D9
// @pin TRIG=D7
// @pin ECHO=D6
// @baud 9600

const byte LED_PIN = 9, TRIG_PIN = 7, ECHO_PIN = 6;
// 손이 들어왔다고 판정할 거리입니다. 센서와 손을 놓는 자리에 맞춰 정하세요.
// @tunable triggerCm
int triggerCm = 15;

long readCm() {
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000);
  return us == 0 ? -1 : (long)(us / 58);
}

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  pinMode(TRIG_PIN, OUTPUT); pinMode(ECHO_PIN, INPUT);
  // 꽂지 않은 아날로그 핀의 흔들리는 값을 씨앗으로 삼아 매번 다른 순서를 만듭니다.
  randomSeed(analogRead(A3));
  Serial.println("time_ms,reaction_ms,distance_cm");
}

void loop() {
  digitalWrite(LED_PIN, LOW);
  // 기다리는 시간이 일정하면 학생은 불빛이 아니라 박자를 보고 손을 냅니다.
  delay(random(2000, 6000));
  digitalWrite(LED_PIN, HIGH);
  unsigned long litAt = millis();

  long cm = -1;
  while (millis() - litAt < 3000) {
    cm = readCm();
    if (cm > 0 && cm < triggerCm) break;
  }
  digitalWrite(LED_PIN, LOW);

  Serial.print(litAt); Serial.print(',');
  Serial.print(millis() - litAt); Serial.print(',');
  Serial.println(cm);
  delay(1000);
}
`

const stepSketch = `#include <Wire.h>
#include <MPU6050.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 115200

MPU6050 imu;
// 표본 간격입니다. 걸음 하나가 0.5초쯤이므로 이보다 훨씬 촘촘해야 합니다.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 20;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  imu.initialize();
  Serial.println("time_ms,g_norm");
}

void loop() {
  static unsigned long last = 0;
  if (millis() - last < samplingIntervalMs) return;
  last = millis();

  int16_t ax, ay, az;
  imu.getAcceleration(&ax, &ay, &az);
  float gx = ax / 16384.0, gy = ay / 16384.0, gz = az / 16384.0;
  // 걸음 수를 스케치에서 세지 않습니다. 문턱값을 잘못 잡으면 다시 걸어야
  // 하지만, 원시 파형을 남겨 두면 문턱값만 바꿔 다시 셀 수 있습니다.
  Serial.print(last); Serial.print(',');
  Serial.println(sqrt(gx * gx + gy * gy + gz * gz), 4);
}
`

const skinSketch = `#include <Wire.h>
#include <MPU6050.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// @pin SDA=A4
// @pin SCL=A5
// @pin ONE_WIRE=D4
// @baud 9600

MPU6050 imu;
OneWire oneWire(4);
DallasTemperature probe(&oneWire);
// 표본 간격입니다. 회복은 몇 분에 걸쳐 일어나므로 1초면 충분합니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 1000;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  imu.initialize();
  probe.begin();
  Serial.println("time_ms,skin_c,dynamic_g");
}

void loop() {
  probe.requestTemperatures();
  int16_t ax, ay, az;
  imu.getAcceleration(&ax, &ay, &az);
  float gx = ax / 16384.0, gy = ay / 16384.0, gz = az / 16384.0;
  // 정지해 있어도 중력 1 g가 잡힙니다. 그 몫을 빼야 움직임만 남습니다.
  float dynamic = sqrt(gx * gx + gy * gy + gz * gz) - 1.0;

  Serial.print(millis()); Serial.print(',');
  Serial.print(probe.getTempCByIndex(0), 2); Serial.print(',');
  Serial.println(dynamic, 4);
  delay(samplingIntervalMs);
}
`

const phototaxisSketch = `// @pin LEFT_CDS=A0
// @pin RIGHT_CDS=A1
// @baud 9600

// 표본 간격입니다. 관찰 기록과 맞추기 쉽도록 1초에서 시작합니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 1000;

void setup() {
  Serial.begin(9600);
  Serial.println("time_ms,left_adc,right_adc,error");
}

void loop() {
  int left = analogRead(A0);
  int right = analogRead(A1);
  // 두 값의 차이가 상자 안 밝기 기울기입니다. 절댓값이 아니라 차이로 보면
  // 두 CDS 개체의 성능 차이가 어느 정도 상쇄됩니다.
  Serial.print(millis()); Serial.print(',');
  Serial.print(left); Serial.print(',');
  Serial.print(right); Serial.print(',');
  Serial.println(left - right);
  delay(samplingIntervalMs);
}
`

const germinationSketch = `#include <OneWire.h>
#include <DallasTemperature.h>

// @pin ONE_WIRE=D4
// @baud 9600

OneWire oneWire(4);
DallasTemperature probe(&oneWire);
// 표본 간격입니다. 며칠을 기록하므로 1분에 한 번이면 넉넉합니다.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 60000;

void setup() {
  Serial.begin(9600);
  probe.begin();
  Serial.println("time_ms,temperature_c");
}

void loop() {
  probe.requestTemperatures();
  // 적산온도는 여기서 더하지 않습니다. 기준 온도를 몇 도로 잡을지는
  // 씨앗마다 다르고, 원시 기록만 있으면 나중에 몇 번이든 다시 더할 수 있습니다.
  Serial.print(millis()); Serial.print(',');
  Serial.println(probe.getTempCByIndex(0), 2);
  delay(samplingIntervalMs);
}
`

const yeastConnections: Connection[] = [...bme280(), ...ds18b20Bus(['DS18B20'], 'D4')]
const photosynthesisConnections: Connection[] = [...tsl2591(), ...bme280()]
const reactionConnections: Connection[] = [...led('D9'), ...ultrasonic('D7', 'D6')]
const skinConnections: Connection[] = [...mpu6050(), ...ds18b20Bus(['DS18B20'], 'D4')]
const phototaxisConnections: Connection[] = [
  ...cdsDivider('CDS_1', 'CDS_RESISTOR_1', 'A0', '왼쪽'),
  ...cdsDivider('CDS_2', 'CDS_RESISTOR_2', 'A1', '오른쪽'),
]

export const phase7BioProjects: Recipe[] = [
  createPhase7Recipe({
    id: 'b1-yeast-fermentation',
    title: '효모 발효 속도와 온도',
    subject: '생물',
    type: 'project',
    difficulty: '중급',
    minutes: 60,
    sensors: ['bme280', 'ds18b20'],
    coreKeywords: ['효모', '발효', '이산화탄소', '온도', '기압'],
    connections: yeastConnections,
    sketch: yeastSketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '발효는 분 단위로 진행합니다. 2000 ms에서 시작하세요.' },
    overview: '설탕물에 푼 효모를 밀폐 용기에 넣고, 효모가 내놓은 이산화탄소로 용기 안 압력이 오르는 속도를 물의 온도별로 비교합니다.',
    procedure: '용기를 밀폐한 뒤 10분 동안 압력을 기록하고, 물중탕의 온도를 바꿔 같은 시간만큼 다시 기록하세요. 매 조건마다 효모와 설탕의 양을 저울로 같게 맞추세요.',
    science: '효모는 산소가 적은 곳에서 당을 분해해 에탄올과 이산화탄소를 내놓습니다. 밀폐 용기에서는 그 기체가 빠져나가지 못해 압력이 오르므로, 압력이 오르는 기울기가 발효 속도의 대리 지표가 됩니다. 다만 물이 데워지기만 해도 공기가 팽창해 압력이 오르므로, 효모를 넣지 않은 대조군을 반드시 함께 재야 두 원인을 나눌 수 있습니다.',
    safety: '유리병처럼 깨질 수 있는 용기를 밀폐하지 마세요. 압력이 오르면 위험합니다. 뚜껑이 헐거운 플라스틱 용기를 쓰고, 실험이 끝나면 천천히 열어 압력을 빼세요.',
    applicationGuide: '온도별로 압력-시간 그래프의 기울기를 구해 온도에 대해 다시 그리면, 발효가 가장 빠른 온도 구간을 찾을 수 있습니다. 60 °C 부근에서 기울기가 급히 꺾이는지도 확인해 보세요.',
    troubleshooting: [
      { symptom: '압력이 전혀 오르지 않음', cause: '용기가 새거나 효모가 활성을 잃었습니다.', fix: '뚜껑 둘레에 비눗물을 발라 새는 곳을 찾고, 효모를 미지근한 설탕물에 10분 먼저 풀어 거품이 이는지 확인하세요.' },
      { symptom: '효모를 넣지 않았는데도 압력이 오름', cause: '물중탕의 열로 용기 안 공기가 팽창한 것입니다.', fix: '오류가 아니라 배경 신호입니다. 대조군의 기울기를 각 조건의 기울기에서 빼세요.' },
      i2cTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'b2-leaf-transpiration',
    title: '잎의 증산 작용과 봉지 안 습도',
    subject: '생물',
    type: 'project',
    difficulty: '초급',
    minutes: 45,
    sensors: ['bme280'],
    coreKeywords: ['증산', '기공', '습도', '시간에 따른 변화', '잎'],
    connections: bme280(),
    sketch: transpirationSketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '습도는 천천히 오릅니다. 5000 ms에서 시작하세요.' },
    overview: '잎이 달린 가지에 비닐봉지를 씌우고 그 안의 습도가 시간에 따른 변화로 어떻게 오르는지 기록해, 잎이 실제로 물을 내보내는지 확인합니다.',
    procedure: '봉지 입구를 줄기에 느슨하게 묶고 센서를 봉지 안에 매달아 잎에 닿지 않게 하세요. 20분간 기록한 뒤 잎을 모두 떼어 낸 가지에 같은 봉지를 씌우고 다시 20분을 기록하세요.',
    science: '뿌리가 빨아올린 물은 잎 뒷면의 기공을 통해 수증기로 빠져나갑니다. 이것을 증산이라 합니다. 봉지 안은 좁고 닫혀 있어 빠져나온 수증기가 쌓이므로 상대습도가 오릅니다. 상대습도는 같은 수증기량이라도 온도가 오르면 내려가므로, 온도를 함께 기록해 두 원인을 구분해야 합니다.',
    safety: '봉지를 줄기에 너무 세게 묶으면 물관이 눌려 실험 자체가 달라집니다. 느슨하게 묶으세요.',
    applicationGuide: '잎이 있을 때와 없을 때의 습도 상승 기울기를 견주면 그 차이가 잎이 내보낸 몫입니다. 잎의 넓이를 모눈종이로 재어 넓이당 기울기로 바꾸면 크기가 다른 식물끼리도 비교할 수 있습니다.',
    troubleshooting: [
      { symptom: '습도가 100 %에서 더 오르지 않음', cause: '봉지 안이 이미 포화되어 측정 범위의 위쪽에 닿았습니다.', fix: '더 큰 봉지를 쓰거나 기록 시간을 줄여 포화 전 구간의 기울기를 쓰세요.' },
      { symptom: '잎을 뗀 가지에서도 습도가 오름', cause: '자른 단면이나 흙에서 물이 증발한 것입니다.', fix: '자른 단면을 테이프로 막고 화분 흙 위를 비닐로 덮은 뒤 다시 재세요.' },
      i2cTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'b3-photosynthesis-pressure',
    title: '물풀의 광합성과 밀폐 용기 압력',
    subject: '생물',
    type: 'project',
    difficulty: '고급',
    minutes: 70,
    sensors: ['bme280', 'tsl2591'],
    coreKeywords: ['광합성', '빛의 세기', '기체 발생', '압력', '대조군'],
    connections: photosynthesisConnections,
    sketch: photosynthesisSketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '한 조건을 10분 이상 기록해야 기울기가 보입니다. 5000 ms에서 시작하세요.' },
    overview: '밀폐한 용기에 물풀을 넣고 빛의 세기를 단계별로 바꾸면서, 용기 안 압력이 오르는 속도와 그때의 조도를 함께 기록합니다.',
    procedure: '한 조건마다 10분씩 기록하고, 조건을 바꾸기 전 용기 뚜껑을 열어 공기를 갈아 주세요. 물풀을 넣지 않은 용기로 같은 조건을 한 번 더 기록해 대조군으로 삼으세요.',
    science: '광합성은 빛 에너지로 이산화탄소와 물에서 양분과 산소를 만듭니다. 밀폐 용기에서는 그 산소가 빠져나가지 못해 압력이 오릅니다. 빛이 약할수록 광합성 속도가 빛의 세기에 거의 비례하지만, 어느 세기를 넘으면 이산화탄소 공급이 한계가 되어 더 밝게 해도 속도가 늘지 않습니다. 압력은 온도만 올라도 오르므로 램프의 열을 대조군으로 반드시 나눠 내야 합니다.',
    safety: '램프는 뜨겁습니다. 용기와 램프 사이에 물통을 두어 열을 걸러 내고, 램프에 물이 튀지 않게 하세요.',
    applicationGuide: '조도를 가로축, 압력 상승 기울기를 세로축으로 그리면 처음에는 직선으로 오르다가 어느 세기부터 평평해지는 곡선이 나옵니다. 평평해지기 시작하는 조도가 그 물풀의 빛 포화점입니다.',
    troubleshooting: [
      { symptom: '밝게 해도 압력 기울기가 늘지 않음', cause: '빛 포화점을 넘었거나 물에 녹은 이산화탄소가 바닥났습니다.', fix: '탄산수를 몇 방울 떨어뜨려 이산화탄소를 보충한 뒤 같은 조건을 다시 재어 두 원인을 구분하세요.' },
      { symptom: '어두운 조건에서 압력이 오히려 내려감', cause: '오류가 아닙니다. 빛이 없으면 물풀도 호흡만 하여 산소를 씁니다.', fix: '그 기울기를 호흡 몫으로 적어 두고 광합성 기울기에 더해 총광합성량을 구하세요.' },
      i2cTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'b4-reaction-time',
    title: '사람의 반응 시간 측정',
    subject: '생물',
    type: 'project',
    difficulty: '초급',
    minutes: 40,
    sensors: ['hc-sr04'],
    actuators: ['led'],
    coreKeywords: ['반응 시간', '자극과 반응', '발생 시점', '신경', '반복 측정'],
    connections: reactionConnections,
    sketch: reactionSketch,
    tunable: { anchor: 'triggerCm', name: '손 감지 거리 (cm)', hint: '손을 놓는 자리와 센서 사이 거리보다 조금 짧게 잡으세요. 15 cm에서 시작합니다.' },
    overview: 'LED가 켜진 순간부터 손이 초음파 센서 앞을 가릴 때까지 걸린 시간을 아두이노가 직접 재어, 사람의 반응 시간을 밀리초 단위로 기록합니다.',
    procedure: '손을 센서에서 30 cm 떨어진 출발 자리에 두고 LED가 켜지면 곧바로 센서 앞으로 옮기세요. 한 사람이 15회를 이어서 하고, 그다음 사람으로 바꾸세요.',
    science: '빛이 눈에 들어와 뇌가 판단하고 근육이 움직이기까지는 여러 단계를 거치므로 시간이 걸립니다. 이 값은 사람마다 다르고 같은 사람도 시행마다 흔들립니다. 그래서 한 번의 값이 아니라 여러 번의 분포를 봐야 하며, 기다리는 시간을 일정하게 두면 학생이 박자를 외워 실제보다 짧은 값이 나옵니다.',
    safety: '손을 급히 움직이다 책상 모서리나 센서에 부딪히지 않도록 앞을 비워 두세요.',
    applicationGuide: '15회의 값을 히스토그램으로 그려 중앙값과 퍼진 정도를 구하고, 시각 자극 대신 소리 자극으로 바꾸면 값이 어떻게 달라지는지 비교해 보세요.',
    troubleshooting: [
      { symptom: '반응 시간이 3000 ms로만 기록됨', cause: '정해 둔 시간 안에 손이 감지되지 않아 기다림이 끝난 것입니다.', fix: '감지 거리를 늘리거나 손을 센서 정면 가까이에서 출발시키세요.' },
      { symptom: '값이 100 ms보다 짧게 나옴', cause: '사람이 도달할 수 없는 값입니다. 손이 이미 감지 범위 안에 있었습니다.', fix: '출발 자리를 감지 거리보다 확실히 멀리 잡고 그 시행은 버리세요.' },
      contactTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'b5-step-counter',
    title: '걸음 수 세기 (만보계 만들기)',
    subject: '생물',
    type: 'project',
    difficulty: '중급',
    minutes: 50,
    sensors: ['mpu6050'],
    coreKeywords: ['걸음', '가속도', '문턱값', '주기', '운동'],
    connections: mpu6050(),
    sketch: stepSketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '걸음 하나가 0.5초쯤입니다. 20 ms보다 크게 두면 봉우리를 놓칩니다.' },
    overview: '허리에 고정한 가속도 센서로 걷는 동안의 흔들림을 통째로 기록하고, 저장한 파형에서 걸음 수를 세어 실제로 센 걸음 수와 맞춰 봅니다.',
    procedure: '정해진 걸음 수만큼 세면서 걷고, 실제로 센 걸음 수를 노트에 적으세요. 같은 사람이 천천히 걷기, 보통 걷기, 빨리 걷기를 각각 30걸음씩 하세요.',
    science: '걸을 때마다 몸이 위아래로 흔들려 가속도 크기에 봉우리가 하나씩 생깁니다. 그러나 팔을 흔들거나 몸을 돌려도 봉우리가 생기므로, 문턱값을 낮게 잡으면 걷지 않아도 걸음이 세어집니다. 그래서 문턱값과 함께 "직전 봉우리로부터 얼마 이상 지나야 다음 걸음으로 센다"는 최소 간격을 함께 둡니다.',
    applicationGuide: '문턱값과 최소 간격을 바꿔 가며 세어 본 걸음 수를 실제 걸음 수와 견주고, 두 값이 가장 잘 맞는 조합을 찾으세요. 그 조합이 다른 사람에게도 맞는지 확인해 보세요.',
    troubleshooting: [
      { symptom: '센 걸음 수가 실제보다 훨씬 많음', cause: '문턱값이 낮아 팔 흔들림까지 걸음으로 셌습니다.', fix: '문턱값을 올리고 봉우리 사이 최소 간격을 0.3초 이상으로 두세요.' },
      { symptom: '빨리 걸을 때만 걸음을 놓침', cause: '표본 간격이 길어 봉우리 사이가 몇 점밖에 없습니다.', fix: '표본 간격을 10 ms로 줄여 다시 기록하세요.' },
      i2cTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'b6-skin-temperature-recovery',
    title: '운동 후 피부 온도 회복',
    subject: '생물',
    type: 'project',
    difficulty: '중급',
    minutes: 50,
    sensors: ['ds18b20', 'mpu6050'],
    coreKeywords: ['체온', '항상성', '회복', '시간에 따른 변화', '운동'],
    connections: skinConnections,
    sketch: skinSketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '회복은 몇 분에 걸쳐 일어납니다. 1000 ms면 충분합니다.' },
    overview: '팔에 붙인 온도 프로브로 운동 전후의 피부 온도를 시간에 따른 변화로 이어 기록하고, 함께 붙인 가속도 센서로 언제 움직였는지도 같은 표에 남깁니다.',
    procedure: '프로브를 팔 안쪽에 반창고로 붙이고 2분간 안정 상태를 기록한 뒤 제자리 뛰기를 1분 하세요. 그다음 10분 동안 가만히 앉아 온도가 돌아오는 과정을 이어서 기록하세요.',
    science: '몸은 체온을 일정하게 지키려 합니다. 운동으로 열이 나면 피부 혈관을 넓혀 열을 밖으로 버리므로 피부 온도가 오르고, 운동을 멈추면 천천히 원래대로 돌아옵니다. 프로브가 재는 것은 몸속 온도가 아니라 피부와 프로브가 이룬 평형 온도이므로, 붙인 자리와 옷차림이 달라지면 값이 통째로 달라집니다.',
    safety: '몸이 불편하면 즉시 멈추세요. 프로브를 붙인 반창고는 피부에 자극이 적은 것으로 고르세요.',
    applicationGuide: '멈춘 시각 이후의 온도에서 안정 상태 온도를 뺀 값에 자연로그를 취해 시간에 대해 그리면 직선에 가까워집니다. 그 기울기로 사람마다 회복 속도를 비교해 보세요.',
    troubleshooting: [
      { symptom: '운동 중에 온도가 오히려 내려감', cause: '땀이 증발하면서 열을 가져간 것입니다.', fix: '오류가 아닙니다. 땀을 닦은 시각을 관찰 메모로 남기고 그 구간을 따로 표시해 해석하세요.' },
      { symptom: '온도가 계단처럼 뚝뚝 끊겨 기록됨', cause: '프로브의 기본 분해능이 0.5 °C로 설정되어 있습니다.', fix: '라이브러리에서 분해능을 12비트로 올려 0.0625 °C 단위로 읽으세요.' },
      contactTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'b7-woodlouse-phototaxis',
    title: '쥐며느리의 주광성 (밝기 구배 상자)',
    subject: '생물',
    type: 'project',
    difficulty: '중급',
    minutes: 55,
    sensors: ['cds'],
    coreKeywords: ['주광성', '자극과 반응', '밝기 구배', '행동', '대조군'],
    connections: phototaxisConnections,
    sketch: phototaxisSketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '관찰 기록과 맞추기 쉽도록 1000 ms에서 시작하세요.' },
    overview: '한쪽은 밝고 한쪽은 어두운 상자를 만들고, 양 끝에 둔 두 CDS로 실제 밝기 차이를 재면서 쥐며느리가 어느 쪽에 머무는지 시각과 함께 기록합니다.',
    procedure: '쥐며느리 열 마리를 상자 가운데에 놓고 5분마다 어느 쪽 절반에 몇 마리가 있는지 세어 적으세요. 한 번의 시행이 끝나면 상자의 밝은 쪽과 어두운 쪽을 서로 바꿔 같은 시행을 반복하세요.',
    science: '빛 자극에 대해 방향을 정해 움직이는 성질을 주광성이라 합니다. 쥐며느리는 마른 곳을 피하는 성질도 함께 가지고 있어, 밝은 쪽이 조금이라도 건조하면 빛이 아니라 습도 때문에 어두운 쪽으로 몰릴 수 있습니다. 상자를 좌우로 바꿔 같은 결과가 나오는지 보는 것이 이 혼동을 걸러 내는 방법입니다.',
    safety: '살아 있는 동물입니다. 램프를 상자에 가까이 대어 온도를 올리지 말고, 관찰이 끝나면 잡았던 자리에 그대로 놓아 주세요.',
    applicationGuide: '좌우를 바꾼 두 시행에서 어두운 쪽에 머문 비율이 모두 높으면 빛에 대한 반응으로 볼 수 있습니다. 두 CDS 값의 차이를 가로축으로 두면 밝기 차이가 클수록 쏠림이 커지는지도 볼 수 있습니다.',
    troubleshooting: [
      { symptom: '두 CDS 값이 처음부터 크게 다름', cause: 'CDS 개체마다 저항이 다릅니다. 밝기 차이가 아닙니다.', fix: '상자를 만들기 전 두 센서를 나란히 두고 읽은 값을 영점으로 적어 두고, 모든 값에서 그 차이를 빼세요.' },
      { symptom: '동물이 한쪽 벽에만 붙어 있음', cause: '벽을 따라 걷는 성질이 빛보다 강하게 나타난 것입니다.', fix: '상자 모서리를 둥글게 만들고 바닥을 같은 재질로 통일한 뒤 다시 시행하세요.' },
      contactTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'b8-seed-germination-gdd',
    title: '씨앗 발아와 적산온도',
    subject: '생물',
    type: 'project',
    difficulty: '초급',
    minutes: 45,
    sensors: ['ds18b20'],
    coreKeywords: ['발아', '적산온도', '장시간 기록', '생장', '기준 온도'],
    connections: ds18b20Bus(['DS18B20'], 'D4'),
    sketch: germinationSketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '며칠을 기록합니다. 60000 ms(1분)면 넉넉합니다.' },
    overview: '싹을 틔우는 동안의 온도를 장시간 기록으로 남기고, 며칠에 걸쳐 쌓인 온도의 합(적산온도)이 발아 시점을 설명하는지 확인합니다.',
    procedure: '젖은 솜 위에 씨앗을 스무 개 놓고 프로브를 씨앗 옆 같은 높이에 두세요. 하루에 두 번 같은 시각에 싹이 난 씨앗 수를 세어 적고, 그 시각을 기록 파일의 시각과 맞춰 두세요.',
    science: '씨앗은 어떤 기준 온도를 넘는 만큼의 열이 쌓여야 발아합니다. 매 시각의 온도에서 기준 온도를 빼고 시간에 대해 더한 값을 적산온도라 하며, 같은 씨앗이라면 발아할 때의 적산온도가 서로 비슷합니다. 기준 온도는 씨앗마다 다르므로 값을 미리 못 박지 않고 원시 온도만 남겨, 나중에 여러 기준으로 다시 더해 볼 수 있게 합니다.',
    safety: '전원을 며칠 켜 두므로 물이 보드에 닿지 않도록 프로브 선을 아래로 늘어뜨려 물방울이 보드로 타고 오르지 않게 하세요.',
    applicationGuide: '기준 온도를 5, 8, 10 °C로 바꿔 각각 적산온도를 구하고, 서로 다른 자리에 둔 접시들의 발아 시점에서 그 값이 가장 비슷해지는 기준 온도를 찾아보세요.',
    troubleshooting: [
      { symptom: '기록이 중간에 끊김', cause: '시리얼 모니터 창이 닫혔거나 USB 연결이 흔들렸습니다.', fix: '기록 프로그램을 쓰고 케이블을 테이프로 고정하세요. 끊긴 구간은 지우지 말고 메모로 남기세요.' },
      { symptom: '온도가 -127 °C로 나옴', cause: '프로브를 찾지 못했을 때 라이브러리가 내보내는 값입니다.', fix: '4.7 kΩ 저항과 DATA 배선을 확인하고, 프로브 선 색과 실제 단자가 맞는지 판매처 표로 확인하세요.' },
      contactTroubleshooting,
    ],
  }),
]
