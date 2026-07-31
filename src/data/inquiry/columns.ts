/**
 * 스케치가 시리얼로 내보내는 CSV 열 이름을 학생이 읽을 수 있는 설명으로 바꾸는 사전.
 *
 * 열 이름은 코드에서 실제로 출력되는 문자열이므로 사람이 다시 적어 두면 코드와
 * 어긋납니다. 그래서 탐구 가이드의 "측정값 읽는 법" 표는 스케치의 헤더
 * `Serial.println("...")`에서 직접 읽어 생성하고, 이 사전은 각 열의 **뜻과 쓰임**만
 * 제공합니다. 사전에 없는 열도 이름 규칙(`_ms`, `_mA`, `_raw` 등)으로 설명이
 * 만들어지므로, 새 레시피가 새 열을 추가해도 표는 비지 않습니다.
 */
export interface ColumnMeaning {
  /** 스케치가 출력하는 열 이름 그대로. */
  name: string
  /** 이 열이 무엇인지 한 줄로. */
  label: string
  /** 표시 단위. 단위가 없는 열(구분자, 상태값)은 빈 문자열입니다. */
  unit: string
  /** 자료 처리에서 이 열을 어떻게 쓰는지. */
  use: string
}

type Entry = Omit<ColumnMeaning, 'name'>

const exact: Record<string, Entry> = {
  // 시간
  time_ms: { label: '스케치가 시작한 뒤 흐른 시간', unit: 'ms', use: '1000으로 나누면 초가 됩니다. 모든 그래프의 가로축으로 씁니다.' },
  time_s: { label: '스케치가 시작한 뒤 흐른 시간', unit: 's', use: '그래프의 가로축으로 바로 쓸 수 있습니다.' },
  time_us: { label: '스케치가 시작한 뒤 흐른 시간', unit: 'µs', use: '1,000,000으로 나누면 초가 됩니다. 충돌처럼 짧은 사건에 씁니다.' },
  time_min: { label: '스케치가 시작한 뒤 흐른 시간', unit: '분', use: '장시간 기록의 가로축으로 씁니다.' },

  // 조건 구분
  condition_id: { label: '지금 측정 중인 조건의 이름', unit: '', use: '조건별로 행을 나눌 때 씁니다. 회로를 바꾸면 반드시 코드에서 함께 바꿔야 합니다.' },
  index: { label: '센서 번호', unit: '', use: '같은 시각의 여러 센서 값을 구분해 각각 다른 선으로 그립니다.' },
  channel: { label: '멀티플렉서 채널 번호', unit: '', use: '어느 위치의 센서인지 구분합니다.' },
  event: { label: '이 행이 정기 표본인지 알림인지 구분하는 표시', unit: '', use: 'INT 행만 골라내면 사건이 일어난 시각 목록이 됩니다.' },
  position: { label: '측정 위치 번호', unit: '', use: '위치별로 나누어 공간 분포를 그립니다.' },
  duty: { label: 'PWM에서 켜져 있는 시간의 비율', unit: '0~255', use: '조건을 구분하는 값입니다. 그래프의 가로축으로는 실제 측정 전압을 쓰세요.' },

  // 온도·습도·기압
  temperature_c: { label: '측정한 온도', unit: '°C', use: '시간에 대해 그리면 가열·냉각 곡선이 됩니다.' },
  temperature_C: { label: '측정한 온도', unit: '°C', use: '시간에 대해 그리면 가열·냉각 곡선이 됩니다.' },
  water_c: { label: '물의 온도', unit: '°C', use: '기준 온도계와 비교해 보정값을 구합니다.' },
  object_temperature_c: { label: '관찰 대상의 온도', unit: '°C', use: '주변 온도를 빼면 온도 차가 되어 냉각 곡선 분석에 씁니다.' },
  ambient_temperature_c: { label: '주변 공기의 온도', unit: '°C', use: '대상 온도에서 이 값을 빼서 온도 차를 만듭니다.' },
  excess_temperature_c: { label: '대상 온도에서 주변 온도를 뺀 값', unit: '°C', use: '이 값에 자연로그를 취해 시간에 대해 그리면 직선이 됩니다.' },
  humidity_pct: { label: '상대습도', unit: '%', use: '같은 수증기량이라도 온도가 바뀌면 값이 달라지므로 온도와 함께 봅니다.' },
  humidity_percent: { label: '상대습도', unit: '%', use: '같은 수증기량이라도 온도가 바뀌면 값이 달라지므로 온도와 함께 봅니다.' },
  pressure_hpa: { label: '측정 위치의 절대 기압', unit: 'hPa', use: '높이나 온도에 대해 그립니다. 날씨 앱의 해면기압과는 기준이 다릅니다.' },
  relative_altitude_m: { label: '기압으로 추정한 상대 높이', unit: 'm', use: '기준 시각의 값을 빼서 변화만 봅니다. 절대 고도가 아닙니다.' },

  // 거리·운동
  distance_m: { label: '센서에서 물체까지의 거리', unit: 'm', use: '시간에 대해 그리면 위치-시간 그래프가 됩니다.' },
  distance_cm: { label: '센서에서 물체까지의 거리', unit: 'cm', use: '100으로 나누면 m가 됩니다. 자로 잰 실제 거리와 비교하세요.' },
  ax_mps2: { label: '센서 x축 방향 가속도', unit: 'm/s²', use: '정지 구간의 평균을 빼서 영점을 맞춘 뒤 사용합니다.' },
  along_mps2: { label: '운동 방향(경사면 방향) 가속도', unit: 'm/s²', use: '가속 구간의 평균을 이론값과 비교합니다.' },
  tilt_deg: { label: '중력 방향으로 계산한 기울기 각도', unit: '°', use: '경사각으로 사용하고, $\\sin\\theta$나 $\\tan\\theta$로 바꿔 그립니다.' },
  tilt_x_g: { label: 'x축 기울기를 중력 단위로 나타낸 값', unit: 'g', use: '주행 중 흔들림과 기울어짐을 확인할 때 씁니다.' },
  g_norm: { label: '3축 가속도를 합친 크기', unit: 'g', use: '정지 상태에서는 1에 가깝습니다. 1을 빼면 움직임의 크기가 됩니다.' },
  dynamic_g: { label: '가속도 크기에서 중력분 1 g를 뺀 값', unit: 'g', use: '활동의 상대적 세기를 나타냅니다. 걸음 수나 열량이 아닙니다.' },
  active_fraction: { label: '기준을 넘은 표본의 비율', unit: '', use: '활동 종류별로 중앙값과 퍼진 정도를 비교합니다.' },
  roll_deg: { label: '좌우로 기울어진 각도', unit: '°', use: '정지 상태에서만 기울기로 해석할 수 있습니다.' },
  pitch_deg: { label: '앞뒤로 기울어진 각도', unit: '°', use: '정지 상태에서만 기울기로 해석할 수 있습니다.' },

  // 회전
  gyro_z_dps: { label: 'z축(회전축) 둘레의 회전 속도', unit: '°/s', use: '$\\pi/180$을 곱하면 rad/s가 됩니다.' },
  pulse_count: { label: '시작 이후 자석이 지나간 누적 횟수', unit: '회', use: '두 행의 차이를 시간 차이로 나누면 초당 펄스 수가 됩니다.' },
  pulses: { label: '측정 구간 동안 센 펄스 수', unit: '회', use: '회전당 자석 수로 나누면 회전 수가 됩니다.' },
  pulse_interval_us: { label: '가장 최근 두 펄스 사이의 시간', unit: 'µs', use: '$f=10^6/\\text{이 값}$으로 순간 주파수를 구합니다.' },
  rpm: { label: '스케치가 계산한 분당 회전수', unit: 'rev/min', use: '자이로 각속도로 구한 값과 비교해 서로 검증합니다.' },

  // 전기
  bus_V: { label: 'INA219가 측정한 회로 쪽 전압', unit: 'V', use: '전류와 짝지어 $V$-$I$ 그래프를 그립니다.' },
  bus_voltage_v: { label: 'INA219가 측정한 회로 쪽 전압', unit: 'V', use: '전류와 짝지어 $V$-$I$ 그래프를 그립니다.' },
  voltage_v: { label: '측정한 전압', unit: 'V', use: '전류와 곱하면 전력이 됩니다.' },
  terminal_V: { label: '전지의 단자전압', unit: 'V', use: '전류에 대해 그리면 기울기에서 내부저항을 얻습니다.' },
  panel_V: { label: '태양전지 양 끝의 전압', unit: 'V', use: '전류와 짝지어 $I$-$V$ 곡선을 그립니다.' },
  capacitor_V: { label: '커패시터 양 끝의 전압', unit: 'V', use: '시간에 대해 그려 충전·방전 곡선을 얻습니다.' },
  current_mA: { label: '회로에 흐르는 전류', unit: 'mA', use: '1000으로 나누면 A가 됩니다. 전압과 곱해 전력을 구합니다.' },
  current_ma: { label: '회로에 흐르는 전류', unit: 'mA', use: '1000으로 나누면 A가 됩니다. 전압과 곱해 전력을 구합니다.' },
  current_raw: { label: '전류 측정용 저항에서 읽은 가공 전 값', unit: '', use: '전류로 바꾸려면 측정 저항값과 변환 계수가 필요합니다.' },
  shunt_mV: { label: '전류 측정용 작은 저항 양 끝의 전압', unit: 'mV', use: '전류가 실제로 흘렀는지 확인하는 근거입니다.' },
  shunt_voltage_mv: { label: '전류 측정용 작은 저항 양 끝의 전압', unit: 'mV', use: '전류가 실제로 흘렀는지 확인하는 근거입니다.' },
  power_W: { label: '전압과 전류를 곱한 전력', unit: 'W', use: '시간에 대해 쌓으면 공급한 전기 에너지가 됩니다.' },
  power_mW: { label: '전압과 전류를 곱한 전력', unit: 'mW', use: '가장 큰 값을 주는 조건이 최대전력점입니다.' },
  power_mw: { label: '전압과 전류를 곱한 전력', unit: 'mW', use: '가장 큰 값을 주는 조건이 최대전력점입니다.' },
  power_density_mw_cm2: { label: '넓이 1 cm²당 전력', unit: 'mW/cm²', use: '크기가 다른 패널을 공정하게 비교할 때 씁니다.' },
  equivalent_ohm: { label: '전압을 전류로 나눠 구한 등가저항', unit: 'Ω', use: '직렬·병렬 이론값과 비교합니다.' },

  // 빛
  lux: { label: '사람 눈 기준으로 계산한 밝기', unit: 'lux', use: '거리나 각도에 대해 그립니다. 식물이 쓰는 빛의 양과는 다릅니다.' },
  mean_lux: { label: '여러 번 읽어 평균 낸 밝기', unit: 'lux', use: '한 번 읽은 값보다 흔들림이 작아 비교에 적합합니다.' },
  d2_times_lux: { label: '거리의 제곱에 밝기를 곱한 값', unit: '', use: '역제곱 법칙이 맞으면 거리와 상관없이 거의 일정합니다.' },
  light_raw: { label: '조도센서가 읽은 가공 전 값', unit: '', use: '상대 비교용입니다. 값이 최댓값에 붙어 있으면 그 구간은 버립니다.' },
  light_adc: { label: 'CDS 분압 전압을 숫자로 바꾼 값', unit: '0~1023', use: '밝기의 상대 비교에만 씁니다. lux라고 부르면 안 됩니다.' },
  left_adc: { label: '왼쪽 CDS의 밝기 값', unit: '0~1023', use: '오른쪽 값과의 차이가 조향 신호가 됩니다.' },
  right_adc: { label: '오른쪽 CDS의 밝기 값', unit: '0~1023', use: '왼쪽 값과의 차이가 조향 신호가 됩니다.' },
  error: { label: '좌우 밝기 값의 차이', unit: '', use: '0에 가까울수록 광원을 정면으로 향하고 있다는 뜻입니다.' },

  // 자기
  hall_raw: { label: '홀 센서가 읽은 가공 전 값', unit: '0~1023', use: '자석이 없을 때의 평균을 빼서 자기장의 상대 세기를 구합니다.' },
  signed_relative_field: { label: '영점을 뺀 홀 센서 값', unit: '', use: '부호는 자극의 방향, 절댓값은 상대 세기를 나타냅니다. 테슬라가 아닙니다.' },
  relative_strength: { label: '영점에서 벗어난 정도의 크기', unit: '', use: '거리에 따른 상대 감쇠를 비교할 때 씁니다.' },
  polarity: { label: '자극 방향을 나타내는 부호', unit: '', use: 'N극과 S극 중 어느 쪽이 센서를 향했는지 구분합니다.' },

  // 상태·사건
  motion: { label: 'PIR이 움직임을 감지했는지 여부', unit: '0 또는 1', use: '0에서 1로 바뀌는 순간만 한 사건으로 셉니다.' },
  occupied: { label: '최근에 사람이 있었다고 판단한 상태', unit: '0 또는 1', use: '조명이 켜진 시간과 겹쳐 보며 불필요한 점등을 찾습니다.' },
  lamp: { label: '조명 출력의 켜짐·꺼짐 상태', unit: '0 또는 1', use: '1인 구간의 길이를 더하면 총 점등 시간이 됩니다.' },
  fan: { label: '팬 출력의 켜짐·꺼짐 상태', unit: '0 또는 1', use: '작동 시작 시각 전후의 온습도 변화를 비교합니다.' },
  door_state: { label: '모형 문의 열림·닫힘 상태', unit: '0 또는 1', use: '감지 시각과 열림 유지 시간을 확인합니다.' },
  dark_motion_count: { label: '어두운 동안 누적된 움직임 사건 수', unit: '회', use: '밝은 시간대의 사건 수와 비율로 비교합니다.' },
  interrupt_count: { label: '센서가 스스로 알려 온 누적 횟수', unit: '회', use: '값이 1 늘어난 시각이 임계값을 넘은 시점입니다.' },

  // 그 밖
  raw: { label: '센서가 읽은 가공 전 값', unit: '', use: '영점과 비교해야 의미가 생깁니다.' },
  analog_raw: { label: '아날로그 입력을 숫자로 바꾼 값', unit: '0~1023', use: '5 V를 1023으로 나눈 값을 곱하면 전압이 됩니다.' },
}

interface PatternRule {
  test: RegExp
  build: (name: string, match: RegExpExecArray) => Entry
}

/**
 * 채널·센서 번호가 붙어 이름이 늘어나는 열은 규칙으로 처리합니다. 8채널 조도
 * 측정처럼 열이 여덟 개인 레시피를 사전에 그대로 나열하면 유지가 어렵습니다.
 */
const patterns: PatternRule[] = [
  {
    test: /^light_ch(\d)_raw$/,
    build: (_name, match) => ({
      label: `${match[1]}번 채널 조도센서가 읽은 가공 전 값`,
      unit: '',
      use: '센서를 놓은 격자 좌표에 대응시켜 공간 분포를 그립니다.',
    }),
  },
  {
    test: /^mpu(\d)_a([xyz])_g$/,
    build: (_name, match) => ({
      label: `${Number(match[1]) + 1}번 MPU6050의 ${match[2]}축 가속도`,
      unit: 'g',
      use: '9.8을 곱하면 m/s²가 됩니다. 충돌 전 평균을 빼서 영점을 맞추세요.',
    }),
  },
  {
    test: /^mpu_0x(6[89])_accel_x_raw$/,
    build: (_name, match) => ({
      label: `I2C 주소 0x${match[1]}인 센서의 x축 가속도 원시값`,
      unit: '',
      use: '16384로 나누면 g 단위가 됩니다. 두 센서를 같은 그래프에 겹쳐 그립니다.',
    }),
  },
  {
    test: /^mux_0x(7[01])_recovery_us$/,
    build: (_name, match) => ({
      label: `주소 0x${match[1]} 멀티플렉서가 리셋 뒤 다시 응답하기까지 걸린 시간`,
      unit: 'µs',
      use: '여러 번 반복해 분포와 최댓값을 비교합니다.',
    }),
  },
  {
    test: /^mux_0x(7[01])_channels$/,
    build: (_name, match) => ({
      label: `주소 0x${match[1]} 멀티플렉서의 채널 선택 상태`,
      unit: '',
      use: '리셋 뒤 0으로 돌아왔는지 확인해 복구 성공률을 셉니다.',
    }),
  },
  {
    test: /^accel_([xyz])_raw$/,
    build: (_name, match) => ({
      label: `${match[1]}축 가속도 원시값`,
      unit: '',
      use: '16384로 나누면 g 단위가 됩니다.',
    }),
  },
  {
    test: /^acceleration_([xyz])_g$/,
    build: (_name, match) => ({
      label: `${match[1]}축 방향 가속도`,
      unit: 'g',
      use: '9.8을 곱하면 m/s²가 됩니다. 정지 구간의 평균을 빼서 영점을 맞추세요.',
    }),
  },
  {
    test: /^a([xyz])$/,
    build: (_name, match) => ({
      label: `${match[1]}축 방향 가속도`,
      unit: 'g',
      use: '9.8을 곱하면 m/s²가 됩니다. 세 축을 함께 보아야 운동 방향을 알 수 있습니다.',
    }),
  },
]

/** 사전에도 규칙에도 없는 열을 이름 끝의 단위 표시로 설명합니다. */
const suffixes: Array<[RegExp, Entry]> = [
  [/_(ms)$/, { label: '시간 값', unit: 'ms', use: '1000으로 나누면 초가 됩니다.' }],
  [/_(us)$/, { label: '시간 값', unit: 'µs', use: '1,000,000으로 나누면 초가 됩니다.' }],
  [/_(mA|ma)$/, { label: '전류 값', unit: 'mA', use: '1000으로 나누면 A가 됩니다.' }],
  [/_(mv|mV)$/, { label: '전압 값', unit: 'mV', use: '1000으로 나누면 V가 됩니다.' }],
  [/_(v|V)$/, { label: '전압 값', unit: 'V', use: '전류와 곱하면 전력이 됩니다.' }],
  [/_(c|C)$/, { label: '온도 값', unit: '°C', use: '273.15를 더하면 절대온도가 됩니다.' }],
  [/_(g)$/, { label: '가속도 값', unit: 'g', use: '9.8을 곱하면 m/s²가 됩니다.' }],
  [/_(deg)$/, { label: '각도 값', unit: '°', use: '$\\pi/180$을 곱하면 라디안이 됩니다.' }],
  [/_(pct|percent)$/, { label: '비율 값', unit: '%', use: '100으로 나누면 소수 비율이 됩니다.' }],
  [/_(raw)$/, { label: '센서가 읽은 가공 전 값', unit: '', use: '영점과 비교해야 의미가 생깁니다.' }],
  [/_(count)$/, { label: '누적 횟수', unit: '회', use: '두 행의 차이를 시간 차이로 나누면 초당 횟수가 됩니다.' }],
]

export function describeColumn(name: string): ColumnMeaning {
  const direct = exact[name]
  if (direct) return { name, ...direct }

  for (const rule of patterns) {
    const match = rule.test.exec(name)
    if (match) return { name, ...rule.build(name, match) }
  }

  for (const [pattern, entry] of suffixes) {
    if (pattern.test(name)) return { name, ...entry }
  }

  return { name, label: '스케치가 기록하는 측정값', unit: '', use: '코드의 출력 순서와 맞춰 뜻을 확인하세요.' }
}

/** 스케치 헤더 한 줄(`time_ms,lux`)을 열 설명 목록으로 바꿉니다. */
export function describeHeader(header: string): ColumnMeaning[] {
  return header
    .split(',')
    .map((column) => column.trim())
    .filter(Boolean)
    .map(describeColumn)
}

/**
 * 스케치에서 CSV 헤더 줄을 찾습니다. 헤더는 `setup()` 안에서 쉼표가 들어간
 * 문자열 하나를 출력하는 줄로 약속되어 있고(`phase6Corpus.test.ts`가 이를
 * 검사합니다), 그 약속을 여기서 그대로 이용합니다.
 */
export function findCsvHeader(sketch: string): string | null {
  return /Serial\.println\("([^"\r\n]+,[^"\r\n]+)"\)/.exec(sketch)?.[1] ?? null
}
