# Wokwi 촬영용 배선 생성 규칙

## 목적과 강제 흐름

`diagram.json`은 편집 원본이 아니라 자동 생성물입니다. 모든 배선은 먼저 저장소의
`ReadableLayout` 형식으로 작성하고 다음 순서를 통과해야 합니다.

1. 부품과 실제 핀·브레드보드 홀을 지정합니다.
2. 각 도선을 Wokwi 캔버스의 절대 좌표를 사용하는 직교 꺾은선으로 작성합니다.
3. `validateReadableLayout()`의 전기적·기하학적 검증을 실행합니다.
4. 오류가 하나라도 있으면 변환과 촬영을 중단합니다.
5. 검증을 통과한 명세만 `compileReadableLayout()`로 Wokwi 형식에 변환합니다.
6. 생성된 `diagram.json`은 직접 수정하지 않습니다.

현재 원본은 두 개입니다.

| 원본 | 생성물 | 성격 |
| --- | --- | --- |
| `src/wokwi/layouts/pendulumLayout.ts` | `diagram.json` | pendulum 레시피 회로. **학생이 실제로 만드는 회로** |
| `src/wokwi/layouts/chipConformanceLayout.ts` | `wokwi/chip-conformance/diagram.json` | INA219·TSL2591 커스텀 칩 검증 리그. `purpose: 'recipe'` 엄격 형상 검증 적용 |

```powershell
npm run generate:wokwi-diagram
npm run verify:wokwi-diagram
```

첫 명령은 엄격한 검증을 통과한 경우에만 두 `diagram.json`을 생성합니다. 두 번째 명령은
생성물이 원본과 정확히 일치하는지 확인하며 CI에서도 실행됩니다.

## 좌표의 근거 — 실제 부품 형상

기하 검증은 **좌표계가 실물과 맞을 때만** 의미가 있습니다. Wokwi는 도선을 **실제 핀 위치**에서
시작해 `h`/`v` 상대 명령을 적용해 그리므로, 명세의 핀 좌표가 틀리면 렌더 경로가 통째로
그만큼 밀립니다. 그러면 검증기는 가상의 좌표계 안에서만 정합하고 화면은 어긋납니다.

`src/wokwi/partGeometry.ts`가 좌표의 출처와 허용 오차를 형상별로 보유합니다.

- `pin-position-mismatch` — 도선의 첫/끝 점이 Wokwi가 그리는 핀 위치와 다르면 차단합니다.
- `unknown-part-geometry` — 형상 데이터가 없는 파트를 **보고**합니다. 조용히 통과시키지
  않습니다. "검사할 수 없었다"가 "검사했고 괜찮았다"로 읽히면 안 되기 때문입니다.
- `unsupported-part-rotation` — 회전된 파트는 핀 표가 무회전 기준이므로 검사를 거부합니다.
- 부품 `bounds`도 선언값이 아니라 실제 렌더 크기에서 유도합니다.

출처가 `wokwi-elements`이면 상류 `pinInfo`를 그대로 전사하고 허용 오차는 **0.01px**입니다.
Uno는 상류의 31개 핀 이름과 좌표를 전부 정확 비교합니다. 공개 렌더에서 측정한 형상은
`source: 'measured'`, 기본 허용 오차 **0.5px**를 사용합니다. 어떤 측정값도 브레드보드
피치 9.6px의 1/4인 **2.4px**를 넘겨 허용하지 않습니다.

실제 피치는 Uno 헤더 9.5px, MPU6050 및 브레드보드 격자 9.6px입니다.
**`minimumClearance`(10px)보다 좁습니다.** 그래서 같은 헤더의 이웃 핀으로 가는 두 도선은
피치가 강제하는 간격을 예외로 인정합니다 — 부품이 물리적으로 허용하지 않는 간격을
요구하면 그 헤더는 배선 자체가 불가능해집니다.

### 측정 재현 절차

1. `WOKWI_CLI_TOKEN`을 설정하고 단일 파트 프로젝트에서 다음 게이트를 실행합니다.

   ```powershell
   wokwi-cli . --screenshot-part uno --screenshot-time 1000 --screenshot-file uno.png
   ```

   Uno의 31핀 결과를 상류 `wokwi-elements` `pinInfo`와 정확 비교합니다. 이름·순서가
   다르거나 좌표 오차가 2.4px를 넘으면 다른 파트의 측정을 진행하지 않습니다.
2. CLI 캡처에 스케일이나 여백이 끼면 공개 Wokwi 편집기의 SSR과 브라우저 DOM에서 파트
   SVG 및 핀의 `getBoundingClientRect()`를 읽고, 파트 왼쪽·위쪽을 빼 로컬 좌표로
   정규화합니다. 저장된 `diagram.json`의 `left`/`top`과도 교차 검증합니다.
3. half breadboard는 **87×55mm**(96dpi에서 328.8189×207.8740px), 피치 9.6px입니다.
   터미널 열은 `x = 26.3897637795 + 9.6(n-1)`, 위쪽 `a`~`e`는
   `y = 50.7897637795 + 9.6i`, 아래쪽 `f`~`j`는
   `y = 118.7897637795 + 9.6i`입니다. 레일은
   `x = 34.8897637795 + 9.6(n-1) + 9.6 floor((n-1)/5)`이고,
   `tp/tn/bp/bn`의 y는 각각 `12.6897637795/22.2897637795/186.4897637795/196.0897637795`입니다.
4. 커스텀 칩의 `pins` 배열은 앞 절반을 왼쪽 위→아래, 뒤 절반을 오른쪽 아래→위로
   배치합니다. `display`가 있으면 렌더 폭은
   `max(30mm, display.width px + 2mm)`, 높이는
   `(pinRows × 2.54mm + 2mm) + display.height px`입니다. 4핀 칩의
   `display: { width: 112, height: 73 }`은 119.56×99.76px로 렌더되어 기존
   120×100px 경계에 가장 가깝습니다.

재현 자료:

- [half breadboard 공개 편집기 SSR](https://wokwi.com/projects/349109488710582866)
- [4핀 커스텀 칩 SSR](https://wokwi.com/projects/404142246935786497)
- [`display` 크기 SSR](https://wokwi.com/projects/408734171659715585)
- [Wokwi CLI 사용법](https://docs.wokwi.com/wokwi-ci/cli-usage)
- [Wokwi Custom Chips API](https://docs.wokwi.com/chips-api/getting-started)
- [`diagram.json` 형식](https://docs.wokwi.com/diagram-format)

`purpose: 'fixture'` 타입은 좌표를 고의로 만들어 쓰는 검증기 단위 테스트에만 남깁니다.
실제 Wokwi 프로젝트인 두 프로덕션 레이아웃은 모두 `purpose: 'recipe'`이며, 형상 검사를
우회하는 용도로 `fixture`를 사용할 수 없습니다.

## 전기적 검증 — 넷리스트

기하학적 검증은 도선이 **보기 좋은지**만 판정합니다. 도선이 **옳은 구멍에 꽂혔는지**는
판정하지 못합니다. 5번 행 대신 6번 행에 꽂아도 직교이고 겹치지 않으면 11종 검사를
모두 통과합니다.

`src/wokwi/netlist.ts`가 이 공백을 메웁니다. 레이아웃에서 실제 도통을 유도한 뒤
두 가지 독립적인 선언과 대조합니다.

1. **`wire`의 `net` 라벨** — 한 도체가 서로 다른 net 이름을 가질 수 없고(`net-label-conflict`),
   같은 net 이름이 서로 이어지지 않은 두 도체에 나뉘어 있을 수 없습니다(`net-label-split`,
   버스 도선 누락 탐지).
2. **`recipe.wiring[]`** — 레이아웃이 만드는 도체 집합과 레시피가 학생에게 지시하는
   도체 집합이 **정확히 같아야** 합니다(`netlist-mismatch`).

브레드보드 도통은 실물 규칙 그대로 모델링합니다. 터미널 스트립 한 열(`5t.a`~`5t.e`)은
하나의 도체이고, 전원·접지 레일(`tp.*`, `tn.*`)은 보드 전체에 걸쳐 각각 하나의 도체입니다.
따라서 가독성을 위해 브레드보드를 경유해도 레시피가 선언하지 않은 연결이 생기지 않습니다.

이 대조 덕분에 **CI가 시뮬레이션한 회로와 학생이 만드는 회로가 같다는 것이 구성상 보장**
됩니다. 검증은 `src/wokwi/netlist.test.ts`가 수행하며 `npm run test:wokwi-layout`과
`npm test`에 모두 포함됩니다.

> 커스텀 칩 리그(`chipConformanceLayout`)에는 대응하는 레시피가 없으므로 2번 대조가
> 적용되지 않습니다. 대신 기대 넷리스트를 테스트에 직접 단언합니다.

## 명세 계약

- 모든 도선은 고유한 `id`, 전기적 연결망 `net`, `from`, `to`, `color`, `points`를 가집니다.
- `points`는 실제 화면 좌표이며 첫 점은 `from`, 마지막 점은 `to` 핀 중심입니다.
- 모든 구간은 수평 또는 수직이어야 합니다. 대각선과 길이 0인 구간은 금지합니다.
- `minimumClearance`는 사진에서 두 평행선을 구별하기 위한 최소 픽셀 간격입니다.
- 부품의 `bounds`는 핀을 제외한 본체 영역입니다. 도선은 이 영역을 통과할 수 없습니다.
- 실제 핀이나 브레드보드 홀 하나에는 도선 플러그 하나만 연결할 수 있습니다.
- 모든 연결점은 해당 부품의 `pins` 목록에 미리 선언되어야 합니다.
- 연결된 핀이나 브레드보드 홀 주변에는 `minimumClearance`만큼의 가시 영역을
  확보해야 하며, 다른 도선은 이 영역을 통과할 수 없습니다.

## 생성 차단 오류

| 오류 코드 | 조건 |
| --- | --- |
| `invalid-layout-value` | 좌표, 간격, 경계 또는 점 개수가 유효하지 않음 |
| `unknown-endpoint-part` | 연결점이 선언되지 않은 부품을 참조함 |
| `duplicate-wire-id` | 도선 ID가 중복됨 |
| `duplicate-endpoint` | 하나의 실제 핀/홀에 두 도선이 연결됨 |
| `non-orthogonal-segment` | 대각선 구간이 존재함 |
| `zero-length-segment` | 길이가 0인 구간이 존재함 |
| `wire-segment-overlap` | 두 도선이 같은 선분을 일부라도 공유함 |
| `wire-clearance-too-small` | 평행 구간 사이가 `minimumClearance`보다 가까움 |
| `wire-crossing` | 두 도선이 승인 없이 교차함 |
| `wire-over-connected-hole` | 도선이 **이미 연결된** 핀·홀 **위를 지나가** 가림 |
| `wire-through-part` | 도선이 부품 본체를 관통함 |
| `pin-position-mismatch` | 도선 끝점이 Wokwi가 그리는 실제 핀 위치와 다름 |
| `unknown-part-geometry` | 파트의 실제 핀 좌표를 확보할 수 없어 검사 불가 |
| `unsupported-part-rotation` | 회전된 파트 (핀 표는 무회전 기준) |

### 가림 판정 기준

`wire-over-connected-hole`은 **지나가는 것**과 **옆에 꽂히는 것**을 구분합니다. 핀의
투영점이 도선 구간의 **내부**에 있어야 위반이고, 구간의 **끝점**이면 그 도선이 거기서
끝나는 것이므로 가리지 않습니다. 임계 거리는 `minimumClearance`가 아니라 별도의
`pinObscureRadius`(기본 4px)입니다 — 전자는 평행선 구별용, 후자는 핀 가림 판정용으로
목적이 다르고, 9.5px 피치 헤더에서 10px를 요구하면 배선이 불가능해지기 때문입니다.

보호 대상은 **도선이 꽂혀 있는 핀·홀만**입니다. 빈 브레드보드 구멍은 가려도 잃을 정보가
없고, 전 구멍을 보호하면 브레드보드 위를 지나갈 수 없게 됩니다.

같은 `SDA`, `SCL`, 전원 또는 접지 연결망이라도 보이는 선분의 중첩은 허용하지
않습니다. 전기적으로 같은 연결이라는 사실은 사진에서 개별 배선을 식별해야 한다는
요구를 완화하지 않습니다.

교차가 불가피하면 두 도선이 서로를 `allowCrossings`에 명시해야 합니다. 한쪽만
선언한 교차는 오류입니다. 공유 끝점은 논리적 접속점이 아니라 실제 단자 하나에
플러그가 두 개 꽂히는 결과가 되므로 허용하지 않습니다.

## 촬영 확정 조건

- 검증 결과가 0건이어야 합니다.
- 변환된 `diagram.json`으로 Wokwi 시뮬레이션이 성공해야 합니다.
- 화면에서 모든 도선을 시작 핀부터 끝 핀까지 끊김 없이 눈으로 추적할 수 있어야 합니다.
- 센서 이름과 핀 라벨이 도선 또는 다른 부품에 가려지지 않아야 합니다.
- 촬영 이후의 수정은 원본 `ReadableLayout`에서만 수행하고 다시 검증·변환합니다.
