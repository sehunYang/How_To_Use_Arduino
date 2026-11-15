import type { Recipe } from '@/schema'
import { generatorLoop, hallSensor, ina219 } from './connections'
import { contactTroubleshooting, createPhase7Recipe, i2cTroubleshooting } from './shared'

/**
 * F 묶음: 신재생 에너지 3건.
 *
 * 1차시(발전기)와 2차시(태양전지)는 같은 INA219 회로와 같은 스케치를 씁니다.
 * 발전 장치만 바꿔 끼우므로 두 방식의 전력과 그 흔들림을 같은 잣대로 견줄 수
 * 있습니다. 3번은 1차시를 마친 학생이 정류·평활, 회전수와 기전력의 비례,
 * 전동기-발전기 효율을 스스로 확인하는 심화 탐구입니다.
 *
 * 태양전지의 I-V 곡선과 최대전력점은 ph23이 다룹니다.
 */

const powerLogSketch = `#include <Wire.h>
#include <Adafruit_INA219.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 115200

Adafruit_INA219 ina219;
// 표본 간격입니다. 손잡이가 한 바퀴 도는 동안 표본이 여러 개 들어가야 흔들림이 보입니다.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 100;
unsigned long prevTime = 0;
float totalEnergy_mJ = 0.0;  // 기록을 시작한 뒤 쌓인 전기 에너지

void setup() {
  Serial.begin(115200);
  if (!ina219.begin()) Serial.println("# INA219_ERROR");
  // 소형 발전기와 태양전지에 맞춘 범위(16 V, 400 mA)입니다. 전류 눈금이 0.1 mA로 촘촘해집니다.
  ina219.setCalibration_16V_400mA();
  Serial.println("time_ms,voltage_V,current_mA,power_mW,energy_mJ");
  prevTime = millis();
}

void loop() {
  unsigned long now = millis();
  if (now - prevTime < samplingIntervalMs) return;
  float dt_s = (now - prevTime) / 1000.0;
  prevTime = now;

  float voltage_V = ina219.getBusVoltage_V();
  float current_mA = ina219.getCurrent_mA();
  // 멈춰 있을 때 잡음으로 생기는 작은 음수는 0으로 둡니다.
  if (voltage_V < 0) voltage_V = 0.0;
  if (current_mA < 0) current_mA = 0.0;

  // P = V × I 이고, V × mA = mW입니다.
  float power_mW = voltage_V * current_mA;
  // 에너지는 전력을 시간에 대해 더한 값입니다. mW × s = mJ.
  totalEnergy_mJ += power_mW * dt_s;

  Serial.print(now); Serial.print(',');
  Serial.print(voltage_V, 3); Serial.print(',');
  Serial.print(current_mA, 2); Serial.print(',');
  Serial.print(power_mW, 2); Serial.print(',');
  Serial.println(totalEnergy_mJ, 2);
}
`

const rectifierRpmSketch = `#include <Wire.h>
#include <Adafruit_INA219.h>

// @pin SDA=A4
// @pin SCL=A5
// @pin HALL=A0
// @baud 115200

Adafruit_INA219 ina219;
const int HALL_PIN = A0;
const unsigned long samplingIntervalMs = 200;  // 한 줄을 내보내는 간격

// 자석이 다가왔다고 볼 변화량입니다. 자석이 지나가도 rpm이 0이면 낮추고,
// 바퀴가 멈춰 있는데 rpm이 튀면 높이세요.
// @tunable magnetThreshold
int magnetThreshold = 60;

int baselineMag = 512;  // 자석이 없을 때의 값. 시작할 때 잽니다.
bool magnetNear = false;
unsigned long lastPassTime = 0;
unsigned long prevTime = 0;
float currentRPM = 0.0;

void setup() {
  Serial.begin(115200);
  if (!ina219.begin()) Serial.println("# INA219_ERROR");
  ina219.setCalibration_16V_400mA();

  // 시작하는 동안 자석을 센서에서 멀리 두세요. 이때의 값을 기준으로 삼습니다.
  long sum = 0;
  for (int i = 0; i < 50; i++) {
    sum += analogRead(HALL_PIN);
    delay(5);
  }
  baselineMag = sum / 50;

  Serial.println("time_ms,rpm,mag_delta,voltage_V,current_mA,power_mW");
  prevTime = millis();
}

void loop() {
  unsigned long now = millis();
  int magDelta = abs(analogRead(HALL_PIN) - baselineMag);

  // 자석이 다가오는 순간 한 번만 셉니다. 멀어졌다고 볼 때는 문턱의 절반을 써서
  // 문턱 근처에서 값이 떨려도 두 번 세지 않게 합니다.
  if (magDelta > magnetThreshold && !magnetNear) {
    magnetNear = true;
    unsigned long period_ms = now - lastPassTime;
    // 50 ms 안에 다시 들어온 신호는 떨림으로 보고 버립니다.
    if (lastPassTime == 0 || period_ms > 50) {
      if (lastPassTime > 0) currentRPM = 60000.0 / period_ms;
      lastPassTime = now;
    }
  } else if (magDelta < magnetThreshold / 2) {
    magnetNear = false;
  }

  // 2초 넘게 자석이 지나가지 않으면 멈춘 것으로 봅니다. 그래서 30 rpm보다 느린 회전은 0으로 나옵니다.
  if (now - lastPassTime > 2000) currentRPM = 0.0;

  if (now - prevTime < samplingIntervalMs) return;
  prevTime = now;

  float voltage_V = ina219.getBusVoltage_V();
  float current_mA = ina219.getCurrent_mA();
  if (voltage_V < 0) voltage_V = 0.0;
  if (current_mA < 0) current_mA = 0.0;
  float power_mW = voltage_V * current_mA;

  Serial.print(now); Serial.print(',');
  Serial.print(currentRPM, 1); Serial.print(',');
  Serial.print(magDelta); Serial.print(',');
  Serial.print(voltage_V, 3); Serial.print(',');
  Serial.print(current_mA, 2); Serial.print(',');
  Serial.println(power_mW, 2);
}
`

const reverseTurnTroubleshooting = {
  symptom: '발전기를 돌려도 voltage_V와 current_mA가 0으로만 나옴',
  cause: '반대 방향으로 돌려 + 와 −가 바뀌었고, 쇼트키 다이오드가 그 전류를 막고 있습니다. 또는 발전기 −와 아두이노 GND가 이어지지 않았습니다.',
  fix: '반대 방향으로 돌려 보세요. 그래도 0이면 발전기 − 악어클립과 아두이노 GND가 같은 줄에 묶였는지 확인하세요.',
}

const openLoadTroubleshooting = {
  symptom: 'voltage_V는 오르는데 current_mA가 0.00으로 나옴',
  cause: '부하 저항이 빠졌거나 두 다리가 같은 열에 꽂혀 회로가 끊겼습니다.',
  fix: '100 Ω 저항의 두 다리가 서로 다른 열에 꽂혀 INA219 VIN-와 GND 줄을 잇는지 확인하세요. 저항으로 전류가 흘러야 전류와 전력이 잡힙니다.',
}

export const phase7EnergyProjects: Recipe[] = [
  createPhase7Recipe({
    id: 'f1-hand-generator-power',
    title: '손발전기와 TT모터의 전자기 유도 발전량',
    subject: '물리',
    type: 'project',
    difficulty: '초급',
    minutes: 50,
    sensors: ['ina219'],
    coreKeywords: ['전자기 유도', '발전기', '유도 기전력', '전력', '신재생 에너지', 'TT모터'],
    connections: [...ina219(), ...generatorLoop(100)],
    sketch: powerLogSketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '100 ms에서 시작하세요. 늘리면 손잡이의 흔들림이 그래프에서 사라집니다.' },
    overview: '손발전기의 손잡이(또는 TT모터의 바퀴)를 돌리는 빠르기와 일정함에 따라 만들어지는 전압, 전류, 전력과 20초 동안 쌓인 전기 에너지를 0.1초마다 기록합니다. 이 회로는 2차시 태양전지 탐구에서 발전 장치만 바꿔 다시 씁니다.',
    procedure: '발전기를 돌리지 않은 채 기록을 시작해 `voltage_V`와 `power_mW`가 0 근처인지 확인하세요. 기록을 새로 시작할 때마다 손잡이를 정방향으로 20초 동안 돌리고 멈춥니다. 초당 약 1바퀴로 천천히 일정하게 돌리는 조건과 초당 3바퀴 이상 빠르게 돌리는 조건을 각각 3회씩 하세요. 끝으로 악어클립을 TT모터의 두 단자로 옮겨 물리고, 바퀴를 책상에 대고 천천히 밀 때와 빠르게 밀 때의 전압과 전력 봉우리를 비교하세요. 각 기록에서 `energy_mJ`의 마지막 값이 그 20초 동안 만든 에너지입니다.',
    science: '코일을 지나는 자기선속이 시간에 따라 변하면 코일에 유도 기전력이 생기고, 그 크기는 감은 수와 자기선속이 변하는 빠르기에 비례합니다(패러데이 법칙). 손잡이를 빠르게 돌릴수록 자기선속이 빨리 변해 전압이 커지고, 부하 저항이 같으면 전력은 $P = V^2/R$이라 전압의 제곱으로 커집니다. TT모터처럼 건전지로 바퀴를 돌리던 전동기도 안에 영구자석과 코일이 있어, 거꾸로 바퀴를 돌리면 발전기가 됩니다. 쇼트키 다이오드는 반대로 돌렸을 때 생기는 음의 전압이 INA219에 걸리지 않게 막고, 그 대가로 약 0.2 V를 먹습니다. INA219가 재는 전압은 부하 저항 양 끝의 전압이므로, 발전기가 만든 전압보다 다이오드 몫만큼 작습니다.',
    safety: '손발전기 교구에 딸린 USB 5V 정전압 모듈은 연결하지 마세요. 전압이 5 V로 묶여 회전 빠르기와 전압의 비례를 볼 수 없습니다. 100 Ω 저항에 5 V가 걸리면 0.25 W가 열이 되어 1/4 W 저항의 한계에 닿습니다. 빠르게 돌린 직후에는 저항을 만지지 말고, 전압이 5 V를 자주 넘으면 1/2 W 이상 저항을 쓰세요.',
    applicationGuide: '데이터 변환·분석에서 가로축 `time_ms`, 세로축 `voltage_V`로 그려 돌리는 빠르기에 따라 전압의 높이가 어떻게 바뀌는지 보세요. 세로축을 `power_mW`와 `energy_mJ`로 바꿔 순간 전력의 최댓값, 평균, 표준편차와 20초 동안 쌓인 에너지를 조건마다 적어 두세요. 이 값들은 2차시 태양전지 탐구에서 두 발전 방식을 견주는 표에 그대로 씁니다.',
    troubleshooting: [
      reverseTurnTroubleshooting,
      openLoadTroubleshooting,
      i2cTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'f2-solar-panel-power',
    title: '태양전지의 광전효과 발전량과 발전기 비교',
    subject: '물리',
    type: 'project',
    difficulty: '초급',
    minutes: 50,
    sensors: ['ina219'],
    coreKeywords: ['태양전지', '광전효과', '광기전력', '태양광 발전', '신재생 에너지', '빛의 세기'],
    connections: [
      ...ina219(),
      { from: 'PANEL.POSITIVE', to: 'INA219.VIN+', color: 'red', text: '태양광 패널 + 선(빨간 선)에 악어클립을 물리고 반대쪽 핀을 INA219 VIN+에 연결하세요. 태양전지는 거꾸로 돌 일이 없어 다이오드를 거치지 않습니다.' },
      { from: 'INA219.VIN-', to: 'RESISTOR_100.1', color: 'orange', text: 'INA219 VIN-를 100 Ω 부하 저항의 한쪽 다리에 연결하세요.' },
      { from: 'RESISTOR_100.2', to: 'PANEL.NEGATIVE', color: 'black', text: '100 Ω 저항의 남은 다리를 태양광 패널 − 선(검은 선)의 악어클립과 연결하세요.' },
      { from: 'PANEL.NEGATIVE', to: 'UNO.GND', color: 'black', text: '태양광 패널 −를 아두이노 GND와 공통으로 묶으세요.' },
    ],
    sketch: powerLogSketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '1차시와 같은 100 ms로 두어야 두 발전 방식의 흔들림을 같은 잣대로 견줄 수 있습니다.' },
    overview: '스마트폰 플래시와 태양광 패널 사이의 거리와 비추는 각도를 바꿔 가며 패널이 만드는 전압, 전류, 전력과 20초 동안 쌓인 에너지를 기록하고, 1차시 손발전기의 결과와 견줍니다.',
    procedure: '1차시 회로를 그대로 쓴다면 발전기의 악어클립 두 개를 태양광 패널의 두 선으로 옮겨 물리고, 패널 + 클립의 핀은 다이오드 열이 아니라 INA219 VIN+ 열에 꽂으세요. 다이오드를 거치면 약 0.2 V를 잃어 약한 빛의 전력을 놓칩니다. 플래시를 켜지 않은 채 실내 조명만으로 나오는 값을 먼저 기록하세요. 플래시를 최대 밝기로 켜고 패널 가운데에 수직으로 비추며 거리 10 cm, 5 cm, 1 cm에서 20초씩 기록합니다. 이어 거리를 3 cm로 두고 수직(90°)과 비스듬히(45°) 비추는 두 조건을 비교하세요. 거리는 자로 재어 플래시를 스탠드에 고정해야 20초 동안 흔들리지 않습니다.',
    science: 'p형과 n형 반도체를 붙인 태양전지에 빛이 들어오면 광자의 에너지를 받은 전자와 정공이 생기고, 접합부의 전기장이 둘을 반대쪽으로 갈라놓아 전압이 생깁니다. 이것을 광기전력 효과라 합니다. 광원이 가까울수록 같은 넓이에 들어오는 광자가 많아져 광전류와 전력이 커집니다. 점광원이라면 빛의 세기는 거리의 제곱에 반비례하지만, 1 cm처럼 패널보다 가까운 거리에서는 플래시가 점광원으로 보이지 않아 이 관계가 맞지 않습니다. 비스듬히 비추면 같은 빛이 더 넓은 면에 퍼져 단위 넓이당 세기가 줄어듭니다. 손발전기와 달리 빛이 일정하면 출력이 거의 흔들리지 않는다는 점이 두 발전 방식의 가장 큰 차이입니다.',
    safety: '플래시를 최대 밝기로 켠 채 눈에 비추지 마세요. 패널을 1 cm까지 가까이 댈 때 휴대전화가 뜨거워지면 잠시 쉬었다가 하세요.',
    applicationGuide: '데이터 변환·분석의 요약 통계에서 조건마다 `voltage_V`의 평균, `power_mW`의 최댓값·평균·표준편차, `energy_mJ`의 마지막 값을 적으세요. 1차시의 빠르게 돌린 손발전기와 플래시 1 cm 조건을 한 표에 놓고 평균 전압, 최고 전력, 평균 전력, 20초 누적 에너지, 전력 표준편차를 견줍니다. 전력 표준편차를 평균 전력으로 나눈 값이 출력이 얼마나 흔들리는지 나타내며, 이 비교가 두 발전 방식의 장단점을 말해 줍니다.',
    troubleshooting: [
      {
        symptom: '플래시를 비춰도 전류가 0.1 mA 근처에서 거의 변하지 않음',
        cause: '패널 + 선이 아직 다이오드 열에 꽂혀 있거나, 패널의 +와 −가 바뀌었습니다.',
        fix: '패널 + 클립의 핀을 INA219 VIN+ 열로 옮기고, 패널 뒷면의 빨간 선이 + 클립에 물렸는지 확인하세요.',
      },
      {
        symptom: '같은 거리인데 기록마다 전력이 크게 다름',
        cause: '플래시를 손으로 들어 거리와 각도가 흔들렸거나 패널 가운데를 벗어났습니다.',
        fix: '플래시를 스탠드나 책 더미에 고정하고 패널 가운데에 표시를 해 두세요.',
      },
      i2cTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'f3-rectifier-rpm-efficiency',
    title: '정류·평활 회로와 회전수로 확인하는 발전기',
    subject: '물리',
    type: 'project',
    difficulty: '고급',
    minutes: 70,
    sensors: ['ina219', 'hbe0704'],
    coreKeywords: ['정류', '평활', '커패시터', '회전수', '유도 기전력', '에너지 변환 효율', '홀 센서'],
    connections: [
      ...ina219(),
      ...generatorLoop(100),
      { from: 'CAPACITOR_100.1', to: 'INA219.VIN-', color: 'orange', text: '100 µF 전해 커패시터의 긴 다리(+)를 INA219 VIN-에서 나온 줄과 같은 열에 꽂으세요. 미션 A의 커패시터 조건에서만 꽂습니다.' },
      { from: 'CAPACITOR_100.2', to: 'UNO.GND', color: 'black', text: '커패시터의 흰 띠가 있는 짧은 다리(−)를 GND 줄에 꽂으세요. 거꾸로 꽂으면 부풀거나 터질 수 있습니다.' },
      ...hallSensor('A0'),
    ],
    sketch: rectifierRpmSketch,
    tunable: { anchor: 'magnetThreshold', name: '자석 감지 문턱 (ADC 값)', hint: '60에서 시작하세요. 자석이 지나가도 rpm이 0이면 낮추고, 멈춰 있는데 rpm이 튀면 높이세요.' },
    overview: '1차시 발전기 회로에 홀 센서와 커패시터를 더해 세 가지를 확인합니다. 커패시터가 출렁이는 발전기 전압을 얼마나 고르게 펴는지, 바퀴의 회전수와 유도 기전력이 정비례하는지, TT모터 두 개를 맞물렸을 때 전동기에 넣은 전력 중 몇 퍼센트가 발전기에서 나오는지입니다.',
    procedure: '미션 A: 커패시터를 빼고 손잡이를 20초 돌려 기록한 뒤, 커패시터를 꽂고 같은 빠르기로 다시 기록하세요. 이어 손발전기 교구의 USB 5V 정전압 모듈을 발전기와 다이오드 사이에 넣고 빠르게 돌려 전압이 5 V 위로 오르지 않는지 확인합니다. 미션 B: TT모터 바퀴 가장자리에 작은 자석을 양면테이프로 붙이고, 홀 센서를 바퀴 옆 0.5~1 cm에 고정하세요. 아두이노를 켤 때는 자석을 센서에서 멀리 두어야 기준값이 맞습니다. 바퀴를 느리게부터 빠르게까지 여러 빠르기로 각각 10초씩 일정하게 돌립니다. 미션 C: TT모터 2개의 바퀴를 맞닿게 고정하고, 1번 모터를 AA 건전지 2개(3 V)로 돌려 2번 모터가 만든 전력을 기록하세요. 그다음 건전지 + → INA219 VIN+ → VIN- → 1번 모터 → 건전지 −로 INA219를 옮겨 1번 모터가 받는 전력을 같은 방법으로 기록합니다. 건전지 −는 아두이노 GND와 묶어 둡니다.',
    science: '발전기 전압은 코일이 자석 사이를 돌 때마다 오르내리는 맥류입니다. 다이오드가 한 방향만 통과시키고(정류), 부하와 나란히 꽂은 커패시터가 전압이 높을 때 전하를 채웠다가($Q = CV$) 낮을 때 내보내 골을 메웁니다(평활). 100 µF와 100 Ω의 시간상수는 10 ms이므로 이보다 느린 손잡이 출렁임은 다 지우지 못합니다. 정전압 모듈은 넘치는 전압을 버려 출력을 5 V로 묶습니다. 패러데이 법칙에 따르면 자석과 코일이 같을 때 유도 기전력은 회전 빠르기에 비례하므로, 부하를 연결해 코일의 내부저항 몫이 빠지더라도 회전수와 전압은 직선에 놓여야 합니다. 다이오드가 약 0.2 V를 먹으므로 그 직선은 원점보다 조금 아래에서 가로축을 지납니다. 맞물린 두 모터에서는 코일의 열, 기어와 바퀴의 마찰, 미끄러짐으로 에너지를 잃으므로 효율 $\\eta = P_{\\text{out}}/P_{\\text{in}} \\times 100\\%$는 100%보다 한참 작습니다.',
    safety: '전해 커패시터는 흰 띠 쪽(−)을 GND에 꽂으세요. 거꾸로 꽂고 빠르게 돌리면 부풀거나 터질 수 있습니다. 25 V 커패시터이므로 손발전기 전압이 25 V를 넘지 않게 하세요. 돌아가는 바퀴에 손가락과 머리카락이 끼지 않게 하세요.',
    applicationGuide: '미션 A는 커패시터가 있을 때와 없을 때의 `voltage_V` 표준편차를 구해 몇 퍼센트 줄었는지 적으세요. 미션 B는 데이터 변환·분석에서 가로축을 `rpm`, 세로축을 `voltage_V`로 두고 산점도와 추세선을 그려 직선의 기울기(V/rpm)와 결정계수를 적습니다. `rpm`이 0인 줄은 빼고 그리세요. 미션 C는 두 기록에서 평균 `power_mW`를 구해 발전기 쪽을 전동기 쪽으로 나눈 값이 효율입니다.',
    troubleshooting: [
      {
        symptom: '바퀴가 도는데 rpm이 계속 0',
        cause: '자석이 센서에서 멀어 `mag_delta`가 문턱(60)을 넘지 못하거나, 30 rpm보다 느리게 돌고 있습니다.',
        fix: '바퀴를 돌리며 `mag_delta`가 봉우리마다 얼마까지 오르는지 보고, 문턱을 그 절반쯤으로 낮추거나 센서를 바퀴에 더 붙이세요.',
      },
      {
        symptom: 'rpm이 실제보다 두 배쯤 크게 나옴',
        cause: '자석의 두 극이 차례로 센서를 지나며 한 바퀴에 봉우리가 둘 생겼습니다.',
        fix: '자석을 한쪽 극만 센서를 향하게 눕혀 붙이고, 아두이노를 다시 켜 기준값을 새로 재세요.',
      },
      reverseTurnTroubleshooting,
      contactTroubleshooting,
    ],
  }),
]
