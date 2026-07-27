# How to use Arduino

아두이노를 전혀 모르는 중·고등학생이 탐구 주제 하나만 들고 와서, 생성형 AI 없이 센서 추천 → 대표 예제 → 프로젝트 배선·코드까지 완주하는 Notion 스타일 가이드 사이트.

- 요구사항 명세: [`.omc/specs/deep-interview-how-to-use-arduino.md`](.omc/specs/deep-interview-how-to-use-arduino.md) (모호도 4.9%, 인수 조건 44건)
- 구현 계획: [`.omc/plans/how-to-use-arduino-implementation.md`](.omc/plans/how-to-use-arduino-implementation.md) (Revision 3.1, 합의 검토 완료)

## 스택

Vite + React + TypeScript, Tailwind CSS v4 + shadcn/ui, React Router, Firebase (Firestore/Auth/Storage, BaaS 직접 호출), GitHub Pages 배포.

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
npm run verify:logic       # logic/*.test.cpp + chips/*.test.cpp 컴파일 + 실행 (현재 4/4)
```

호스트 컴파일러는 **Zig 0.14.1의 `zig c++`(clang 19)** 이며, [`scripts/setup-zig.mjs`](scripts/setup-zig.mjs)가
`node_modules/.zig/`로 내려받습니다. 시스템 전역 설치나 관리자 권한이 필요 없고, `node_modules`를 지우면 같이 사라집니다.
(npm 패키지 `@ziglang/cli`는 postinstall이 `tar xJ`로 고정돼 있어 `.zip`으로 배포되는 Windows에서 동작하지 않습니다.)

테스트 프레임워크는 [doctest](https://github.com/doctest/doctest) 단일 헤더(MIT)를 `logic/vendor/doctest.h`에 벤더링해 씁니다.
지금은 카나리 2종(pendulum, multi-tsl2591)만 돌지만, Phase 5에서 레시피 34종으로 그대로 확장되는 구조입니다.

## Firebase 프로젝트 준비

실제 Firebase 프로젝트 생성·과금 전환 등 사람이 직접 해야 하는 단계는 [`docs/firebase-setup.md`](docs/firebase-setup.md)를 따르세요.

## Wokwi 시뮬레이션 준비

L3(Wokwi 실제 시뮬레이션 실행)와 `PL5`(월간 CI 분 실측)에 필요한 Wokwi 계정·CLI 토큰·커스텀 칩 패키징 등 사람이 직접 해야 하는 단계는 [`docs/wokwi-setup.md`](docs/wokwi-setup.md)를 따르세요.
