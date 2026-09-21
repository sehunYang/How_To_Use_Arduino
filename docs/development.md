# 개발자 문서

사용자용 안내는 [`README.md`](../README.md)에 있습니다. 이 문서는 빌드, 테스트, 콘텐츠 검증, 배포를 다룹니다.

## 스택

Vite + React + TypeScript, Tailwind CSS v4 + shadcn/ui, React Router, Firebase (Firestore/Auth/Storage, BaaS
직접 호출), GitHub Pages 배포.

## 개발

```bash
npm install
npm run dev                # 로컬 개발 서버
npm run build              # 타입체크 + 프로덕션 빌드
npm run lint               # ESLint (A7.4 디자인 토큰 규칙 포함)
npm test                   # Vitest 단위 테스트
npm run test:rules         # Firestore/Storage 보안 규칙 테스트 (로컬 에뮬레이터, 실제 프로젝트 불필요)
```

## 레시피 데이터에서 만드는 것

레시피 상세 화면의 준비물, 설치할 라이브러리, 시리얼 모니터 속도, 첫 실행 문제 해결은 레시피마다 손으로 적지
않고 [`src/recipes/`](../src/recipes/)에서 배선과 스케치를 읽어 만듭니다. 손으로 적은 목록은 배선이나
`#include`를 고칠 때 같이 고쳐지지 않고 조용히 어긋나기 때문입니다. 새 부품이나 새 라이브러리를 쓰는 레시피가
목록에서 빠지면 `src/recipes/beginnerFlow.test.ts`가 잡아냅니다.

아두이노도 배선도 코딩도 처음인 학생이 화면 밖에서 멈추던 자리들도 레시피 데이터에서 끌어내 모든 레시피가
받도록 했습니다. 검사는 `src/recipes/beginnerHelp.test.ts`입니다.

| 무엇 | 어디서 만드나 | 왜 |
|---|---|---|
| 저항 색띠 그림 | [`resistorBands.ts`](../src/recipes/resistorBands.ts)에서 저항값으로 계산 | `4.7 kΩ 저항`이라고 적어 줘도 저항에는 값이 인쇄되어 있지 않아 서랍에서 고를 수 없습니다 |
| 브레드보드 연결 안내 | [`firstRun.ts`](../src/recipes/firstRun.ts) + [`BreadboardMap.tsx`](../src/components/BreadboardMap.tsx) | 한 칸 밀려 꽂아도 화면은 그대로 넘어갑니다. 되짚으려면 어떤 구멍이 이어져 있는지를 알아야 합니다 |
| 전원 넣기 전 최종 점검 (체크 목록) | [`powerCheck.ts`](../src/recipes/powerCheck.ts)에서 배선 끝점으로 | 배선 단계의 체크 상자는 "꽂았는가"만 묻고 "맞게 꽂았는가"는 묻지 않습니다 |
| 처음 나온 값 점검표 | [`firstReading.ts`](../src/recipes/firstReading.ts)에서 센서별로 | `-127.00`처럼 고장났을 때만 나오는 값을 정상으로 알고 한 시간을 헛측정합니다 |
| 코드가 하는 일 요약 | [`sketchSummary.ts`](../src/recipes/sketchSummary.ts)에서 스케치를 읽어 | 코딩이 처음이면 스케치는 복사할 덩어리일 뿐이라 노란 줄을 바꿔도 무엇이 달라지는지 모릅니다 |
| 용어 뜻 | [`glossary.ts`](../src/recipes/glossary.ts)에서 이 레시피에 나온 말만 | `VCC`·`SDA`를 뜻도 모른 채 모양만 맞춰 꽂으면 값이 이상할 때 의심할 곳을 고를 수 없습니다 |
| 도움 요청 카드 | [`classroom.ts`](../src/recipes/classroom.ts) | "안 돼요"라는 말만으로는 선생님도 처음부터 다시 짚어야 합니다 |

## L5 로직 테스트 하네스

스케치의 순수 계산 로직은 `logic/*.h` 헤더로 뽑아내 실제 보드 없이 PC에서 검증합니다. US-207부터는 커스텀 칩
레지스터 모델(`chips/*.c`)도 같은 하네스로 돌아갑니다.

```bash
npm run setup:zig          # 호스트 C++ 컴파일러 준비 (최초 1회, 자동 실행됨)
npm run verify:logic       # logic/*.test.cpp + chips/*.test.cpp 컴파일 + 실행
```

호스트 컴파일러는 Zig 0.14.1의 `zig c++`(clang 19)이며, [`scripts/setup-zig.mjs`](../scripts/setup-zig.mjs)가
`node_modules/.zig/`로 내려받습니다. 시스템 전역 설치나 관리자 권한이 필요 없고, `node_modules`를 지우면 같이
사라집니다. (npm 패키지 `@ziglang/cli`는 postinstall이 `tar xJ`로 고정돼 있어 `.zip`으로 배포되는 Windows에서
동작하지 않습니다.)

테스트 프레임워크는 [doctest](https://github.com/doctest/doctest) 단일 헤더(MIT)를 `logic/vendor/doctest.h`에
벤더링해 씁니다. 카나리 회귀와 Phase 5 레시피 34종의 계산·통과 로직을 검증합니다.

## Phase 5 콘텐츠 검증

정본 초안 34건은 `src/data/phase5/`에 있으며 학생 화면에는 검토 전 초안이 번들되지 않습니다. 다음 명령으로
콘텐츠 계약, 검색, Uno 컴파일과 로직을 검증합니다.

```bash
npm run verify:corpus
npm run verify:matching -- --min 83
npm run verify:holdout -- --min 73
npm run verify:compile
npm run verify:logic
```

`npm run verify:corpus -- --release`는 34건의 실제 게시 상태와 현재 해시에 대한 모바일·주석 검토를 추가로
요구하므로 사람 검토 전에는 실패하는 것이 정상입니다. 운영 Firestore에 초안과 센서 근거를 적재할 때는 관리자
자격증명과 등록된 App Check 디버그 토큰을 환경변수로 제공한 뒤 `npm run seed:phase5`를 실행합니다. 이 명령은
초안만 저장하며 게시나 검색 인덱스 갱신은 하지 않습니다.

## 배포

`main`에 푸시하면 [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)이 lint, 단위 테스트,
Wokwi 다이어그램 검사, 검색 인덱스 드리프트 검사, 보안 규칙 테스트를 거쳐 GitHub Pages로 올립니다. 공개 주소는
<https://shy.ai.kr/How_To_Use_Arduino/>이고 `public/CNAME`이 도메인을 고정합니다.

## 로고와 파비콘

원본은 [`assets/logo.png`](../assets/logo.png)(2380×2473, 배경 투명)입니다. `assets/`는 배포되지 않는 원본
보관용이고, 서비스되는 아이콘은 `public/`에 있는 아래 세 개입니다.

| 파일 | 크기 | 비고 |
|---|---|---|
| `public/favicon-32.png` | 32×32 | 브라우저 탭. 16px로 줄여도 글자 모양이 남는 크기 |
| `public/favicon.png` | 256×256 | 북마크·고해상도 화면, `og:image` |
| `public/apple-touch-icon.png` | 180×180 | 흰 바탕으로 합성. iOS가 투명한 부분을 검게 채우기 때문 |

원본을 바꾸면 위 세 크기를 다시 만들어야 합니다. 정사각형 화폭 가운데에 비율을 지켜 배치하고, 애플 터치
아이콘만 흰 바탕을 깝니다. `index.html`의 아이콘 경로에는 빌드 때 `VITE_BASE_PATH`가 자동으로 붙지만
`og:image`는 그렇지 않으므로 전체 주소로 적어야 합니다.

## README 화면 그림

[`docs/images/`](images/)의 그림은 로컬 개발 서버(`npm run dev`)를 띄운 채 실제 화면을 찍은 것입니다. 화면
구조가 바뀌면 같은 자리를 다시 찍어 바꿔 주세요.

## 사람이 해야 하는 준비

- Firebase 프로젝트 생성과 과금 전환: [`docs/firebase-setup.md`](firebase-setup.md)
- Wokwi 계정, CLI 토큰, 커스텀 칩 패키징: [`docs/wokwi-setup.md`](wokwi-setup.md)
