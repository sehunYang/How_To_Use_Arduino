/**
 * 브레드보드의 어떤 구멍이 서로 이어져 있는지 보여 주는 그림.
 *
 * 배선도는 "무엇을 어디에 꽂는가"를 그리지만, 이 그림은 **왜 그 구멍인가**를
 * 그립니다. 한 칸 밀려 꽂았을 때 학생이 스스로 되짚을 수 있는 유일한 단서라서
 * 배선 단계보다 먼저 볼 수 있는 자리에 둡니다.
 */

const COLUMNS = 18
const COLUMN_STEP = 15
const FIRST_COLUMN_X = 24
const HOLE_RADIUS = 2.6

const RAIL_TOP_Y = [16, 26]
const UPPER_ROWS = [56, 66, 76, 86, 96]
const LOWER_ROWS = [124, 134, 144, 154, 164]
const GAP_Y = 110

const HOLE_COLOR = '#b9b9b2'
const BOARD_COLOR = '#f3f2ee'
const BOARD_EDGE = '#cfcec7'
const POSITIVE = '#d13b30'
const NEGATIVE = '#2166c4'
const HIGHLIGHT = '#2f8f4e'
const INK = '#4b4b4b'

const columnX = (index: number) => FIRST_COLUMN_X + index * COLUMN_STEP
/** 세로 묶음 설명을 붙일 열. 가운데쯤이라 설명선이 그림 밖으로 나가지 않습니다. */
const HIGHLIGHT_COLUMN = 5

function HoleRow({ y, from = 0, to = COLUMNS - 1 }: { y: number; from?: number; to?: number }) {
  const holes = []
  for (let index = from; index <= to; index += 1) {
    holes.push(<circle key={index} cx={columnX(index)} cy={y} r={HOLE_RADIUS} fill={HOLE_COLOR} />)
  }
  return <g>{holes}</g>
}

export function BreadboardMap() {
  return (
    <svg
      viewBox="0 0 300 186"
      role="img"
      aria-label="브레드보드 연결 그림. 가장자리 두 줄은 가로로 길게 이어지고, 가운데 구멍들은 세로 다섯 개씩 묶여 이어지며, 가운데 홈에서 위아래가 끊깁니다."
      className="mt-3 h-auto w-full max-w-md"
    >
      <rect x="6" y="6" width="288" height="174" rx="6" fill={BOARD_COLOR} stroke={BOARD_EDGE} />

      {/* 전원 줄: 가로로 길게 이어진 두 줄 */}
      <line x1="16" y1="11" x2="284" y2="11" stroke={POSITIVE} strokeWidth="1.5" />
      <line x1="16" y1="31" x2="284" y2="31" stroke={NEGATIVE} strokeWidth="1.5" />
      {RAIL_TOP_Y.map((y) => (
        <HoleRow key={y} y={y} />
      ))}
      <rect
        x="14"
        y="10"
        width="272"
        height="12"
        rx="5"
        fill={POSITIVE}
        fillOpacity="0.14"
        stroke={POSITIVE}
        strokeDasharray="4 3"
      />
      <text x="150" y="44" textAnchor="middle" fontSize="9" fill={POSITIVE}>
        전원 줄 — 이 줄은 가로로 끝까지 이어져 있습니다
      </text>

      {/* 위쪽 다섯 줄 */}
      {UPPER_ROWS.map((y) => (
        <HoleRow key={y} y={y} />
      ))}

      {/* 세로 다섯 구멍 묶음 */}
      <rect
        x={columnX(HIGHLIGHT_COLUMN) - 6}
        y={UPPER_ROWS[0] - 6}
        width="12"
        height={UPPER_ROWS[4] - UPPER_ROWS[0] + 12}
        rx="5"
        fill={HIGHLIGHT}
        fillOpacity="0.16"
        stroke={HIGHLIGHT}
      />
      <line
        x1={columnX(HIGHLIGHT_COLUMN) + 7}
        y1={UPPER_ROWS[2]}
        x2={columnX(HIGHLIGHT_COLUMN) + 26}
        y2={UPPER_ROWS[2]}
        stroke={HIGHLIGHT}
        strokeWidth="1"
      />
      <text x={columnX(HIGHLIGHT_COLUMN) + 30} y={UPPER_ROWS[2] + 3} fontSize="9" fill={HIGHLIGHT}>
        세로 다섯 구멍이 한 묶음 — 서로 이어져 있습니다
      </text>

      {/* 가운데 홈 */}
      <rect x="10" y={GAP_Y - 6} width="280" height="12" fill={BOARD_EDGE} fillOpacity="0.5" />
      <text x="150" y={GAP_Y + 3} textAnchor="middle" fontSize="9" fill={INK}>
        가운데 홈 — 위아래는 이어져 있지 않습니다
      </text>

      {/* 아래쪽 다섯 줄 */}
      {LOWER_ROWS.map((y) => (
        <HoleRow key={y} y={y} />
      ))}
    </svg>
  )
}
