import type { TroubleshootingItem } from '@/schema'

/**
 * 배선과 코드 사이에 비어 있던 자리를 채우는 안내입니다.
 *
 * 레시피는 어디에도 "붙여 넣은 코드를 어떻게 보드에 넣는가"를 적지 않았습니다.
 * 아두이노를 처음 여는 학생에게는 이 한 칸이 배선보다 큰 벽입니다. 레시피마다
 * 다시 적을 내용이 아니라 모든 레시피가 똑같이 거치는 길이므로 한곳에 둡니다.
 */

export interface FirstRunStep {
  title: string
  detail: string
}

export const ARDUINO_IDE_URL = 'https://www.arduino.cc/en/software'

export function firstRunSteps(hasLibraries: boolean): FirstRunStep[] {
  return [
    {
      title: '아두이노 IDE를 설치하고 엽니다',
      detail: '코드를 보드에 넣어 주는 프로그램입니다. 학교 컴퓨터에 이미 깔려 있는 경우도 많으니 먼저 찾아보세요.',
    },
    {
      title: 'USB 케이블로 보드를 컴퓨터에 연결합니다',
      detail: '보드의 초록 불이 들어오면 전원이 들어온 것입니다.',
    },
    {
      title: '[도구] → [보드]에서 Arduino Uno를, [도구] → [포트]에서 새로 생긴 포트를 고릅니다',
      detail: '포트 이름은 컴퓨터마다 다릅니다. 케이블을 뺐다 꽂았을 때 나타났다 사라지는 것이 우리 보드입니다.',
    },
    ...(hasLibraries
      ? [{
          title: '[도구] → [라이브러리 관리]에서 아래 목록을 검색해 설치합니다',
          detail: '이 단계를 건너뛰면 업로드할 때 빨간 글씨로 파일을 찾을 수 없다는 오류가 납니다.',
        }]
      : []),
    {
      title: '아래 코드를 복사해 IDE 창에 붙여 넣습니다',
      detail: '창에 원래 적혀 있던 내용은 모두 지우고 붙여 넣으세요.',
    },
    {
      title: '왼쪽 위 업로드(→) 단추를 누릅니다',
      detail: '아래쪽에 "업로드 완료"가 뜰 때까지 케이블을 뽑지 마세요.',
    },
    {
      title: '[도구] → [시리얼 모니터]를 열고 속도를 맞춥니다',
      detail: '창 오른쪽 아래 속도가 아래에 적힌 값과 다르면 알아볼 수 없는 기호만 나옵니다.',
    },
  ]
}

/** 학생이 처음 한 시간 동안 실제로 마주치는 오류들. 레시피마다 다르지 않습니다. */
export function firstRunTroubleshooting(baudRate: number): TroubleshootingItem[] {
  return [
    {
      symptom: '[도구] → [포트]에 아두이노가 보이지 않음',
      cause: '충전 전용 USB 케이블이거나, 정품이 아닌 보드에 필요한 USB 통신 칩 드라이버(CH340)가 없을 수 있습니다.',
      fix: '자료 전송이 되는 케이블로 바꿔 꽂아 보고, 보드의 USB 쪽 칩에 CH340이라고 적혀 있으면 CH340 드라이버를 설치한 뒤 IDE를 다시 켜세요.',
    },
    {
      symptom: '업로드할 때 빨간 글씨로 No such file or directory가 뜸',
      cause: '스케치가 부르는 라이브러리가 아직 설치되지 않았습니다.',
      fix: '빨간 글씨에 적힌 파일 이름을 위 “필요한 라이브러리” 목록에서 찾아 [도구] → [라이브러리 관리]에서 설치하세요.',
    },
    {
      symptom: '업로드가 안 되고 programmer is not responding이 뜸',
      cause: '보드나 포트가 잘못 선택되었거나, 다른 프로그램이 그 포트를 붙잡고 있습니다.',
      fix: '시리얼 모니터 창을 닫고 [도구]에서 보드를 Arduino Uno로, 포트를 다시 고른 뒤 한 번 더 업로드하세요.',
    },
    {
      symptom: '시리얼 모니터에 알아볼 수 없는 기호만 나옴',
      cause: '시리얼 모니터의 속도가 스케치의 속도와 다릅니다.',
      fix: `시리얼 모니터 오른쪽 아래 속도를 ${baudRate} baud로 바꾸세요.`,
    },
  ]
}

const DEFAULT_SAFETY =
  '전원을 끈 상태에서 배선하고, 전원을 넣기 전에 5V와 GND가 직접 이어지지 않았는지 확인하세요.'

/**
 * 본문에 접어 둔 안전 안내를 배선 단계 **위로** 끌어올립니다.
 *
 * 안내문은 지금까지 본문(탐구 가이드) 안에 있었고, 본문은 배선 단계보다
 * 아래에 있었습니다. 순서대로 읽는 학생은 이미 다 꽂고 전원까지 넣은 뒤에야
 * "전원을 끄고 배선하세요"를 만났습니다.
 */
export function safetyNotice(body: string): string {
  const callouts = [...body.matchAll(/:::callout\s+warn\s*\n([\s\S]*?)\n:::/g)]
    .map((match) => match[1].trim())
    .filter(Boolean)
  if (!callouts.length) return DEFAULT_SAFETY
  const joined = callouts.join(' ')
  return joined.includes('전원을 끈 상태') ? joined : `${DEFAULT_SAFETY} ${joined}`
}
