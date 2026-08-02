# How to use Arduino

아두이노를 전혀 모르는 중·고등학생이 탐구 주제 하나만 들고 와서, 생성형 AI 없이 탐구를 끝까지 마치는 가이드 사이트.
측정하고 싶은 것을 문장으로 적으면 센서 추천 → 대표 예제 → 프로젝트 배선·코드로 이어지고, 측정을 마친 뒤에는
시리얼 모니터 내용을 붙여넣어 CSV 저장, 요약 통계, 논문 형식 그래프까지 같은 자리에서 처리합니다.

학생 화면은 네 갈래입니다.

| 화면 | 하는 일 |
|---|---|
| 아이디어 찾기 (`/`) | 탐구 문장으로 센서와 레시피 검색 |
| 레시피 둘러보기 (`/recipes`) | 준비물·단계별 배선도·코드·바꿔 볼 값 |
| 센서 학습하기 (`/sensors`) | 측정 물리량, 출력 방식, 배선 주의점 |
| 데이터 변환·분석 (`/data-analysis`) | 기본은 붙여넣기 → 요약 통계 → 그래프 → 회귀 → CSV·PNG 저장. 고급으로 바꾸면 구간 자르기, 조건 값 열·계산 열 더하기(로그·삼각함수·차분·누적·이동평균), 계열 나누기와 열로 펼치기, 격자 표 |

- 요구사항 명세: [`.omc/specs/deep-interview-how-to-use-arduino.md`](.omc/specs/deep-interview-how-to-use-arduino.md) (모호도 4.9%, 인수 조건 44건)
- 구현 계획: [`.omc/plans/how-to-use-arduino-implementation.md`](.omc/plans/how-to-use-arduino-implementation.md) (Revision 3.1, 합의 검토 완료)

## 스택

Vite + React + TypeScript, Tailwind CSS v4 + shadcn/ui, React Router, Firebase (Firestore/Auth/Storage, BaaS 직접 호출), GitHub Pages 배포.

## 로고와 파비콘

원본은 [`assets/logo.png`](assets/logo.png)(2380×2473, 배경 투명)입니다. `assets/`는 배포되지 않는 원본
보관용이고, 실제로 서비스되는 아이콘은 `public/`에 있는 아래 세 개입니다.

| 파일 | 크기 | 비고 |
|---|---|---|
| `public/favicon-32.png` | 32×32 | 브라우저 탭. 16px로 줄여도 글자 모양이 남는 크기 |
| `public/favicon.png` | 256×256 | 북마크·고해상도 화면, `og:image` |
| `public/apple-touch-icon.png` | 180×180 | 흰 바탕으로 합성. iOS가 투명한 부분을 검게 채우기 때문 |

원본을 바꾸면 위 세 크기를 다시 만들어야 합니다. 정사각형 화폭 가운데에 비율을 지켜 배치하고,
애플 터치 아이콘만 흰 바탕을 깝니다. `index.html`의 아이콘 경로에는 빌드 때 `VITE_BASE_PATH`가
자동으로 붙지만 `og:image`는 그렇지 않으므로 전체 주소로 적어야 합니다.

## 개발

```bash
npm install
npm run dev              # 로컬 개발 서버
npm run build             # 타입체크 + 프로덕션 빌드
npm run lint               # ESLint (A7.4 디자인 토큰 규칙 포함)
npm test                   # Vitest 단위 테스트
npm run test:rules         # Firestore/Storage 보안 규칙 테스트 (로컬 에뮬레이터, 실제 프로젝트 불필요)
```

## L5 로직 테스트 하네스

스케치의 순수 계산 로직은 `logic/*.h` 헤더로 뽑아내 실제 보드 없이 PC에서 검증합니다.
US-207부터는 커스텀 칩 레지스터 모델(`chips/*.c`)도 같은 하네스로 함께 돌아갑니다.

```bash
npm run setup:zig          # 호스트 C++ 컴파일러 준비 (최초 1회, 자동 실행됨)
npm run verify:logic       # logic/*.test.cpp + chips/*.test.cpp 컴파일 + 실행
```

호스트 컴파일러는 **Zig 0.14.1의 `zig c++`(clang 19)** 이며, [`scripts/setup-zig.mjs`](scripts/setup-zig.mjs)가
`node_modules/.zig/`로 내려받습니다. 시스템 전역 설치나 관리자 권한이 필요 없고, `node_modules`를 지우면 같이 사라집니다.
(npm 패키지 `@ziglang/cli`는 postinstall이 `tar xJ`로 고정돼 있어 `.zip`으로 배포되는 Windows에서 동작하지 않습니다.)

테스트 프레임워크는 [doctest](https://github.com/doctest/doctest) 단일 헤더(MIT)를 `logic/vendor/doctest.h`에 벤더링해 씁니다.
카나리 회귀와 Phase 5 레시피 34종의 계산·통과 로직을 함께 검증합니다.

## Phase 5 콘텐츠 검증

정본 초안 34건은 `src/data/phase5/`에 있으며 학생 화면에는 검토 전 초안이
번들되지 않습니다. 다음 명령으로 콘텐츠 계약, 검색, Uno 컴파일과 로직을
검증합니다.

```bash
npm run verify:corpus
npm run verify:matching -- --min 83
npm run verify:holdout -- --min 73
npm run verify:compile
npm run verify:logic
```

`npm run verify:corpus -- --release`는 34건의 실제 게시 상태와 현재 해시에
대한 모바일·주석 검토를 추가로 요구하므로 사람 검토 전에는 실패하는 것이
정상입니다. 운영 Firestore에 초안과 센서 근거를 적재할 때는 관리자 자격증명과
등록된 App Check 디버그 토큰을 환경변수로 제공한 뒤 `npm run seed:phase5`를
실행합니다. 이 명령은 초안만 저장하며 게시나 검색 인덱스 갱신은 하지 않습니다.

## Firebase 프로젝트 준비

실제 Firebase 프로젝트 생성·과금 전환 등 사람이 직접 해야 하는 단계는 [`docs/firebase-setup.md`](docs/firebase-setup.md)를 따르세요.

## Wokwi 시뮬레이션 준비

L3(Wokwi 실제 시뮬레이션 실행)와 `PL5`(월간 CI 분 실측)에 필요한 Wokwi 계정·CLI 토큰·커스텀 칩 패키징 등 사람이 직접 해야 하는 단계는 [`docs/wokwi-setup.md`](docs/wokwi-setup.md)를 따르세요.
