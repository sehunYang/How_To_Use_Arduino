import { createPhase6Recipe, hallPulseDriver, type Phase6RecipeDefinition } from './shared'

/** Shared wording for recipes whose tunable is a DS18B20 count, not an interval. */
const sensorCountTunable = {
  name: '센서 개수',
  hint: '실제로 1-Wire 버스에 연결해 확인한 DS18B20 개수와 같게 설정하세요.',
}

const mechanics: Phase6RecipeDefinition[] = [
  {
    id: 'ph01-uniform-motion',
    title: '등속 직선운동의 위치-시간 그래프',
    difficulty: '초급', minutes: 45, sensors: ['hc-sr04'],
    keywords: ['등속운동', '위치', '속도', '기울기'],
    law: '등속 직선운동에서는 위치가 $x=x_0+vt$를 따라 시간에 선형적으로 변하며 위치-시간 그래프의 기울기가 속도입니다.',
    apparatus: 'HC-SR04, 저속 카트, 카트에 붙일 평평한 반사판(카드), 직선 트랙, 자, Arduino UNO, 브레드보드',
    method: '센서를 트랙 끝에 고정하고 카트를 일정한 속력으로 움직여 거리와 시간을 기록합니다. 출발 위치와 속력을 바꿔 각각 3회 반복하세요.',
    graph: '$x$-$t$ 산점도에 직선을 적합하고 기울기 $v$, 절편 $x_0$, 결정계수와 반복 측정 불확도를 구합니다.',
  },
  {
    id: 'ph02-newton-second-law',
    title: '뉴턴 제2법칙과 질량-가속도 관계',
    difficulty: '중급', minutes: 60, sensors: ['mpu6050'],
    keywords: ['뉴턴 제2법칙', '힘', '질량', '가속도'],
    law: '합력이 일정하면 가속도는 질량에 반비례하고 $F=ma$를 만족합니다.',
    apparatus: 'MPU6050, 저속 카트, 추와 실, 질량추 세트, 도르래, Arduino UNO, 브레드보드',
    method: '당기는 힘을 고정한 채 카트 질량을 바꾸고 수평축 가속도를 기록합니다. 센서 영점과 트랙 기울기를 먼저 보정하세요.',
    graph: '가속도 a를 1/m에 대해 그려 기울기에서 합력을 추정하고 마찰로 생기는 절편을 해석합니다.',
  },
  {
    id: 'ph03-projectile-motion',
    title: '발사체의 비행시간과 포물선 운동',
    difficulty: '고급', minutes: 70, sensors: ['mpu6050', 'hc-sr04'],
    keywords: ['포물선운동', '비행시간', '수평속도', '중력'],
    law: '공기저항을 무시하면 수평으로 발사된 물체의 수평 운동은 등속, 수직 운동은 등가속이므로, 비행시간은 높이가 정하고 수평 도달 거리는 발사 속력과 비행시간의 곱입니다.',
    apparatus: 'MPU6050, HC-SR04, 수평 책상, 공을 굴릴 낮은 경사로, 쇠구슬 또는 단단한 작은 공, 줄자, 착지점을 표시할 먹지와 흰 종이, 포획 상자, Arduino UNO, 브레드보드',
    method: 'MPU6050을 책상에 올려 두 축 가속도로 책상이 수평인지 먼저 확인합니다. HC-SR04를 책상 위에서 굴러오는 공을 향해 고정하고, 공이 가장자리로 접근하는 거리-시간 기록의 기울기로 발사 속력 $v$를 구합니다. 책상 높이 $h$를 재어 비행시간 $t=\\sqrt{2h/g}$를 계산하고, 바닥의 먹지에 찍힌 착지점까지의 수평 거리를 줄자로 재어 예측 거리 $v\\,t$와 비교합니다. 날아가는 공을 센서로 추적하지는 않습니다.',
    graph: '발사 속력을 바꿔 가며 예측 수평거리와 실측 수평거리를 같은 그래프에 그리고, 기울기 1의 직선에서 벗어나는 정도로 공기저항과 속력 측정 오차를 평가합니다.',
    safety: '사람을 향해 발사하지 말고 가벼운 물체와 포획 상자를 사용하세요.',
  },
  {
    id: 'ph04-momentum-collision',
    title: '충돌 전후 운동량 비교',
    difficulty: '고급', minutes: 75, sensors: ['mpu6050', 'mpu6050'],
    sensorTokens: ['MPU6050_1', 'MPU6050_2'],
    keywords: ['운동량', '충돌', '보존법칙', '충격량'],
    law: '외력이 무시되는 짧은 충돌 동안 두 물체의 전체 운동량은 보존됩니다.',
    apparatus: 'MPU6050 2개, 저속 카트 2대, 용수철·스펀지 완충 범퍼, 질량추, 트랙, Arduino UNO, 브레드보드 (시리얼 모니터 115200 baud)',
    method: 'AD0로 두 센서 주소를 분리해 카트마다 하나씩 단단히 고정하고, 리드선은 느슨하게 늘어뜨려 카트 운동을 방해하지 않게 합니다. 두 카트 사이에 완충 범퍼를 붙여 충돌이 50 ms 이상 걸리게 하고, 시리얼 모니터를 115200으로 맞추세요. 등속으로 굴러가는 동안 가속도계는 0을 읽으므로 속도 자체는 적분으로 얻을 수 없습니다. 대신 충돌 구간의 가속도를 시간 적분해 각 카트의 속도 변화량 $\\Delta v$를 구합니다. 질량과 충돌 형태를 바꿔 반복하세요.',
    graph: '두 카트의 $m\\,\\Delta v$를 비교해 $m_1\\Delta v_1+m_2\\Delta v_2=0$이 측정 불확도 안에서 성립하는지 확인하고, 탄성·비탄성 조건별 차이를 비교합니다.',
    sketch: `#include <Wire.h>
// @baud 115200
const byte MPU_ADDRESSES[2]={0x68,0x69};
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=5; // 200 Hz — 수십 ms 충돌에 표본 10개 이상을 남깁니다.
void mpuWrite(byte a,byte r,byte v){Wire.beginTransmission(a);Wire.write(r);Wire.write(v);Wire.endTransmission();}
int16_t mpuRead16(byte a,byte r){
  Wire.beginTransmission(a);Wire.write(r);Wire.endTransmission(false);Wire.requestFrom(a,(byte)2);
  byte high=Wire.read();byte low=Wire.read(); // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}
void setup(){
  Serial.begin(115200);Wire.begin();Wire.setClock(400000);
  for(byte i=0;i<2;i++){
    mpuWrite(MPU_ADDRESSES[i],0x6B,0);
    mpuWrite(MPU_ADDRESSES[i],0x1A,0x01); // 대역폭 184 Hz — 짧은 충돌 봉우리를 뭉개지 않습니다.
    mpuWrite(MPU_ADDRESSES[i],0x1C,0x18); // ±16 g — 충돌 봉우리는 ±2 g 기본 범위를 넘습니다.
  }
  Serial.println("time_ms,mpu0_ax_g,mpu1_ax_g");
}
void loop(){
  static unsigned long last=0;
  if(millis()-last<samplingIntervalMs)return;
  last=millis();
  Serial.print(last);
  for(byte i=0;i<2;i++){Serial.print(',');Serial.print(mpuRead16(MPU_ADDRESSES[i],0x3B)/2048.0f,4);}
  Serial.println();
}`,
  },
  {
    id: 'ph05-restitution-coefficient',
    title: '공의 반발계수 측정',
    difficulty: '중급', minutes: 50, sensors: ['hc-sr04'],
    keywords: ['반발계수', '낙하', '반발높이', '에너지'],
    law: '바닥이 정지해 있을 때 반발계수는 연속한 낙하·반발 높이로 $e\\approx\\sqrt{h_2/h_1}$로 구할 수 있습니다.',
    apparatus: 'HC-SR04, 공 여러 종류, 단단한 수평 바닥, 낙하 가이드, Arduino UNO, 브레드보드',
    method: '초음파 센서를 공의 수직 이동선 위에 고정하고 여러 높이에서 놓아 첫 반발 최고점을 찾습니다.',
    graph: '$h_2$를 $h_1$에 대해 그리고 기울기의 제곱근으로 $e$를 구해 재질별 에너지 손실을 비교합니다.',
  },
  {
    id: 'ph06-spring-oscillation',
    title: '용수철 진동의 주기와 질량',
    difficulty: '중급', minutes: 60, sensors: ['mpu6050'],
    keywords: ['단순조화운동', '용수철', '주기', '질량'],
    law: '이상적인 질량-용수철 진동의 주기는 $T=2\\pi\\sqrt{m/k}$이며 $T^2$은 질량에 선형입니다.',
    apparatus: 'MPU6050, 용수철, 질량추, 안전 고정대, Arduino UNO, 브레드보드',
    method: '센서를 질량추에 단단히 고정하고 작은 진폭으로 진동시킵니다. 질량을 단계적으로 바꿔 10주기 이상 기록하세요.',
    graph: '$T^2$-$m$ 그래프의 기울기에서 용수철 상수 $k$를 구하고 유효질량에 의한 절편을 해석합니다.',
  },
  {
    id: 'ph07-centripetal-acceleration',
    title: '구심가속도와 회전반경',
    difficulty: '고급', minutes: 65, sensors: ['mpu6050'],
    keywords: ['구심가속도', '각속도', '회전반경', '원운동'],
    law: '등속 원운동의 구심가속도는 $a_c=\\omega^2r$입니다.',
    apparatus: 'MPU6050, 저속 회전판, 반경 표시 자, 보호 덮개, Arduino UNO, 브레드보드',
    method: '센서의 x축을 반지름 방향으로, z축을 회전축과 나란하게 정렬합니다. 구심가속도는 반지름 방향 가속도 열에서, 각속도 $\\omega$는 자이로 z축 열(gyro_z_dps)에서 얻습니다. 반경과 회전 속도를 한 번에 하나씩 바꿔 측정하세요.',
    graph: '고정 반경에서는 $a_c$-$\\omega^2$, 고정 각속도에서는 $a_c$-$r$ 그래프를 만들고 선형성을 검증합니다. $\\omega$는 gyro_z_dps를 rad/s로 바꾸어 사용합니다($\\times\\pi/180$).',
    safety: '센서와 배터리를 이중 고정하고 회전 중 보호 덮개 밖으로 손을 넣지 마세요.',
    // The shared MPU sketch logs acceleration only, so a_c-ω² could not be
    // plotted from it. This variant adds the gyro z channel the guide needs.
    sketch: `#include <Wire.h>
// @baud 9600
int16_t mpuRead16(byte reg){
  Wire.beginTransmission(0x68);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(0x68,(byte)2);
  byte high=Wire.read();byte low=Wire.read(); // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}
void mpuWrite(byte reg,byte value){Wire.beginTransmission(0x68);Wire.write(reg);Wire.write(value);Wire.endTransmission();}
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=100;
void setup(){
  Serial.begin(9600);Wire.begin();mpuWrite(0x6B,0);
  Serial.println("time_ms,acceleration_x_g,acceleration_y_g,acceleration_z_g,gyro_z_dps");
}
void loop(){
  float ax=mpuRead16(0x3B)/16384.0f,ay=mpuRead16(0x3D)/16384.0f,az=mpuRead16(0x3F)/16384.0f;
  float gz=mpuRead16(0x47)/131.0f;
  Serial.print(millis());Serial.print(',');Serial.print(ax,5);Serial.print(',');
  Serial.print(ay,5);Serial.print(',');Serial.print(az,5);Serial.print(',');
  Serial.println(gz,3);
  delay(samplingIntervalMs);
}`,
  },
  {
    id: 'ph08-rpm-comparison',
    title: '회전체 각속도와 RPM 비교',
    difficulty: '중급', minutes: 55, sensors: ['mpu6050', 'hbe0704'],
    keywords: ['각속도', 'RPM', '홀 센서', '자이로스코프'],
    law: '자이로스코프의 각속도와 자석 통과 펄스의 주파수는 $\\mathrm{RPM}=60f/N$ 관계로 같은 회전율을 나타냅니다.',
    apparatus: 'MPU6050, HBE0704, 작은 자석, 저속 회전판, Arduino UNO, 브레드보드',
    method: '자석 수 N을 기록하고 홀 센서 펄스와 자이로 각속도를 동시에 측정합니다. 여러 속도에서 두 결과를 비교하세요.',
    graph: '홀 센서 RPM을 자이로 RPM에 대해 그려 기울기 1과 절편 0에서 벗어나는 정도를 분석합니다.',
  },
  {
    id: 'ph09-friction-coefficients',
    title: '정지 마찰계수와 운동 마찰계수',
    difficulty: '중급', minutes: 55, sensors: ['mpu6050'],
    keywords: ['마찰계수', '경사면', '정지마찰', '운동마찰'],
    law: '물체가 막 미끄러지기 시작하는 경사각 $\\theta$에서 $\\mu_s\\approx\\tan\\theta$이며 미끄러지는 가속도로 운동마찰계수를 추정할 수 있습니다.',
    apparatus: 'MPU6050, 각도 조절 경사면, 시험 재료, Arduino UNO, 브레드보드',
    method: '센서로 경사각을 측정하며 판을 천천히 올려 미끄럼 시작각을 기록합니다. 이후 일정 각도에서 하강 가속도를 측정하세요.',
    graph: '재료별 $\\mu_s$와 $\\mu_k$를 오차막대와 함께 비교하고 표면 상태에 따른 산포를 분석합니다.',
  },
  {
    id: 'ph10-rotational-damping',
    title: '회전 감쇠와 에너지 손실',
    difficulty: '고급', minutes: 65, sensors: ['mpu6050', 'hbe0704'],
    keywords: ['회전감쇠', '각속도', '에너지손실', '지수감쇠'],
    law: '점성 감쇠가 주된 원인이면 각속도 또는 진폭의 바깥 경계를 이은 선이 시간에 따라 지수적으로 감소합니다.',
    apparatus: 'MPU6050, HBE0704, 자석, 회전판, 교체 가능한 제동 재료, Arduino UNO, 브레드보드',
    method: '같은 초기 회전속도에서 제동 조건만 바꾸고 자이로 각속도와 홀 펄스 간격을 기록합니다.',
    graph: '$\\ln(\\omega/\\omega_0)$-$t$ 그래프의 기울기로 감쇠상수를 구하고 조건별 회전 에너지 손실률을 비교합니다.',
  },
]

const thermal: Phase6RecipeDefinition[] = [
  {
    id: 'ph11-specific-heat',
    title: '물질의 비열 비교',
    difficulty: '중급', minutes: 80, sensors: ['ds18b20', 'ds18b20'],
    sensorTokens: ['DS18B20_1', 'DS18B20_2'],
    keywords: ['비열', '열량', '온도변화', '열평형'],
    law: '같은 열량 $Q$를 같은 질량 $m$에 공급하면 온도 변화는 $\\Delta T=Q/(mc)$에 따라 비열 $c$에 반비례합니다.',
    apparatus: 'DS18B20 2개, 동일 질량 시료, 저전압 정격 히터, 단열 용기, 전력계, Arduino UNO, 브레드보드',
    method: '시료 질량과 공급 전력을 같게 유지하고 두 시료의 온도를 일정 간격으로 기록합니다.',
    graph: '초기 선형 구간의 $dT/dt$와 공급 전력으로 비열비를 구하고 용기 열용량과 열손실을 오차로 평가합니다.',
    tunable: sensorCountTunable,
    safety: '화상 방지를 위해 저온 범위와 정격 전력만 사용하고 교사가 히터 전원을 관리하세요.',
  },
  {
    id: 'ph12-latent-heat',
    title: '얼음의 융해 잠열 곡선',
    difficulty: '중급', minutes: 90, sensors: ['ds18b20'],
    keywords: ['융해', '잠열', '상변화', '가열곡선'],
    law: '상변화 중에는 공급된 열이 잠열에 쓰이므로 온도 상승이 일시적으로 작아지는 평탄 구간이 나타납니다.',
    apparatus: 'DS18B20, 잘게 부순 얼음, 단열 컵, 저전압 정격 히터, 전력계, 저울, Arduino UNO, 브레드보드',
    method: '얼음과 물의 질량을 기록하고 일정한 낮은 전력으로 가열하면서 완전히 녹을 때까지 온도를 기록합니다.',
    graph: '온도-시간 가열곡선에서 평탄 구간의 시간과 전력으로 융해에 사용된 에너지를 추정합니다.',
    safety: '센서의 방수 등급을 확인하고 히터 단자와 물이 접촉하지 않게 분리하세요.',
  },
  {
    id: 'ph13-thermal-conductivity',
    title: '재료별 열전도율 비교',
    difficulty: '고급', minutes: 75, sensors: ['ds18b20', 'ds18b20'],
    sensorTokens: ['DS18B20_1', 'DS18B20_2'],
    keywords: ['열전도', '거리별 온도 변화율', '푸리에법칙', '재료'],
    law: '정상상태 전도 열률은 $P=kA\\Delta T/L$이며 같은 형상에서는 거리에 따른 온도 변화율과 열전도율의 관계를 비교할 수 있습니다.',
    apparatus: 'DS18B20 2개, 같은 치수의 재료 막대, 저전압 히터, 단열재, Arduino UNO, 브레드보드',
    method: '막대 양 끝에 센서를 고정하고 한쪽만 일정 전력으로 가열해 정상상태의 온도차를 측정합니다.',
    graph: '재료별 정상 온도차와 도달 시간을 비교하고 알려진 기준 재료에 대한 상대 열전도율을 구합니다.',
    tunable: sensorCountTunable,
  },
  {
    id: 'ph14-insulation-performance',
    title: '단열재 성능 비교',
    difficulty: '초급', minutes: 70, sensors: ['ds18b20', 'bme280'],
    keywords: ['단열', '냉각곡선', '열손실', '뉴턴냉각'],
    law: '주변 조건이 일정하면 물체와 주변의 온도차는 뉴턴 냉각 법칙에 따라 근사적으로 지수 감소합니다.',
    apparatus: 'DS18B20, BME280, 동일 용기, 단열재 시료, 따뜻한 물, Arduino UNO, 브레드보드',
    method: 'BME280으로 주변 온·습도를 기록하고 동일한 초기온도의 용기를 서로 다른 단열재로 감싸 냉각곡선을 측정합니다.',
    graph: '$\\ln\\!\\left[(T-T_{\\mathrm{환경}})/(T_0-T_{\\mathrm{환경}})\\right]$-$t$ 기울기로 냉각상수를 구해 단열 성능을 비교합니다.',
  },
  {
    id: 'ph15-gas-temperature-pressure',
    title: '기체의 온도-압력 관계',
    difficulty: '고급', minutes: 80, sensors: ['bme280'],
    keywords: ['이상기체', '온도', '압력', '게이뤼삭법칙'],
    law: '부피와 기체량이 일정한 저압 범위에서 절대압력은 절대온도에 비례합니다.',
    apparatus: 'BME280, 압력 해제 가능한 교육용 밀폐 용기, 온수·냉수 욕조, Arduino UNO, 브레드보드',
    method: '용기 정격을 넘지 않는 작은 온도 범위에서 충분히 열평형을 기다린 뒤 온도와 절대압력을 기록합니다.',
    graph: 'P-T(K) 그래프에 가장 잘 맞는 직선을 그리고 절편과 측정값-예측값의 차이로 누설·부피 변화·센서 자기발열을 평가합니다.',
    safety: '유리병이나 완전 밀폐 용기를 가열하지 말고 압력 해제 장치가 있는 교육용 용기만 사용하세요.',
  },
  {
    id: 'ph16-altitude-pressure',
    title: '고도 변화와 기압',
    difficulty: '초급', minutes: 50, sensors: ['bme280'],
    keywords: ['기압', '고도', '정역학', '대기'],
    law: '작은 고도 차에서는 정역학 관계 $\\Delta P\\approx-\\rho g\\Delta h$가 성립하며 기압이 높이에 따라 감소합니다.',
    apparatus: 'BME280, 줄자, 계단 또는 엘리베이터가 아닌 안전한 높이 지점, Arduino UNO, 브레드보드',
    method: '센서를 같은 자세로 유지하고 기준층부터 여러 높이에서 안정된 기압과 온도를 기록합니다.',
    graph: '기압차-높이 그래프의 기울기에서 공기 밀도를 추정하고 시간이 지나며 날씨 때문에 기준값이 서서히 변하는 현상을 보정합니다.',
  },
]

const electricity: Phase6RecipeDefinition[] = [
  {
    id: 'ph17-ohms-law', title: '옴의 법칙 V-I 특성', difficulty: '초급', minutes: 50, sensors: ['ina219'],
    keywords: ['옴의 법칙', '전압', '전류', '저항'],
    law: '옴성 저항에서는 전압과 전류가 $V=IR$의 선형 관계를 따릅니다. UNO의 analogWrite()는 진짜 아날로그 전압이 아니라 PWM이므로, RC 저역통과 필터로 평활한 뒤 실제 전압을 INA219로 측정합니다.',
    apparatus: 'INA219, 100 Ω RC 필터 저항, 470 µF 전해 커패시터, 1 kΩ·2.2 kΩ·4.7 kΩ 측정 저항, 수-암(MF) 점퍼선, Arduino UNO, 브레드보드',
    method: '먼저 1 kΩ 저항을 연결하고 코드의 conditionId를 R1K로 맞춥니다. D9 PWM 듀티를 단계적으로 올리고 RC 출력이 안정될 때까지 기다린 뒤 INA219가 측정한 저항 양단의 실제 전압과 전류를 기록합니다. 전원을 끈 뒤 측정 저항을 2.2 kΩ, 4.7 kΩ으로 바꿀 때마다 conditionId도 각각 R2K2, R4K7로 바꾸어 반복합니다.',
    graph: 'PWM 듀티가 아니라 INA219가 측정한 실제 V-I 데이터를 그립니다. 각 직선의 V/I 또는 기울기에서 저항을 구해 표시값과 비교합니다. INA219의 전류 분해능은 약 0.1 mA이므로 4.7 kΩ 조건(약 0.1~1 mA)은 눈금 1~10칸에 불과합니다. 이 조건은 같은 듀티에서 여러 번 재어 평균을 쓰고, 불확도를 반드시 함께 표시하세요.',
    tunable: {
      name: '듀티 변경 후 안정화 시간 (ms)',
      hint: 'RC 필터의 시정수는 약 47 ms입니다. 출력이 완전히 안정되도록 그 5배 이상으로 두세요.',
    },
    safety: '커패시터의 +극은 평활 노드, -극은 GND에 연결하세요. UNO D9의 과전류를 막기 위해 측정 저항은 1 kΩ 이상만 사용하고, 100 Ω·220 Ω 저항을 직접 연결하지 마세요.',
    connections: [
      { from: 'INA219.VCC', to: 'UNO.5V', color: 'red', text: 'INA219 VCC를 브레드보드 + 전원 레일에 연결하세요.' },
      { from: 'INA219.GND', to: 'UNO.GND', color: 'black', text: 'INA219 GND를 브레드보드 - 전원 레일에 연결하세요.' },
      { from: 'INA219.SDA', to: 'UNO.A4', color: 'green', text: 'INA219 SDA를 UNO A4(SDA)에 직접 연결하세요.' },
      { from: 'INA219.SCL', to: 'UNO.A5', color: 'yellow', text: 'INA219 SCL을 UNO A5(SCL)에 직접 연결하세요.' },
      { from: 'RESISTOR_100.1', to: 'UNO.D9', color: 'orange', text: '브레드보드에 꽂은 100 Ω RC 필터 저항 1번 다리를 UNO D9 PWM 출력에 연결하세요.' },
      { from: 'RESISTOR_100.2', to: 'CAPACITOR.1', color: 'orange', text: '100 Ω 저항 2번 다리와 470 µF 커패시터 +극을 같은 브레드보드 단자 열에 연결해 평활 노드를 만드세요.' },
      { from: 'RESISTOR_100.2', to: 'INA219.VIN+', color: 'red', text: '평활 노드가 있는 브레드보드 단자 열을 INA219 VIN+에 연결하세요.' },
      { from: 'CAPACITOR.2', to: 'UNO.GND', color: 'black', text: '470 µF 커패시터 -극을 브레드보드 - 전원 레일에 연결하세요.' },
      { from: 'INA219.VIN-', to: 'RESISTOR_1000.1', color: 'purple', text: 'INA219 VIN-를 브레드보드에 꽂은 1 kΩ 측정 저항 1번 다리에 연결하세요.' },
      { from: 'RESISTOR_1000.2', to: 'UNO.GND', color: 'black', text: '1 kΩ 측정 저항 2번 다리를 브레드보드 - 전원 레일에 연결하세요.' },
    ],
    sketch: `#include <Wire.h>
// @baud 9600
// @pin PWM_OUT=D9
const byte PWM_OUT = 9;
const float INA_SHUNT_OHMS = 0.1f;
const char* conditionId = "R1K"; // R1K, R2K2, R4K7 중 실제 연결한 저항과 맞추세요.
// @tunable settlingMs
unsigned long settlingMs = 800;

int16_t readIna(byte reg){
  Wire.beginTransmission(0x40);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(0x40,(byte)2);
  byte high=Wire.read();byte low=Wire.read(); // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}

void setup() {
  Serial.begin(9600);
  Wire.begin();
  pinMode(PWM_OUT, OUTPUT);
  analogWrite(PWM_OUT, 0);
  Serial.println("condition_id,duty,bus_V,shunt_mV,current_mA");
}

void loop() {
  static int duty = 26;
  analogWrite(PWM_OUT, duty);
  delay(settlingMs);

  float busV = (readIna(0x02) >> 3) * 0.004f;
  float shuntMv = readIna(0x01) * 0.01f;
  float currentMa = shuntMv / INA_SHUNT_OHMS;

  Serial.print(conditionId);
  Serial.print(',');
  Serial.print(duty);
  Serial.print(',');
  Serial.print(busV, 4);
  Serial.print(',');
  Serial.print(shuntMv, 4);
  Serial.print(',');
  Serial.println(currentMa, 3);

  duty += 26;
  if (duty > 234) {
    analogWrite(PWM_OUT, 0);
    duty = 26;
    delay(2000);
  }
}`,
  },
  {
    id: 'ph18-series-parallel-resistance', title: '직렬·병렬 저항의 등가저항', difficulty: '중급', minutes: 60, sensors: ['ina219'],
    keywords: ['직렬회로', '병렬회로', '등가저항', '전류'],
    law: '직렬은 $R_{\\mathrm{eq}}=\\sum_i R_i$, 병렬은 $1/R_{\\mathrm{eq}}=\\sum_i(1/R_i)$를 만족합니다.',
    apparatus: 'INA219, 220 Ω 저항 1개, 1 kΩ 저항 1개, 5 V 저전압 전원(3 V에서는 직렬 전류가 분해능에 가까워집니다), Arduino UNO, 브레드보드',
    method: '그림처럼 220 Ω과 1 kΩ을 직렬로 연결하고 코드의 conditionId를 SERIES_220_1000으로 맞춰 측정합니다. 전원을 끈 뒤 두 저항의 양 끝을 각각 같은 두 마디에 꽂아 병렬로 다시 배선하고 conditionId를 PARALLEL_220_1000으로 바꿔 측정합니다. 두 조건에서 INA219는 항상 전원과 저항망 사이에 직렬로 둡니다.',
    graph: 'V/I로 계산한 등가저항을 이론값과 비교하고 저항 허용오차가 결과 범위에 포함되는지 판단합니다.',
    connections: [
      { from: 'INA219.VCC', to: 'UNO.5V', color: 'red', text: 'INA219 VCC를 브레드보드 + 전원 레일에 연결하세요.' },
      { from: 'INA219.GND', to: 'UNO.GND', color: 'black', text: 'INA219 GND를 브레드보드 - 전원 레일에 연결하세요.' },
      { from: 'INA219.SDA', to: 'UNO.A4', color: 'green', text: 'INA219 SDA를 UNO A4에 연결하세요.' },
      { from: 'INA219.SCL', to: 'UNO.A5', color: 'yellow', text: 'INA219 SCL을 UNO A5에 연결하세요.' },
      { from: 'BATTERY.+', to: 'INA219.VIN+', color: 'red', text: '저전압 전원 +를 INA219 VIN+에 연결하세요.' },
      { from: 'INA219.VIN-', to: 'RESISTOR_220.1', color: 'orange', text: '기본 SERIES 조건에서 INA219 VIN-를 220 Ω 저항 1번 다리에 연결하세요.' },
      { from: 'RESISTOR_220.2', to: 'RESISTOR_1000.1', color: 'purple', text: '기본 SERIES 조건에서 220 Ω 저항과 1 kΩ 저항을 직렬로 연결하세요.' },
      { from: 'RESISTOR_1000.2', to: 'BATTERY.-', color: 'black', text: '1 kΩ 저항의 남은 다리를 전원 -에 연결하세요.' },
      { from: 'BATTERY.-', to: 'UNO.GND', color: 'black', text: '전원 -와 UNO GND를 공통 접지하세요.' },
    ],
    sketch: `#include <Wire.h>
// @baud 9600
const float INA_SHUNT_OHMS = 0.1f;
const char* conditionId = "SERIES_220_1000"; // 병렬 재배선 뒤 PARALLEL_220_1000으로 바꾸세요.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 500;
int16_t readIna(byte reg){
  Wire.beginTransmission(0x40);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(0x40,(byte)2);
  byte high=Wire.read();byte low=Wire.read(); // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}
void setup(){Serial.begin(9600);Wire.begin();Serial.println("condition_id,time_ms,bus_V,current_mA,equivalent_ohm");}
void loop(){
  float busV=(readIna(0x02)>>3)*0.004f,shuntMv=readIna(0x01)*0.01f,currentMa=shuntMv/INA_SHUNT_OHMS;
  float equivalentOhm=currentMa==0?NAN:busV/(currentMa/1000.0f);
  Serial.print(conditionId);Serial.print(',');Serial.print(millis());Serial.print(',');Serial.print(busV,4);Serial.print(',');Serial.print(currentMa,3);Serial.print(',');Serial.println(equivalentOhm,2);
  delay(samplingIntervalMs);
}`,
  },
  {
    id: 'ph19-kirchhoff-laws', title: '키르히호프 전압·전류 법칙', difficulty: '고급', minutes: 75, sensors: ['ina219'],
    keywords: ['키르히호프', '마디', '폐회로', '전류보존'],
    law: '마디에서 전류의 대수합은 0이고 폐회로에서 전위차의 대수합은 0입니다.',
    apparatus: 'INA219, 220 Ω·470 Ω·1 kΩ 저항, 저전압 전원, 측정점 전환 점퍼, Arduino UNO, 브레드보드',
    method: '그림처럼 220 Ω과 470 Ω의 두 갈래 병렬 회로를 구성합니다. 먼저 INA219를 분기 전 공통선에 두고 conditionId=TOTAL로 전체 전류를 기록합니다. 전원을 끈 뒤 INA219를 220 Ω 가지와 470 Ω 가지에 차례로 직렬 이동하고 conditionId를 BRANCH_220, BRANCH_470으로 바꿔 기록합니다. 각 조건에서 저항 양단 전압도 함께 기록해 전체 전류와 두 가지 전류의 합, 각 고리 전압강하를 비교합니다. 가지로 옮길 때는 분기 마디를 VIN+에, 해당 저항 1번 다리를 VIN-에 연결합니다. 전원 전압은 TOTAL 조건에서 bus_V에 shunt_mV÷1000을 더해 구합니다.',
    graph: '마디 전류의 측정값-예측값 차이와 고리 전압의 측정값-예측값 차이를 계산해 측정 불확도 범위에서 0인지 확인합니다.',
    connections: [
      { from: 'INA219.VCC', to: 'UNO.5V', color: 'red', text: 'INA219 VCC를 UNO 5V에 연결하세요.' },
      { from: 'INA219.GND', to: 'UNO.GND', color: 'black', text: 'INA219 GND를 UNO GND에 연결하세요.' },
      { from: 'INA219.SDA', to: 'UNO.A4', color: 'green', text: 'INA219 SDA를 UNO A4에 연결하세요.' },
      { from: 'INA219.SCL', to: 'UNO.A5', color: 'yellow', text: 'INA219 SCL을 UNO A5에 연결하세요.' },
      { from: 'BATTERY.+', to: 'INA219.VIN+', color: 'red', text: 'TOTAL 조건에서 전원 +를 INA219 VIN+에 연결하세요.' },
      { from: 'INA219.VIN-', to: 'RESISTOR_220.1', color: 'orange', text: 'INA219 VIN- 뒤 분기 마디를 220 Ω 가지 입력에 연결하세요.' },
      { from: 'INA219.VIN-', to: 'RESISTOR_470.1', color: 'orange', text: '같은 분기 마디를 470 Ω 가지 입력에도 연결하세요.' },
      { from: 'RESISTOR_220.2', to: 'BATTERY.-', color: 'black', text: '220 Ω 가지 출력을 전원 - 귀환 마디에 연결하세요.' },
      { from: 'RESISTOR_470.2', to: 'BATTERY.-', color: 'black', text: '470 Ω 가지 출력도 같은 전원 - 귀환 마디에 연결하세요.' },
      { from: 'BATTERY.-', to: 'UNO.GND', color: 'black', text: '전원 -와 UNO GND를 공통 접지하세요.' },
    ],
    sketch: `#include <Wire.h>
// @baud 9600
const float INA_SHUNT_OHMS=0.1f;
const char* conditionId="TOTAL"; // TOTAL, BRANCH_220, BRANCH_470 중 INA219 위치와 맞추세요.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=500;
int16_t readIna(byte reg){
  Wire.beginTransmission(0x40);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(0x40,(byte)2);
  byte high=Wire.read();byte low=Wire.read(); // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}
void setup(){Serial.begin(9600);Wire.begin();Serial.println("condition_id,time_ms,bus_V,shunt_mV,current_mA");}
void loop(){float busV=(readIna(2)>>3)*0.004f,shuntMv=readIna(1)*0.01f,currentMa=shuntMv/INA_SHUNT_OHMS;Serial.print(conditionId);Serial.print(',');Serial.print(millis());Serial.print(',');Serial.print(busV,4);Serial.print(',');Serial.print(shuntMv,4);Serial.print(',');Serial.println(currentMa,3);delay(samplingIntervalMs);}`,
  },
  {
    id: 'ph20-joule-heating', title: '전력과 줄열', difficulty: '고급', minutes: 80, sensors: ['ina219', 'ds18b20'],
    keywords: ['줄열', '전력', '온도', '에너지보존'],
    law: '저항에서 발생하는 전력은 $P=VI=I^2R$이며 공급 에너지는 시간 적분 $E=\\int P\\,dt$로 구합니다.',
    apparatus: 'INA219, DS18B20, 10 Ω·정격 5 W 이상 전력저항, 단열 용기, 3~5 V 전류 제한 전원, 열전도 테이프, Arduino UNO, 브레드보드',
    method: 'DS18B20 프로브를 10 Ω 전력저항 몸체에 열전도 테이프로 고정합니다. 전원-INA219-전력저항을 직렬 연결하고 conditionId=HEATING으로 전압·전류·온도를 기록합니다. 저항 소비전력이 1 W 이하인지 확인한 뒤, 전원을 끄고 conditionId=COOLING으로 바꾸어 냉각 구간도 계속 기록합니다. 냉각 분석에 쓸 주변 온도를 온도계로 재어 관찰 노트에 적어 두세요.',
    graph: '누적 전기에너지와 온도상승을 비교해 유효 열용량과 주변 손실을 추정합니다.',
    safety: '일반 1/4 W 저항을 가열 소자로 쓰지 말고 전력저항의 표면을 만지지 마세요. 단열 용기 안에서는 온도가 계속 오르므로 90 °C에 접근하면 즉시 전원을 끄세요(DS18B20 상한 125 °C).',
    connections: [
      { from: 'INA219.VCC', to: 'UNO.5V', color: 'red', text: 'INA219 VCC를 UNO 5V에 연결하세요.' },
      { from: 'INA219.GND', to: 'UNO.GND', color: 'black', text: 'INA219 GND를 UNO GND에 연결하세요.' },
      { from: 'INA219.SDA', to: 'UNO.A4', color: 'green', text: 'INA219 SDA를 UNO A4에 연결하세요.' },
      { from: 'INA219.SCL', to: 'UNO.A5', color: 'yellow', text: 'INA219 SCL을 UNO A5에 연결하세요.' },
      { from: 'DS18B20.VCC', to: 'UNO.5V', color: 'red', text: 'DS18B20 VCC를 UNO 5V에 연결하세요.' },
      { from: 'DS18B20.GND', to: 'UNO.GND', color: 'black', text: 'DS18B20 GND를 UNO GND에 연결하세요.' },
      { from: 'DS18B20.DATA', to: 'UNO.D2', color: 'green', text: 'DS18B20 DATA를 UNO D2에 연결하세요.' },
      { from: 'DS18B20.DATA', to: 'RESISTOR_4700.1', color: 'green', text: 'DS18B20 DATA에 4.7 kΩ 풀업 저항 1번 다리를 연결하세요.' },
      { from: 'RESISTOR_4700.2', to: 'UNO.5V', color: 'red', text: '4.7 kΩ 풀업 저항 2번 다리를 UNO 5V에 연결하세요.' },
      { from: 'BATTERY.+', to: 'INA219.VIN+', color: 'red', text: '전류 제한 전원 +를 INA219 VIN+에 연결하세요.' },
      { from: 'INA219.VIN-', to: 'RESISTOR_10.1', color: 'orange', text: 'INA219 VIN-를 10 Ω·5 W 전력저항 1번 다리에 연결하세요.' },
      { from: 'RESISTOR_10.2', to: 'BATTERY.-', color: 'black', text: '전력저항 2번 다리를 전원 -에 연결하세요.' },
      { from: 'BATTERY.-', to: 'UNO.GND', color: 'black', text: '전원 -와 UNO GND를 공통 접지하세요.' },
    ],
    sketch: `#include <Wire.h>
// @baud 9600
// @pin ONEWIRE=D2
const byte ONEWIRE=2;const float INA_SHUNT_OHMS=0.1f;const char* conditionId="HEATING";
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=1000;
int16_t readIna(byte reg){
  Wire.beginTransmission(0x40);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(0x40,(byte)2);
  byte high=Wire.read();byte low=Wire.read(); // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}
void oneWireReset(){pinMode(ONEWIRE,OUTPUT);digitalWrite(ONEWIRE,LOW);delayMicroseconds(480);pinMode(ONEWIRE,INPUT_PULLUP);delayMicroseconds(480);}
void writeOneWire(byte value){for(byte i=0;i<8;i++){pinMode(ONEWIRE,OUTPUT);digitalWrite(ONEWIRE,LOW);delayMicroseconds((value>>i)&1?6:60);pinMode(ONEWIRE,INPUT_PULLUP);delayMicroseconds((value>>i)&1?64:10);}}
byte readOneWire(){byte value=0;for(byte i=0;i<8;i++){pinMode(ONEWIRE,OUTPUT);digitalWrite(ONEWIRE,LOW);delayMicroseconds(3);pinMode(ONEWIRE,INPUT_PULLUP);delayMicroseconds(10);if(digitalRead(ONEWIRE))value|=(1<<i);delayMicroseconds(53);}return value;}
float readTemperatureC(){oneWireReset();writeOneWire(0xCC);writeOneWire(0x44);delay(750);oneWireReset();writeOneWire(0xCC);writeOneWire(0xBE);byte lsb=readOneWire();byte msb=readOneWire();int16_t raw=(int16_t)(((uint16_t)msb<<8)|lsb);return raw/16.0f;}
void setup(){Serial.begin(9600);Wire.begin();Serial.println("condition_id,time_ms,bus_V,current_mA,power_W,temperature_C");}
void loop(){float busV=(readIna(2)>>3)*0.004f,currentMa=(readIna(1)*0.01f)/INA_SHUNT_OHMS,tempC=readTemperatureC();Serial.print(conditionId);Serial.print(',');Serial.print(millis());Serial.print(',');Serial.print(busV,4);Serial.print(',');Serial.print(currentMa,3);Serial.print(',');Serial.print(busV*currentMa/1000.0f,4);Serial.print(',');Serial.println(tempC,3);delay(samplingIntervalMs);}`,
  },
  {
    id: 'ph21-rc-time-constant', title: 'RC 충전·방전 시간상수', difficulty: '중급', minutes: 65, sensors: ['ina219'],
    keywords: ['RC회로', '시간상수', '충전', '방전'],
    law: '커패시터 전압은 충전 시 $V=V_0\\left(1-e^{-t/(RC)}\\right)$, 방전 시 $V=V_0e^{-t/(RC)}$를 따릅니다.',
    apparatus: 'INA219, 10 kΩ 저항, 100 µF 전해 커패시터, 5 V 전원, 방전 스위치, Arduino UNO, 브레드보드',
    method: '기록을 시작하기 전 10 kΩ 저항을 커패시터 양 끝에 잠시 대어 완전히 방전하고, 시리얼 모니터를 먼저 연 뒤 전원을 연결해 t=0의 상승 시작이 기록에 담기게 하세요. 그림의 CHARGE 조건에서 5 V-10 kΩ-INA219-100 µF 순서로 연결하고 커패시터 +극을 A0에도 연결한 뒤 conditionId=CHARGE로 기록합니다. 완전히 충전되면 전원을 끄고, 커패시터 +극-INA219-10 kΩ-커패시터 -극의 폐회로가 되도록 점퍼를 옮긴 뒤 conditionId=DISCHARGE로 바꾸어 기록합니다. 충전과 방전 모두 A0가 커패시터 +극에 연결되어 있는지 확인하세요.',
    graph: '63.2% 충전 시점과 로그 선형화 기울기에서 τ를 각각 구해 명목 RC값과 비교합니다.',
    safety: '전해 커패시터의 극성과 정격전압을 반드시 확인하고 전원 재연결 전 방전하세요.',
    connections: [
      { from: 'INA219.VCC', to: 'UNO.5V', color: 'red', text: 'INA219 VCC를 UNO 5V에 연결하세요.' },
      { from: 'INA219.GND', to: 'UNO.GND', color: 'black', text: 'INA219 GND를 UNO GND에 연결하세요.' },
      { from: 'INA219.SDA', to: 'UNO.A4', color: 'green', text: 'INA219 SDA를 UNO A4에 연결하세요.' },
      { from: 'INA219.SCL', to: 'UNO.A5', color: 'yellow', text: 'INA219 SCL을 UNO A5에 연결하세요.' },
      { from: 'BATTERY.+', to: 'RESISTOR_10000.1', color: 'red', text: 'CHARGE 조건에서 5 V 전원 +를 10 kΩ 저항 1번 다리에 연결하세요.' },
      { from: 'RESISTOR_10000.2', to: 'INA219.VIN+', color: 'orange', text: '10 kΩ 저항 2번 다리를 INA219 VIN+에 연결하세요.' },
      { from: 'INA219.VIN-', to: 'CAPACITOR.1', color: 'purple', text: 'INA219 VIN-를 100 µF 커패시터 +극에 연결하세요. 이 노드의 전압은 A0가 잽니다.' },
      { from: 'CAPACITOR.1', to: 'UNO.A0', color: 'blue', text: '100 µF 커패시터 +극을 UNO A0에도 연결해 커패시터 전압을 직접 측정하세요.' },
      { from: 'CAPACITOR.2', to: 'BATTERY.-', color: 'black', text: '100 µF 커패시터 -극을 전원 -에 연결하세요.' },
      { from: 'BATTERY.-', to: 'UNO.GND', color: 'black', text: '전원 -와 UNO GND를 공통 접지하세요.' },
    ],
    sketch: `#include <Wire.h>
// @baud 9600
const float INA_SHUNT_OHMS=0.1f;
const byte CAPACITOR_VOLTAGE_PIN=A0;
const char* conditionId="CHARGE"; // 방전 회로로 옮긴 뒤 DISCHARGE로 바꾸세요.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=50;
int16_t readIna(byte reg){
  Wire.beginTransmission(0x40);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(0x40,(byte)2);
  byte high=Wire.read();byte low=Wire.read(); // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}
void setup(){Serial.begin(9600);Wire.begin();Serial.println("condition_id,time_ms,capacitor_V,current_mA");}
void loop(){float capacitorV=analogRead(CAPACITOR_VOLTAGE_PIN)*(5.0f/1023.0f),currentMa=(readIna(1)*0.01f)/INA_SHUNT_OHMS;Serial.print(conditionId);Serial.print(',');Serial.print(millis());Serial.print(',');Serial.print(capacitorV,4);Serial.print(',');Serial.println(currentMa,4);delay(samplingIntervalMs);}`,
  },
  {
    id: 'ph22-battery-internal-resistance', title: '건전지 내부저항 추정', difficulty: '중급', minutes: 55, sensors: ['ina219'],
    keywords: ['내부저항', '기전력', '단자전압', '건전지'],
    law: '전지의 단자전압은 $V=E-Ir$로 근사되므로 연결한 저항을 바꿔 전류를 달리했을 때의 전압강하에서 내부저항 $r$을 구할 수 있습니다.',
    apparatus: 'INA219, 새 9 V 사각 건전지(006P)와 홀더, 100 Ω·220 Ω·470 Ω 정격저항(1 W 이상), Arduino UNO, 브레드보드 — 1.5 V 건전지는 내부저항에 의한 전압 강하(수 mV)가 센서 분해능(4 mV)보다 작아 측정할 수 없습니다',
    method: '먼저 저항을 떼고 INA219 VIN+와 VIN-를 모두 건전지 +에 연결해 conditionId=OPEN으로 개방전압을 기록합니다. 전원을 분리한 뒤 그림처럼 저항을 연결하고 470 Ω, 220 Ω, 100 Ω 순서로 교체하며 conditionId를 각각 R470, R220, R100으로 맞춥니다. 각 저항은 5초 이내로 측정하고 조건 사이에 건전지를 쉬게 하세요.',
    graph: 'V-I 그래프의 음의 기울기에서 내부저항, 절편에서 기전력을 구합니다.',
    safety: '건전지를 단락하지 말고 저항 정격과 최대 측정전류를 넘지 마세요.',
    connections: [
      { from: 'INA219.VCC', to: 'UNO.5V', color: 'red', text: 'INA219 VCC를 UNO 5V에 연결하세요.' },
      { from: 'INA219.GND', to: 'UNO.GND', color: 'black', text: 'INA219 GND를 UNO GND에 연결하세요.' },
      { from: 'INA219.SDA', to: 'UNO.A4', color: 'green', text: 'INA219 SDA를 UNO A4에 연결하세요.' },
      { from: 'INA219.SCL', to: 'UNO.A5', color: 'yellow', text: 'INA219 SCL을 UNO A5에 연결하세요.' },
      { from: 'BATTERY.+', to: 'INA219.VIN+', color: 'red', text: '건전지 +를 INA219 VIN+에 연결하세요.' },
      { from: 'INA219.VIN-', to: 'RESISTOR_220.1', color: 'orange', text: '기본 R220 조건에서 INA219 VIN-를 220 Ω 저항 1번 다리에 연결하세요.' },
      { from: 'RESISTOR_220.2', to: 'BATTERY.-', color: 'black', text: '220 Ω 저항 2번 다리를 건전지 -에 연결하세요.' },
      { from: 'BATTERY.-', to: 'UNO.GND', color: 'black', text: '건전지 -와 UNO GND를 공통 접지하세요.' },
    ],
    sketch: `#include <Wire.h>
// @baud 9600
const float INA_SHUNT_OHMS=0.1f;
const char* conditionId="R220"; // OPEN, R470, R220, R100 중 실제 조건과 맞추세요.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=250;
int16_t readIna(byte reg){
  Wire.beginTransmission(0x40);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(0x40,(byte)2);
  byte high=Wire.read();byte low=Wire.read(); // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}
void setup(){Serial.begin(9600);Wire.begin();Serial.println("condition_id,time_ms,terminal_V,current_mA");}
void loop(){float terminalV=(readIna(2)>>3)*0.004f,currentMa=(readIna(1)*0.01f)/INA_SHUNT_OHMS;Serial.print(conditionId);Serial.print(',');Serial.print(millis());Serial.print(',');Serial.print(terminalV,4);Serial.print(',');Serial.println(currentMa,3);delay(samplingIntervalMs);}`,
  },
  {
    id: 'ph23-solar-iv-mpp', title: '태양전지 I-V 곡선과 최대전력점', difficulty: '고급', minutes: 80, sensors: ['ina219', 'tsl2591'],
    keywords: ['태양전지', 'IV곡선', '최대전력점', '조도'],
    law: '태양전지의 출력 전력 $P=VI$는 연결한 저항에 따라 변하며 $I$-$V$ 곡선 위에 최대전력점이 존재합니다.',
    apparatus: 'INA219, 소형 태양전지, TSL2591, 100 Ω~10 kΩ 저항 세트, 일정한 광원, Arduino UNO, 브레드보드',
    method: '패널과 TSL2591 수광면을 같은 광원 방향에 고정합니다. 그림처럼 패널-INA219-저항을 직렬로 연결하고 가장 큰 저항부터 바꿉니다. 각 교체 때 전원을 차단한 뒤 코드의 conditionId를 실제로 연결한 저항과 맞추세요. 10 kΩ은 R10K, 4.7 kΩ은 R4K7, 2.2 kΩ은 R2K2, 1 kΩ은 R1K, 470 Ω은 R470, 220 Ω은 R220, 100 Ω은 R100입니다. 각 조건에서 V, I, 조도를 함께 기록합니다.',
    graph: '$I$-$V$ 및 $P$-$V$ 그래프를 그리고 최대 $P$ 지점과 광량 변화에 따른 이동을 비교합니다.',
    connections: [
      { from: 'INA219.VCC', to: 'UNO.5V', color: 'red', text: 'INA219 VCC를 UNO 5V에 연결하세요.' },
      { from: 'INA219.GND', to: 'UNO.GND', color: 'black', text: 'INA219 GND를 UNO GND에 연결하세요.' },
      { from: 'INA219.SDA', to: 'UNO.A4', color: 'green', text: 'INA219 SDA를 UNO A4 공통 I2C 버스에 연결하세요.' },
      { from: 'INA219.SCL', to: 'UNO.A5', color: 'yellow', text: 'INA219 SCL을 UNO A5 공통 I2C 버스에 연결하세요.' },
      { from: 'TSL2591.VIN', to: 'UNO.5V', color: 'red', text: 'TSL2591 VIN을 UNO 5V에 연결하세요.' },
      { from: 'TSL2591.GND', to: 'UNO.GND', color: 'black', text: 'TSL2591 GND를 UNO GND에 연결하세요.' },
      { from: 'TSL2591.SDA', to: 'UNO.A4', color: 'green', text: 'TSL2591 SDA를 UNO A4 공통 I2C 버스에 연결하세요.' },
      { from: 'TSL2591.SCL', to: 'UNO.A5', color: 'yellow', text: 'TSL2591 SCL을 UNO A5 공통 I2C 버스에 연결하세요.' },
      { from: 'PANEL.POSITIVE', to: 'INA219.VIN+', color: 'red', text: '태양전지 +를 INA219 VIN+에 연결하세요.' },
      { from: 'INA219.VIN-', to: 'RESISTOR_1000.1', color: 'orange', text: '기본 R1K 조건에서 INA219 VIN-를 1 kΩ 저항 1번 다리에 연결하세요.' },
      { from: 'RESISTOR_1000.2', to: 'PANEL.NEGATIVE', color: 'black', text: '1 kΩ 저항 2번 다리를 태양전지 -에 연결하세요.' },
      { from: 'PANEL.NEGATIVE', to: 'UNO.GND', color: 'black', text: '태양전지 -와 UNO GND를 공통 접지해 INA219 버스 전압의 기준을 만드세요.' },
    ],
    sketch: `#include <Wire.h>
// @baud 9600
const float INA_SHUNT_OHMS=0.1f;
const char* conditionId="R1K"; // R10K, R4K7, R2K2, R1K, R470, R220, R100 중 실제 연결한 저항과 맞추세요.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=500;
int16_t readIna(byte reg){
  Wire.beginTransmission(0x40);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(0x40,(byte)2);
  byte high=Wire.read();byte low=Wire.read(); // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}
uint16_t lightRaw(){
  Wire.beginTransmission(0x29);Wire.write(0xB4);Wire.endTransmission(false);Wire.requestFrom(0x29,(byte)2);
  byte low=Wire.read();byte high=Wire.read(); // TSL2591은 하위 바이트가 먼저 옵니다.
  return (uint16_t)low|((uint16_t)high<<8);
}
void setup(){Serial.begin(9600);Wire.begin();Wire.beginTransmission(0x29);Wire.write(0xA0);Wire.write(0x03);Wire.endTransmission();Serial.println("condition_id,time_ms,panel_V,current_mA,power_mW,light_raw");}
void loop(){float panelV=(readIna(2)>>3)*0.004f,currentMa=(readIna(1)*0.01f)/INA_SHUNT_OHMS;Serial.print(conditionId);Serial.print(',');Serial.print(millis());Serial.print(',');Serial.print(panelV,4);Serial.print(',');Serial.print(currentMa,3);Serial.print(',');Serial.print(panelV*currentMa,3);Serial.print(',');Serial.println(lightRaw());delay(samplingIntervalMs);}`,
  },
]

const magnetism: Phase6RecipeDefinition[] = [
  {
    id: 'ph24-solenoid-current-field', title: '솔레노이드 전류와 자기장', difficulty: '고급', minutes: 70, sensors: ['ina219', 'hbe0704'],
    keywords: ['솔레노이드', '전류', '자기장', '비례관계'],
    law: '긴 솔레노이드 중심 자기장은 $B\\approx\\mu_0nI$로 전류에 비례합니다.',
    apparatus: 'INA219, HBE0704, 교육용 솔레노이드, 전류 제한 저전압 전원, 솔레노이드 규격에 맞는 직렬 전력저항, 비자성 센서 지그, Arduino UNO, 브레드보드',
    method: 'HBE0704 OUT을 A0에 연결합니다. 홀 센서는 감지면(패키지 평면)을 수직으로 지나는 자기장 성분에만 반응하므로, 감지면이 코일 축과 수직이 되도록 코일 중심에 고정합니다. 그림처럼 전원-INA219-솔레노이드(LOAD)-전력저항을 직렬로 구성합니다. 전원 전류 제한값을 I050, I100, I150처럼 단계적으로 바꿀 때마다 실제 전류가 안정된 뒤 코드의 conditionId도 같은 ID로 바꾸어 기록합니다. 전류를 0으로 내린 기준 조건은 I000으로 기록합니다.',
    graph: '홀 출력-I 그래프의 선형 구간을 찾고 코일 가열에 따른 드리프트를 분리합니다. 교육용 솔레노이드에서 기대되는 변화는 전체 20~50카운트 수준이므로 좁은 범위도 정상이며, 조건마다 30개 표본을 평균해야 합니다.',
    safety: '코일 정격전류를 넘지 말고 측정 사이에 충분히 냉각하세요.',
    connections: [
      { from: 'INA219.VCC', to: 'UNO.5V', color: 'red', text: 'INA219 VCC를 UNO 5V에 연결하세요.' },
      { from: 'INA219.GND', to: 'UNO.GND', color: 'black', text: 'INA219 GND를 UNO GND에 연결하세요.' },
      { from: 'INA219.SDA', to: 'UNO.A4', color: 'green', text: 'INA219 SDA를 UNO A4에 연결하세요.' },
      { from: 'INA219.SCL', to: 'UNO.A5', color: 'yellow', text: 'INA219 SCL을 UNO A5에 연결하세요.' },
      { from: 'HBE0704.VCC', to: 'UNO.5V', color: 'red', text: 'HBE0704 VCC를 UNO 5V에 연결하세요.' },
      { from: 'HBE0704.GND', to: 'UNO.GND', color: 'black', text: 'HBE0704 GND를 UNO GND에 연결하세요.' },
      { from: 'HBE0704.OUT', to: 'UNO.A0', color: 'blue', text: 'HBE0704 OUT을 UNO A0에 연결하세요.' },
      { from: 'BATTERY.+', to: 'INA219.VIN+', color: 'red', text: '전류 제한 전원 +를 INA219 VIN+에 연결하세요.' },
      { from: 'INA219.VIN-', to: 'LOAD.POSITIVE', color: 'orange', text: 'INA219 VIN-를 솔레노이드 코일의 시작 단자에 연결하세요.' },
      { from: 'LOAD.NEGATIVE', to: 'RESISTOR_10.1', color: 'purple', text: '솔레노이드 코일의 끝 단자를 규격에 맞는 직렬 전력저항에 연결하세요.' },
      { from: 'RESISTOR_10.2', to: 'BATTERY.-', color: 'black', text: '직렬 전력저항의 남은 다리를 전원 -에 연결하세요.' },
      { from: 'BATTERY.-', to: 'UNO.GND', color: 'black', text: '전원 -와 UNO GND를 공통 접지하세요.' },
    ],
    sketch: `#include <Wire.h>
// @baud 9600
// @pin HALL_IN=A0
const byte HALL_IN=A0;const float INA_SHUNT_OHMS=0.1f;const char* conditionId="I050";
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=250;
int16_t readIna(byte reg){
  Wire.beginTransmission(0x40);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(0x40,(byte)2);
  byte high=Wire.read();byte low=Wire.read(); // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}
void setup(){Serial.begin(9600);Wire.begin();Serial.println("condition_id,time_ms,current_mA,hall_raw");}
void loop(){float currentMa=(readIna(1)*0.01f)/INA_SHUNT_OHMS;Serial.print(conditionId);Serial.print(',');Serial.print(millis());Serial.print(',');Serial.print(currentMa,3);Serial.print(',');Serial.println(analogRead(HALL_IN));delay(samplingIntervalMs);}`,
  },
  {
    id: 'ph25-coil-turns-field', title: '코일 감은 수와 자기장', difficulty: '중급', minutes: 65, sensors: ['ina219', 'hbe0704'],
    keywords: ['코일', '감은수', '자기장', '암페어법칙'],
    law: '길이와 전류가 같을 때 솔레노이드 자기장은 단위 길이당 감은 수 n에 비례합니다.',
    apparatus: 'INA219, HBE0704, 같은 길이·지름이면서 감은 수가 다른 코일 3개, 전류 제한 전원, 규격에 맞는 직렬 전력저항, 비자성 센서 지그, Arduino UNO, 브레드보드',
    method: 'HBE0704를 코일 중심의 같은 위치와 방향에 고정합니다. 그림의 LOAD 자리에 첫 코일을 연결하고 전류 제한 전원으로 모든 코일의 실제 전류를 같은 값에 맞춥니다. 전원을 끄고 코일을 N50, N100, N150 순서로 교체할 때마다 코드의 conditionId를 실제 감은 수 ID로 바꾸어 전류와 홀 출력을 함께 기록합니다. 전류를 0으로 내린 영점 기준은 conditionId=N000으로 따로 기록합니다.',
    graph: '영점 보정 홀 출력-N 그래프를 만들고 코일 끝 효과로 생기는 비선형성을 분석합니다.',
    safety: '코일을 교체하기 전에 반드시 전원을 끄고 각 코일의 정격전류를 넘지 마세요.',
    connections: [
      { from: 'INA219.VCC', to: 'UNO.5V', color: 'red', text: 'INA219 VCC를 UNO 5V에 연결하세요.' },
      { from: 'INA219.GND', to: 'UNO.GND', color: 'black', text: 'INA219 GND를 UNO GND에 연결하세요.' },
      { from: 'INA219.SDA', to: 'UNO.A4', color: 'green', text: 'INA219 SDA를 UNO A4에 연결하세요.' },
      { from: 'INA219.SCL', to: 'UNO.A5', color: 'yellow', text: 'INA219 SCL을 UNO A5에 연결하세요.' },
      { from: 'HBE0704.VCC', to: 'UNO.5V', color: 'red', text: 'HBE0704 VCC를 UNO 5V에 연결하세요.' },
      { from: 'HBE0704.GND', to: 'UNO.GND', color: 'black', text: 'HBE0704 GND를 UNO GND에 연결하세요.' },
      { from: 'HBE0704.OUT', to: 'UNO.A0', color: 'blue', text: 'HBE0704 OUT을 UNO A0에 연결하세요.' },
      { from: 'BATTERY.+', to: 'INA219.VIN+', color: 'red', text: '전류 제한 전원 +를 INA219 VIN+에 연결하세요.' },
      { from: 'INA219.VIN-', to: 'LOAD.POSITIVE', color: 'orange', text: 'INA219 VIN-를 현재 시험할 코일의 시작 단자에 연결하세요.' },
      { from: 'LOAD.NEGATIVE', to: 'RESISTOR_10.1', color: 'purple', text: '시험 코일의 끝 단자를 규격에 맞는 직렬 전력저항에 연결하세요.' },
      { from: 'RESISTOR_10.2', to: 'BATTERY.-', color: 'black', text: '직렬 전력저항의 남은 다리를 전원 -에 연결하세요.' },
      { from: 'BATTERY.-', to: 'UNO.GND', color: 'black', text: '전원 -와 UNO GND를 공통 접지하세요.' },
    ],
    sketch: `#include <Wire.h>
// @baud 9600
// @pin HALL_IN=A0
const byte HALL_IN=A0;const float INA_SHUNT_OHMS=0.1f;const char* conditionId="N50"; // N000(전류 0), N50, N100, N150 중 실제 조건과 맞추세요.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=250;
int16_t readIna(byte reg){
  Wire.beginTransmission(0x40);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(0x40,(byte)2);
  byte high=Wire.read();byte low=Wire.read(); // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}
void setup(){Serial.begin(9600);Wire.begin();Serial.println("condition_id,time_ms,current_mA,hall_raw");}
void loop(){float currentMa=(readIna(1)*0.01f)/INA_SHUNT_OHMS;Serial.print(conditionId);Serial.print(',');Serial.print(millis());Serial.print(',');Serial.print(currentMa,3);Serial.print(',');Serial.println(analogRead(HALL_IN));delay(samplingIntervalMs);}`,
  },
  {
    id: 'ph26-rotating-magnet-signal', title: '회전 자석의 각속도와 유도 신호', difficulty: '중급', minutes: 55, sensors: ['hbe0704'],
    keywords: ['회전자석', '주파수', '각속도', '홀효과'],
    law: '회전축에 자석 $N$개가 있으면 홀 센서 펄스 주파수 $f$와 각속도는 $\\omega=2\\pi f/N$ 관계를 가집니다.',
    apparatus: 'HBE0704, 자석 1~4개, 손 회전 원판 또는 저속 모터, 보호 덮개, Arduino UNO, 브레드보드',
    method: '기록을 시작하기 전 자석을 손으로 천천히 센서 앞을 지나가게 하여, hall_raw가 400 아래로 떨어지는 극이 센서를 향하도록 자석 방향을 맞추고 그때 pulse_count가 1씩 늘어나는지 확인하세요. 반대 극은 값이 올라가기만 해 펄스가 세어지지 않습니다. 홀 센서와 자석 사이 간격을 고정하고 펄스 사이 시간을 기록합니다. 자석 수를 바꿔 같은 회전속도를 측정하세요. 스케치는 표본을 출력하는 사이에도 홀 신호를 계속 살펴 자석 통과를 세므로, pulse_count와 pulse_interval_us 열에서 주파수를 구합니다.',
    graph: '펄스 주파수/N으로 계산한 회전수를 비교하고 누락·중복 펄스 비율을 구합니다. 주파수는 $f=10^6/\\text{pulse\\_interval\\_us}$ 또는 두 행의 pulse_count 차이를 시간 차이로 나누어 얻습니다.',
    // A magnet pulse is only milliseconds wide, so the default fixed-interval
    // analogRead() sampled almost none of them. Edge counting runs continuously.
    sketch: `// @baud 9600
${hallPulseDriver('A0')}
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=100;
void setup(){Serial.begin(9600);Serial.println("time_ms,hall_raw,pulse_count,pulse_interval_us");}
void loop(){
  pollHallFor(samplingIntervalMs);
  Serial.print(millis());Serial.print(',');Serial.print(hallRaw);Serial.print(',');
  Serial.print(pulseCount);Serial.print(',');Serial.println(lastIntervalUs);
}`,
  },
  {
    id: 'ph27-magnetic-shielding', title: '자기 차폐 재료 비교', difficulty: '중급', minutes: 55, sensors: ['hbe0704'],
    keywords: ['자기차폐', '투자율', '홀센서', '재료'],
    law: '자성 재료는 자기선속 경로를 바꿔 특정 위치의 자기장 크기를 감소시키거나 집중시킬 수 있습니다.',
    apparatus: 'HBE0704, 고정 자석, 철·알루미늄·플라스틱 시료(각 2가지 두께), 비자성 거리 지그, Arduino UNO, 브레드보드',
    method: '자석-센서 거리와 방향을 고정하고 시료만 차례로 삽입해 영점 대비 출력을 측정합니다. 시료를 바꾸거나 넣고 뺀 시각을 관찰 노트에 적어 CSV 구간을 나누세요.',
    graph: '재료별 차폐율 $(B_0-B)/B_0$를 비교하고 시료 두께와 위치에 따른 변화를 오차막대로 나타냅니다.',
  },
]

const optics: Phase6RecipeDefinition[] = [
  {
    id: 'ph28-malus-law', title: '말뤼스 법칙', difficulty: '중급', minutes: 60, sensors: ['tsl2591'],
    keywords: ['말뤼스법칙', '편광', '광세기', '코사인제곱'],
    law: '선편광이 분석기를 통과한 세기는 $I=I_0\\cos^2\\theta$를 따릅니다.',
    apparatus: 'TSL2591, 선형 편광판 2장, 일정한 LED 광원, 각도 눈금판, 차광통, Arduino UNO, 브레드보드',
    method: '센서와 광원을 고정하고 분석기 각도를 10° 간격으로 돌리며 빛을 완전히 막았을 때의 기준값을 포함한 조도를 기록합니다. 각도를 바꾼 시각을 관찰 노트에 적어 CSV 구간을 나누세요. 0°에서 light_raw가 최댓값(65535) 근처면 광원을 멀리 두고, 90° 잔광이 0에 붙으면 스케치의 LIGHT_CONFIG를 0x10(25배)으로 올리세요.',
    graph: '빛을 완전히 막았을 때의 기준값을 뺀 $I$를 $\\cos^2\\theta$에 대해 그려 선형성과 편광판의 최소 투과 잔광을 평가합니다.',
  },
  {
    id: 'ph29-transmittance-absorbance', title: '투과율과 흡광도', difficulty: '중급', minutes: 60, sensors: ['tsl2591'],
    keywords: ['투과율', '흡광도', '비어람베르트', '필터'],
    law: '투과율은 $T=I/I_0$, 흡광도는 $A=-\\log_{10}T$이며 균일한 흡수 매질에서는 농도·경로 길이에 비례합니다.',
    apparatus: 'TSL2591, 일정 광원, 색 필터 또는 안전한 색소 용액, 동일 큐벳, 차광통, Arduino UNO, 브레드보드',
    method: '빈 경로의 $I_0$와 빛을 완전히 막았을 때의 기준값을 먼저 측정한 뒤 필터 또는 농도만 바꾸어 $I$를 기록합니다.',
    graph: '농도-A 그래프를 만들고 측정 범위를 넘어 최댓값에 머무는 현상, 산란, 용기 차이 때문에 직선 관계에서 벗어나는 구간을 찾습니다.',
  },
  {
    id: 'ph30-reflection-intensity-angle', title: '입사각에 따른 반사광 세기', difficulty: '중급', minutes: 60, sensors: ['tsl2591'],
    keywords: ['반사', '입사각', '반사각', '광세기'],
    law: '정반사는 입사각과 반사각이 같으며 측정되는 세기는 표면 거칠기, 편광, 센서가 빛을 받아들이는 방향과 범위에 따라 달라집니다.',
    apparatus: 'TSL2591, 좁은 LED 광원, 거울과 무광 시료, 회전 눈금판, 차광판, Arduino UNO, 브레드보드',
    method: '입사광을 고정하고 센서를 예측 반사각 주변으로 이동해 각도별 광량을 측정합니다.',
    graph: '각도-광량 곡선의 최대 위치로 반사 법칙을 검증하고 재료별 봉우리 폭과 배경 산란을 비교합니다.',
  },
  {
    id: 'ph31-lens-focal-length', title: '렌즈 초점거리 측정', difficulty: '초급', minutes: 55, sensors: ['tsl2591'],
    keywords: ['렌즈', '초점거리', '얇은렌즈식', '상거리'],
    law: '얇은 렌즈는 $1/f=1/u+1/v$를 만족하며 먼 광원의 경우 상거리가 초점거리에 가까워집니다.',
    apparatus: 'TSL2591 정밀 조도센서, 볼록렌즈, LED 물체, 광학 레일 또는 자, 차광판, Arduino UNO, 브레드보드, MF선',
    method: '물체거리 u를 고정하고 센서를 이동해 가장 선명하고 밝은 상이 생기는 v를 찾습니다. 여러 u에서 반복하세요.',
    graph: '1/v-1/u 관계 또는 계산한 f의 분포를 나타내고 센서 면적 때문에 생기는 초점 판정 오차를 평가합니다.',
  },
  {
    id: 'ph32-aperture-light', title: '차광판 구멍 크기와 광량', difficulty: '초급', minutes: 45, sensors: ['tsl2591'],
    keywords: ['구멍 크기', '면적', '광량', '역제곱'],
    law: '빛이 고르게 비칠 때 작은 구멍을 통과하는 광량은 구멍 면적 $A=\\pi d^2/4$에 근사적으로 비례합니다.',
    apparatus: 'TSL2591, 구멍 지름이 다른 차광판, 일정 광원, 버니어캘리퍼스, 차광통, Arduino UNO, 브레드보드',
    method: '광원-차광판-센서 거리를 고정하고 구멍 지름만 바꾸어 빛을 완전히 막았을 때의 기준값을 보정한 광량을 측정합니다.',
    graph: '광량-$d^2$ 그래프를 만들고 가장자리 회절·광원의 고르지 않은 밝기 때문에 벗어나는 작은 구멍을 찾습니다.',
  },
  {
    id: 'ph33-light-source-stability', title: '서로 다른 광원의 시간 안정성', difficulty: '초급', minutes: 50, sensors: ['tsl2591'],
    keywords: ['광원', '안정성', '변동계수', '드리프트'],
    law: '광원의 짧은 시간 변화와 온도 때문에 기준값이 장시간에 걸쳐 서서히 변하는 현상은 평균 광량이 같아도 서로 다른 시간 범위의 흔들림으로 나타납니다.',
    apparatus: 'TSL2591, LED·형광등 등 비교 광원, 고정 지그, 차광통, Arduino UNO, 브레드보드',
    method: '센서 위치와 주변광을 고정하고 각 광원을 켠 직후부터 충분한 시간 동안 같은 표본 간격으로 기록합니다.',
    graph: '이동평균, 변동계수, 예열 추세를 광원별로 비교합니다. 이 센서는 약 0.1초 동안 빛을 모아 한 값을 만들므로 전원 주파수의 빠른 깜빡임(플리커)은 평균되어 보이지 않으며, 초 단위 이상의 변동만 비교할 수 있습니다.',
  },
]

const fluidsSound: Phase6RecipeDefinition[] = [
  {
    id: 'ph34-torricelli-drain', title: '물 빠지는 속도와 토리첼리 법칙', difficulty: '고급', minutes: 75, sensors: ['hc-sr04'],
    keywords: ['토리첼리법칙', '수면높이', '유출속도', '유체'],
    law: '작은 구멍의 이상 유출 속도는 $v=\\sqrt{2gh}$이며 일정 단면 용기의 수면 하강률과 연결됩니다.',
    apparatus: 'HC-SR04, 안지름 12 cm 이상의 넓은 투명 원통 용기(비커·양동이), 작은 배출구, 물받이, 방수 차폐판, Arduino UNO, 브레드보드',
    method: '초음파 센서를 처음 수면보다 5 cm 이상 위, 용기 중심축에 수직으로 고정합니다. 좁은 병에서는 초음파가 벽이나 입구 테두리에 먼저 반사되므로 넓은 용기를 쓰세요. 측정 전에 용기의 안지름과 센서에서 배출구까지의 거리를 자로 재어 두고, 배출구를 연 순간부터 수면 높이를 기록합니다.',
    graph: '수면 높이 $h$와 시간, 또는 $\\sqrt{h}$와 시간의 관계를 그려 이상식과 점성·수축 효과의 차이를 분석합니다.',
    safety: '전자부품과 물을 물리적으로 분리하고 넘침을 받을 수 있는 큰 물받이를 사용하세요.',
  },
  {
    id: 'ph35-temperature-speed-of-sound', title: '온도에 따른 음속 보정', difficulty: '중급', minutes: 60, sensors: ['hc-sr04', 'bme280'],
    keywords: ['음속', '온도', '초음파', '거리보정'],
    law: '건조 공기의 음속은 일상 온도 범위에서 $c\\approx331.3+0.606T\\,(^\\circ\\mathrm{C})\\,\\mathrm{m/s}$로 증가합니다.',
    apparatus: 'HC-SR04, BME280, 고정 반사판, 거리 기준자, 온도가 다른 안전한 실내 환경, Arduino UNO, 브레드보드',
    method: '반사판 거리를 고정하고 BME280 온도와 초음파 왕복시간을 함께 기록해 고정 음속 계산과 온도 보정 계산을 비교합니다.',
    graph: '온도-측정오차 그래프와 보정 전후의 측정값-예측값 차이를 비교해 습도·공기 흐름의 영향을 평가합니다.',
  },
]

export const phase6PhysicsDefinitions = [
  ...mechanics,
  ...thermal,
  ...electricity,
  ...magnetism,
  ...optics,
  ...fluidsSound,
]

export const phase6PhysicsRecipes = phase6PhysicsDefinitions.map(createPhase6Recipe)
