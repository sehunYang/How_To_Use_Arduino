# Design

## 2026-08-01 데이터 변환·분석 결정

- 데이터 변환·분석은 학생 가이드의 하위 항목이 아니라 같은 높이의 메뉴로 둔다.
- 그래프는 화면 테마와 무관하게 흰 바탕·검은 축의 논문 그림 형식으로만 그린다. 화면에 보이는 그림과 저장한 PNG가 달라지면 안 되고, 어두운 바탕 그림은 보고서에 쓸 수 없다.
- 세로축에 겹쳐 그리는 계열은 세 개까지만 허용한다. 산점도는 모든 계열 쌍이 서로 구분되어야 하며, 네 번째 색부터는 색약에서 앞선 색과 구별되지 않는다.
- 계열 색은 고정된 순서(파랑·주황·초록)로만 배정하고, 색과 함께 점 모양(원·마름모·삼각형)으로도 구분한다.
- 세로축 눈금은 하나만 둔다. 단위가 다른 변인은 눈금을 따로 만들지 않고, 학생에게 단위가 같은 변인끼리 고르도록 안내한다.

## 2026-07-31 recipe and wiring decisions

- 레시피 둘러보기 카드에는 배선 이미지나 배선 단계 카드를 표시하지 않는다.
- 과목, 난이도, 예상 시간은 텍스트 구분자 대신 서로 구별되는 토큰 기반 배지로 표시한다.
- 배지는 색상에만 의존하지 않고 각 항목의 텍스트를 항상 함께 제공한다.
- 배선도와 단계별 연결은 레시피 상세 화면에서만 제공한다.
- 도선 시작점과 끝점은 부품 상자의 추정 위치가 아니라 실제 Wokwi `pinInfo` 또는 검증된 측정 geometry 좌표여야 한다.
- 화면에 그려진 핀 중심과 도선 끝점의 좌표가 일치하지 않으면 배포를 차단한다.
- Wokwi Elements에 없는 부품은 핀 이름과 핀 중심을 명시적으로 표시하는 저장소 소유 대체 모듈을 사용한다.
- Phase 5 전체 34개 레시피가 동일한 핀 좌표 검증을 통과해야 한다.

## Source of truth

- Status: Active
- Last refreshed: 2026-07-29
- Primary product surfaces: 학생용 검색, 레시피 목록·상세, 센서 학습 목록·상세, 단계별 배선 뷰어
- Evidence reviewed: `src/styles/tokens.css`, `src/components/WiringIllustration.tsx`, `src/wokwi/partGeometry.ts`, `docs/wokwi-wiring-rules.md`, `.omc/plans/how-to-use-arduino-implementation.md`, Adafruit INA219/TSL2591/TCA9548A product and fabrication references

## Brand

- Personality: 정확하고 차분한 과학 실습 조교
- Trust signals: 실제 부품과 일치하는 외형, 검증된 핀 좌표, 추적 가능한 배선, 시뮬레이션 상태의 정직한 표시
- Avoid: 의미 없는 플레이스홀더, 일반 사각형으로 대체한 센서, 실제 핀 배열과 다른 그림, 장식 때문에 배선을 가리는 표현

## Product goals

- Goals: 학생이 실물 부품을 바로 식별하고, 배선을 한 단계씩 안전하게 재현하도록 돕는다.
- Non-goals: Wokwi 시뮬레이터나 편집기 자체를 다시 구현하지 않는다.
- Success signals: 부품·핀·도선이 `ReadableLayout`과 일치하고, 현재 단계의 새 연결을 모바일에서도 즉시 식별할 수 있다.

## Personas and jobs

- Primary personas: 브레드보드와 Arduino를 처음 또는 제한적으로 사용하는 중·고등학생
- User jobs: 실물 부품 식별, 연결할 두 핀 확인, 점퍼선 색상 확인, 이전 단계와 새 단계 구분
- Key contexts of use: 브레드보드 옆에 둔 휴대전화, 교실 조명, 한 손 또는 엄지 조작

## Information architecture

- Primary navigation: 학생 가이드(아이디어 찾기 · 레시피 둘러보기 · 센서 학습하기)와 같은 높이의 데이터 변환·분석
- Core routes/screens: `/`, `/search`, `/recipes`, `/recipes/:id`, `/sensors`, `/sensors/:id`, `/data-analysis`
- Content hierarchy: 현재 단계 배선 이미지 → 연결 문장 → 진행 제어 → 코드와 설명

## Design principles

- 공개된 Wokwi 부품 SVG는 변형하거나 재해석하지 않고 원본을 사용한다.
- Wokwi 원본이 공개되지 않은 브레드보드·커스텀 센서는 실물 구조를 근거로 제작한다.
- 새 부품 SVG는 Wokwi의 평면 벡터 스타일, 제한된 음영, 핀·패드 표현, 선 굵기와 색상 밀도를 따른다.
- 배선 기하와 전기적 정합성은 기존 `ReadableLayout` 및 넷리스트 검증을 유일한 정본으로 사용한다.
- Tradeoffs: Wokwi 화면 전체의 픽셀 복제보다 부품 식별성과 핀 정확성을 우선하되, 공개 원본이 있는 부품은 픽셀 수준으로 일치시킨다.

## Visual language

- Color: 앱 UI는 `src/styles/tokens.css`; 회로 부품은 Wokwi 원본 팔레트 또는 실물 PCB 색상을 Wokwi 명도·채도 범위로 정규화한다.
- Typography: 앱은 기존 시스템 글꼴; 부품 실크스크린은 Wokwi SVG의 글꼴 크기·굵기·대문자 규칙을 따른다.
- Spacing/layout rhythm: 부품 좌표와 크기는 `src/wokwi/partGeometry.ts`를 따른다.
- Shape/radius/elevation: 회로 SVG는 평면 벡터 중심이며, Wokwi 원본에 존재하는 최소 음영만 허용한다.
- Motion: 단계 전환은 짧은 불투명도 전환만 사용하고 `prefers-reduced-motion`을 존중한다.
- Imagery/iconography: 사진과 임의 생성 이미지를 혼용하지 않는다. 공개 Wokwi SVG와 검토된 자체 SVG만 사용한다. 센서 미리보기는 실물의 외곽 형태·핀 수·기판 유무를 보존하며, 공통 4:3 안전 영역 안에서 의미 있는 핀이나 라벨이 잘리지 않는 최대 크기로 광학 보정한다.

## Components

- Existing components to reuse: `WiringIllustration`, `Button`, 레시피 진행 상태 훅
- New/changed components: 정적 회로 SVG 렌더러, 부품 SVG 레지스트리, 단계별 도선 레이어, 센서 카드, 센서 갤러리, 센서 상세 스펙
- Variants and states: 0단계, 현재 단계까지 누적, 완성, 확대, 이미지 누락 오류
- Token/component ownership: 앱 토큰은 `tokens.css`; 회로 부품 팔레트와 선 스타일은 렌더러 전용 상수로 관리한다.

## Accessibility

- Target standard: WCAG 2.2 AA
- Keyboard/focus behavior: 단계 이동과 확대 제어를 키보드로 사용할 수 있어야 한다.
- Contrast/readability: 전선은 색상과 함께 단계 강조·선 패턴 또는 외곽선을 사용한다.
- Screen-reader semantics: 이미지 대체 텍스트에 현재 단계의 from/to와 색상을 포함한다.
- Reduced motion and sensory considerations: 단계 전환 애니메이션은 제거 가능해야 하며 색상만으로 상태를 구분하지 않는다.

## Responsive behavior

- Supported breakpoints/devices: 360px 이상 모바일, 태블릿, 데스크톱
- Layout adaptations: 모바일은 상단 sticky 이미지, 데스크톱은 이미지와 단계 목록 2단
- Touch/hover differences: 모바일 핀치와 드래그, 데스크톱 휠과 드래그, 더블탭·버튼 확대를 지원하며 hover에만 정보를 의존하지 않는다. 확대 범위는 100%~500%다.

## Interaction states

- Loading: 이전 단계 이미지를 유지하며 짧은 로딩 상태 표시
- Empty: 게시 레시피에는 허용하지 않음
- Error: 플레이스홀더 대신 “검증된 배선 이미지를 준비 중” 메시지 표시
- Success: 마지막 단계 완료 후 완성 회로와 PC 작업 안내
- Disabled: 다음 단계 버튼의 이유를 문맥으로 제공
- Offline/slow network: 정적 번들 자산으로 동작

## Content voice

- Tone: 짧고 직접적인 명령형, 핀 이름은 원문 유지
- Terminology: “배선도”, “현재 단계”, “연결”, “핀”, “점퍼선”
- Microcopy rules: 색상·출발 핀·도착 핀을 한 문장에 모두 포함한다.

## Implementation constraints

- Framework/styling system: React, TypeScript, Tailwind v4
- Design-token constraints: 앱 색상은 기존 토큰을 사용하며 회로 내부 색상은 렌더러에 한정한다.
- Performance constraints: 초기 JS gzip 250KB 이하, 검색 인덱스 기존 예산 유지
- Compatibility constraints: GitHub Pages 정적 배포, `/How_To_Use_Arduino/` base path
- Test/screenshot expectations: 공개 Wokwi SVG는 원본 해시 또는 구조 비교, 자체 SVG는 핀 좌표·경계·스타일 검사, 전체 회로는 단계별 시각 회귀 검사를 통과해야 한다.

## Open questions

- [ ] 공개되지 않은 Wokwi 브레드보드 외형의 허용 시각 오차를 첫 기준 이미지 검토 후 수치화한다.
- [x] INA219·TSL2591·TCA9548A는 Adafruit 계열 파란 PCB와 공식 핀 라벨을 프로젝트 표준 외형으로 사용한다.
