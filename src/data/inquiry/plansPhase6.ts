import type { InquiryPlan } from './types'

/**
 * Phase 6 레시피(핀 활용 6개 + 물리 35개)의 탐구 설계.
 *
 * Phase 6 본문은 법칙 한 문장과 측정 방법 한 문단만 담고 있어서, 학생이
 * "무엇을 몇 단계로 바꿔야 하는지"와 "그래서 무엇을 계산해야 하는지"를 알 수
 * 없었습니다. 여기서 그 두 가지를 레시피마다 구체적인 값과 순서로 채웁니다.
 */
export const phase6Plans: Record<string, InquiryPlan> = {
  // ── 핀 활용 ───────────────────────────────────────────────────────────
  's11-tsl2591-interrupt': {
    question: '센서에게 “밝기가 크게 변하면 먼저 알려 줘”라고 시키면 무엇이 좋아질까?',
    measures: '조도 원시값과 센서가 스스로 알려 온 시각·횟수',
    changes: '알림을 걸 밝기의 위·아래 기준값',
    relation: '기준을 좁게 잡을수록 알림은 자주 오지만 잘못된 알림도 함께 늘어난다',
    concepts: ['interruptPin', 'threshold', 'illuminance', 'eventCounting'],
    variables: {
      independent: '알림을 거는 상한·하한 기준값 조합(3가지 이상)',
      dependent: '알림 횟수, 알림이 온 시각과 실제 변화 시각의 차이',
      controls: ['센서 위치와 방향', '밝기를 바꾸는 방법과 속도', '연속 몇 회 벗어나야 알릴지 정한 설정'],
    },
    analysis: [
      '시간-조도 그래프를 그리고 event 열이 INT인 행의 시각을 그 위에 표시합니다.',
      '실제로 기준을 넘은 첫 표본의 시각과 알림 시각의 차이를 구해 응답 지연으로 정리합니다.',
      '기준을 넘지 않았는데 온 알림을 세어 오검출률을, 넘었는데 오지 않은 경우를 세어 미검출률을 구합니다.',
      '기준값 조합별로 세 값을 표로 비교합니다.',
    ],
    checkpoints: [
      { sign: '알림이 딱 한 번만 오고 끝납니다', meaning: '알림 상태를 지워 주지 않으면 다음 알림이 생기지 않습니다. 알림을 지우는 명령이 실행되는지 확인하세요.' },
      { sign: '알림이 쉴 새 없이 옵니다', meaning: '기준값 근처에서 값이 오르내리고 있습니다. 상한과 하한을 더 벌리세요.' },
    ],
    extensions: {
      immediate: '상·하한을 더 좁혀 알림 횟수와 오검출이 함께 늘어나는지 확인하세요.',
      broaden: '값을 계속 읽어 판단하는 방식과 비교해, 같은 사건을 놓치는 정도가 어떻게 다른지 재 보세요.',
      connect: '“서로 다른 광원의 시간 안정성” 레시피에서 알림 없이 연속 기록할 때의 자료와 비교해 보세요.',
    },
  },
  's12-dual-mpu6050-address': {
    question: '똑같이 생긴 센서 두 개를 두 가닥 통신선 하나로 어떻게 구별할까?',
    measures: '주소가 다른 두 센서의 가속도 원시값',
    changes: '두 센서를 각각 기울이거나 흔드는 방식',
    relation: '주소 선택 핀의 전압 상태가 센서의 이름표를 정하므로 한 통신선에서도 따로 읽을 수 있다',
    concepts: ['i2cAddress', 'acceleration', 'rawValue', 'samplingInterval'],
    variables: {
      independent: '두 센서에 주는 움직임(한쪽만, 반대로, 동시에)',
      dependent: '두 주소의 가속도 값과 같은 행 안에서 두 값의 차이',
      controls: ['두 센서의 고정 방법과 방향', '표본 간격', '공급 전압'],
    },
    analysis: [
      '스케치를 올리고 두 열이 모두 살아 있는 값을 내는지 확인합니다. 한 열만 고정되어 있으면 그 주소가 응답하지 않는 것입니다.',
      '한쪽 센서만 기울여 그 주소의 값만 변하는지 확인해 이름표가 맞는지 검증합니다.',
      '두 센서를 같은 물체에 붙여 동시에 흔들고, 두 곡선을 한 그래프에 겹쳐 그립니다.',
      '같은 행 안에서 두 값의 차이를 구해 봅니다. 한 행의 두 값은 연이어 읽히므로(1 ms 이내) 사실상 같은 순간의 측정이고, 남는 차이는 센서 영점·감도 차이입니다.',
    ],
    checkpoints: [
      { sign: '한 주소만 보입니다', meaning: '주소 선택 핀이 제대로 연결되지 않았습니다. 첫 센서는 GND, 둘째 센서는 3.3V에 연결해야 합니다.' },
      { sign: '둘째 센서가 뜨겁거나 반응하지 않습니다', meaning: '주소 선택 핀에 5V를 넣었을 수 있습니다. 이 핀은 3.3V 전용입니다. 즉시 전원을 끄세요.' },
    ],
    extensions: {
      immediate: '두 센서를 같은 판에 붙여 흔들고 두 값의 차이가 거의 0인지 확인하세요.',
      broaden: '표본 간격을 절반으로 줄여도 같은 행의 두 값이 계속 거의 같은지 확인하세요.',
      connect: '“충돌 전후 운동량 비교” 레시피에서 이 주소 분리 기술을 실제 실험에 사용합니다.',
    },
  },
  'p9-motion-interrupt': {
    question: '충돌은 얼마나 짧은 시간에 끝나고, 그동안 힘은 얼마나 클까?',
    measures: '충돌 구간의 3축 가속도와 마이크로초 단위 시각',
    changes: '완충재의 종류와 두께',
    relation: '같은 속도로 부딪혀도 완충재가 두꺼우면 최대 가속도는 작아지고 지속시간은 길어진다',
    concepts: ['impulse', 'acceleration', 'samplingInterval', 'zeroOffset'],
    formula: {
      expression: '$J=\\int F\\,dt=m\\int a\\,dt$',
      symbols: [
        { symbol: '$J$', meaning: '충격량', unit: 'N·s' },
        { symbol: '$a$', meaning: '충돌 구간의 가속도', unit: 'm/s²' },
        { symbol: '$m$', meaning: '충돌체의 질량', unit: 'kg' },
      ],
      prediction: '같은 속도로 부딪히면 충격량은 비슷하지만, 지속시간이 2배가 되면 최대 가속도는 대략 절반이 됩니다.',
    },
    variables: {
      independent: '완충재 종류 3가지',
      dependent: '최대 가속도, 충돌 지속시간, 가속도-시간 그래프의 넓이',
      controls: ['충돌 직전 속도', '충돌체의 질량', '표본 속도', '센서 부착 위치'],
    },
    analysis: [
      '시리얼 모니터를 115200으로 맞추고, 충돌 구간에 표본이 20개 이상 들어가는지 먼저 확인합니다.',
      '충돌 전 정지 구간의 평균을 구해 모든 축의 값에서 뺍니다.',
      '가속도 크기가 기준을 넘은 첫 시각과 다시 내려온 시각의 차이를 충돌 지속시간으로 정합니다.',
      '그 구간의 가속도-시간 그래프 넓이를 사다리꼴로 근사해 속도 변화량을 구합니다.',
      '질량을 곱해 충격량을 구하고, 완충재별로 최대 가속도·지속시간·충격량을 표로 비교합니다.',
    ],
    checkpoints: [
      { sign: '충돌 구간에 점이 3~4개뿐입니다', meaning: '표본 속도가 너무 느립니다. 분주값을 낮추되 115200 baud에서는 약 280 Hz가 상한임을 기억하세요.' },
      { sign: '완충재를 바꿨는데 충격량이 크게 달라집니다', meaning: '충돌 직전 속도가 같지 않았을 가능성이 큽니다. 같은 높이에서 놓았는지 확인하세요.' },
    ],
    extensions: {
      immediate: '완충재를 두 겹으로 늘려 최대 가속도가 얼마나 더 줄어드는지 확인하세요.',
      broaden: '충돌 속도를 2배로 올려 최대 가속도와 지속시간이 각각 어떻게 변하는지 비교하세요.',
      connect: '“충돌 전후 운동량 비교” 레시피에서 두 물체의 운동량 보존까지 확인할 수 있습니다.',
    },
  },
  's13-mpu-aux-tsl2591': {
    question: '센서에 다시 센서를 붙이면 값은 언제 갱신될까?',
    measures: '보조 통신선에 붙은 조도센서의 값과 같은 행의 3축 가속도',
    changes: '조명 조건과 센서의 자세',
    relation: 'MPU6050이 보조 통신선을 대신 읽어 주므로 UNO는 주 통신선 하나로 두 센서의 값을 함께 얻는다',
    concepts: ['i2cAddress', 'multiplexer', 'samplingInterval', 'illuminance'],
    variables: {
      independent: '조명 상태(켬/끔)와 센서 자세(수평/기울임)',
      dependent: '같은 행에 기록된 light_raw와 3축 가속도 값',
      controls: ['TSL2591 전원 전압(3.3V)', '측정 간격', '조도를 바꾸는 방법'],
    },
    analysis: [
      'TSL2591 전원이 3.3V인지 먼저 확인합니다. 5V로 넣으면 보조 통신선에 과전압이 걸립니다.',
      '센서를 기울이면 가속도 열만 변하고, 조명을 바꾸면 light_raw 열만 변하는지 확인합니다.',
      '조명을 껐다 켠 시각을 관찰 노트에 적고 light_raw가 그 시각을 따라 바뀌는 것을 확인합니다.',
      '자세와 조명을 함께 바꾸며 두 값을 같은 시간축에 겹쳐 그려, 주 통신선 하나로 두 센서를 동시에 기록했음을 보입니다.',
    ],
    checkpoints: [
      { sign: '보조 센서가 전혀 응답하지 않습니다', meaning: '모드 설정이 맞지 않거나 배선이 XDA/XCL이 아닐 수 있습니다. 두 핀 연결을 다시 확인하세요.' },
      { sign: '값이 계속 같은 숫자로 고정됩니다', meaning: '보조 통신선의 갱신이 멈춘 것입니다. 주 통신선 쪽 설정부터 확인하세요.' },
    ],
    extensions: {
      immediate: '조명을 더 빠르게 껐다 켜서 어느 속도부터 변화를 놓치기 시작하는지 찾으세요.',
      broaden: '측정 간격을 절반으로 줄여도 두 열이 계속 함께 기록되는지 확인하고, 한 번에 읽는 센서가 늘어나면 무엇이 한계가 될지 토의하세요.',
      connect: '“TSL2591로 밝기를 정밀하게 재기” 예제로 돌아가면 직접 연결했을 때의 기준 지연을 얻을 수 있습니다.',
    },
  },
  's14-tca-address-reset': {
    question: '통신이 멈춰 버렸을 때 되살리려면 무엇을 해야 할까?',
    measures: '리셋 뒤 모듈이 다시 응답하기까지 걸린 시간과 채널 선택 상태',
    changes: '리셋 대상 모듈과 리셋 전 채널 설정',
    relation: 'LOW 펄스로 리셋하면 선택 상태가 지워지고 통신선이 정상으로 돌아온다',
    concepts: ['multiplexer', 'i2cAddress', 'repeatMeasurement', 'uncertainty'],
    variables: {
      independent: '리셋할 모듈(0x70, 0x71)과 리셋 전에 열어 둔 채널',
      dependent: 'recovery_us 값과 채널 선택 상태가 0으로 돌아왔는지 여부',
      controls: ['공급 전압', '리셋 펄스의 길이', '주변 배선 길이'],
    },
    analysis: [
      '두 모듈의 주소가 0x70과 0x71로 나뉘어 보이는지 I2C 스캔으로 확인합니다.',
      '리셋을 50회 이상 반복해 recovery_us 값을 모읍니다.',
      '값의 평균, 최댓값, 퍼진 범위를 모듈별로 비교합니다.',
      'channels 열이 리셋 뒤 0으로 돌아온 비율을 세어 복구 성공률을 구합니다.',
    ],
    checkpoints: [
      { sign: '리셋 후에도 채널이 열려 있습니다', meaning: '리셋 선이 실제로 LOW로 내려가지 않은 것입니다. RST 배선과 핀 번호를 확인하세요. 이 부품의 최소 펄스 폭은 나노초 수준이라 펄스 길이(10 µs)가 짧아서 실패하는 일은 없습니다.' },
      { sign: '두 모듈의 복구 시간이 크게 다릅니다', meaning: '배선 길이나 풀업 저항 조건이 다를 수 있습니다. 두 모듈의 배선을 같게 맞추고 다시 재세요.' },
    ],
    extensions: {
      immediate: '리셋 없이 채널 선택만 다시 써서도 통신이 복구되는지 비교해, 리셋이 꼭 필요한 상황을 구별해 보세요.',
      broaden: '일부러 통신선을 잠깐 흔들어 멈춘 상태를 만든 뒤, 리셋으로 되살릴 수 있는지 시험하세요.',
      connect: '“TCA9548A로 주소가 같은 TSL2591 두 개 연결하기” 예제에서 채널 전환의 기본을 먼저 익히세요.',
    },
  },
  'p10-eight-point-light-field': {
    question: '빛은 공간에서 어떤 모양으로 퍼져 있을까?',
    measures: '격자로 배치한 8개 지점의 조도 원시값',
    changes: '광원의 위치와 차광판을 놓는 자리',
    relation: '광원에서 멀거나 가려진 지점일수록 값이 작아져 공간 분포가 드러난다',
    concepts: ['illuminance', 'inverseSquareLaw', 'multiplexer', 'calibration'],
    variables: {
      independent: '차광판 위치 또는 광원까지의 거리',
      dependent: '8개 채널의 light_ch0~7_raw 값',
      controls: ['센서 간격과 높이', '센서 방향', '광원의 밝기', '주변 조명'],
    },
    analysis: [
      '8개 센서를 같은 자리에 모아 두고 한 번 읽어 센서별 감도 차이를 구합니다.',
      '격자로 배치한 뒤 각 값에 그 보정을 적용합니다.',
      '센서 좌표에 값을 배치해 2×4 표를 만들고, 값의 크기를 색으로 나타냅니다.',
      '가로 방향과 세로 방향으로 이웃한 값의 차이를 구해 어느 방향의 변화가 더 급한지 봅니다.',
      '차광판을 놓기 전후의 표를 나란히 두어 그림자의 모양을 확인합니다.',
    ],
    checkpoints: [
      { sign: '한 채널만 값이 크게 다릅니다', meaning: '그 센서의 방향이 틀어졌거나 감도 보정이 빠진 것입니다. 배치와 보정을 다시 확인하세요.' },
      { sign: '모든 채널이 같은 값입니다', meaning: '채널 전환이 되지 않아 한 센서만 반복해 읽고 있을 수 있습니다. 채널 선택값을 확인하세요.' },
    ],
    extensions: {
      immediate: '광원을 격자의 한쪽 끝으로 옮기고 값의 기울기가 어떻게 뒤집히는지 확인하세요.',
      broaden: '차광판 대신 반사판을 세워 빛이 더해지는 지점을 찾아보세요.',
      connect: '“거리에 따른 빛의 세기 (역제곱 법칙)” 레시피의 결과로 이 분포를 예측하고 실제와 비교하세요.',
    },
  },

  // ── 역학 ──────────────────────────────────────────────────────────────
  'ph01-uniform-motion': {
    question: '일정한 속력으로 움직인다는 것은 그래프에서 어떤 모습일까?',
    measures: '카트까지의 거리와 그 시각',
    changes: '카트의 속력과 출발 위치',
    relation: '위치-시간 그래프가 직선이면 등속이고, 그 기울기가 속도이다',
    concepts: ['uniformMotion', 'velocity', 'position', 'slopeIntercept'],
    formula: {
      expression: '$x=x_0+vt$',
      symbols: [
        { symbol: '$x$', meaning: '시각 $t$에서의 위치', unit: 'm' },
        { symbol: '$x_0$', meaning: '출발 위치(그래프의 세로축 절편)', unit: 'm' },
        { symbol: '$v$', meaning: '속도(그래프의 기울기)', unit: 'm/s' },
      ],
      prediction: '속력을 2배로 하면 그래프의 기울기도 2배가 되고, 출발 위치를 바꾸면 직선이 위아래로 평행 이동합니다.',
    },
    variables: {
      independent: '카트의 속력 3단계와 출발 위치 2가지',
      dependent: 'distance_m 값',
      controls: ['트랙의 수평 상태', '센서 높이와 방향', '표본 간격', '카트의 질량'],
    },
    analysis: [
      '거리-시간 산점도를 그리고 카트가 일정하게 움직인 구간만 골라냅니다.',
      '그 구간에 직선을 맞춰 기울기와 세로축 절편을 구합니다.',
      '기울기를 속도로, 절편을 출발 위치로 읽고 실제로 잰 값과 비교합니다.',
      '직선이 자료를 얼마나 잘 설명하는지($R^2$)를 함께 적습니다.',
      '조건마다 3회 반복해 속도의 평균과 퍼진 범위를 구합니다.',
    ],
    checkpoints: [
      { sign: '그래프가 직선이 아니라 완만한 곡선입니다', meaning: '카트가 실제로는 느려지고 있습니다. 마찰이 있다는 뜻이므로 등속 구간만 골라 쓰세요.' },
      { sign: '중간중간 점이 크게 튑니다', meaning: '초음파가 트랙 벽에 반사되었을 수 있습니다. 센서 주변을 정리하고 다시 재세요.' },
    ],
    extensions: {
      immediate: '출발 위치만 바꾸고 기울기가 그대로인지 확인하세요.',
      broaden: '트랙을 살짝 기울여 그래프가 직선에서 곡선으로 바뀌는 순간을 관찰하세요.',
      connect: '“자유낙하 가속도 g 구하기” 레시피에서 곡선이 되는 운동을 다룹니다.',
    },
  },
  'ph02-newton-second-law': {
    question: '같은 힘으로 밀 때 무거울수록 얼마나 더 천천히 빨라질까?',
    measures: '카트의 수평 방향 가속도',
    changes: '카트에 실은 질량',
    relation: '힘이 일정하면 가속도는 질량에 반비례한다',
    concepts: ['newtonSecondLaw', 'force', 'mass', 'acceleration', 'linearization'],
    formula: {
      expression: '$F=ma$',
      symbols: [
        { symbol: '$F$', meaning: '카트에 작용한 알짜힘', unit: 'N' },
        { symbol: '$m$', meaning: '카트와 실은 추를 합한 질량', unit: 'kg' },
        { symbol: '$a$', meaning: '측정한 가속도', unit: 'm/s²' },
      ],
      prediction: '질량을 2배로 하면 가속도는 절반이 됩니다. $1/m$을 가로축으로 그리면 직선이 됩니다.',
    },
    variables: {
      independent: '카트 질량 5단계(추를 하나씩 추가)',
      dependent: '가속 구간의 평균 가속도',
      controls: ['당기는 힘(같은 추와 같은 실)', '트랙의 수평 상태', '센서 축과 진행 방향의 정렬', '출발 위치'],
    },
    analysis: [
      '카트를 정지시킨 채 값을 읽어 각 축의 영점을 구하고 모든 값에서 뺍니다.',
      '트랙이 완전히 수평인지 확인하고, 기울어졌다면 그 성분도 빼야 합니다.',
      '가속도가 거의 일정한 구간의 평균을 질량마다 3회씩 구합니다.',
      '$1/m$을 가로축, 평균 가속도를 세로축으로 그리면 직선이 되고 기울기가 알짜힘입니다.',
      '세로축 절편이 0에서 벗어난 만큼을 마찰의 영향으로 해석합니다.',
    ],
    checkpoints: [
      { sign: '기울기로 구한 힘이 추의 무게보다 작습니다', meaning: '마찰과 도르래의 저항이 힘을 깎았습니다. 절편의 부호와 함께 설명하세요.' },
      { sign: '가장 무거운 조건에서 가속도가 거의 0입니다', meaning: '알짜힘이 마찰을 겨우 이기는 상태입니다. 그 조건은 빼고 분석하세요.' },
    ],
    extensions: {
      immediate: '질량은 그대로 두고 당기는 추를 2배로 늘려 가속도가 2배가 되는지 확인하세요.',
      broaden: '트랙에 천을 깔아 마찰을 키우고 절편이 얼마나 더 커지는지 비교하세요.',
      connect: '“경사면에서의 가속도” 레시피에서 중력이 만드는 힘으로 같은 관계를 확인합니다.',
    },
  },
  'ph03-projectile-motion': {
    question: '앞으로 던진 물체는 왜 곡선을 그리며 떨어질까?',
    measures: '책상 위를 굴러오는 공까지의 거리(발사 속력 계산용)와 책상의 수평 확인용 가속도',
    changes: '발사 속력(경사로에서 공을 놓는 높이)',
    relation: '수평 방향은 속도가 변하지 않고 수직 방향만 중력으로 빨라진다',
    concepts: ['projectile', 'uniformMotion', 'uniformAcceleration', 'gravitationalAcceleration'],
    formula: {
      expression: '$x=v_0t,\\quad y=h-\\tfrac{1}{2}gt^2$',
      symbols: [
        { symbol: '$v_0$', meaning: '수평 방향 초기 속도', unit: 'm/s' },
        { symbol: '$h$', meaning: '발사 높이', unit: 'm' },
        { symbol: '$t$', meaning: '비행 시간', unit: 's' },
      ],
      prediction: '같은 높이에서 쏘면 속도를 2배로 해도 비행 시간은 그대로이고 수평 거리만 2배가 됩니다.',
    },
    variables: {
      independent: '경사로에서 공을 놓는 높이 3단계(발사 속력 3단계)',
      dependent: '실측 수평 도달 거리와 예측 거리($v_0t$)의 차이',
      controls: ['책상 높이(발사 높이)', '발사각(수평)', '물체의 질량과 모양', '경사로와 책상의 위치'],
    },
    analysis: [
      'MPU6050의 두 수평축 가속도가 0 근처인지 확인해 책상이 수평인지 점검합니다.',
      '공이 책상 가장자리로 접근하는 거리-시간 구간에 직선을 맞춰 그 기울기로 발사 속력 $v_0$를 구합니다.',
      '책상 높이 $h$를 자로 재고 $t=\\sqrt{2h/g}$로 비행 시간을 계산합니다.',
      '예측 수평 거리 $v_0t$와 먹지에 찍힌 실제 착지 거리를 비교합니다.',
      '놓는 높이별로 예측과 실측을 표로 정리하고, 차이를 공기 저항·회전·속력 측정 오차로 설명합니다.',
    ],
    checkpoints: [
      { sign: '실측 거리가 예측보다 항상 짧습니다', meaning: '공이 가장자리에서 회전을 얻거나 공기 저항이 있는 것입니다. 무겁고 매끈한 공으로 바꿔 보세요.' },
      { sign: '거리-시간 그래프에서 직선 구간을 찾기 어렵습니다', meaning: '초음파가 작은 공을 놓친 것입니다. 더 큰 공을 쓰거나 카드 반사판을 붙인 카트로 대신 발사하세요.' },
    ],
    extensions: {
      immediate: '책상 높이만 2배로 올려 비행 시간과 도달 거리가 각각 약 1.4배가 되는지 확인하세요.',
      broaden: '가벼운 스티로폼 공으로 바꿔 공기 저항이 예측을 얼마나 어긋나게 하는지 비교하세요.',
      connect: '“자유낙하 가속도 g 구하기” 레시피에서 수직 운동만 따로 다뤄 보세요.',
    },
  },
  'ph04-momentum-collision': {
    question: '두 물체가 부딪히면 운동의 양은 어디로 갈까?',
    measures: '두 카트 각각의 x축 가속도(±16 g 범위)',
    changes: '카트의 질량과 충돌 방식(잘 튀는 충돌과 붙는 충돌)',
    relation: '밖에서 힘이 작용하지 않으면 충돌 전후 운동량의 합이 보존된다',
    concepts: ['momentum', 'momentumConservation', 'impulse', 'mass'],
    formula: {
      expression: '$m_1v_1+m_2v_2=m_1v_1\'+m_2v_2\'$',
      symbols: [
        { symbol: '$m_1,m_2$', meaning: '두 카트의 질량', unit: 'kg' },
        { symbol: '$v_1,v_2$', meaning: '충돌 전 각각의 속도', unit: 'm/s' },
        { symbol: "$v_1',v_2'$", meaning: '충돌 후 각각의 속도', unit: 'm/s' },
      ],
      prediction: '가만히 있던 같은 질량의 카트를 치면, 친 카트는 거의 멈추고 맞은 카트가 대신 움직입니다.',
    },
    variables: {
      independent: '두 카트의 질량비 3가지와 충돌 방식 2가지',
      dependent: '충돌 구간 적분에서 구한 각 카트의 속도 변화량과 $m\\,\\Delta v$의 합',
      controls: ['충돌 직전 속도', '트랙의 수평 상태', '센서 부착 방향', '표본 간격', '완충 범퍼'],
    },
    analysis: [
      '두 센서 주소가 0x68과 0x69로 나뉘어 각각 읽히는지 먼저 확인합니다.',
      '충돌 전 정지 구간의 평균을 각 열에서 빼 영점을 맞춥니다.',
      '등속으로 굴러가는 동안 가속도계는 0을 읽으므로 속도 자체는 나오지 않습니다. 대신 충돌 구간(값이 크게 흔들리는 수십 ms)의 가속도만 시간에 대해 쌓아 각 카트의 속도 변화량 $\\Delta v$를 구합니다.',
      '질량을 곱해 $m_1\\Delta v_1$과 $m_2\\Delta v_2$를 구하고, 부호가 반대이며 합이 0에 가까운지 확인합니다.',
      '두 값 크기의 차이를 큰 쪽으로 나눠 상대 차이를 구하고, 충돌 방식별로 표로 정리합니다.',
    ],
    checkpoints: [
      { sign: '두 $m\\,\\Delta v$의 크기가 20% 이상 다릅니다', meaning: '적분 구간이 충돌 밖까지 걸쳤거나 범퍼가 트랙과 스쳤을 수 있습니다. 적분 구간을 충돌 구간만으로 좁히세요.' },
      { sign: '붙는 충돌인데 두 속도가 다릅니다', meaning: '실제로 붙지 않았거나 충돌 후 회전이 생긴 것입니다. 연결 상태를 확인하세요.' },
    ],
    extensions: {
      immediate: '한 카트에 추를 얹어 질량비를 2:1로 만들고 결과가 어떻게 달라지는지 확인하세요.',
      broaden: '운동에너지의 합도 함께 계산해, 운동량은 보존되지만 에너지는 보존되지 않는 충돌을 찾아보세요.',
      connect: '“충돌 순간과 충격 지속시간 측정” 레시피에서 충돌 그 자체를 더 자세히 들여다봅니다.',
    },
  },
  'ph05-restitution-coefficient': {
    question: '잘 튀는 공과 그렇지 않은 공은 무엇이 다를까?',
    measures: '떨어뜨린 높이와 튀어 오른 최고 높이',
    changes: '공의 재질과 떨어뜨리는 높이',
    relation: '튀어 오른 높이와 떨어뜨린 높이의 비의 제곱근이 반발계수이다',
    concepts: ['restitution', 'energyLoss', 'mechanicalEnergy', 'repeatMeasurement'],
    formula: {
      expression: '$e\\approx\\sqrt{h_2/h_1}$',
      symbols: [
        { symbol: '$e$', meaning: '반발계수(0에서 1 사이)', unit: '-' },
        { symbol: '$h_1$', meaning: '떨어뜨린 높이', unit: 'm' },
        { symbol: '$h_2$', meaning: '첫 반발의 최고 높이', unit: 'm' },
      ],
      prediction: '$e$가 0.8인 공은 1 m에서 떨어뜨리면 약 64 cm까지 튀어 오릅니다.',
    },
    variables: {
      independent: '공의 재질 3가지와 낙하 높이 3단계',
      dependent: '첫 반발 최고 높이에서 구한 반발계수',
      controls: ['같은 단단한 바닥', '낙하 가이드', '센서 위치와 방향', '놓는 방식'],
    },
    analysis: [
      '거리-시간 그래프에서 첫 번째 반발의 최고점을 찾아 높이로 바꿉니다.',
      '$h_2/h_1$의 제곱근으로 반발계수를 구합니다.',
      '재질마다 5회 반복해 평균과 퍼진 범위를 구합니다.',
      '$h_1$을 가로축, $h_2$를 세로축으로 그리면 직선이 되고 기울기가 $e^2$입니다.',
      '반발계수의 제곱이 남은 에너지의 비율이라는 점을 이용해 재질별 손실률을 계산합니다.',
    ],
    checkpoints: [
      { sign: '반발계수가 1보다 큽니다', meaning: '최고점을 잘못 읽었거나 공이 옆으로 튀었습니다. 낙하 가이드를 쓰고 다시 재세요.' },
      { sign: '높이를 바꿔도 반발계수가 조금씩 변합니다', meaning: '높은 곳에서 떨어질수록 변형이 커져 손실이 늘 수 있습니다. 이 경향 자체를 결과로 보고하세요.' },
    ],
    extensions: {
      immediate: '같은 공을 카펫 위에 떨어뜨려 반발계수가 얼마나 줄어드는지 확인하세요.',
      broaden: '공을 냉장고에 넣었다 꺼내 온도에 따라 반발계수가 달라지는지 확인하세요.',
      connect: '“역학적 에너지 보존 확인하기” 레시피와 이어 보면 손실 에너지가 어디로 갔는지 논의할 수 있습니다.',
    },
  },
  'ph06-spring-oscillation': {
    question: '용수철에 매단 추가 무거워지면 진동은 빨라질까, 느려질까?',
    measures: '진동하는 추의 가속도와 봉우리 사이 시간',
    changes: '매단 추의 질량',
    relation: '주기의 제곱이 질량에 정비례한다',
    concepts: ['simpleHarmonic', 'period', 'springConstant', 'mass', 'linearization'],
    formula: {
      expression: '$T=2\\pi\\sqrt{m/k}$',
      symbols: [
        { symbol: '$T$', meaning: '한 번 진동하는 시간', unit: 's' },
        { symbol: '$m$', meaning: '매단 질량', unit: 'kg' },
        { symbol: '$k$', meaning: '용수철 상수', unit: 'N/m' },
      ],
      prediction: '질량을 4배로 하면 주기는 2배가 됩니다. $T^2$을 질량에 대해 그리면 직선이 됩니다.',
    },
    variables: {
      independent: '매단 질량 6단계',
      dependent: '10주기 이상에서 구한 한 주기',
      controls: ['같은 용수철', '작은 진폭', '센서 부착 위치', '고정대의 흔들림 없음'],
    },
    analysis: [
      '가속도 그래프에서 같은 방향의 봉우리를 세어 10주기 이상의 총 시간을 읽습니다.',
      '총 시간을 주기 수로 나눠 한 주기를 구하고, 질량마다 3회 반복합니다.',
      '질량을 가로축, $T^2$을 세로축으로 그리면 직선이 되고 기울기는 $4\\pi^2/k$입니다.',
      '기울기로 용수철 상수 $k$를 구합니다.',
      '세로축 절편이 0이 아니라면 용수철 자체의 질량이 함께 진동한 결과로 해석합니다.',
    ],
    checkpoints: [
      { sign: '직선이 원점을 지나지 않습니다', meaning: '용수철에도 질량이 있습니다. 절편에서 그 “함께 움직인 질량”을 읽을 수 있습니다.' },
      { sign: '진폭을 크게 했더니 주기가 변합니다', meaning: '용수철이 늘어나는 한계를 넘었을 수 있습니다. 진폭을 줄여 다시 재세요.' },
    ],
    extensions: {
      immediate: '용수철을 두 개 직렬로 이어 $k$가 어떻게 변하는지 확인하세요.',
      broaden: '같은 용수철을 나란히(병렬) 두 개 매달아 $k$가 2배가 되는지 확인하세요.',
      connect: '“단진자의 주기 측정하기” 레시피와 비교하면 질량이 주기를 바꾸는 경우와 아닌 경우를 구별할 수 있습니다.',
    },
  },
  'ph07-centripetal-acceleration': {
    question: '회전목마 바깥쪽이 더 무섭게 느껴지는 이유는 무엇일까?',
    measures: '반지름 방향 가속도와 회전축 둘레의 각속도',
    changes: '회전 반경과 회전 속도',
    relation: '구심가속도는 각속도의 제곱과 반경에 각각 비례한다',
    concepts: ['centripetalAcceleration', 'angularVelocity', 'radius', 'linearization'],
    formula: {
      expression: '$a_c=\\omega^2 r$',
      symbols: [
        { symbol: '$a_c$', meaning: '구심가속도', unit: 'm/s²' },
        { symbol: '$\\omega$', meaning: '각속도', unit: 'rad/s' },
        { symbol: '$r$', meaning: '회전 반경', unit: 'm' },
      ],
      prediction: '각속도를 2배로 하면 구심가속도는 4배가 되고, 반경만 2배로 하면 2배가 됩니다.',
    },
    variables: {
      independent: '반경 4단계(각속도 고정)와 각속도 4단계(반경 고정)',
      dependent: '반지름 방향 가속도',
      controls: ['센서 축 정렬(x축을 반지름 방향, z축을 회전축 방향)', '센서와 전지의 고정', '보호 덮개'],
    },
    analysis: [
      'gyro_z_dps 값에 $\\pi/180$을 곱해 각속도를 rad/s로 바꿉니다.',
      '회전이 안정된 구간에서 가속도와 각속도의 평균을 함께 구합니다.',
      '반경을 고정한 자료로 $\\omega^2$을 가로축, $a_c$를 세로축으로 그려 기울기가 반경과 같은지 확인합니다.',
      '각속도를 고정한 자료로 $r$을 가로축, $a_c$를 세로축으로 그려 직선인지 확인합니다.',
      '두 그래프의 기울기에서 각각 반경과 $\\omega^2$을 역산해 실제 값과 비교합니다.',
    ],
    checkpoints: [
      { sign: '가속도에 1 g 정도가 더해져 있습니다', meaning: '센서 축이 회전면에서 기울어 중력 성분이 섞였습니다. z축을 회전축과 나란히 맞추세요.' },
      { sign: '각속도가 계속 줄어듭니다', meaning: '회전판이 감속하고 있습니다. 안정된 구간만 골라 쓰세요.' },
    ],
    extensions: {
      immediate: '반경을 절반으로 줄이고 같은 각속도에서 가속도도 절반이 되는지 확인하세요.',
      broaden: '회전 속도를 올려 각속도가 자이로 한계(±250 °/s, 약 41 RPM)에 닿아 값이 평평하게 잘리는 지점을 찾으세요.',
      connect: '“회전체 각속도와 RPM 비교” 레시피에서 각속도를 다른 방법으로 다시 재어 검증하세요.',
    },
  },
  'ph08-rpm-comparison': {
    question: '같은 회전을 서로 다른 두 방법으로 재면 값이 일치할까?',
    measures: '자이로 각속도와 자석 통과 펄스의 간격',
    changes: '회전 속도',
    relation: '두 방법으로 구한 회전수는 같은 값을 가리켜야 하며, 어긋나면 그 원인이 있다',
    concepts: ['angularVelocity', 'rpm', 'frequency', 'calibration'],
    formula: {
      expression: '$\\mathrm{RPM}=\\dfrac{60f}{N}$',
      symbols: [
        { symbol: '$f$', meaning: '초당 펄스 수', unit: 'Hz' },
        { symbol: '$N$', meaning: '한 바퀴당 자석 수', unit: '개' },
      ],
      prediction: '두 방법으로 구한 RPM을 서로 그리면 기울기 1, 절편 0인 직선이 나와야 합니다.',
    },
    variables: {
      independent: '회전 속도 5단계(자이로 한계인 약 41 RPM 아래에서)',
      dependent: '자이로 RPM과 홀 센서 RPM',
      controls: ['자석 수와 부착 위치', '홀 센서와 자석 사이 간격', '센서 축 정렬'],
    },
    analysis: [
      '자석 수 $N$을 세어 기록하고, 자석을 손으로 천천히 지나가게 하여 hall_raw가 내려가는 극이 센서를 향하게 맞춥니다. $N$이 틀리면 모든 결과가 어긋납니다.',
      'pulse_interval_us로 $f=10^6/\\text{간격}$을 구하거나, 두 행의 pulse_count 차이를 시간 차이로 나눕니다.',
      '위 식으로 홀 센서 RPM을 구합니다.',
      'gyro_z_dps를 60으로 곱하고 360으로 나눠 자이로 RPM을 구합니다.',
      '두 값을 서로 그려 기울기와 절편을 구하고, 1과 0에서 벗어난 정도를 원인과 함께 설명합니다.',
    ],
    checkpoints: [
      { sign: '회전하는데 pulse_count가 0에서 늘지 않습니다', meaning: '자석의 반대 극이 센서를 향해 값이 올라가기만 하는 것입니다. 자석을 뒤집어 붙이세요.' },
      { sign: '홀 센서 RPM이 자이로의 정확히 2배입니다', meaning: '자석 하나가 두 번 세어지고 있습니다. 진입·해제 기준을 벌리세요.' },
      { sign: '느린 회전에서 두 값이 크게 어긋납니다', meaning: '측정 시간 안에 펄스가 몇 개 없기 때문입니다. 펄스 간격으로 계산하는 방법을 쓰세요.' },
    ],
    extensions: {
      immediate: '자석을 하나 더 붙이고 두 방법의 일치가 유지되는지 확인하세요.',
      broaden: '회전을 갑자기 늦춰 두 방법 중 어느 쪽이 더 빨리 반응하는지 비교하세요.',
      connect: '“회전 감쇠와 에너지 손실” 레시피에서 이 두 측정을 함께 써서 감쇠를 추적합니다.',
    },
  },
  'ph09-friction-coefficients': {
    question: '물체가 미끄러지기 시작하는 각도는 무엇이 정할까?',
    measures: '경사각과 미끄러지는 동안의 가속도',
    changes: '접촉면의 재질',
    relation: '미끄러지기 시작하는 각도의 탄젠트가 정지 마찰계수이다',
    concepts: ['friction', 'frictionCoefficient', 'acceleration', 'repeatMeasurement'],
    formula: {
      expression: '$\\mu_s\\approx\\tan\\theta_c,\\quad \\mu_k=\\dfrac{a_{\\text{센서}}}{g\\cos\\theta}$',
      symbols: [
        { symbol: '$\\theta_c$', meaning: '미끄러지기 시작한 각도', unit: '°' },
        { symbol: '$\\mu_s$', meaning: '정지 마찰계수', unit: '-' },
        { symbol: '$\\mu_k$', meaning: '운동 마찰계수', unit: '-' },
        { symbol: '$a_{\\text{센서}}$', meaning: '미끄러지는 동안 센서가 읽는 경사면 방향 값의 크기(가속도계는 물체의 실제 가속도가 아니라 마찰이 만드는 이 성분을 읽습니다)', unit: 'm/s²' },
      ],
      prediction: '정지 마찰계수는 대개 운동 마찰계수보다 큽니다. 즉 움직이기 시작한 뒤에는 힘이 덜 듭니다.',
    },
    variables: {
      independent: '접촉면 재료 3가지',
      dependent: '미끄럼 시작각과 미끄러지는 동안의 가속도',
      controls: ['시료의 무게와 접촉 넓이', '판을 올리는 속도', '표면의 청결 상태', '센서 부착 방향'],
    },
    analysis: [
      '판을 아주 천천히 올리며 기록합니다. 정지 상태에서는 acceleration_x_g에 arcsin을 취하면 경사각 $\\theta$가 되므로, 움직이기 시작한 순간의 각도를 이렇게 읽습니다.',
      '재료마다 5회 반복해 시작각의 평균과 퍼진 범위를 구합니다.',
      '시작각의 탄젠트로 정지 마찰계수를 구합니다.',
      '시작각보다 조금 큰 각도에서 미끄러뜨리되, 표본 간격을 20 ms로 줄여 기록하고 미끄러지는 동안 센서가 읽는 경사면 방향 값의 평균 $a_{\\text{센서}}$를 구합니다.',
      '위 식으로 운동 마찰계수를 구하고 두 값을 오차 범위와 함께 표로 비교합니다.',
    ],
    checkpoints: [
      { sign: '반복할 때마다 시작각이 크게 다릅니다', meaning: '표면에 먼지가 있거나 판을 올리는 속도가 달랐습니다. 표면을 닦고 속도를 일정하게 하세요.' },
      { sign: '운동 마찰계수가 정지 마찰계수보다 큽니다', meaning: '가속 구간을 잘못 골랐을 가능성이 큽니다. 출발 직후 구간을 빼고 다시 계산하세요.' },
    ],
    extensions: {
      immediate: '같은 재료에 추를 올려 무게를 2배로 하고 시작각이 변하지 않는지 확인하세요.',
      broaden: '접촉 넓이를 반으로 줄인 시료로 바꿔, 넓이가 마찰계수에 영향을 주는지 확인하세요.',
      connect: '“마찰에 의한 에너지 손실 측정” 레시피에서 마찰을 에너지 관점으로 다시 봅니다.',
    },
  },
  'ph10-rotational-damping': {
    question: '돌던 물체는 왜 멈출까, 그리고 얼마나 빨리 멈출까?',
    measures: '각속도와 자석 통과 펄스 간격의 시간 변화',
    changes: '제동 재료(회전을 방해하는 조건)',
    relation: '저항이 속도에 비례하면 각속도는 시간에 따라 지수적으로 줄어든다',
    concepts: ['damping', 'angularVelocity', 'energyLoss', 'linearization'],
    formula: {
      expression: '$\\omega=\\omega_0e^{-bt}$',
      symbols: [
        { symbol: '$\\omega$', meaning: '시각 $t$의 각속도', unit: 'rad/s' },
        { symbol: '$\\omega_0$', meaning: '처음 각속도', unit: 'rad/s' },
        { symbol: '$b$', meaning: '감쇠 상수(클수록 빨리 멈춤)', unit: '1/s' },
      ],
      prediction: '각속도에 로그를 취해 시간에 대해 그리면 직선이 되고, 기울기의 크기가 감쇠 상수입니다.',
    },
    variables: {
      independent: '제동 재료 3가지',
      dependent: '각속도의 시간 변화에서 구한 감쇠 상수',
      controls: ['처음 각속도', '회전판과 자석의 배치', '센서 위치', '주변 공기 흐름'],
    },
    analysis: [
      '같은 처음 각속도에서 출발하도록 매번 같은 방법으로 회전시킵니다. 처음 각속도는 자이로 한계(±250 °/s, 약 41 RPM)를 넘지 않게 하세요. 한계를 넘으면 그래프 시작이 평평하게 잘립니다.',
      'gyro_z_dps를 rad/s로 바꾸고 시간에 대해 그립니다.',
      '각속도를 처음 값으로 나눈 뒤 자연로그를 취해 시간에 대해 그리면 직선이 됩니다.',
      '그 직선의 기울기 크기를 감쇠 상수로 읽고 재료별로 비교합니다.',
      '회전 에너지가 각속도의 제곱에 비례한다는 점을 이용해 에너지가 절반이 되는 시간도 구합니다.',
    ],
    checkpoints: [
      { sign: '로그 그래프가 직선이 아닙니다', meaning: '속도에 비례하지 않는 저항(마른 마찰)이 섞인 것입니다. 그 자체가 중요한 관찰입니다.' },
      { sign: '홀 펄스가 마지막에 끊깁니다', meaning: '속도가 너무 느려져 펄스 간격이 길어진 것입니다. pulse_interval_us 열은 새 펄스가 없으면 마지막 값에 멈춰 있으므로, 회전이 끝난 뒤에는 자이로 자료로 이어서 분석하세요.' },
    ],
    extensions: {
      immediate: '제동 재료를 떼고 공기 저항만 있을 때의 감쇠 상수를 기준으로 삼으세요.',
      broaden: '처음 각속도를 2배로 올려 감쇠 상수가 그대로인지 확인하세요. 그대로라면 저항이 속도에 비례한다는 증거입니다.',
      connect: '“구심가속도와 회전반경” 레시피에서 회전 상태를 재는 다른 방법을 익힐 수 있습니다.',
    },
  },

  // ── 열 ────────────────────────────────────────────────────────────────
  'ph11-specific-heat': {
    question: '같은 열을 주어도 왜 물질마다 데워지는 속도가 다를까?',
    measures: '같은 열을 받는 두 시료의 온도 변화',
    changes: '시료의 종류',
    relation: '같은 열량과 질량이면 온도 변화는 비열에 반비례한다',
    concepts: ['specificHeat', 'heat', 'temperature', 'heatCapacity'],
    formula: {
      expression: '$\\Delta T=\\dfrac{Q}{mc}$',
      symbols: [
        { symbol: '$\\Delta T$', meaning: '온도 변화', unit: 'K' },
        { symbol: '$Q$', meaning: '공급한 열량', unit: 'J' },
        { symbol: '$m$', meaning: '시료의 질량', unit: 'kg' },
        { symbol: '$c$', meaning: '비열', unit: 'J/(kg·K)' },
      ],
      prediction: '비열이 2배인 물질은 같은 열을 받아도 온도가 절반만 오릅니다.',
    },
    variables: {
      independent: '시료의 종류(2가지 이상)',
      dependent: '초기 선형 구간의 온도 상승 속도',
      controls: ['시료의 질량', '공급 전력', '단열 용기와 센서 위치', '처음 온도'],
    },
    analysis: [
      '측정 전에 센서 하나를 손으로 쥐어 index 열의 어느 번호가 반응하는지 확인하고, index와 시료의 대응표를 적어 둡니다.',
      '히터가 하나이므로 한 번에 한 시료씩 가열하고, 두 번째 시료는 장치를 식힌 뒤 같은 방법으로 반복합니다. 가열을 시작한 직후 온도가 거의 직선으로 오르는 구간을 고릅니다.',
      '그 구간의 기울기(초당 온도 상승)를 시료마다 구합니다.',
      '공급 전력을 기울기와 질량으로 나눠 비열을 계산합니다.',
      '두 시료의 비열 비를 구해 알려진 값과 비교합니다.',
      '용기가 함께 데워지는 몫과 새어 나간 열을 오차 원인으로 적습니다.',
    ],
    checkpoints: [
      { sign: '시간이 지나며 기울기가 완만해집니다', meaning: '온도가 올라가면서 열이 더 많이 새어 나가기 때문입니다. 초기 구간만 쓰세요.' },
      { sign: '계산한 비열이 알려진 값보다 큽니다', meaning: '용기와 센서를 데우는 데 쓰인 열까지 시료 몫으로 계산되었습니다. 용기의 열용량을 따로 재어 빼세요.' },
    ],
    extensions: {
      immediate: '같은 시료의 질량을 2배로 늘려 온도 상승 속도가 절반이 되는지 확인하세요.',
      broaden: '공급 전력을 2배로 올려 기울기가 2배가 되는지 확인해 식의 다른 변수도 검증하세요.',
      connect: '“얼음의 융해 잠열 곡선” 레시피에서 온도가 오르지 않는 구간을 만나게 됩니다.',
    },
  },
  'ph12-latent-heat': {
    question: '얼음이 녹는 동안에는 왜 온도가 오르지 않을까?',
    measures: '얼음과 물이 섞인 상태의 온도 변화',
    changes: '바꾸지 않습니다. 일정한 전력으로 계속 가열하며 관찰합니다',
    relation: '상태가 바뀌는 동안 공급된 열은 온도를 올리지 않고 상태 변화에 쓰인다',
    concepts: ['latentHeat', 'phaseChange', 'heat', 'temperature'],
    formula: {
      expression: '$Q=mL_f$',
      symbols: [
        { symbol: '$Q$', meaning: '평탄 구간에 공급된 열량', unit: 'J' },
        { symbol: '$m$', meaning: '녹은 얼음의 질량', unit: 'kg' },
        { symbol: '$L_f$', meaning: '융해 잠열(물은 약 334000)', unit: 'J/kg' },
      ],
      prediction: '얼음의 양을 2배로 하면 평탄 구간의 길이도 대략 2배가 됩니다.',
    },
    variables: {
      independent: '시간(관찰 전체 구간)',
      dependent: 'temperature_c의 시간 변화, 특히 평탄 구간의 길이',
      controls: ['공급 전력', '얼음과 물의 질량', '단열 컵', '센서 위치와 젓는 조건'],
    },
    analysis: [
      '얼음과 물의 질량을 저울로 재어 기록합니다.',
      '온도-시간 그래프에서 기울기가 거의 0인 평탄 구간의 시작과 끝 시각을 읽습니다.',
      '평탄 구간의 길이에 공급 전력을 곱해 그동안 들어간 열량을 구합니다.',
      '그 열량을 녹은 얼음의 질량으로 나눠 융해 잠열을 계산합니다.',
      '알려진 값 334 kJ/kg과 비교하고, 차이의 원인을 열손실과 얼음 온도 등으로 나눠 설명합니다.',
    ],
    checkpoints: [
      { sign: '평탄 구간이 뚜렷하지 않습니다', meaning: '얼음이 너무 적거나 젓지 않아 온도가 고르지 않습니다. 잘게 부순 얼음을 늘리고 계속 저으세요.' },
      { sign: '평탄 구간의 온도가 0 °C가 아닙니다', meaning: '센서의 보정 오차입니다. 얼음물에서 잰 값을 기준으로 보정값을 적용하세요.' },
    ],
    extensions: {
      immediate: '얼음을 절반만 넣고 평탄 구간의 길이도 절반이 되는지 확인하세요.',
      broaden: '물이 끓기 직전까지 계속 가열해 두 번째 평탄 구간이 나타나는지 관찰하세요.',
      connect: '“물질의 비열 비교” 레시피에서 온도가 오르는 구간의 기울기를 다루는 법을 익히세요.',
    },
  },
  'ph13-thermal-conductivity': {
    question: '금속 숟가락은 왜 나무 젓가락보다 빨리 뜨거워질까?',
    measures: '막대 양 끝의 온도와 그 차이',
    changes: '막대의 재료',
    relation: '열을 잘 전달하는 재료일수록 정상 상태의 온도 차가 작다',
    concepts: ['conduction', 'thermalConductivity', 'temperature', 'thermalEquilibrium'],
    formula: {
      expression: '$P=\\dfrac{kA\\,\\Delta T}{L}$',
      symbols: [
        { symbol: '$P$', meaning: '막대를 지나는 열의 흐름', unit: 'W' },
        { symbol: '$k$', meaning: '열전도율', unit: 'W/(m·K)' },
        { symbol: '$A$', meaning: '막대의 단면적', unit: 'm²' },
        { symbol: '$\\Delta T$', meaning: '양 끝의 온도 차', unit: 'K' },
        { symbol: '$L$', meaning: '막대의 길이', unit: 'm' },
      ],
      prediction: '같은 전력을 넣을 때 열전도율이 2배인 재료는 양 끝 온도 차가 절반이 됩니다.',
    },
    variables: {
      independent: '막대 재료 3가지(치수는 동일)',
      dependent: '정상 상태의 양 끝 온도 차와 그 상태에 이르는 시간',
      controls: ['막대의 길이와 단면적', '가열 전력', '센서 부착 방법', '옆면 단열'],
    },
    analysis: [
      '가열하기 전에 두 센서를 나란히 두고 30개 표본의 평균 차이를 재어 두 센서의 영점 오프셋으로 기록합니다. 정상 상태 온도 차가 1 °C 아래일 수 있어 이 보정 없이는 결과가 뒤집힐 수 있습니다. 한 센서를 손으로 쥐어 index와 막대 끝의 대응도 확인해 둡니다.',
      '가열을 시작한 뒤 두 온도의 차이가 더 이상 변하지 않을 때까지 기다립니다.',
      '그 정상 상태에서 온도 차의 평균을 구하고 영점 오프셋을 뺍니다.',
      '재료마다 온도 차와 도달 시간을 표로 정리합니다.',
      '기준 재료(예: 알루미늄)를 정하고, 온도 차의 역수 비로 상대 열전도율을 구합니다.',
      '옆면으로 새는 열 때문에 실제보다 열전도율이 크게 나온다는 점을 오차로 적습니다.',
    ],
    checkpoints: [
      { sign: '온도 차가 계속 변합니다', meaning: '아직 정상 상태가 아닙니다. 더 기다리거나 단열을 보강하세요.' },
      { sign: '나무 막대에서 먼 쪽 온도가 거의 변하지 않습니다', meaning: '정상입니다. 열이 거의 전달되지 않는다는 뜻이고, 온도 차의 하한만 말할 수 있습니다.' },
    ],
    extensions: {
      immediate: '막대를 알루미늄 포일로 감싸 옆면 손실을 줄이고 온도 차가 달라지는지 확인하세요.',
      broaden: '같은 재료로 길이만 2배인 막대를 써서 온도 차가 2배가 되는지 확인하세요.',
      connect: '“단열재 성능 비교” 레시피에서 열을 막는 쪽의 성능을 다룹니다.',
    },
  },
  'ph14-insulation-performance': {
    question: '어떤 단열재가 따뜻함을 가장 오래 지킬까?',
    measures: '용기 속 온도와 주변 온도',
    changes: '용기를 감싼 단열재',
    relation: '단열이 좋을수록 냉각 상수가 작아 온도 차가 천천히 줄어든다',
    concepts: ['insulation', 'newtonCooling', 'temperature', 'linearization'],
    formula: {
      expression: '$\\ln\\dfrac{T-T_a}{T_0-T_a}=-kt$',
      symbols: [
        { symbol: '$T$', meaning: '시각 $t$의 용기 속 온도', unit: '°C' },
        { symbol: '$T_a$', meaning: '주변 온도', unit: '°C' },
        { symbol: '$k$', meaning: '냉각 상수', unit: '1/s' },
      ],
      prediction: '단열이 좋을수록 그래프의 기울기가 완만해지고 $k$가 작아집니다.',
    },
    variables: {
      independent: '단열재 종류 3~4가지',
      dependent: '냉각 상수 $k$',
      controls: ['같은 용기와 물의 양', '처음 물 온도', '주변 온도와 기류', '센서 담근 깊이'],
    },
    analysis: [
      'BME280으로 주변 온도를 함께 기록해 실제로 일정했는지 확인합니다.',
      '용기 온도에서 주변 온도를 빼 온도 차를 만듭니다.',
      '온도 차를 처음 온도 차로 나눈 뒤 자연로그를 취해 시간에 대해 그립니다.',
      '직선의 기울기 크기를 냉각 상수로 읽고 단열재별로 비교합니다.',
      '$1/k$를 “온도 차가 약 37%로 줄어드는 시간”으로 바꿔 직관적으로 설명합니다.',
    ],
    checkpoints: [
      { sign: '주변 온도가 실험 중에 변했습니다', meaning: '온도 차 계산이 어긋납니다. 각 시각의 실제 주변 온도를 써서 다시 계산하세요.' },
      { sign: '단열재를 두껍게 했는데 $k$가 그대로입니다', meaning: '뚜껑이 열려 있어 위쪽으로 열이 빠져나갔을 수 있습니다. 뚜껑 조건을 통일하세요.' },
    ],
    extensions: {
      immediate: '같은 단열재를 두 겹으로 감싸 $k$가 얼마나 더 줄어드는지 확인하세요.',
      broaden: '차가운 물로 바꿔 “차가움을 지키는 성능”도 같은 $k$로 설명되는지 확인하세요.',
      connect: '“물의 냉각 곡선 (뉴턴 냉각법칙)” 레시피에서 이 분석 방법의 기초를 익힐 수 있습니다.',
    },
  },
  'ph15-gas-temperature-pressure': {
    question: '기체를 데우면 왜 압력이 올라갈까?',
    measures: '밀폐 용기 속 기체의 온도와 절대압력',
    changes: '용기를 담그는 물의 온도',
    relation: '부피와 기체량이 같으면 절대압력은 절대온도에 비례한다',
    concepts: ['gasLaw', 'pressure', 'absoluteTemperature', 'thermalEquilibrium'],
    formula: {
      expression: '$\\dfrac{P}{T}=\\text{일정}$',
      symbols: [
        { symbol: '$P$', meaning: '기체의 절대압력', unit: 'hPa' },
        { symbol: '$T$', meaning: '절대온도(섭씨 + 273.15)', unit: 'K' },
      ],
      prediction: '절대온도가 10% 오르면 압력도 약 10% 오릅니다. $P$-$T$ 그래프를 그리면 원점을 향하는 직선이 됩니다.',
    },
    variables: {
      independent: '물 욕조의 온도 5단계(용기 정격 안에서)',
      dependent: 'pressure_hpa 값',
      controls: ['용기의 부피(변형 없음)', '기체의 양(밀폐 유지)', '열평형을 기다리는 시간'],
    },
    analysis: [
      '각 온도에서 값이 더 이상 변하지 않을 때까지 기다린 뒤 30개 표본의 평균을 구합니다.',
      '섭씨 온도에 273.15를 더해 절대온도로 바꿉니다.',
      '절대온도를 가로축, 압력을 세로축으로 그려 직선을 맞춥니다.',
      '그 직선을 0 K까지 늘렸을 때 원점 근처를 지나는지 확인합니다.',
      '벗어난다면 새는 곳, 용기의 부피 변화, 센서 자체 발열 중 무엇 때문인지 나눠 검토합니다.',
    ],
    checkpoints: [
      { sign: '온도를 올렸는데 압력이 오르지 않습니다', meaning: '용기가 새고 있습니다. 밀폐를 확인하고 다시 시작하세요.' },
      { sign: '직선을 늘렸더니 원점에서 크게 벗어납니다', meaning: '섭씨를 절대온도로 바꾸지 않았거나 기체가 샜을 수 있습니다. 단위부터 확인하세요.' },
    ],
    extensions: {
      immediate: '온도를 다시 내려 압력이 원래 값으로 되돌아오는지 확인해 되돌릴 수 있는 변화인지 봅니다.',
      broaden: '용기 안 기체를 조금 빼고 같은 실험을 반복해 직선의 기울기가 달라지는지 확인하세요.',
      connect: '“고도 변화와 기압” 레시피에서 기압을 다른 방식으로 다룹니다.',
    },
  },
  'ph16-altitude-pressure': {
    question: '한 층만 올라가도 기압이 달라질까?',
    measures: '여러 높이에서 잰 절대 기압과 온도',
    changes: '측정 지점의 높이',
    relation: '높이가 올라가면 그 위에 남은 공기의 무게가 줄어 기압이 낮아진다',
    concepts: ['pressure', 'airDensity', 'gravitationalAcceleration', 'slopeIntercept'],
    formula: {
      expression: '$\\Delta P\\approx-\\rho g\\,\\Delta h$',
      symbols: [
        { symbol: '$\\Delta P$', meaning: '기압 차', unit: 'Pa' },
        { symbol: '$\\rho$', meaning: '공기 밀도(약 1.2)', unit: 'kg/m³' },
        { symbol: '$\\Delta h$', meaning: '높이 차', unit: 'm' },
      ],
      prediction: '높이가 10 m 올라가면 기압은 약 1.2 hPa 낮아집니다.',
    },
    variables: {
      independent: '기준층에서 잰 높이 4단계 이상',
      dependent: 'pressure_hpa 값',
      controls: ['센서 자세와 위치', '측정 시각(짧은 시간 안에 끝내기)', '실내외 조건'],
    },
    analysis: [
      '각 높이에서 값이 안정될 때까지 기다린 뒤 30개 표본의 평균을 구합니다.',
      '기준층에서 다시 한 번 재어, 날씨 때문에 기준값이 흘러가지 않았는지 확인합니다.',
      '높이를 가로축, 기압을 세로축으로 그려 직선을 맞춥니다.',
      '기울기(hPa/m)에 100을 곱해 Pa/m로 바꾼 뒤 $g$로 나눠 공기 밀도를 추정하고 1.2 kg/m³와 비교합니다.',
      '처음과 마지막 기준층 값의 차이를 이용해 시간에 따른 변화분을 보정합니다.',
    ],
    checkpoints: [
      { sign: '높이 차에 비해 기압 차가 너무 큽니다', meaning: '건물 안팎의 공기 흐름이나 문 여닫기 영향입니다. 조용한 계단실에서 다시 재세요.' },
      { sign: '같은 높이를 다시 쟀는데 값이 다릅니다', meaning: '날씨가 변하고 있습니다. 왕복 측정으로 그 변화분을 보정하세요.' },
    ],
    extensions: {
      immediate: '한 층 사이만 5회 반복해 기압 차가 재현되는지 확인하세요.',
      broaden: '건물 전체 높이까지 범위를 넓혀 직선 관계가 유지되는지 확인하세요.',
      connect: '“기압 변화로 날씨 관측” 레시피에서 같은 자리의 기압이 시간에 따라 어떻게 변하는지 봅니다.',
    },
  },

  // ── 전기 ──────────────────────────────────────────────────────────────
  'ph17-ohms-law': {
    question: '전압을 올리면 전류는 정확히 그만큼 늘어날까?',
    measures: '저항 양 끝의 실제 전압과 그때 흐른 전류',
    changes: '저항에 걸어 주는 전압과 저항값',
    relation: '옴성 저항에서는 전압과 전류가 정비례하고 그 비가 저항이다',
    concepts: ['ohmsLaw', 'voltage', 'current', 'resistance', 'pwm'],
    formula: {
      expression: '$V=IR$',
      symbols: [
        { symbol: '$V$', meaning: '저항 양 끝의 전압', unit: 'V' },
        { symbol: '$I$', meaning: '흐르는 전류', unit: 'A' },
        { symbol: '$R$', meaning: '저항', unit: 'Ω' },
      ],
      prediction: '전압을 2배로 올리면 전류도 2배가 됩니다. $V$-$I$ 그래프의 기울기가 저항입니다.',
    },
    variables: {
      independent: 'PWM 듀티 5단계와 측정 저항 3가지(1 kΩ, 2.2 kΩ, 4.7 kΩ)',
      dependent: 'bus_V와 current_mA 값',
      controls: ['RC 필터 구성', '안정화 시간', '주변 온도', '조건마다 conditionId를 실제 저항과 맞추기'],
    },
    analysis: [
      '가로축에 PWM 듀티가 아니라 INA219가 실제로 측정한 전압을 놓습니다. 듀티는 조건 이름일 뿐입니다.',
      '저항마다 $V$-$I$ 산점도를 그리고 직선을 맞춥니다.',
      '기울기 또는 각 점의 $V/I$로 저항을 구해 부품 표시값과 비교합니다.',
      '4.7 kΩ 조건은 전류가 0.1~1 mA로 작아 눈금 몇 칸에 불과하므로, 같은 조건을 여러 번 재어 평균과 불확도를 함께 적습니다.',
      '세 저항의 직선을 한 그래프에 겹쳐 기울기가 저항 순서대로 커지는지 확인합니다.',
    ],
    checkpoints: [
      { sign: '전류가 0.0 mA로만 나옵니다', meaning: '저항이 커서 전류가 분해능 아래로 내려간 것입니다. 더 작은 저항 조건의 자료를 함께 쓰세요.' },
      { sign: '점들이 직선이 아니라 계단처럼 놓입니다', meaning: '전류 분해능 때문에 생긴 계단입니다. 오차막대를 붙여 표시하세요.' },
      { sign: '듀티를 올렸는데 전압이 안 오릅니다', meaning: 'RC 필터가 아직 안정되지 않았습니다. 안정화 시간을 늘리세요.' },
    ],
    extensions: {
      immediate: '같은 듀티에서 5회 반복해 전류 값이 얼마나 흔들리는지 확인하세요.',
      broaden: 'LED를 저항 대신 연결해 $V$-$I$ 관계가 직선이 아닌 부품을 관찰하세요.',
      connect: '“직렬·병렬 저항의 등가저항” 레시피에서 저항을 조합했을 때의 관계로 확장합니다.',
    },
  },
  'ph18-series-parallel-resistance': {
    question: '저항을 여러 개 이으면 전체 저항은 어떻게 변할까?',
    measures: '저항망 전체에 걸린 전압과 흐르는 전류',
    changes: '두 저항의 연결 방식(직렬, 병렬)',
    relation: '직렬은 저항이 더해지고, 병렬은 역수가 더해져 전체 저항이 작아진다',
    concepts: ['seriesParallel', 'equivalentResistance', 'ohmsLaw', 'resistance'],
    formula: {
      expression: '$R_{\\mathrm{eq}}=\\sum_i R_i,\\quad \\frac{1}{R_{\\mathrm{eq}}}=\\sum_i\\frac{1}{R_i}$',
      symbols: [
        { symbol: '$R_{\\mathrm{eq}}$', meaning: '전체를 대신하는 하나의 저항', unit: 'Ω' },
        { symbol: '$R_i$', meaning: '각 저항의 값', unit: 'Ω' },
      ],
      prediction: '220 Ω과 1 kΩ이면 직렬은 1220 Ω, 병렬은 약 180 Ω입니다. 병렬은 가장 작은 저항보다도 작아집니다.',
    },
    variables: {
      independent: '연결 방식(직렬, 병렬)',
      dependent: '전압을 전류로 나눠 구한 등가저항',
      controls: ['공급 전압', '같은 두 저항', 'INA219를 전원과 저항망 사이에 두는 위치', '측정 시간'],
    },
    analysis: [
      '두 저항의 실제 값을 확인하고 표시된 허용오차(예: ±5%)를 적어 둡니다.',
      '직렬 조건에서 30개 표본의 평균 전압과 전류를 구해 등가저항을 계산합니다.',
      '전원을 끄고 병렬로 다시 배선한 뒤 같은 방법으로 계산합니다.',
      '두 결과를 이론값과 비교하고, 차이가 허용오차 범위 안에 있는지 판단합니다.',
      '병렬 등가저항이 두 저항 중 작은 값보다도 작다는 것을 확인합니다.',
    ],
    checkpoints: [
      { sign: '병렬 등가저항이 220 Ω보다 큽니다', meaning: '실제로는 직렬로 연결되어 있을 가능성이 큽니다. 두 저항의 양 끝이 같은 두 마디에 꽂혔는지 확인하세요.' },
      { sign: '계산값이 이론값과 10% 이상 다릅니다', meaning: '접촉 저항이나 배선 저항이 더해졌을 수 있습니다. 접점을 다시 눌러 꽂으세요.' },
    ],
    extensions: {
      immediate: '저항을 3개로 늘려 직렬 합이 그대로 더해지는지 확인하세요.',
      broaden: '값이 같은 저항 두 개를 병렬로 이어 등가저항이 정확히 절반이 되는지 확인하세요.',
      connect: '“키르히호프 전압·전류 법칙” 레시피에서 갈림길의 전류를 직접 재어 봅니다.',
    },
  },
  'ph19-kirchhoff-laws': {
    question: '갈림길에서 전류는 어떻게 나뉘고, 한 바퀴 돌면 전압은 어떻게 될까?',
    measures: '전체 전류와 각 가지의 전류, 각 저항 양단의 전압',
    changes: 'INA219를 두는 측정 지점(전체, 220 Ω 가지, 470 Ω 가지)',
    relation: '갈림점에서 전류의 합이 보존되고, 한 고리를 돌면 전압 변화의 합이 0이 된다',
    concepts: ['kirchhoff', 'current', 'voltage', 'seriesParallel'],
    formula: {
      expression: '$\\sum I_{\\text{들어옴}}=\\sum I_{\\text{나감}},\\quad \\sum V_{\\text{고리}}=0$',
      symbols: [
        { symbol: '$I$', meaning: '각 가지에 흐르는 전류', unit: 'mA' },
        { symbol: '$V$', meaning: '각 부품 양단의 전압', unit: 'V' },
      ],
      prediction: '저항이 작은 가지에 더 많은 전류가 흐르고, 두 가지 전류의 합은 전체 전류와 같아야 합니다.',
    },
    variables: {
      independent: '측정 지점 3곳(TOTAL, BRANCH_220, BRANCH_470)',
      dependent: '각 지점의 current_mA와 저항 양단 전압',
      controls: ['공급 전압', '저항 구성', '측정 사이 전원 차단', 'conditionId를 실제 측정 지점과 맞추기'],
    },
    analysis: [
      '각 조건에서 30개 표본의 평균 전류와 전압을 구합니다.',
      '두 가지 전류의 합을 전체 전류와 비교하고, 차이를 전체 전류로 나눠 상대 차이를 구합니다.',
      '각 가지의 전압 강하가 서로 같은지 확인합니다. 병렬 가지는 같은 전압을 나눠 씁니다.',
      '전원 전압(TOTAL 조건에서 bus_V + shunt_mV÷1000)에서 각 부품의 전압 강하를 차례로 빼면 0이 되는지 확인합니다.',
      '두 법칙의 차이가 반복 측정에서 나온 흔들림 범위 안에 있는지 판단합니다.',
    ],
    checkpoints: [
      { sign: '가지 전류의 합이 전체보다 뚜렷하게 작습니다', meaning: '측정 사이에 배선이 달라졌거나 접촉이 불량합니다. 세 조건을 짧은 시간 안에 다시 재세요.' },
      { sign: '두 가지의 전압이 다릅니다', meaning: '실제로 병렬이 아닌 배선입니다. 두 저항이 같은 두 마디를 공유하는지 확인하세요.' },
    ],
    extensions: {
      immediate: '470 Ω을 1 kΩ으로 바꿔 전류가 어떻게 다시 나뉘는지 확인하세요.',
      broaden: '가지를 3개로 늘려 법칙이 그대로 성립하는지 확인하세요.',
      connect: '“직렬·병렬 저항의 등가저항” 레시피의 결과로 각 가지 전류를 미리 예측해 보세요.',
    },
  },
  'ph20-joule-heating': {
    question: '전기가 열로 바뀔 때, 얼마나 넣으면 얼마나 뜨거워질까?',
    measures: '전력저항의 전압·전류·온도',
    changes: '가열 구간과 냉각 구간',
    relation: '공급한 전기 에너지가 저항의 온도를 올리고, 동시에 일부는 주변으로 새어 나간다',
    concepts: ['jouleHeating', 'electricPower', 'heatCapacity', 'newtonCooling'],
    formula: {
      expression: '$E=\\int P\\,dt,\\quad P=VI=I^2R$',
      symbols: [
        { symbol: '$E$', meaning: '공급한 전기 에너지', unit: 'J' },
        { symbol: '$P$', meaning: '전력', unit: 'W' },
        { symbol: '$V,I$', meaning: '전압과 전류', unit: 'V, A' },
      ],
      prediction: '전류를 2배로 하면 전력은 4배가 됩니다. 온도는 처음에 빠르게 오르다 어느 값에서 멈춥니다.',
    },
    variables: {
      independent: '가열(HEATING)과 냉각(COOLING) 구간',
      dependent: 'power_W의 시간 누적값과 temperature_C의 변화',
      controls: ['공급 전압', '단열 용기', '센서를 저항 몸체에 붙인 방법', '주변 온도'],
    },
    analysis: [
      '저항의 소비전력이 2.5 W 이하인지 먼저 확인합니다.',
      '가열 구간에서 전력을 시간에 대해 쌓아 공급한 총 에너지를 구합니다.',
      '온도 상승분으로 그 에너지를 나눠 “유효 열용량”을 추정합니다.',
      '온도가 더 이상 오르지 않는 지점에서는 공급 전력과 새어 나가는 열이 같아졌다는 점을 확인합니다.',
      '냉각 구간에서는 관찰 노트에 적어 둔 주변 온도와의 차에 로그를 취해 냉각 상수를 구하고, 열손실 몫을 따로 평가합니다.',
    ],
    checkpoints: [
      { sign: '온도가 계속 오르기만 합니다', meaning: '아직 균형점에 이르지 못했습니다. 더 오래 기록하거나 전력을 낮추세요.' },
      { sign: '유효 열용량이 비현실적으로 큽니다', meaning: '센서가 저항 몸체에 잘 붙어 있지 않아 온도를 낮게 읽는 것입니다. 접촉을 다시 확인하세요.' },
    ],
    extensions: {
      immediate: '전압을 조금 낮춰 균형 온도가 얼마나 내려가는지 확인하세요.',
      broaden: '저항을 단열재로 감싸 같은 전력에서 균형 온도가 얼마나 올라가는지 비교하세요.',
      connect: '“물질의 비열 비교” 레시피에서 열용량을 재는 다른 방법을 익힐 수 있습니다.',
    },
  },
  'ph21-rc-time-constant': {
    question: '커패시터는 얼마나 빨리 차고 얼마나 빨리 비워질까?',
    measures: '커패시터 양단의 전압과 흐르는 전류의 시간 변화',
    changes: '충전 구간과 방전 구간',
    relation: '저항과 전기용량의 곱이 클수록 충전과 방전이 느리다',
    concepts: ['capacitor', 'timeConstant', 'voltage', 'current', 'linearization'],
    formula: {
      expression: '$V=V_0\\left(1-e^{-t/(RC)}\\right),\\quad V=V_0e^{-t/(RC)}$',
      symbols: [
        { symbol: '$V_0$', meaning: '최종 전압 또는 처음 전압', unit: 'V' },
        { symbol: '$R$', meaning: '직렬 저항', unit: 'Ω' },
        { symbol: '$C$', meaning: '전기용량', unit: 'F' },
        { symbol: '$\\tau=RC$', meaning: '시간상수', unit: 's' },
      ],
      prediction: '10 kΩ과 100 µF이면 시간상수는 1초입니다. 1초 만에 약 63%까지 차고, 5초면 거의 다 찹니다.',
    },
    variables: {
      independent: '조건(CHARGE, DISCHARGE)',
      dependent: 'capacitor_V의 시간 변화',
      controls: ['저항과 커패시터의 값', '공급 전압', '표본 간격', '측정 전 완전 방전'],
    },
    analysis: [
      '충전 곡선에서 최종 전압의 63.2%에 이른 시각을 읽어 시간상수를 구합니다.',
      '방전 곡선에서는 처음 전압의 36.8%로 내려간 시각을 읽습니다.',
      '방전 자료의 전압에 자연로그를 취해 시간에 대해 그리면 직선이 되고, 기울기의 역수 크기가 시간상수입니다.',
      '두 방법으로 구한 시간상수를 명목값 $RC$와 비교합니다.',
      '차이가 크다면 전해 커패시터의 용량 허용오차(±20%도 흔합니다)를 근거로 설명합니다.',
    ],
    checkpoints: [
      { sign: '충전이 순식간에 끝나 점이 몇 개 없습니다', meaning: '표본 간격이 시간상수에 비해 너무 깁니다. 간격을 줄이거나 저항을 키우세요.' },
      { sign: '방전 곡선이 0까지 내려가지 않습니다', meaning: '측정 회로로 조금씩 전류가 흐르고 있습니다. 그 잔류값을 빼고 로그를 취하세요.' },
    ],
    extensions: {
      immediate: '저항을 2배로 바꿔 시간상수도 2배가 되는지 확인하세요.',
      broaden: '커패시터를 두 개 병렬로 이어 전기용량이 더해지는지 시간상수로 확인하세요.',
      connect: '“옴의 법칙 V-I 특성” 레시피의 RC 필터가 왜 필요한지 이 실험으로 이해할 수 있습니다.',
    },
  },
  'ph22-battery-internal-resistance': {
    question: '건전지에서 전류를 많이 뽑으면 왜 전압이 떨어질까?',
    measures: '전지의 단자전압과 그때 흐르는 전류',
    changes: '연결한 저항값',
    relation: '전지 안에도 저항이 있어서 전류가 클수록 단자전압이 더 많이 떨어진다',
    concepts: ['emf', 'internalResistance', 'voltage', 'current', 'slopeIntercept'],
    formula: {
      expression: '$V=E-Ir$',
      symbols: [
        { symbol: '$V$', meaning: '단자전압', unit: 'V' },
        { symbol: '$E$', meaning: '기전력(그래프의 세로축 절편)', unit: 'V' },
        { symbol: '$I$', meaning: '흐르는 전류', unit: 'A' },
        { symbol: '$r$', meaning: '내부저항(기울기의 크기)', unit: 'Ω' },
      ],
      prediction: '저항을 작게 할수록 전류가 커지고 단자전압은 내려갑니다. $V$-$I$ 그래프는 오른쪽으로 내려가는 직선입니다.',
    },
    variables: {
      independent: '연결한 저항(OPEN, 470 Ω, 220 Ω, 100 Ω)',
      dependent: 'terminal_V와 current_mA 값',
      controls: ['같은 건전지', '각 조건 5초 이내 측정', '조건 사이 휴식 시간', '주변 온도'],
    },
    analysis: [
      '저항을 떼고 개방 상태(OPEN)의 전압을 먼저 기록합니다. 이 값이 기전력에 가깝습니다.',
      '저항을 바꿔 가며 각 조건의 평균 전압과 전류를 구합니다.',
      '전류를 가로축, 단자전압을 세로축으로 그려 직선을 맞춥니다.',
      '세로축 절편이 기전력, 기울기의 크기가 내부저항입니다. 다만 측정 경로의 0.1 Ω 션트 저항도 기울기에 포함되므로 그만큼 빼 주세요.',
      '개방 전압과 절편이 비슷한지 비교해 측정이 일관되는지 확인합니다.',
    ],
    checkpoints: [
      { sign: '측정을 반복할수록 전압이 계속 낮아집니다', meaning: '건전지가 지치고 있습니다. 조건 사이에 쉬게 하고 측정 시간을 줄이세요.' },
      { sign: '내부저항이 음수로 나옵니다', meaning: '조건 이름과 실제 저항이 어긋났을 가능성이 큽니다. conditionId를 확인하세요.' },
    ],
    extensions: {
      immediate: '오래 쓴 건전지로 바꿔 내부저항이 얼마나 커졌는지 비교하세요.',
      broaden: '건전지 두 개를 직렬로 이어 기전력과 내부저항이 각각 어떻게 변하는지 확인하세요.',
      connect: '“태양전지 I-V 곡선과 최대전력점” 레시피에서 전원의 특성 곡선을 더 넓게 다룹니다.',
    },
  },
  'ph23-solar-iv-mpp': {
    question: '태양전지에서 가장 많은 전기를 뽑으려면 무엇을 연결해야 할까?',
    measures: '태양전지의 전압·전류·전력과 같은 순간의 조도',
    changes: '연결한 부하 저항',
    relation: '너무 크거나 작은 저항에서는 전력이 작고, 그 사이 어딘가에 최대전력점이 있다',
    concepts: ['solarCell', 'maximumPowerPoint', 'electricPower', 'illuminance'],
    formula: {
      expression: '$P=VI$',
      symbols: [
        { symbol: '$P$', meaning: '태양전지의 출력', unit: 'mW' },
        { symbol: '$V$', meaning: '패널 전압', unit: 'V' },
        { symbol: '$I$', meaning: '출력 전류', unit: 'mA' },
      ],
      prediction: '저항이 아주 크면 전압은 높지만 전류가 거의 없고, 아주 작으면 반대입니다. 전력은 그 중간에서 최대가 됩니다.',
    },
    variables: {
      independent: '부하 저항 7단계(10 kΩ부터 100 Ω까지)',
      dependent: 'panel_V, current_mA, power_mW 값',
      controls: ['광원의 밝기와 거리', '패널 각도', '패널 온도', 'conditionId를 실제 저항과 맞추기'],
    },
    analysis: [
      '가장 큰 저항부터 차례로 바꾸며 각 조건에서 값이 안정된 뒤 평균을 구합니다.',
      '전압을 가로축, 전류를 세로축으로 그려 $I$-$V$ 곡선을 만듭니다.',
      '같은 자료로 전압을 가로축, 전력을 세로축으로 그려 $P$-$V$ 곡선을 만듭니다.',
      '전력이 가장 큰 점의 전압과 전류를 읽어 최대전력점으로 기록합니다.',
      '광원을 어둡게 한 뒤 같은 실험을 반복해 최대전력점이 어느 쪽으로 옮겨 가는지 비교합니다.',
    ],
    checkpoints: [
      { sign: '전력이 계속 커지기만 합니다', meaning: '저항 범위가 최대전력점을 지나지 못했습니다. 더 작은 저항을 추가하세요.' },
      { sign: '조도는 그대로인데 전력이 줄어듭니다', meaning: '패널이 데워졌을 수 있습니다. 조건 사이에 식히는 시간을 두세요.' },
    ],
    extensions: {
      immediate: '광원을 절반 거리로 옮겨 최대전력점의 전압이 거의 그대로인지 확인하세요.',
      broaden: '패널 절반을 가리고 $I$-$V$ 곡선이 어떻게 찌그러지는지 관찰하세요.',
      connect: '“태양광 패널 각도별 효율” 레시피에서 각도에 따른 출력 변화를 함께 다룹니다.',
    },
  },
  'ph24-solenoid-current-field': {
    question: '전자석의 힘은 전류를 올리면 얼마나 세질까?',
    measures: '코일에 흐르는 전류와 코일 중심의 홀 센서 출력',
    changes: '코일에 흘리는 전류',
    relation: '긴 솔레노이드 중심의 자기장은 전류에 정비례한다',
    concepts: ['solenoid', 'magneticField', 'current', 'hallEffect'],
    formula: {
      expression: '$B\\approx\\mu_0 nI$',
      symbols: [
        { symbol: '$B$', meaning: '코일 중심의 자기장', unit: 'T' },
        { symbol: '$\\mu_0$', meaning: '진공의 투자율(약 $4\\pi\\times10^{-7}$)', unit: 'T·m/A' },
        { symbol: '$n$', meaning: '단위 길이당 감은 수', unit: '회/m' },
        { symbol: '$I$', meaning: '코일 전류', unit: 'A' },
      ],
      prediction: '전류를 2배로 하면 자기장도 2배가 됩니다. 전류를 가로축으로 그리면 원점을 지나는 직선이 됩니다.',
    },
    variables: {
      independent: '코일 전류 4단계(I000, I050, I100, I150)',
      dependent: '영점을 뺀 hall_raw 값',
      controls: ['코일의 위치와 감은 수', '센서를 코일 중심에 고정한 위치와 방향', '측정 사이 냉각 시간'],
    },
    analysis: [
      '전류를 0으로 한 I000 조건에서 홀 센서의 영점을 먼저 구합니다.',
      '각 전류 조건에서 값이 안정된 뒤 30개 표본의 평균을 구하고 영점을 뺍니다.',
      '전류를 가로축, 영점을 뺀 홀 출력을 세로축으로 그려 직선을 맞춥니다.',
      '직선이 원점을 지나는지, 기울기가 일정한지 확인합니다.',
      '측정 순서를 뒤집어 다시 재고, 코일이 데워지며 값이 흘러가는 정도를 따로 확인합니다.',
    ],
    checkpoints: [
      { sign: '전류가 클 때 직선에서 아래로 벗어납니다', meaning: '코일이 데워져 저항이 커졌거나 센서가 측정 범위에 가까워진 것입니다. 냉각 시간을 늘리세요.' },
      { sign: '전류가 0인데 홀 값이 0이 아닙니다', meaning: '정상입니다. 그것이 영점이며, 반드시 빼고 분석해야 합니다.' },
    ],
    extensions: {
      immediate: '전류 방향을 반대로 해 홀 출력의 부호가 뒤집히는지 확인하세요.',
      broaden: '센서를 코일 끝으로 옮겨 중심보다 값이 얼마나 작은지 비교하세요.',
      connect: '“코일 감은 수와 자기장” 레시피에서 식의 다른 변수인 감은 수를 다룹니다.',
    },
  },
  'ph25-coil-turns-field': {
    question: '같은 전류라도 촘촘히 감으면 자석이 더 세질까?',
    measures: '코일 전류와 코일 중심의 홀 센서 출력',
    changes: '코일의 감은 수(길이와 지름은 동일)',
    relation: '길이와 전류가 같으면 자기장은 단위 길이당 감은 수에 비례한다',
    concepts: ['solenoid', 'turnsPerLength', 'magneticField', 'controlVariable'],
    formula: {
      expression: '$B\\approx\\mu_0 nI$',
      symbols: [
        { symbol: '$n$', meaning: '단위 길이당 감은 수', unit: '회/m' },
        { symbol: '$I$', meaning: '코일 전류(모든 조건에서 같게 맞춤)', unit: 'A' },
        { symbol: '$B$', meaning: '코일 중심의 자기장', unit: 'T' },
      ],
      prediction: '감은 수를 2배로 하면 자기장도 2배가 됩니다.',
    },
    variables: {
      independent: '코일의 감은 수 3단계(N50, N100, N150)',
      dependent: '영점을 뺀 hall_raw 값',
      controls: ['실제 코일 전류(전류 제한 전원으로 같은 값에 맞춤)', '코일 길이와 지름', '센서 위치와 방향'],
    },
    analysis: [
      '코일을 바꿀 때마다 current_mA를 확인해 세 조건의 전류가 실제로 같은지 검증합니다.',
      '전류를 0으로 한 상태에서 영점을 구해 모든 값에서 뺍니다.',
      '감은 수를 가로축, 영점을 뺀 홀 출력을 세로축으로 그립니다.',
      '직선이 원점을 지나는지 확인하고, 벗어난다면 코일 끝 효과로 설명합니다.',
      '기울기로 “감은 수 1회당 자기장 증가분”을 구해 코일별로 비교합니다.',
    ],
    checkpoints: [
      { sign: '코일을 바꿨더니 전류도 함께 변합니다', meaning: '코일 저항이 달라졌기 때문입니다. 전류 제한 전원으로 전류를 다시 같게 맞추세요.' },
      { sign: '감은 수를 늘렸는데 자기장이 덜 늘어납니다', meaning: '코일이 길어져 실제 단위 길이당 감은 수가 예상보다 작을 수 있습니다. 코일 길이를 다시 재세요.' },
    ],
    extensions: {
      immediate: '같은 코일을 두 개 겹쳐 감은 수를 2배로 만들고 결과를 예측한 뒤 확인하세요.',
      broaden: '코일 안에 철심을 넣고 자기장이 얼마나 커지는지 관찰하세요.',
      connect: '“솔레노이드 전류와 자기장” 레시피에서 같은 식의 전류 변수를 다룹니다.',
    },
  },
  'ph26-rotating-magnet-signal': {
    question: '자석이 지나가는 신호만으로 회전 속도를 알 수 있을까?',
    measures: '홀 센서의 펄스 수와 펄스 사이 시간',
    changes: '회전축에 붙인 자석의 수와 회전 속도',
    relation: '펄스 주파수를 자석 수로 나누면 실제 회전 속도가 된다',
    concepts: ['frequency', 'angularVelocity', 'eventCounting', 'samplingInterval'],
    formula: {
      expression: '$\\omega=\\dfrac{2\\pi f}{N}$',
      symbols: [
        { symbol: '$\\omega$', meaning: '각속도', unit: 'rad/s' },
        { symbol: '$f$', meaning: '초당 펄스 수', unit: 'Hz' },
        { symbol: '$N$', meaning: '회전축의 자석 수', unit: '개' },
      ],
      prediction: '같은 회전 속도에서 자석을 2개로 늘리면 펄스 주파수는 2배가 되지만 계산한 각속도는 같습니다.',
    },
    variables: {
      independent: '자석 수 1~4개와 회전 속도 3단계',
      dependent: 'pulse_interval_us와 pulse_count에서 구한 주파수',
      controls: ['홀 센서와 자석 사이 간격', '자석의 극 방향', '회전판의 균형'],
    },
    analysis: [
      'pulse_interval_us로 $f=10^6/\\text{간격}$을 구하거나, 두 행의 pulse_count 차이를 시간 차이로 나눕니다.',
      '두 방법으로 구한 주파수가 서로 맞는지 확인합니다.',
      '주파수를 자석 수로 나눠 회전 속도를 구하고, 자석 수를 바꿔도 같은 값이 나오는지 검증합니다.',
      '펄스가 빠지거나 두 번 세어진 비율을 구해 측정의 신뢰도를 평가합니다.',
    ],
    checkpoints: [
      { sign: '자석 수를 바꿨더니 계산한 회전 속도가 달라집니다', meaning: '자석 수를 잘못 세었거나 한 자석이 두 번 세어지고 있습니다. 손으로 한 바퀴 돌려 확인하세요.' },
      { sign: '펄스 간격이 들쭉날쭉합니다', meaning: '자석 간격이 고르지 않거나 회전이 흔들립니다. 자석을 균등하게 배치하세요.' },
    ],
    extensions: {
      immediate: '자석 하나의 극을 뒤집으면 그 자석의 펄스만 사라져 회전당 펄스 수가 줄어드는 것을 확인하세요.',
      broaden: '센서와 자석 사이 간격을 넓혀 어느 거리부터 펄스를 놓치기 시작하는지 찾으세요.',
      connect: '“회전체 각속도와 RPM 비교” 레시피에서 자이로 센서로 이 값을 검증합니다.',
    },
  },
  'ph27-magnetic-shielding': {
    question: '자기장을 막을 수 있는 재료가 따로 있을까?',
    measures: '자석과 센서 사이에 재료를 넣었을 때의 홀 센서 출력',
    changes: '사이에 넣는 재료(철, 알루미늄, 플라스틱)',
    relation: '자성 재료는 자기장의 경로를 바꿔 센서 위치의 자기장을 줄인다',
    concepts: ['magneticShielding', 'magneticField', 'hallEffect', 'zeroOffset'],
    formula: {
      expression: '$\\text{차폐율}=\\dfrac{B_0-B}{B_0}$',
      symbols: [
        { symbol: '$B_0$', meaning: '재료가 없을 때의 자기장', unit: '-' },
        { symbol: '$B$', meaning: '재료를 넣었을 때의 자기장', unit: '-' },
      ],
      prediction: '철은 자기장의 길을 자기 쪽으로 끌어당겨 크게 줄이고, 플라스틱은 거의 영향을 주지 않습니다.',
    },
    variables: {
      independent: '삽입 재료 3가지와 두께 2단계',
      dependent: '영점을 뺀 홀 센서 출력에서 계산한 차폐율',
      controls: ['자석과 센서 사이 거리', '자석의 극 방향', '센서 위치', '주변 금속'],
    },
    analysis: [
      '자석을 치운 상태의 평균을 영점으로 정합니다.',
      '재료 없이 잰 값에서 영점을 빼 기준 자기장 $B_0$를 구합니다.',
      '재료마다 같은 자리에 넣고 30개 표본의 평균에서 영점을 뺀 값을 구합니다. 재료를 바꾼 시각은 관찰 노트의 기록으로 CSV 구간을 나눕니다.',
      '위 식으로 차폐율을 계산하고 재료와 두께별로 표로 정리합니다.',
      '값의 퍼진 범위를 오차막대로 함께 표시합니다.',
    ],
    checkpoints: [
      { sign: '철판을 넣었더니 값이 오히려 커집니다', meaning: '철이 자석에 끌려 거리가 가까워졌을 수 있습니다. 지그로 거리를 고정하세요.' },
      { sign: '플라스틱에서 차폐율이 0이 아닙니다', meaning: '재료 두께만큼 거리가 늘어난 효과입니다. 같은 두께의 플라스틱을 기준으로 삼아 다시 계산하세요.' },
    ],
    extensions: {
      immediate: '같은 재료를 두 겹으로 넣어 차폐율이 두 배가 되는지 확인하세요.',
      broaden: '재료로 센서를 상자처럼 감싸 보고, 판 하나를 넣을 때와 얼마나 다른지 비교하세요.',
      connect: '“자석의 거리에 따른 자기장 감쇠” 레시피에서 거리에 의한 감소와 재료에 의한 감소를 구별해 보세요.',
    },
  },

  // ── 빛 ────────────────────────────────────────────────────────────────
  'ph28-malus-law': {
    question: '편광판 두 장을 겹쳐 돌리면 왜 어두워졌다 밝아질까?',
    measures: '분석기 각도별로 통과한 빛의 세기',
    changes: '두 편광판이 이루는 각도',
    relation: '통과한 빛의 세기는 각도의 코사인 제곱에 비례한다',
    concepts: ['polarization', 'malusLaw', 'illuminance', 'linearization'],
    formula: {
      expression: '$I=I_0\\cos^2\\theta$',
      symbols: [
        { symbol: '$I$', meaning: '통과한 빛의 세기', unit: '-' },
        { symbol: '$I_0$', meaning: '두 편광판이 나란할 때의 세기', unit: '-' },
        { symbol: '$\\theta$', meaning: '두 편광판이 이루는 각', unit: '°' },
      ],
      prediction: '45°에서는 세기가 절반, 90°에서는 거의 0이 됩니다.',
    },
    variables: {
      independent: '분석기 각도 0°에서 180°까지 10° 간격',
      dependent: '기준값을 뺀 light_raw',
      controls: ['광원의 밝기', '센서와 광원의 거리', '차광통', '첫 편광판의 각도'],
    },
    analysis: [
      '빛을 완전히 막은 상태의 값을 먼저 재어 모든 측정값에서 뺍니다.',
      '각도마다 30개 표본의 평균을 구합니다.',
      '$\\cos^2\\theta$를 가로축, 보정한 세기를 세로축으로 그리면 원점을 지나는 직선이 되어야 합니다.',
      '직선에서 벗어난 정도와 90°에서 남은 빛의 양을 함께 기록합니다.',
      '남은 빛은 편광판의 성능 한계로 설명합니다.',
    ],
    checkpoints: [
      { sign: '90°에서도 빛이 꽤 남습니다', meaning: '편광판의 성능 한계이거나 주변광이 새어 들어온 것입니다. 차광통을 보강해 다시 재세요.' },
      { sign: '$\\cos^2\\theta$ 그래프가 직선이 아닙니다', meaning: '각도 눈금의 0점이 어긋났을 수 있습니다. 가장 밝은 각도를 0°로 다시 잡으세요.' },
    ],
    extensions: {
      immediate: '90°로 맞춘 두 편광판 사이에 세 번째 편광판을 45°로 끼워 넣고 빛이 되살아나는지 확인하세요.',
      broaden: '광원을 LED에서 형광등으로 바꿔 결과가 유지되는지 확인하세요.',
      connect: '“투과율과 흡광도” 레시피에서 빛이 줄어드는 다른 방식을 다룹니다.',
    },
  },
  'ph29-transmittance-absorbance': {
    question: '색이 진할수록 빛은 얼마나 더 많이 흡수될까?',
    measures: '시료를 통과한 빛의 세기',
    changes: '색소 용액의 농도 또는 색 필터의 종류',
    relation: '흡광도는 농도와 통과 길이에 비례한다',
    concepts: ['transmittance', 'absorbance', 'illuminance', 'linearization'],
    formula: {
      expression: '$T=I/I_0,\\quad A=-\\log_{10}T$',
      symbols: [
        { symbol: '$I_0$', meaning: '시료가 없을 때의 세기', unit: '-' },
        { symbol: '$I$', meaning: '시료를 통과한 뒤의 세기', unit: '-' },
        { symbol: '$A$', meaning: '흡광도', unit: '-' },
      ],
      prediction: '농도를 2배로 하면 흡광도도 대략 2배가 되고, 통과한 빛은 절반이 아니라 제곱만큼 줄어듭니다.',
    },
    variables: {
      independent: '색소 농도 5단계 또는 필터 종류',
      dependent: '보정한 light_raw에서 계산한 흡광도',
      controls: ['같은 큐벳과 통과 길이', '광원과 센서의 위치', '차광통', '용액의 온도'],
    },
    analysis: [
      '빛을 완전히 막았을 때의 값을 재어 모든 측정값에서 뺍니다.',
      '빈 경로 또는 순수한 용매만 넣었을 때의 값을 $I_0$로 정합니다.',
      '농도별로 $T=I/I_0$를 구하고 상용로그를 취해 흡광도로 바꿉니다.',
      '농도를 가로축, 흡광도를 세로축으로 그려 직선 구간을 찾습니다.',
      '진한 농도에서 직선을 벗어나는 지점을 표시하고 산란과 측정 범위 초과로 설명합니다.',
    ],
    checkpoints: [
      { sign: '가장 진한 시료에서 값이 0에 붙습니다', meaning: '빛이 거의 통과하지 못한 것입니다. 그 조건은 직선 맞추기에서 제외하세요.' },
      { sign: '흡광도가 음수로 나옵니다', meaning: '$I$가 $I_0$보다 크게 측정된 것입니다. 큐벳 위치나 주변광이 달라졌는지 확인하세요.' },
    ],
    extensions: {
      immediate: '같은 용액을 두 배 긴 경로로 통과시켜 흡광도가 2배가 되는지 확인하세요.',
      broaden: '색이 다른 필터를 앞에 두고 흡광도가 색에 따라 달라지는지 비교하세요.',
      connect: '“말뤼스 법칙” 레시피에서 빛이 줄어드는 또 다른 원리를 비교해 보세요.',
    },
  },
  'ph30-reflection-intensity-angle': {
    question: '거울과 종이는 빛을 어떻게 다르게 되돌려 보낼까?',
    measures: '반사각 주변 여러 각도에서의 빛의 세기',
    changes: '센서를 놓는 각도와 반사 시료의 종류',
    relation: '매끄러운 면은 반사각에서 좁고 강한 봉우리를, 거친 면은 넓고 낮은 분포를 만든다',
    concepts: ['reflectionLaw', 'illuminance', 'controlVariable', 'repeatMeasurement'],
    variables: {
      independent: '센서 각도(예상 반사각 ±40°는 10° 간격, 봉우리 근처 ±6°는 2° 간격)와 시료 2~3가지',
      dependent: '보정한 light_raw 값',
      controls: ['입사각과 입사광의 세기', '광원과 시료의 거리', '차광판', '센서 높이'],
    },
    analysis: [
      '광원을 끈 상태의 값을 재어 모든 측정에서 뺍니다.',
      '각도마다 20개 표본의 평균을 구해 각도-세기 곡선을 그립니다.',
      '곡선의 최댓값이 나타나는 각도를 읽어 입사각과 같은지 확인합니다.',
      '봉우리의 절반 높이에서의 너비를 재어 시료별로 비교합니다.',
      '봉우리 밖의 배경 세기를 구해 거친 면일수록 크다는 것을 보입니다.',
    ],
    checkpoints: [
      { sign: '최댓값 각도가 입사각과 다릅니다', meaning: '시료가 조금 기울어 있거나 각도 눈금의 기준이 어긋났습니다. 시료를 다시 맞추세요.' },
      { sign: '무광 시료에서 봉우리를 찾을 수 없습니다', meaning: '정상입니다. 거친 면은 여러 방향으로 고르게 반사한다는 뜻입니다.' },
    ],
    extensions: {
      immediate: '입사각을 바꿔 최댓값 각도가 함께 옮겨 가는지 확인하세요.',
      broaden: '거울에 물을 한 겹 발라 표면 상태가 봉우리 너비를 어떻게 바꾸는지 관찰하세요.',
      connect: '“차광판 구멍 크기와 광량” 레시피에서 빛의 양을 결정하는 다른 요인을 다룹니다.',
    },
  },
  'ph31-lens-focal-length': {
    question: '돋보기는 왜 어떤 거리에서만 또렷한 상을 만들까?',
    measures: '물체와 상의 거리, 그리고 그 위치에서의 밝기',
    changes: '물체까지의 거리',
    relation: '물체거리와 상거리의 역수를 더하면 초점거리의 역수가 된다',
    concepts: ['lensEquation', 'focalLength', 'illuminance', 'linearization'],
    formula: {
      expression: '$\\dfrac{1}{f}=\\dfrac{1}{u}+\\dfrac{1}{v}$',
      symbols: [
        { symbol: '$f$', meaning: '초점거리', unit: 'm' },
        { symbol: '$u$', meaning: '렌즈에서 물체까지의 거리', unit: 'm' },
        { symbol: '$v$', meaning: '렌즈에서 상까지의 거리', unit: 'm' },
      ],
      prediction: '물체를 멀리 두면 상거리는 초점거리에 가까워집니다. $1/u$와 $1/v$를 그리면 기울기 $-1$인 직선이 됩니다.',
    },
    variables: {
      independent: '물체거리 $u$ 5단계',
      dependent: '빛이 가장 강하게 모이는 상거리 $v$',
      controls: ['같은 렌즈', '광원의 밝기와 크기', '광학 레일의 정렬', '차광판'],
    },
    analysis: [
      '각 물체거리에서 센서를 조금씩 옮기며 값이 가장 큰 위치를 찾아 상거리로 기록합니다.',
      '같은 조건을 3회 반복해 상거리의 평균과 퍼진 범위를 구합니다.',
      '각 조건에서 위 식으로 초점거리를 계산합니다.',
      '$1/u$를 가로축, $1/v$를 세로축으로 그려 직선을 맞추고, 두 절편에서 각각 $1/f$를 읽습니다.',
      '계산한 초점거리들의 평균과 퍼진 범위를 렌즈에 표시된 값과 비교합니다.',
    ],
    checkpoints: [
      { sign: '가장 밝은 위치가 넓게 퍼져 정하기 어렵습니다', meaning: '센서 수광면이 상보다 크기 때문입니다. 앞에 작은 구멍이 뚫린 차광판을 두세요.' },
      { sign: '값이 최댓값에서 움직이지 않습니다', meaning: '렌즈가 모은 빛이 센서의 측정 범위를 넘은 것입니다. 렌즈 앞에 반투명 종이를 한 겹 대어 광량을 줄이고 다시 재세요.' },
      { sign: '물체거리가 초점거리보다 작을 때 상을 못 찾습니다', meaning: '그 경우에는 스크린에 맺히는 상이 생기지 않습니다. 물체를 초점거리보다 멀리 두세요.' },
    ],
    extensions: {
      immediate: '아주 먼 창밖 풍경을 물체로 삼아 상거리가 초점거리에 가까워지는지 확인하세요.',
      broaden: '초점거리가 다른 렌즈로 바꿔 직선의 절편이 함께 변하는지 확인하세요.',
      connect: '“차광판 구멍 크기와 광량” 레시피에서 빛을 모으는 넓이의 효과를 다룹니다.',
    },
  },
  'ph32-aperture-light': {
    question: '구멍을 2배로 넓히면 빛은 2배로 들어올까?',
    measures: '구멍을 통과해 센서에 닿은 빛의 세기',
    changes: '차광판 구멍의 지름',
    relation: '통과하는 빛의 양은 구멍의 면적, 곧 지름의 제곱에 비례한다',
    concepts: ['aperture', 'illuminance', 'linearization', 'calibration'],
    formula: {
      expression: '$A=\\dfrac{\\pi d^2}{4}$',
      symbols: [
        { symbol: '$A$', meaning: '구멍의 면적', unit: 'm²' },
        { symbol: '$d$', meaning: '구멍의 지름', unit: 'm' },
      ],
      prediction: '지름을 2배로 하면 면적은 4배가 되므로 통과하는 빛도 약 4배가 됩니다.',
    },
    variables: {
      independent: '구멍 지름 5단계',
      dependent: '기준값을 뺀 light_raw 값',
      controls: ['광원과 차광판, 센서 사이 거리', '광원의 밝기', '차광통', '구멍의 중심 위치'],
    },
    analysis: [
      '구멍을 완전히 막았을 때의 값을 재어 모든 측정에서 뺍니다.',
      '버니어캘리퍼스로 각 구멍의 지름을 정확히 재어 적습니다.',
      '$d^2$을 가로축, 보정한 세기를 세로축으로 그려 원점을 지나는 직선인지 확인합니다.',
      '가장 작은 구멍이 직선에서 벗어나는지 확인하고, 그렇다면 회절과 광원의 고르지 않은 밝기로 설명합니다.',
      '기울기로 “면적 1 mm²당 세기”를 구해 광원의 밝기를 나타내는 값으로 씁니다.',
    ],
    checkpoints: [
      { sign: '작은 구멍에서 값이 예상보다 큽니다', meaning: '주변으로 새는 빛이 있습니다. 차광통과 구멍 주변을 검은 종이로 막으세요.' },
      { sign: '가장 큰 구멍에서 값이 더 이상 안 커집니다', meaning: '센서가 측정 범위를 넘었습니다. 광원을 멀리 두거나 광원과 센서 사이에 반투명 종이를 대어 빛을 줄이세요.' },
    ],
    extensions: {
      immediate: '지름이 정확히 2배인 두 구멍만 골라 세기가 4배가 되는지 확인하세요.',
      broaden: '구멍 대신 같은 면적의 네모난 창을 만들어 모양이 결과에 영향을 주는지 확인하세요.',
      connect: '“거리에 따른 빛의 세기 (역제곱 법칙)” 레시피와 함께 보면 빛의 양을 결정하는 두 요인을 정리할 수 있습니다.',
    },
  },
  'ph33-light-source-stability': {
    question: '늘 똑같아 보이는 조명도 사실은 흔들리고 있을까?',
    measures: '한 광원의 밝기를 오랫동안 같은 간격으로 기록한 값',
    changes: '비교할 광원의 종류',
    relation: '평균 밝기가 같아도 짧은 시간의 떨림과 긴 시간의 흐름은 광원마다 다르다',
    concepts: ['flicker', 'movingAverage', 'illuminance', 'samplingInterval'],
    variables: {
      independent: '광원의 종류(LED, 형광등 등)',
      dependent: 'light_raw 값의 시간 변화',
      controls: ['센서와 광원의 거리와 각도', '주변광 차단', '표본 간격', '기록 시작 시각(켠 직후부터)'],
    },
    analysis: [
      '광원을 켠 직후부터 충분히 오래, 같은 간격으로 끊김 없이 기록합니다.',
      '이동평균을 구해 긴 시간의 흐름만 남기고, 원래 값에서 그 흐름을 빼 짧은 떨림만 남깁니다.',
      '떨림의 표준 정도를 평균으로 나눠 광원별로 비교합니다.',
      '켠 직후 몇 분 동안 값이 서서히 변하는지 확인해 예열에 걸리는 시간을 구합니다.',
      '표본 간격보다 빠른 깜빡임은 잡을 수 없다는 한계를 결론에 적습니다.',
    ],
    checkpoints: [
      { sign: '켠 직후 값이 계속 오릅니다', meaning: '광원이 예열 중입니다. 안정된 뒤의 구간과 나눠서 분석하세요.' },
      { sign: '값이 규칙적으로 오르내립니다', meaning: '깜빡임이 표본 간격과 맞물린 것일 수 있습니다. 간격을 바꿔 다시 재어 확인하세요.' },
    ],
    extensions: {
      immediate: '표본 간격을 두 배로 늘려도 변동계수가 거의 그대로인지 확인해, 지금 보이는 떨림이 빠른 깜빡임이 아니라 느린 변동임을 확인하세요.',
      broaden: '조명을 밝기 조절기로 어둡게 한 뒤 떨림의 크기가 어떻게 달라지는지 비교하세요.',
      connect: '“조도 임계값 인터럽트 알림” 레시피에서 값이 흔들릴 때 알림 기준을 어떻게 잡아야 하는지 다룹니다.',
    },
  },

  // ── 유체와 소리 ───────────────────────────────────────────────────────
  'ph34-torricelli-drain': {
    question: '물통의 물은 왜 처음에 빨리 빠지고 나중에 천천히 빠질까?',
    measures: '시간에 따른 수면 높이',
    changes: '바꾸지 않습니다. 배출구를 연 뒤의 변화를 그대로 기록합니다',
    relation: '나오는 속도가 수면 높이의 제곱근에 비례하므로 수면은 갈수록 천천히 내려간다',
    concepts: ['torricelli', 'velocity', 'gravitationalAcceleration', 'linearization'],
    formula: {
      expression: '$v=\\sqrt{2gh}$',
      symbols: [
        { symbol: '$v$', meaning: '배출구에서 나오는 물의 속도', unit: 'm/s' },
        { symbol: '$h$', meaning: '배출구에서 수면까지의 높이', unit: 'm' },
        { symbol: '$g$', meaning: '중력가속도', unit: 'm/s²' },
      ],
      prediction: '높이가 4분의 1로 줄면 나오는 속도는 절반이 됩니다. $\\sqrt{h}$를 시간에 대해 그리면 직선이 됩니다.',
    },
    variables: {
      independent: '시간(배출 전체 구간)',
      dependent: 'distance_m에서 계산한 수면 높이',
      controls: ['용기의 단면적', '배출구의 크기', '센서 위치와 방향', '처음 수면 높이'],
    },
    analysis: [
      '미리 재어 둔 센서-배출구 거리에서 센서-수면 거리(distance_m)를 빼, 배출구 위 수면 높이 $h$로 바꿉니다.',
      '수면 높이를 시간에 대해 그려 곡선임을 확인합니다.',
      '$\\sqrt{h}$를 시간에 대해 다시 그리면 직선이 되어야 합니다.',
      '미리 재어 둔 안지름으로 용기 단면적을 구하고, 직선의 기울기와 함께 써서 배출구의 유효 넓이를 추정한 뒤 실제 구멍 넓이와 비교합니다.',
      '실제 유출이 이론보다 느린 이유를 점성과 물줄기가 좁아지는 현상으로 설명합니다.',
    ],
    checkpoints: [
      { sign: '수면이 낮아지자 값이 튀기 시작합니다', meaning: '수면이 흔들리거나 초음파가 용기 벽에 반사된 것입니다. 방수 차폐판을 세우고 다시 재세요.' },
      { sign: '$\\sqrt{h}$ 그래프가 마지막에 휘어집니다', meaning: '수면이 배출구에 가까워지면 이론식의 가정이 깨집니다. 그 구간은 빼고 맞추세요.' },
    ],
    extensions: {
      immediate: '처음 수면 높이를 절반으로 낮춰 시작하고, 전체 배출 시간이 어떻게 달라지는지 확인하세요.',
      broaden: '배출구를 2배 넓혀 배출 시간이 절반보다 짧아지는지 확인하세요.',
      connect: '“자유낙하 가속도 g 구하기” 레시피와 비교하면 같은 $\\sqrt{2gh}$가 어디에서 나왔는지 이해할 수 있습니다.',
    },
  },
  'ph35-temperature-speed-of-sound': {
    question: '온도가 달라지면 초음파 거리계의 값도 달라질까?',
    measures: '고정된 거리에 대한 초음파 측정값과 그때의 공기 온도',
    changes: '주변 공기의 온도',
    relation: '음속은 온도가 오를수록 빨라지므로, 고정 음속으로 계산하면 거리에 오차가 생긴다',
    concepts: ['soundSpeed', 'temperature', 'calibration', 'ultrasonicEcho'],
    formula: {
      expression: '$c\\approx331.3+0.606\\,T$',
      symbols: [
        { symbol: '$c$', meaning: '공기 중 음속', unit: 'm/s' },
        { symbol: '$T$', meaning: '공기 온도', unit: '°C' },
      ],
      prediction: '온도가 10 °C 오르면 음속은 약 6 m/s 빨라져, 고정 음속으로 계산한 거리는 약 1.8% 짧게 나옵니다.',
    },
    variables: {
      independent: '주변 공기 온도 3~4단계',
      dependent: '측정 거리와 실제 거리의 차이',
      controls: ['반사판까지의 실제 거리', '센서와 반사판의 정렬', '공기 흐름', '측정 간격'],
    },
    analysis: [
      '반사판까지의 실제 거리를 자로 정확히 재어 적습니다.',
      '각 온도 조건에서 온도와 거리 측정값을 함께 30개 이상 모읍니다.',
      'echo_time_us에 고정 음속 343 m/s를 적용해(거리 = 왕복시간 × 343 ÷ 2,000,000) 보정 전 거리를 만들고, 실제 거리와의 차이를 온도에 대해 그립니다.',
      'distance_m는 스케치가 위 식으로 온도 보정을 마친 거리입니다. 이 값과 실제 거리의 차이도 같은 방법으로 구합니다.',
      '보정 전후의 오차를 같은 그래프에 그려 보정 효과를 수치로 보입니다.',
    ],
    checkpoints: [
      { sign: '온도를 바꿨는데 오차가 변하지 않습니다', meaning: '센서 주변 공기가 아직 데워지지 않았을 수 있습니다. 열평형을 기다리세요.' },
      { sign: '보정했는데도 오차가 남습니다', meaning: '센서 자체의 영점 오차입니다. 그 값을 따로 구해 함께 빼세요.' },
    ],
    extensions: {
      immediate: '실제 거리를 2배로 늘려 온도에 의한 오차도 2배가 되는지 확인하세요.',
      broaden: '가습기로 습도를 높여 습도가 음속에 주는 영향이 온도보다 작은지 확인하세요.',
      connect: '“HC-SR04 초음파로 거리 재기” 예제에서 이 오차가 왜 생기는지 먼저 확인해 보세요.',
    },
  },
}
