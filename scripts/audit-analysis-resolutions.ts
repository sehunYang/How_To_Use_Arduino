/**
 * 레시피가 요구하는 최종 그래프를, 데이터 변환·분석 탭의 새 기능(조건 값 열·계산 열·
 * 계열 나누기·회차 합치기)만으로 실제로 만들 수 있는지 확인합니다.
 *
 * 각 항목은 학생이 화면에서 밟을 순서를 그대로 적은 것입니다. 조건 값 열에 무엇을
 * 적는지, 계산 열에 어떤 식을 넣는지, 계열을 무엇으로 나누는지까지 코드로 옮겨
 * 두었으므로, 이 파일이 통과하면 화면에서도 같은 그래프가 나옵니다.
 */

export interface Resolution {
  /** 회차마다 사람이 적어 넣는 값. 값은 조건(p)과 회차 번호로 만듭니다. */
  manual?: Array<{ name: string; value: (p: number, index: number) => string }>
  /** 계산 열. 적은 순서대로 계산하며 앞 열을 뒤 식에서 다시 쓸 수 있습니다. */
  calculated?: Array<{ name: string; expression: string }>
  /** 분석에 앞서 잘라 낼 구간 */
  crop?: { column: string; min?: string; max?: string }
  /** 계열 나누기 기준 열 */
  group?: string
  /** 계열을 열로 펼칠지. 같은 시각 두 계열을 빼야 할 때 씁니다. */
  pivot?: boolean
  /** 회차를 합쳐 한 계열로 볼지 */
  merged?: boolean
  x: string
  y: string
  /** 이 값에 가까운 기울기가 나와야 합니다(물리량 복원 확인). */
  expectSlope?: number
  /** 새 기능으로도 남는 한계 */
  remaining?: string
}

const round = (value: number) => String(Number(value.toFixed(6)))

export const RESOLUTIONS: Record<string, Resolution> = {
  // ── 조건 값 열이 가로축이 되는 탐구 ────────────────────────────────────
  pendulum: {
    manual: [
      { name: '실길이_m', value: (p) => String(p) },
      { name: '주기_s', value: (p) => round(2 * Math.PI * Math.sqrt(p / 9.8)) },
    ],
    calculated: [{ name: '주기제곱_s2', expression: '주기_s^2' }],
    merged: true,
    x: '실길이_m',
    y: '주기제곱_s2',
    expectSlope: (4 * Math.PI ** 2) / 9.8,
  },
  'p1-pendulum-period': {
    manual: [
      { name: '실길이_m', value: (p) => String(p) },
      { name: '주기_s', value: (p) => round(2 * Math.PI * Math.sqrt(p / 9.8)) },
    ],
    calculated: [{ name: '주기제곱_s2', expression: '주기_s^2' }],
    merged: true,
    x: '실길이_m',
    y: '주기제곱_s2',
    expectSlope: (4 * Math.PI ** 2) / 9.8,
  },
  'ph06-spring-oscillation': {
    manual: [
      { name: '질량_kg', value: (p) => String(p) },
      { name: '주기_s', value: (p) => round(2 * Math.PI * Math.sqrt(p / 18)) },
    ],
    calculated: [{ name: '주기제곱_s2', expression: '주기_s^2' }],
    merged: true,
    x: '질량_kg',
    y: '주기제곱_s2',
    expectSlope: (4 * Math.PI ** 2) / 18,
  },
  'ph02-newton-second-law': {
    manual: [{ name: '질량_kg', value: (p) => String(p) }],
    calculated: [
      { name: '역질량', expression: '1/질량_kg' },
      { name: '가속도_mps2', expression: 'acceleration_x_g*9.8' },
    ],
    crop: { column: 'time_ms', min: '600', max: '2150' },
    merged: true,
    x: '역질량',
    y: '가속도_mps2',
    expectSlope: 1.4,
  },
  S1: {
    manual: [{ name: '실제각도_deg', value: (p) => String(p) }],
    merged: true,
    x: '실제각도_deg',
    y: 'roll_deg',
    expectSlope: 1,
  },
  S2: {
    manual: [{ name: '실제거리_cm', value: (p) => String(p) }],
    merged: true,
    x: '실제거리_cm',
    y: 'distance_cm',
    expectSlope: 1.01,
  },
  S4: {
    manual: [{ name: '필터_장수', value: (p) => String(p) }],
    merged: true,
    x: '필터_장수',
    y: 'light_adc',
  },
  S8: {
    manual: [{ name: '거리_cm', value: (p) => String(p) }],
    calculated: [{ name: '거리제곱역수', expression: '1/거리_cm^2' }],
    merged: true,
    x: '거리제곱역수',
    y: 'lux',
    expectSlope: 40000,
  },
  S10: {
    manual: [{ name: '거리_cm', value: (p) => String(p) }],
    calculated: [
      { name: 'log_거리', expression: 'log(거리_cm)' },
      { name: 'log_세기', expression: 'log(relative_strength)' },
    ],
    merged: true,
    x: 'log_거리',
    y: 'log_세기',
    expectSlope: -3,
  },
  'p6-magnetic-field-distance': {
    manual: [{ name: '거리_cm', value: (p) => String(p) }],
    calculated: [
      { name: 'log_거리', expression: 'log(거리_cm)' },
      { name: 'log_세기', expression: 'log(abs(signed_relative_field))' },
    ],
    merged: true,
    x: 'log_거리',
    y: 'log_세기',
    expectSlope: -3,
  },
  'p8-inverse-square-light': {
    calculated: [
      { name: 'log_거리', expression: 'log(distance_m)' },
      { name: 'log_조도', expression: 'log(mean_lux - 18)' },
    ],
    x: 'log_거리',
    y: 'log_조도',
    expectSlope: -2,
  },
  'p5-incline-acceleration': {
    manual: [
      { name: '경사각_deg', value: (p) => String(p) },
      { name: '평균가속도_mps2', value: (p) => round(0.35 * Math.sin((p * Math.PI) / 180) * 9.8) },
    ],
    calculated: [{ name: 'sin_theta', expression: 'sin(경사각_deg)' }],
    merged: true,
    x: 'sin_theta',
    y: '평균가속도_mps2',
    expectSlope: 0.35 * 9.8,
  },
  'p7-solar-panel-angle': {
    manual: [{ name: '각도_deg', value: (p) => String(p) }],
    calculated: [
      { name: 'cos_theta', expression: 'cos(각도_deg)' },
      { name: '상대전류', expression: 'current_ma/42' },
    ],
    merged: true,
    x: 'cos_theta',
    y: '상대전류',
    expectSlope: 1,
  },
  'ph28-malus-law': {
    manual: [{ name: '분석기각도_deg', value: (p) => String(p) }],
    calculated: [
      { name: 'cos2_theta', expression: 'cos(분석기각도_deg)^2' },
      { name: '보정세기', expression: 'light_raw - 120' },
    ],
    merged: true,
    x: 'cos2_theta',
    y: '보정세기',
    expectSlope: 26000,
  },
  'ph29-transmittance-absorbance': {
    manual: [{ name: '농도', value: (p) => String(p) }],
    calculated: [{ name: '흡광도', expression: 'log(24000/(light_raw - 90))' }],
    merged: true,
    x: '농도',
    y: '흡광도',
    expectSlope: 0.28 / Math.LN10,
  },
  'ph30-reflection-intensity-angle': {
    manual: [{ name: '센서각도_deg', value: (p) => String(p) }],
    calculated: [{ name: '보정세기', expression: 'light_raw - 200' }],
    merged: true,
    x: '센서각도_deg',
    y: '보정세기',
  },
  'ph31-lens-focal-length': {
    manual: [
      { name: '물체거리_m', value: (p) => String(p) },
      { name: '상거리_m', value: (p) => round(1 / (1 / 0.1 - 1 / p)) },
    ],
    calculated: [
      { name: '역물체거리', expression: '1/물체거리_m' },
      { name: '역상거리', expression: '1/상거리_m' },
    ],
    merged: true,
    x: '역물체거리',
    y: '역상거리',
    expectSlope: -1,
  },
  'ph32-aperture-light': {
    manual: [{ name: '지름_mm', value: (p) => String(p) }],
    calculated: [
      { name: '지름제곱', expression: '지름_mm^2' },
      { name: '보정세기', expression: 'light_raw - 80' },
    ],
    merged: true,
    x: '지름제곱',
    y: '보정세기',
    expectSlope: 620,
  },
  'ph16-altitude-pressure': {
    manual: [{ name: '높이_m', value: (p) => String(p) }],
    merged: true,
    x: '높이_m',
    y: 'pressure_hpa',
    expectSlope: -0.118,
  },
  'ph25-coil-turns-field': {
    manual: [{ name: '감은수', value: (p) => String(p) }],
    calculated: [{ name: '영점뺀홀', expression: 'hall_raw - 512' }],
    merged: true,
    x: '감은수',
    y: '영점뺀홀',
    expectSlope: 0.31,
  },
  'ph27-magnetic-shielding': {
    manual: [{ name: '재료번호', value: (_p, index) => String(index) }],
    calculated: [{ name: '차폐율', expression: '(180 - (hall_raw - 512))/180' }],
    merged: true,
    x: '재료번호',
    y: '차폐율',
  },
  'ph09-friction-coefficients': {
    manual: [{ name: '재료번호', value: (_p, index) => String(index) }],
    calculated: [
      { name: '경사각_deg', expression: 'asin(acceleration_x_g)' },
      { name: '마찰계수', expression: 'tan(경사각_deg)' },
    ],
    merged: true,
    x: '재료번호',
    y: '마찰계수',
    remaining: '미끄러지기 시작한 순간을 자동으로 찾아 주지는 않습니다. 그 시각을 읽어 구간을 자르거나 조건 값 열에 적습니다.',
  },
  'ph07-centripetal-acceleration': {
    manual: [{ name: '반경_m', value: (p) => String(p) }],
    calculated: [
      { name: '각속도_rad', expression: 'gyro_z_dps*0.0174533' },
      { name: '구심가속도', expression: 'acceleration_x_g*9.8' },
    ],
    merged: true,
    x: '반경_m',
    y: '구심가속도',
    expectSlope: 4.2 ** 2,
  },
  'ph08-rpm-comparison': {
    manual: [{ name: '자석수', value: () => '2' }],
    calculated: [
      { name: '홀_rpm', expression: '60000000/(pulse_interval_us*자석수)' },
      { name: '자이로_rpm', expression: 'gyro_z_dps/6' },
    ],
    merged: true,
    x: '홀_rpm',
    y: '자이로_rpm',
    expectSlope: 1,
  },
  'ph26-rotating-magnet-signal': {
    manual: [{ name: '자석수', value: (p) => String(p) }],
    calculated: [
      { name: '주파수_hz', expression: '1000000/pulse_interval_us' },
      { name: '회전속도_rps', expression: '주파수_hz/자석수' },
    ],
    merged: true,
    x: '자석수',
    y: '회전속도_rps',
  },

  // ── 계산 열만으로 되는 탐구 ───────────────────────────────────────────
  'cooling-curve': {
    calculated: [{ name: 'ln_온도차', expression: 'ln(excess_temperature_c)' }],
    x: 'time_s',
    y: 'ln_온도차',
    expectSlope: -0.011,
  },
  'ph14-insulation-performance': {
    calculated: [
      { name: '온도차', expression: 'object_temperature_c - ambient_temperature_c' },
      { name: 'ln_상대온도차', expression: 'ln(온도차/52)' },
    ],
    x: 'time_ms',
    y: 'ln_상대온도차',
    expectSlope: -0.0009 / 1000,
  },
  'ph21-rc-time-constant': {
    calculated: [{ name: 'ln_전압', expression: 'ln(capacitor_V)' }],
    group: 'condition_id',
    x: 'time_ms',
    y: 'ln_전압',
  },
  'ph10-rotational-damping': {
    manual: [{ name: '처음각속도', value: () => '220' }],
    calculated: [{ name: 'ln_상대각속도', expression: 'ln(gyro_z_dps/처음각속도)' }],
    merged: true,
    x: 'time_ms',
    y: 'ln_상대각속도',
  },
  'ph34-torricelli-drain': {
    manual: [{ name: '센서_배출구_m', value: () => '0.45' }],
    calculated: [
      { name: '수면높이_m', expression: '센서_배출구_m - distance_m' },
      { name: 'sqrt_h', expression: 'sqrt(수면높이_m)' },
    ],
    x: 'time_ms',
    y: 'sqrt_h',
  },
  'ph35-temperature-speed-of-sound': {
    manual: [{ name: '실제거리_m', value: () => '0.8' }],
    calculated: [
      { name: '보정전거리_m', expression: 'echo_time_us*343/2000000' },
      { name: '보정전오차_m', expression: '보정전거리_m - 실제거리_m' },
    ],
    merged: true,
    x: 'temperature_c',
    y: '보정전오차_m',
  },
  'ph15-gas-temperature-pressure': {
    calculated: [{ name: '절대온도_K', expression: 'temperature_c + 273.15' }],
    x: '절대온도_K',
    y: 'pressure_hpa',
    expectSlope: 1010 / 278.15,
  },
  'free-fall': {
    // 낙하하는 동안만 남기면 정지 구간이 직선에 끼지 않습니다.
    crop: { column: 'time_ms', min: '200', max: '640' },
    calculated: [
      { name: '낙하시간_s', expression: '(time_ms - first(time_ms))/1000' },
      { name: '낙하시간제곱', expression: '낙하시간_s^2' },
      { name: '낙하거리_m', expression: 'first(distance_m) - distance_m' },
    ],
    merged: true,
    x: '낙하시간제곱',
    y: '낙하거리_m',
    expectSlope: 9.8 / 2,
  },

  // ── 계열 나누기로 되는 탐구 ───────────────────────────────────────────
  'multi-tsl2591': { group: 'channel', x: 'time_ms', y: 'light_raw' },
  S9: { group: 'channel', x: 'time_ms', y: 'light_raw' },
  'e5-spatial-light-map': { group: 'position', x: 'time_ms', y: 'lux' },
  'e6-multi-point-temperature': {
    group: 'index',
    pivot: true,
    calculated: [{ name: '온도차', expression: 'temperature_c_0 - temperature_c_1' }],
    x: 'time_ms_0',
    y: '온도차',
  },
  'ph11-specific-heat': { group: 'index', x: 'time_ms', y: 'temperature_c' },
  'ph13-thermal-conductivity': {
    group: 'index',
    pivot: true,
    manual: [{ name: '재료번호', value: (_p, index) => String(index) }],
    calculated: [
      { name: '온도차', expression: 'temperature_c_0 - temperature_c_1' },
      { name: '정상상태차', expression: 'last(온도차)' },
    ],
    merged: true,
    x: '재료번호',
    y: '정상상태차',
  },
  's11-tsl2591-interrupt': { group: 'event', x: 'time_ms', y: 'light_raw' },
  'ph18-series-parallel-resistance': { group: 'condition_id', x: 'time_ms', y: 'equivalent_ohm' },
  'ph19-kirchhoff-laws': { group: 'condition_id', x: 'time_ms', y: 'current_mA' },
  'ph23-solar-iv-mpp': { group: 'condition_id', x: 'panel_V', y: 'current_mA' },
  'ph17-ohms-law': { group: 'condition_id', x: 'current_mA', y: 'bus_V' },
  'ph20-joule-heating': {
    group: 'condition_id',
    // 표본 간격 1초이므로 전력을 그대로 쌓으면 줄(J) 단위 에너지가 됩니다.
    calculated: [{ name: '공급에너지_J', expression: 'cumsum(power_W)' }],
    x: '공급에너지_J',
    y: 'temperature_C',
  },

  // ── 회차 합치기로 되는 탐구 ───────────────────────────────────────────
  // 가로축이 mA이므로 기울기의 단위는 V/mA입니다. 내부저항 0.42 Ω은 0.00042 V/mA.
  'ph22-battery-internal-resistance': { merged: true, x: 'current_mA', y: 'terminal_V', expectSlope: -0.00042 },
  'ph24-solenoid-current-field': { merged: true, x: 'current_mA', y: 'hall_raw', expectSlope: 0.62 },
  S7: { merged: true, x: 'current_ma', y: 'voltage_v' },
  'ina219-current': {
    // LED 조건은 저항값을 알 수 없어 비워 둡니다. 빈 칸은 그래프에서 빠지므로
    // 저항 세 조건만으로 직선을 맞추고, LED는 따로 견주게 됩니다.
    manual: [{ name: '저항_ohm', value: (_p, index) => ['1000', '470', '220', ''][index] }],
    calculated: [
      { name: '전류_mA', expression: 'current_raw/10' },
      { name: '컨덕턴스', expression: '1/저항_ohm' },
    ],
    merged: true,
    x: '컨덕턴스',
    y: '전류_mA',
    expectSlope: 5000,
  },
  'ph05-restitution-coefficient': {
    manual: [
      { name: '낙하높이_m', value: () => '1.0' },
      { name: '반발높이_m', value: (p) => round(p) },
    ],
    merged: true,
    x: '낙하높이_m',
    y: '반발높이_m',
    remaining: '봉우리를 자동으로 찾아 주지는 않습니다. 그래프에서 반발 최고점을 읽어 조건 값 열에 적습니다.',
  },
  'p2-mechanical-energy': {
    manual: [
      { name: '놓은높이_m', value: (p) => String(p) },
      { name: '봉우리_g', value: (p) => round(1 + (2 * p) / 0.5) },
    ],
    calculated: [{ name: '속력제곱', expression: '(봉우리_g - 1)*9.8*0.5' }],
    merged: true,
    x: '놓은높이_m',
    y: '속력제곱',
    expectSlope: 2 * 9.8,
  },
  'p9-motion-interrupt': {
    manual: [{ name: '완충재번호', value: (_p, index) => String(index) }],
    calculated: [
      // 표본 간격 2000 us를 곱해 가속도-시간 그래프의 넓이를 쌓습니다.
      { name: '속도변화_mps', expression: 'cumsum(acceleration_x_g*9.8*0.002)' },
      { name: '총속도변화_mps', expression: 'last(속도변화_mps)' },
    ],
    merged: true,
    x: '완충재번호',
    y: '총속도변화_mps',
  },
  'ph04-momentum-collision': {
    crop: { column: 'time_ms', min: '880', max: '1120' },
    manual: [{ name: '질량비', value: (p) => String(p) }],
    calculated: [
      { name: '속도변화_1', expression: 'last(cumsum(mpu0_ax_g*9.8*0.02))' },
      { name: '속도변화_2', expression: 'last(cumsum(mpu1_ax_g*9.8*0.02))' },
      { name: '운동량합', expression: '속도변화_1 + 속도변화_2*질량비' },
    ],
    merged: true,
    x: '질량비',
    y: '속도변화_2',
  },
  'p4-friction-energy-loss': {
    calculated: [{ name: '속도_mps', expression: 'diff(distance_m)/diff(time_ms)*1000' }],
    x: 'time_ms',
    y: '속도_mps',
  },
  'ph03-projectile-motion': {
    manual: [
      { name: '놓은높이_m', value: (p) => String(p) },
      { name: '착지거리_m', value: (p) => round(Math.sqrt(2 * 9.8 * p) * 0.8 * Math.sqrt((2 * 0.8) / 9.8)) },
    ],
    merged: true,
    x: '놓은높이_m',
    y: '착지거리_m',
  },
  'ph12-latent-heat': { x: 'time_s', y: 'temperature_c' },
  'ph01-uniform-motion': { merged: true, x: 'time_ms', y: 'distance_m' },
  'ph33-light-source-stability': {
    calculated: [{ name: '떨림', expression: 'light_raw - avg(light_raw, 21)' }],
    x: 'time_ms',
    y: '떨림',
  },
  'e4-weather-pressure': {
    calculated: [
      { name: '이동평균_hpa', expression: 'avg(pressure_hpa, 25)' },
      { name: '변화량_hpa', expression: 'pressure_hpa - prev(pressure_hpa)' },
    ],
    x: 'time_min',
    y: '이동평균_hpa',
  },
  'p10-eight-point-light-field': { x: 'time_ms', y: 'light_ch0_raw' },

  // ── 나머지: 조건 값 열로 표를 채우는 탐구 ─────────────────────────────
  S3: {
    manual: [
      { name: '거리_m', value: (p) => String(p) },
      { name: '감지성공률', value: (p) => round(Math.min(1, 1 / p)) },
    ],
    merged: true,
    x: '거리_m',
    y: '감지성공률',
  },
  S5: { x: 'time_ms', y: 'water_c' },
  S6: { x: 'temperature_c', y: 'humidity_pct' },
  'e2-reaction-temperature': { x: 'time_s', y: 'temperature_c' },
  'fan-control': { x: 'time_s', y: 'humidity_percent' },
  'plant-growth': {
    manual: [{ name: '생장길이_mm', value: (p, index) => round(p / 400 + index) }],
    merged: true,
    x: 'time_ms',
    y: '생장길이_mm',
  },
  'night-activity': {
    calculated: [
      { name: '시간당사건수', expression: 'avg(diff(dark_motion_count)/diff(time_ms)*3600000, 61)' },
    ],
    x: 'time_ms',
    y: '시간당사건수',
  },
  'photosynthesis-light-control': {
    calculated: [{ name: '누적점등_s', expression: 'cumsum(lamp)' }],
    x: 'time_ms',
    y: '누적점등_s',
  },
  'human-activity-meter': {
    manual: [{ name: '활동번호', value: (_p, index) => String(index) }],
    merged: true,
    x: '활동번호',
    y: 'dynamic_g',
  },
  'obstacle-avoid-car': {
    manual: [
      { name: '속도단계', value: (_p, index) => String(index + 1) },
      { name: '정지거리_cm', value: (p) => round(12 + p * 6) },
    ],
    merged: true,
    x: '속도단계',
    y: '정지거리_cm',
  },
  'light-follow-car': {
    manual: [{ name: '센서간격_cm', value: (p) => String(p) }],
    merged: true,
    x: '센서간격_cm',
    y: 'error',
  },
  'automatic-door': {
    manual: [
      { name: '유지시간_s', value: (p) => String(p) },
      { name: '통과중닫힘_회', value: (p) => round(Math.max(0, 4 - p / 2)) },
    ],
    merged: true,
    x: '유지시간_s',
    y: '통과중닫힘_회',
  },
  'parking-alarm': {
    manual: [{ name: '실제거리_cm', value: (p) => String(p) }],
    merged: true,
    x: '실제거리_cm',
    y: 'distance_cm',
  },
  'rpm-meter': { merged: true, x: 'time_ms', y: 'rpm' },
  'smart-lighting': {
    manual: [
      { name: '유지시간_s', value: (p) => String(p) },
      { name: '총점등시간_s', value: (p) => round(p * 1.8) },
    ],
    merged: true,
    x: '유지시간_s',
    y: '총점등시간_s',
  },
  's12-dual-mpu6050-address': {
    calculated: [{ name: '두값의차', expression: 'mpu_0x68_accel_x_raw - mpu_0x69_accel_x_raw' }],
    x: 'time_ms',
    y: '두값의차',
  },
  's13-mpu-aux-tsl2591': { x: 'time_ms', y: 'light_raw' },
  's14-tca-address-reset': { x: 'time_ms', y: 'mux_0x70_recovery_us' },
}
