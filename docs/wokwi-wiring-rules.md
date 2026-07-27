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

현재 루트 회로의 원본은 `src/wokwi/layouts/pendulumLayout.ts`입니다.

```powershell
npm run generate:wokwi-diagram
npm run verify:wokwi-diagram
```

첫 명령은 엄격한 검증을 통과한 경우에만 `diagram.json`을 생성합니다. 두 번째 명령은
생성물이 원본과 정확히 일치하는지 확인하며 CI에서도 실행됩니다.

## 명세 계약

- 모든 도선은 고유한 `id`, 전기적 연결망 `net`, `from`, `to`, `color`, `points`를 가집니다.
- `points`는 실제 화면 좌표이며 첫 점은 `from`, 마지막 점은 `to` 핀 중심입니다.
- 모든 구간은 수평 또는 수직이어야 합니다. 대각선과 길이 0인 구간은 금지합니다.
- `minimumClearance`는 사진에서 두 평행선을 구별하기 위한 최소 픽셀 간격입니다.
- 부품의 `bounds`는 핀을 제외한 본체 영역입니다. 도선은 이 영역을 통과할 수 없습니다.
- 실제 핀이나 브레드보드 홀 하나에는 도선 플러그 하나만 연결할 수 있습니다.
- 모든 연결점은 해당 부품의 `pins` 목록에 미리 선언되어야 합니다.

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
| `wire-through-part` | 도선이 부품 본체를 관통함 |

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
