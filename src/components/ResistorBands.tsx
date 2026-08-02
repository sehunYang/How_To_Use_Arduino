/**
 * 준비물 목록에 적힌 저항값을 실제 부품 모습으로 보여 줍니다.
 *
 * 저항은 값이 숫자로 인쇄되어 있지 않아, 값을 알아도 서랍에서 고를 수 없습니다.
 * 색 이름을 글로만 적으면 네 색의 **순서**가 뜻을 잃으므로 그림과 글을 함께 냅니다.
 * 색을 구분하기 어렵거나 흑백으로 인쇄한 경우에는 아래 글줄만으로도 찾을 수 있습니다.
 */
import { describeBands, resistorBands } from '@/recipes/resistorBands'

const BODY_LEFT = 24
const BODY_RIGHT = 104
const BODY_TOP = 8
const BODY_HEIGHT = 20
const BAND_WIDTH = 7
/** 앞의 세 띠는 붙어 있고 오차 띠만 떨어져 있습니다. 실물이 그렇게 생겨서 방향을 알려 줍니다. */
const BAND_LEFTS = [32, 45, 58, 88]

export function ResistorBands({ ohms }: { ohms: number }) {
  const bands = resistorBands(ohms)
  if (!bands) return null

  const label = `색띠 ${describeBands(bands)} 순서로 읽는 저항입니다.`

  return (
    <span className="mt-2 block">
      <svg
        viewBox="0 0 128 36"
        role="img"
        aria-label={label}
        className="h-9 w-32"
      >
        {/* 다리 */}
        <line x1="2" y1={BODY_TOP + BODY_HEIGHT / 2} x2={BODY_LEFT} y2={BODY_TOP + BODY_HEIGHT / 2} stroke="#9a9a95" strokeWidth="2" />
        <line x1={BODY_RIGHT} y1={BODY_TOP + BODY_HEIGHT / 2} x2="126" y2={BODY_TOP + BODY_HEIGHT / 2} stroke="#9a9a95" strokeWidth="2" />
        {/* 몸통 */}
        <rect
          x={BODY_LEFT}
          y={BODY_TOP}
          width={BODY_RIGHT - BODY_LEFT}
          height={BODY_HEIGHT}
          rx="7"
          fill="#d8c9a3"
          stroke="#b3a075"
        />
        {bands.map((band, index) => (
          <rect
            key={band.meaning}
            x={BAND_LEFTS[index]}
            y={BODY_TOP}
            width={BAND_WIDTH}
            height={BODY_HEIGHT}
            fill={band.hex}
          />
        ))}
      </svg>
      <span className="mt-1 block text-caption text-muted">
        색띠 {describeBands(bands)} <span aria-hidden="true">(왼쪽부터)</span>
      </span>
    </span>
  )
}
