import type { Recipe } from '@/schema'
import { bme280, ds18b20Bus, led, relayFan, tsl2591 } from './connections'
import {
  contactTroubleshooting,
  createPhase7Recipe,
  externalSupplyTroubleshooting,
  i2cTroubleshooting,
  type Connection,
} from './shared'

/**
 * C 묶음 — 화학·환경 8건.
 *
 * 화학·환경은 6건뿐이었고 그마저 온도 기록에 몰려 있었습니다. 이 묶음은
 * 세 갈래로 넓힙니다. **온도로 반응을 좇는 것**(어는점 내림·중화열·비열),
 * **빛으로 물질의 변화를 좇는 것**(탁도·반사율·광표백), 그리고 **공기의
 * 상태를 다루는 것**(건습구 습도·환기)입니다.
 *
 * 빛을 쓰는 세 건은 모두 LED를 광원으로 함께 답니다. 교실 조명이나 창밖
 * 햇빛은 측정하는 동안 조용히 변하므로, 그것을 광원으로 쓰면 물질이 변한
 * 것과 조명이 변한 것을 나중에 구분할 수 없습니다.
 */

const psychrometerSketch = `#include <Wire.h>
#include <Adafruit_BME280.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// @pin SDA=A4
// @pin SCL=A5
// @pin ONE_WIRE=D4
// @baud 9600

Adafruit_BME280 bme;
OneWire oneWire(4);
DallasTemperature probes(&oneWire);
// 표본 간격입니다. 습구는 천천히 안정되므로 촘촘히 잴 필요가 없습니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 2000;

void setup() {
  Serial.begin(9600);
  if (!bme.begin(0x76)) Serial.println("# BME280_ERROR");
  probes.begin();
  Serial.println("time_ms,dry_c,wet_c,humidity_pct");
}

void loop() {
  probes.requestTemperatures();
  // 버스에 달린 순서는 프로브의 고유 번호가 정합니다. 꽂은 순서가 아닙니다.
  // 0번이 건구가 맞는지 손으로 한쪽을 쥐어 확인한 뒤 기록을 시작하세요.
  Serial.print(millis()); Serial.print(',');
  Serial.print(probes.getTempCByIndex(0), 2); Serial.print(',');
  Serial.print(probes.getTempCByIndex(1), 2); Serial.print(',');
  Serial.println(bme.readHumidity(), 2);
  delay(samplingIntervalMs);
}
`

const freezingSketch = `#include <OneWire.h>
#include <DallasTemperature.h>

// @pin ONE_WIRE=D4
// @baud 9600

OneWire oneWire(4);
DallasTemperature probe(&oneWire);
// 표본 간격입니다. 어는 구간의 평평한 부분을 놓치지 않을 만큼 촘촘해야 합니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 2000;

void setup() {
  Serial.begin(9600);
  probe.begin();
  // 0.5 °C 단위로는 어는점 내림 1 °C를 셋으로도 못 나눕니다. 12비트로 올려
  // 0.0625 °C 단위로 읽습니다.
  probe.setResolution(12);
  Serial.println("time_ms,temperature_c");
}

void loop() {
  probe.requestTemperatures();
  Serial.print(millis()); Serial.print(',');
  Serial.println(probe.getTempCByIndex(0), 3);
  delay(samplingIntervalMs);
}
`

const turbiditySketch = `#include <Wire.h>
#include <Adafruit_TSL2591.h>

// @pin LED=D9
// @baud 9600

Adafruit_TSL2591 tsl(2591);
const byte LED_PIN = 9;
uint16_t baselineRaw = 1;
// 표본 간격입니다. 침전은 초 단위로 진행하므로 짧게 잡습니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 500;

uint16_t readFull() {
  uint32_t lum = tsl.getFullLuminosity();
  return (uint16_t)(lum & 0xffff);
}

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  analogWrite(LED_PIN, 255);
  if (!tsl.begin()) Serial.println("# TSL2591_ERROR");
  tsl.setGain(TSL2591_GAIN_LOW);
  tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  delay(1000);
  // 맑은 물을 통과한 빛을 100 %의 기준으로 삼습니다. 이 값을 잡기 전에
  // 시약을 넣으면 그 뒤의 모든 투과율이 틀립니다.
  baselineRaw = readFull();
  if (baselineRaw == 0) baselineRaw = 1;
  Serial.println("time_ms,light_raw,transmittance_pct");
}

void loop() {
  uint16_t raw = readFull();
  Serial.print(millis()); Serial.print(',');
  Serial.print(raw); Serial.print(',');
  Serial.println(100.0 * raw / baselineRaw, 2);
  delay(samplingIntervalMs);
}
`

const albedoSketch = `#include <Wire.h>
#include <Adafruit_TSL2591.h>

// @pin LED=D9
// @baud 9600

Adafruit_TSL2591 tsl(2591);
const byte LED_PIN = 9;
// 한 밝기 단계를 유지하는 시간입니다. 센서가 안정될 만큼 길게 두세요.
// @tunable stepHoldMs
int stepHoldMs = 3000;

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  if (!tsl.begin()) Serial.println("# TSL2591_ERROR");
  tsl.setGain(TSL2591_GAIN_MED);
  tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  Serial.println("time_ms,pwm_value,reflected_raw");
}

void loop() {
  // 밝기를 세 단계로 바꾸며 잽니다. 반사율이 재료의 성질이라면 세 단계 모두에서
  // 같은 비율이 나와야 합니다. 한 단계만 재면 그것을 확인할 수 없습니다.
  const int levels[] = {85, 170, 255};
  for (byte i = 0; i < 3; i++) {
    analogWrite(LED_PIN, levels[i]);
    delay(stepHoldMs);
    uint32_t lum = tsl.getFullLuminosity();
    Serial.print(millis()); Serial.print(',');
    Serial.print(levels[i]); Serial.print(',');
    Serial.println((uint16_t)(lum & 0xffff));
  }
}
`

const neutralizationSketch = `#include <OneWire.h>
#include <DallasTemperature.h>

// @pin ONE_WIRE=D4
// @baud 9600

OneWire oneWire(4);
DallasTemperature probe(&oneWire);
// 표본 간격입니다. 한 방울의 온도 변화를 놓치지 않을 만큼 짧아야 합니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 1000;

void setup() {
  Serial.begin(9600);
  probe.begin();
  probe.setResolution(12);
  Serial.println("time_ms,temperature_c");
}

void loop() {
  probe.requestTemperatures();
  // 시간에 따른 온도만 남깁니다. 몇 mL를 넣었는지는 사람이 노트에 적고
  // 나중에 시각으로 맞춥니다. 스케치가 부피를 알 방법은 없습니다.
  Serial.print(millis()); Serial.print(',');
  Serial.println(probe.getTempCByIndex(0), 3);
  delay(samplingIntervalMs);
}
`

const specificHeatSketch = `#include <OneWire.h>
#include <DallasTemperature.h>

// @pin ONE_WIRE=D4
// @baud 9600

OneWire oneWire(4);
DallasTemperature probes(&oneWire);
// 표본 간격입니다. 가열과 냉각 모두 분 단위로 진행합니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 5000;

void setup() {
  Serial.begin(9600);
  probes.begin();
  probes.setResolution(12);
  Serial.println("time_ms,soil_c,water_c");
}

void loop() {
  probes.requestTemperatures();
  Serial.print(millis()); Serial.print(',');
  Serial.print(probes.getTempCByIndex(0), 2); Serial.print(',');
  Serial.println(probes.getTempCByIndex(1), 2);
  delay(samplingIntervalMs);
}
`

const bleachingSketch = `#include <Wire.h>
#include <Adafruit_TSL2591.h>

// @pin LED=D9
// @baud 9600

Adafruit_TSL2591 tsl(2591);
const byte LED_PIN = 9;
uint16_t baselineRaw = 1;
// 표본 간격입니다. 색이 빠지는 데 한 시간이 걸리므로 길게 잡습니다.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 10000;

uint16_t readFull() {
  uint32_t lum = tsl.getFullLuminosity();
  return (uint16_t)(lum & 0xffff);
}

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  analogWrite(LED_PIN, 255);
  if (!tsl.begin()) Serial.println("# TSL2591_ERROR");
  tsl.setGain(TSL2591_GAIN_LOW);
  tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  delay(1000);
  // 색소를 넣기 전 맑은 용매를 통과한 값입니다. 흡광도를 계산하는 분모가
  // 되므로 매 시각 함께 내보내, 나중에 어떤 기준을 썼는지 알 수 있게 합니다.
  baselineRaw = readFull();
  if (baselineRaw == 0) baselineRaw = 1;
  Serial.println("time_ms,light_raw,baseline_raw");
}

void loop() {
  Serial.print(millis()); Serial.print(',');
  Serial.print(readFull()); Serial.print(',');
  Serial.println(baselineRaw);
  delay(samplingIntervalMs);
}
`

const ventilationSketch = `#include <Wire.h>
#include <Adafruit_BME280.h>

// @pin RELAY=D7
// @baud 9600

Adafruit_BME280 bme;
const byte RELAY_PIN = 7;
// 팬을 켜 두는 시간입니다. 방의 크기에 맞춰 늘리거나 줄이세요.
// @tunable fanOnSeconds
int fanOnSeconds = 120;

void report(int fanState) {
  Serial.print(millis()); Serial.print(',');
  Serial.print(bme.readTemperature(), 2); Serial.print(',');
  Serial.print(bme.readHumidity(), 2); Serial.print(',');
  Serial.println(fanState);
}

void setup() {
  Serial.begin(9600);
  if (!bme.begin(0x76)) Serial.println("# BME280_ERROR");
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  Serial.println("time_ms,temperature_c,humidity_pct,fan");
}

void loop() {
  // 켜기 전 2분, 켠 동안, 끈 뒤 5분을 한 줄기로 남깁니다. 회복 시간은
  // 끈 시각을 알아야 잴 수 있으므로 팬 상태를 매 행에 함께 적습니다.
  for (int i = 0; i < 24; i++) { report(0); delay(5000); }
  digitalWrite(RELAY_PIN, HIGH);
  for (int i = 0; i < fanOnSeconds / 5; i++) { report(1); delay(5000); }
  digitalWrite(RELAY_PIN, LOW);
  for (int i = 0; i < 60; i++) { report(0); delay(5000); }
}
`

const psychrometerConnections: Connection[] = [...bme280(), ...ds18b20Bus(['DS18B20_1', 'DS18B20_2'], 'D4')]
const opticalConnections: Connection[] = [...tsl2591(), ...led('D9')]
const twoProbeConnections: Connection[] = ds18b20Bus(['DS18B20_1', 'DS18B20_2'], 'D4')
const ventilationConnections: Connection[] = [...bme280(), ...relayFan('D7')]

export const phase7ChemistryProjects: Recipe[] = [
  createPhase7Recipe({
    id: 'c1-wet-dry-humidity',
    title: '건구·습구 온도로 상대습도 구하기',
    subject: '화학·환경',
    type: 'project',
    difficulty: '중급',
    minutes: 50,
    sensors: ['ds18b20', 'bme280'],
    coreKeywords: ['상대습도', '건습구', '증발', '잠열', '보정'],
    connections: psychrometerConnections,
    sketch: psychrometerSketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '습구가 안정되는 데 몇 분 걸립니다. 2000 ms면 충분합니다.' },
    overview: '두 온도 프로브 중 하나만 젖은 천으로 감싸 두 온도의 차이를 재고, 그 차이로 구한 상대습도를 습도 센서가 읽은 값과 견줍니다.',
    procedure: '두 온도가 각각 안정될 때까지 5분 이상 기다린 뒤 값을 읽으세요. 부채질을 한 조건과 하지 않은 조건에서 각각 기록하세요.',
    science: '젖은 천에서 물이 증발할 때 기화열을 가져가므로 습구 온도는 건구보다 낮아집니다. 공기가 건조할수록 증발이 활발해 그 차이가 커지므로, 두 온도의 차이로 상대습도를 거꾸로 구할 수 있습니다. 다만 증발 속도는 바람에도 좌우되어, 바람이 없으면 습구 주위 공기가 이미 포화해 실제보다 높은 습도가 나옵니다.',
    applicationGuide: '건습구 표에서 읽은 습도와 습도 센서의 값을 짝지어 그리고, 부채질 여부에 따라 두 값의 차이가 어떻게 달라지는지 확인하세요.',
    troubleshooting: [
      { symptom: '건구와 습구가 뒤바뀐 것 같음', cause: '1-Wire 버스의 순서는 꽂은 순서가 아니라 프로브의 고유 번호가 정합니다.', fix: '한쪽 프로브를 손으로 쥐어 어느 열의 값이 오르는지 보고 순서를 확인해 적어 두세요.' },
      { symptom: '두 온도가 거의 같음', cause: '천이 말랐거나 공기가 이미 포화 상태입니다.', fix: '천을 다시 적시고 약한 바람을 보내며 다시 재세요.' },
      contactTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'c2-freezing-point-depression',
    title: '소금물 농도와 어는점 내림',
    subject: '화학·환경',
    type: 'project',
    difficulty: '중급',
    minutes: 60,
    sensors: ['ds18b20'],
    coreKeywords: ['어는점 내림', '농도', '용액', '상변화', '냉각 곡선'],
    connections: ds18b20Bus(['DS18B20'], 'D4'),
    sketch: freezingSketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '어는 구간의 평평한 부분을 놓치지 않도록 2000 ms 이하로 두세요.' },
    overview: '농도가 다른 소금물을 얼음-소금 냉매에 담가 식히면서, 온도가 잠시 평평해지는 구간의 온도를 농도별로 비교합니다.',
    procedure: '용액을 저으면서 식히고, 온도가 평평해지는 구간이 나타날 때까지 기록을 멈추지 마세요. 농도마다 같은 부피의 용액을 쓰고 같은 냉매에 담그세요.',
    science: '순수한 물은 0 °C에서 얼지만, 물에 무언가 녹아 있으면 더 낮은 온도에서 얼기 시작합니다. 이것을 어는점 내림이라 하며 내려간 정도는 녹아 있는 입자 수에 비례합니다. 소금은 물에서 두 종류의 이온으로 갈라지므로 같은 몰수의 설탕보다 두 배쯤 크게 어는점을 내립니다. 얼기 시작할 때 굳는 열이 나와 온도가 잠시 평평해지는데, 그 구간의 온도가 어는점입니다.',
    safety: '얼음에 소금을 섞은 냉매는 -20 °C 가까이 내려갑니다. 맨손으로 오래 만지지 마세요.',
    applicationGuide: '농도를 가로축, 어는점이 내려간 정도를 세로축으로 그려 직선이 되는지 확인하고, 기울기에서 소금이 이온 두 개로 갈라진다는 것이 보이는지 살펴보세요.',
    troubleshooting: [
      { symptom: '평평한 구간이 보이지 않음', cause: '너무 빨리 식혔거나 표본 간격이 깁니다.', fix: '냉매의 소금을 줄여 천천히 식히고 표본 간격을 1000 ms로 줄이세요.' },
      { symptom: '어는점 아래로 내려갔다가 다시 오름', cause: '오류가 아닙니다. 얼음 핵이 생기기 전 과냉각된 것입니다.', fix: '다시 오른 뒤의 평평한 온도를 어는점으로 읽고, 저어 주면 과냉각이 줄어듭니다.' },
      contactTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'c3-turbidity-precipitation',
    title: '용해·침전 과정을 탁도로 추적하기',
    subject: '화학·환경',
    type: 'project',
    difficulty: '중급',
    minutes: 50,
    sensors: ['tsl2591'],
    actuators: ['led'],
    coreKeywords: ['탁도', '침전', '투과율', '반응 속도', '기준값'],
    connections: opticalConnections,
    sketch: turbiditySketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '침전은 초 단위로 진행합니다. 500 ms에서 시작하세요.' },
    overview: 'LED 빛을 비커 너머로 통과시켜 조도 센서로 받고, 시약을 넣어 앙금이 생기는 동안 통과하는 빛이 줄어드는 과정을 기록합니다.',
    procedure: '맑은 물로 기준값을 잡은 뒤 시약을 한 번에 넣고 즉시 저으세요. 저은 뒤에는 비커와 센서를 끝까지 움직이지 마세요.',
    science: '물에 떠 있는 작은 알갱이는 빛을 흩뜨려 통과하는 빛을 줄입니다. 얼마나 줄었는지가 알갱이의 양을 나타내며 이것을 탁도라 합니다. 다만 흩뜨림은 알갱이의 크기에도 좌우되므로, 같은 질량이라도 알갱이가 잘게 나뉘어 있으면 훨씬 더 흐리게 보입니다. 그래서 이 방법은 질량을 재는 것이 아니라 상대 비교에 씁니다.',
    safety: '시약은 선생님이 정해 준 것만 정해 준 농도로 쓰고, 다 쓴 용액은 지정된 통에 버리세요.',
    applicationGuide: '투과율을 시간에 대해 그려 앙금이 다 생기는 데 걸린 시간을 읽고, 시약 농도를 절반으로 줄였을 때 그 시간이 어떻게 달라지는지 비교하세요.',
    troubleshooting: [
      { symptom: '투과율이 처음부터 100 %를 넘음', cause: '기준값을 잡을 때보다 지금 빛이 더 많이 들어옵니다. 방 조명이 켜졌거나 비커를 옮긴 것입니다.', fix: '기준값을 다시 잡고, 측정 내내 비커·센서·LED를 종이 상자로 덮어 두세요.' },
      { symptom: '값이 0 근처에서 움직이지 않음', cause: '용액이 너무 진해 빛이 거의 통과하지 못합니다.', fix: '시약 농도를 낮추거나 더 얇은 용기를 써서 빛이 지나는 거리를 줄이세요.' },
      i2cTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'c4-neutralization-endpoint',
    title: '중화 반응의 온도 변화로 종말점 찾기',
    subject: '화학·환경',
    type: 'project',
    difficulty: '고급',
    minutes: 60,
    sensors: ['ds18b20'],
    coreKeywords: ['중화', '발열', '종말점', '적정', '시간에 따른 변화'],
    connections: ds18b20Bus(['DS18B20'], 'D4'),
    sketch: neutralizationSketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '한 번에 넣는 양이 적을수록 촘촘해야 합니다. 1000 ms에서 시작하세요.' },
    overview: '산 용액에 염기를 일정한 양씩 넣으면서 시간에 따른 온도 변화를 기록하고, 온도가 더 이상 오르지 않는 지점에서 중화가 끝난 시점을 찾습니다.',
    procedure: '염기를 1 mL씩 넣을 때마다 넣은 시각과 누적 부피를 노트에 적으세요. 넣은 뒤에는 5초간 저어 온도가 고르게 퍼지게 하세요.',
    science: '산과 염기가 만나 물이 되는 반응은 열을 내놓습니다. 산이 남아 있는 동안에는 염기를 넣을 때마다 온도가 오르지만, 산이 모두 소모되면 더 넣어도 반응할 상대가 없어 온도가 오르지 않고 오히려 찬 용액이 섞여 내려갑니다. 꺾이는 지점이 종말점이며, 지시약의 색 변화와 달리 색을 쓰지 않고도 찾을 수 있습니다.',
    safety: '산과 염기는 보호 안경과 장갑을 끼고 다루세요. 프로브는 유리 온도계가 아니지만 세게 부딪히면 방수 피막이 상합니다.',
    applicationGuide: '누적 부피를 가로축, 온도를 세로축으로 그려 두 직선을 맞추고 그 교점을 종말점으로 읽으세요. 지시약을 함께 넣어 색이 변한 부피와 견주면 두 방법의 차이를 볼 수 있습니다.',
    troubleshooting: [
      { symptom: '온도 상승이 너무 작아 꺾임이 보이지 않음', cause: '용액이 묽거나 부피가 커서 같은 열이 넓게 퍼집니다.', fix: '농도를 높이거나 용액 부피를 줄이고, 종이컵을 두 겹으로 써서 열이 새는 것을 줄이세요.' },
      { symptom: '온도가 계속 천천히 내려가기만 함', cause: '실온보다 따뜻한 용액이 식는 배경 변화가 반응열보다 큽니다.', fix: '두 용액을 미리 같은 실온으로 맞추고, 넣기 전 5분간의 기울기를 배경으로 빼세요.' },
      contactTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'c5-surface-albedo',
    title: '표면 색과 알베도(반사율)',
    subject: '화학·환경',
    type: 'project',
    difficulty: '초급',
    minutes: 45,
    sensors: ['tsl2591'],
    actuators: ['led'],
    coreKeywords: ['반사율', '알베도', '표면 색', '도시 열섬', '광원 제어'],
    connections: opticalConnections,
    sketch: albedoSketch,
    tunable: { anchor: 'stepHoldMs', name: '단계 유지 시간 (ms)', hint: '센서가 안정될 만큼 길게 두세요. 3000 ms에서 시작합니다.' },
    overview: '같은 LED 빛을 여러 표면에 비추고 되돌아온 빛의 세기를 재어, 색과 재질에 따라 얼마나 많은 빛을 되돌려 보내는지 비교합니다.',
    procedure: '표면 시료를 바꿀 때마다 LED와 센서의 자리를 그대로 두고 시료만 갈아 끼우세요. 흰 종이를 기준 시료로 삼아 처음과 마지막에 각각 한 번씩 재세요.',
    science: '들어온 빛 가운데 되돌아 나오는 빛의 비율을 반사율, 지구 규모로 말할 때는 알베도라 합니다. 밝은 표면은 많이 되돌려 보내 덜 데워지고, 어두운 표면은 흡수해 더 데워집니다. 도시가 주변 시골보다 더운 까닭의 하나가 아스팔트처럼 알베도가 낮은 표면이 넓기 때문입니다.',
    applicationGuide: '흰 종이의 값으로 각 시료의 값을 나누어 상대 반사율로 바꾸고, 세 밝기 단계에서 그 비율이 같게 나오는지 확인하세요. 같지 않다면 센서가 측정 범위를 넘었을 수 있습니다.',
    troubleshooting: [
      { symptom: '가장 밝은 단계에서만 비율이 어긋남', cause: '센서가 측정 범위의 위쪽에 닿아 값이 잘렸습니다.', fix: '증폭 설정을 낮추거나 센서를 조금 멀리 두고 다시 재세요.' },
      { symptom: '검은 시료에서 값이 0으로 나옴', cause: '되돌아온 빛이 너무 약합니다.', fix: '증폭 설정을 높이고 주변 빛이 새어 들지 않도록 상자를 씌우세요.' },
      i2cTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'c6-soil-water-heat-capacity',
    title: '흙과 물의 비열 차이와 해륙풍 모형',
    subject: '화학·환경',
    type: 'project',
    difficulty: '중급',
    minutes: 60,
    sensors: ['ds18b20'],
    coreKeywords: ['비열', '해륙풍', '가열과 냉각', '열용량', '모형'],
    connections: twoProbeConnections,
    sketch: specificHeatSketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '가열과 냉각 모두 분 단위입니다. 5000 ms면 충분합니다.' },
    overview: '같은 램프 아래 나란히 놓은 흙과 물의 온도를 함께 기록해, 같은 열을 받아도 두 물질의 온도가 서로 다르게 오르고 내리는 것을 확인합니다.',
    procedure: '램프를 켜고 20분간 가열한 뒤 램프를 끄고 20분간 식는 과정을 이어서 기록하세요. 두 그릇의 질량과 표면 넓이를 같게 맞추고 프로브를 같은 깊이에 묻으세요.',
    science: '같은 질량을 1 °C 올리는 데 필요한 열의 양을 비열이라 합니다. 물의 비열은 흙보다 네 배 넘게 커서, 같은 열을 받아도 물의 온도는 천천히 오르고 천천히 내려갑니다. 낮에는 땅이 먼저 더워져 그 위 공기가 떠오르고 바다에서 바람이 불어오며, 밤에는 반대가 됩니다. 이것이 해륙풍입니다.',
    safety: '램프는 뜨겁습니다. 물이 램프에 튀지 않게 하고 젖은 손으로 만지지 마세요.',
    applicationGuide: '가열 구간에서 두 온도의 기울기 비를 구해 비열의 비와 견주고, 냉각 구간에서도 같은 순서가 유지되는지 확인하세요. 낮과 밤에 바람의 방향이 바뀌는 이유를 이 그래프로 설명해 보세요.',
    troubleshooting: [
      { symptom: '두 온도가 거의 같게 오름', cause: '램프가 한쪽으로 치우쳐 두 그릇이 받는 열이 다릅니다.', fix: '램프를 두 그릇의 정확한 가운데 위에 두고 거리를 자로 맞추세요.' },
      { symptom: '물 쪽 온도가 들쭉날쭉함', cause: '프로브가 물 표면 가까이에 있어 대류의 영향을 받았습니다.', fix: '프로브를 가운데 깊이에 고정하고 그릇 벽에 닿지 않게 하세요.' },
      contactTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'c7-photobleaching',
    title: '빛에 의한 색소 분해(광표백)',
    subject: '화학·환경',
    type: 'project',
    difficulty: '중급',
    minutes: 70,
    sensors: ['tsl2591'],
    actuators: ['led'],
    coreKeywords: ['광표백', '흡광도', '분해 속도', '장시간 기록', '색소'],
    connections: opticalConnections,
    sketch: bleachingSketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '한 시간 넘게 기록합니다. 10000 ms면 모양을 놓치지 않습니다.' },
    overview: '색소 용액에 LED 빛을 계속 비추면서 통과하는 빛이 시간에 따라 늘어나는 과정을 기록해, 색소가 빛에 분해되는 속도를 구합니다.',
    procedure: '색소를 넣기 전 맑은 용매로 기준값을 잡고, 색소를 넣은 뒤에는 한 시간 이상 기록을 멈추지 마세요. 같은 색소를 어두운 곳에 둔 시료도 함께 준비해 나중에 색을 비교하세요.',
    science: '색소 분자는 빛을 흡수하는데, 흡수한 에너지가 크면 분자 자체가 끊어져 색을 잃습니다. 색이 빠질수록 용액을 통과하는 빛이 늘어나므로, 통과한 빛의 비율에 음의 상용로그를 취한 흡광도가 시간에 따라 줄어듭니다. 어두운 곳에 둔 시료가 함께 바래면 원인은 빛이 아니라 산소나 온도입니다.',
    safety: '색소 용액이 눈에 들어가지 않도록 주의하고, 오래 켜 둔 LED와 저항은 따뜻해질 수 있으니 종이에 직접 닿지 않게 하세요.',
    applicationGuide: '흡광도에 자연로그를 취해 시간에 대해 그리고 직선이 되면 분해가 일차 반응임을 뜻합니다. 그 기울기로 반감기를 구해 보세요.',
    troubleshooting: [
      { symptom: '통과하는 빛이 줄어듦', cause: '용매가 증발해 색이 진해졌거나 먼지가 앉았습니다.', fix: '용기를 랩으로 덮어 증발을 막고 광로에 먼지가 없는지 확인하세요.' },
      { symptom: '어두운 곳의 시료도 같이 바램', cause: '빛이 아닌 원인으로 분해된 것입니다.', fix: '두 시료의 온도를 같게 맞추고 산소와 닿는 면적을 줄여 다시 비교하세요.' },
      i2cTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'c8-ventilation-recovery',
    title: '환기 전후 실내 회복 시간',
    subject: '화학·환경',
    type: 'project',
    difficulty: '초급',
    minutes: 50,
    sensors: ['bme280'],
    actuators: ['relay-module', 'dc-fan-5v'],
    coreKeywords: ['환기', '회복 시간', '시간에 따른 변화', '온습도', '자동 제어'],
    connections: ventilationConnections,
    sketch: ventilationSketch,
    tunable: { anchor: 'fanOnSeconds', name: '팬을 켜 두는 시간 (초)', hint: '방이 클수록 길게 두세요. 120초에서 시작합니다.' },
    overview: '릴레이로 팬을 켜서 좁은 공간의 공기를 갈아 준 뒤, 온도와 습도가 원래 상태로 돌아오는 데 걸리는 시간을 시간에 따른 변화로 기록합니다.',
    procedure: '측정 상자나 작은 방을 닫고 사람이 드나들지 않는 상태에서 한 번의 기록을 끝까지 마치세요. 팬을 켠 시각과 끈 시각이 기록의 fan 열과 맞는지 확인하세요.',
    science: '닫힌 공간의 공기는 사람의 호흡과 물건의 증발로 천천히 달라집니다. 팬으로 바깥 공기를 들이면 상태가 빠르게 바깥에 가까워졌다가, 팬을 끄면 다시 원래대로 되돌아갑니다. 되돌아가는 과정은 지수 모양으로 잦아들며, 그 시간상수가 그 공간이 얼마나 잘 닫혀 있는지를 나타냅니다.',
    safety: '팬은 반드시 별도 전원으로 돌리고 릴레이 접점 쪽에 가정용 전원을 연결하지 마세요. 팬 날개에 손가락이 닿지 않도록 망을 씌우세요.',
    applicationGuide: '팬을 끈 시각 이후의 습도에서 팬을 켰을 때의 값을 빼고 자연로그를 취해 시간에 대해 그리면 직선이 됩니다. 그 기울기로 방마다 회복 시간상수를 비교해 보세요.',
    troubleshooting: [
      { symptom: '팬을 켜도 습도가 변하지 않음', cause: '바깥 공기와 안쪽 공기의 상태가 이미 비슷합니다.', fix: '젖은 수건을 잠깐 넣어 습도를 올린 뒤 그 회복 과정을 재세요.' },
      { symptom: '회복 곡선이 중간에 꺾임', cause: '문이 열렸거나 사람이 드나든 것입니다.', fix: '그 시각을 관찰 메모로 남기고 꺾인 뒤 구간만으로 기울기를 구하세요.' },
      externalSupplyTroubleshooting,
    ],
  }),
]
