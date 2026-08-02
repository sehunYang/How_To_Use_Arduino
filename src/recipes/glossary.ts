import type { Recipe } from '@/schema'
import { splitEndpoint } from './parts'

/**
 * 화면이 쓰는 말의 뜻.
 *
 * 배선 단계는 `VCC`, `GND`, `SDA` 같은 글자를 그대로 보여 줍니다. 모듈 기판에도
 * 같은 글자가 인쇄되어 있어 대조하기 좋기 때문인데, 그 글자가 무엇을 뜻하는지는
 * 어디에도 없었습니다. 학생은 뜻을 모른 채 모양만 맞춰 꽂게 되고, 그러면 값이
 * 이상할 때 무엇을 의심해야 할지 고를 수 없습니다.
 *
 * 모든 말을 늘어놓으면 아무도 읽지 않으므로 **이 레시피에 실제로 나온 말만**
 * 골라 냅니다.
 */

export interface GlossaryEntry {
  term: string
  meaning: string
}

/** 핀 이름에서 곧바로 찾을 수 있는 말. 열쇠는 배선에 적힌 글자 그대로입니다. */
const PIN_TERMS: Record<string, string> = {
  VCC: '부품에 전기를 넣어 주는 자리(+). 아두이노의 5V나 3.3V에서 옵니다.',
  VIN: 'VCC와 같은 뜻으로, 모듈에 따라 이렇게 적혀 있습니다.',
  VDD: 'VCC와 같은 뜻입니다.',
  GND: '전기가 되돌아 나가는 자리(−). 회로의 기준점이라 모든 부품이 이 줄을 함께 써야 합니다.',
  SDA: 'I2C로 값을 주고받는 선. 아두이노 우노에서는 A4에 꽂습니다.',
  SCL: 'I2C에서 박자를 맞춰 주는 선. 아두이노 우노에서는 A5에 꽂습니다.',
  DATA: '센서가 값을 실어 보내는 선. 한 가닥으로 주고받습니다.',
  DQ: 'DATA와 같은 자리입니다. DS18B20 기판에는 이렇게 인쇄되어 있습니다.',
  OUT: '센서가 판단 결과를 내보내는 자리. 0 또는 1로 나옵니다.',
  AO: '센서가 값을 전압의 세기로 내보내는 자리. 아두이노의 A로 시작하는 핀에 꽂습니다.',
  SIG: '값을 내보내는 자리. AO나 OUT과 같은 뜻으로 쓰입니다.',
  TRIG: '초음파를 쏘라고 시키는 자리.',
  ECHO: '되돌아온 초음파를 받아 시간을 알려 주는 자리.',
  'VIN+': '측정할 전류가 들어오는 자리. 전류가 이 안을 지나가야 잴 수 있습니다.',
  'VIN-': '측정한 전류가 나가는 자리. 여기서 부하로 이어집니다.',
}

/** 핀 이름이 아니라 배선 문장이나 안내에 나오는 말. */
const TEXT_TERMS: Array<GlossaryEntry & { pattern: RegExp }> = [
  {
    term: 'I2C',
    meaning: '선 두 가닥(SDA·SCL)으로 여러 부품과 이야기하는 방식. 부품마다 주소가 달라야 구별됩니다.',
    pattern: /I2C|SDA|SCL/,
  },
  {
    term: '아날로그 핀 (A0~A5)',
    meaning: '전압의 세기를 0~1023 사이 숫자로 바꿔 읽는 핀. 밝기나 저항 변화를 재는 데 씁니다.',
    pattern: /UNO\.A\d/,
  },
  {
    term: '디지털 핀 (D2~D13)',
    meaning: '켜짐(1)과 꺼짐(0) 두 가지만 주고받는 핀.',
    pattern: /UNO\.D\d/,
  },
  {
    term: '풀업 저항',
    meaning: '신호선을 평소에 켜짐 쪽으로 붙들어 두는 저항. 없으면 값이 제멋대로 흔들립니다.',
    pattern: /풀업|4\.7\s?kΩ/,
  },
  {
    term: '5V · 3.3V',
    meaning: '아두이노가 내주는 전기의 세기. 3.3V 전용 모듈을 5V에 꽂으면 손상됩니다.',
    pattern: /UNO\.(5V|3\.3V)/,
  },
]

/** 레시피와 상관없이 학생이 반드시 만나는 말. */
const ALWAYS_TERMS: GlossaryEntry[] = [
  { term: '스케치', meaning: '아두이노에 넣는 프로그램. 이 화면의 코드가 바로 스케치입니다.' },
  { term: '업로드', meaning: '스케치를 보드로 옮겨 넣는 일. 왼쪽 위 화살표 단추가 이 일을 합니다.' },
  { term: '시리얼 모니터', meaning: '보드가 보내온 글을 보여 주는 창. 측정값이 여기에 쌓입니다.' },
  { term: 'baud', meaning: '보드와 컴퓨터가 글을 주고받는 속도. 양쪽이 같아야 글자가 깨지지 않습니다.' },
  { term: '라이브러리', meaning: '센서를 다루는 방법이 미리 적혀 있는 꾸러미. 설치해야 코드가 컴파일됩니다.' },
]

export function glossaryFor(recipe: Pick<Recipe, 'wiring'>): GlossaryEntry[] {
  const pins = new Set<string>()
  for (const step of recipe.wiring) {
    for (const endpoint of [step.from, step.to]) {
      const { pin } = splitEndpoint(endpoint)
      if (pin) pins.add(pin.toUpperCase())
    }
  }

  const haystack = recipe.wiring
    .flatMap((step) => [step.from, step.to, step.text])
    .join('\n')

  const pinEntries = [...pins]
    .filter((pin) => pin in PIN_TERMS)
    .map((pin) => ({ term: pin, meaning: PIN_TERMS[pin] }))

  const textEntries = TEXT_TERMS.filter((entry) => entry.pattern.test(haystack)).map(
    ({ term, meaning }) => ({ term, meaning }),
  )

  return [...pinEntries, ...textEntries, ...ALWAYS_TERMS]
}
