# Wokwi 시뮬레이션 수동 프로비저닝 체크리스트

이 문서는 How to use Arduino의 L3(Wokwi 실제 시뮬레이션 실행)와 `PL5`(월간 Wokwi CI 분(分) 실측)를 활성화하는 데 필요한 **사람이 직접 하는 단계만** 담고 있습니다. [`docs/firebase-setup.md`](firebase-setup.md)가 Phase 0.4/0.5의 Firebase 수작업을 다룬 것과 같은 이유로, Wokwi 계정·CLI 토큰 발급은 에이전트가 대신할 수 없는 사람 전용 단계이므로 별도 체크리스트로 분리했습니다.

Phase 2(검증 하네스) 중 L1(정적 검사)·L2(컴파일)·L5(로직 하네스)는 이미 카나리 2종에 대해 그린 상태입니다(`npm run verify:compile`, `npm run verify:logic`). 아래 단계들을 완료해야만 L3와 `PL5`가 열립니다.

## 1. Wokwi 계정 생성 및 WOKWI_CLI_TOKEN 발급

- [ ] [wokwi.com](https://wokwi.com)에서 계정을 생성하거나 기존 계정으로 로그인합니다
- [ ] Wokwi 대시보드에서 CLI 인증 토큰(`WOKWI_CLI_TOKEN`)을 발급합니다
  - ⚠️ 이 세션에서는 Wokwi 대시보드 UI의 정확한 메뉴 경로를 직접 확인할 수 없었습니다(실제 계정 접근 불가). 토큰 발급 메뉴는 보통 계정 설정 또는 "CLI" 관련 섹션에 있으니, **진행 시점의 [Wokwi 공식 문서](https://docs.wokwi.com)에서 정확한 경로를 확인하세요.**
  - 발급된 토큰은 비밀 값입니다 — 저장소나 커밋에 절대 포함하지 마세요

## 2. GitHub Actions Secret으로 토큰 등록

- [ ] GitHub CLI로 등록하는 경우:
  ```bash
  gh secret set WOKWI_CLI_TOKEN
  ```
  (프롬프트가 뜨면 1단계에서 발급한 토큰 값을 붙여넣습니다)
- [ ] 또는 GitHub 웹 UI: 저장소 **Settings → Secrets and variables → Actions → New repository secret**에서 이름 `WOKWI_CLI_TOKEN`, 값은 1단계의 토큰으로 등록합니다
- [ ] 등록 후 `.github/workflows/*.yml`에서 `${{ secrets.WOKWI_CLI_TOKEN }}`으로 참조할 수 있습니다 (US-208의 워크플로에 L3 잡을 추가할 때 사용)

## 3. CI에 실제 Wokwi CLI 설치

- [ ] ⚠️ **이 세션에서 확인한 사실**: npm 패키지명 `wokwi-cli`와 `@wokwi/cli` 둘 다 조회 시 404가 반환되었습니다. 패키지명이 바뀌었거나 이 세션의 확인 방법이 잘못되었을 수 있습니다 — **실제로 설치를 진행하는 시점에 [Wokwi 공식 문서](https://docs.wokwi.com)에서 현재 올바른 패키지명·설치 방법을 반드시 재확인하세요.** 아래 단계에서 특정 설치 명령을 단정하지 않는 것도 같은 이유입니다.
- [ ] Wokwi 공식 문서가 안내하는 방법으로 CLI를 CI 환경(GitHub Actions 러너)에 설치합니다 (npm 전역 설치, 스크립트 다운로드, 또는 다른 방식일 수 있음 — 문서 확인 필요)
- [ ] 설치가 확인되면 `.github/workflows/*.yml`에 설치 단계를 추가하고 `WOKWI_CLI_TOKEN` 환경 변수를 CLI에 전달하도록 구성합니다

## 4. INA219 / TSL2591 커스텀 칩 WASM 패키징 및 게시

`chips/ina219.c`/`chips/ina219.h`와 `chips/tsl2591.c`/`chips/tsl2591.h`(US-207)는 각 칩의 레지스터 맵과 읽기/쓰기 동작을 Wokwi API와 무관한 순수 C로 구현하고, 같은 저장소의 host doctest 하네스(`chips/ina219.test.cpp`, `chips/tsl2591.test.cpp`, `npm run verify:logic`)로 이미 정확성이 검증되어 있습니다. 두 헤더 파일 모두 "이 레지스터 로직을 실제 Wokwi 커스텀 칩으로 패키징하려면 Wokwi CLI/계정이 필요하다"는 주석을 남겨 두었고, 이 섹션이 그 후속 작업입니다.

- [ ] **`chip.json` 디스크립터 작성**: Wokwi의 [커스텀 칩 API](https://docs.wokwi.com/chips-api/getting-started)가 요구하는 형식으로 INA219용/TSL2591용 `chip.json`을 각각 작성합니다. 핀 배치와 레지스터 동작은 `chips/ina219.h` / `chips/tsl2591.h`에 이미 문서화된 레지스터 맵(INA219: Config 0x00 / Shunt 0x01 / Bus 0x02 / Power 0x03 / Current 0x04 / Calibration 0x05, A0·A1 스트랩; TSL2591: 고정 주소 0x29, Enable 0x00 / Config 0x01 / CH0·CH1 0x14~0x17, gain·적분시간)를 그대로 근거로 삼습니다
- [ ] **WASM 빌드**: `chips/ina219.c` / `chips/tsl2591.c`를 Wokwi가 요구하는 WASM 타깃으로 컴파일합니다. Wokwi 공식 커스텀 칩 가이드는 보통 Docker 기반 또는 wasi-sdk 기반 빌드 절차를 안내합니다 — **이 샌드박스에서는 실제 빌드 명령을 실행·검증할 수 없었으므로, 진행 시점의 Wokwi 공식 문서에서 정확한 빌드 명령을 확인하세요**
- [ ] **게시 또는 로컬 참조**: 빌드된 칩을 Wokwi 칩 레지스트리에 게시하거나, `diagram/{recipeId}.json`(US-201의 `buildDiagram`이 생성하는 파일)의 `chips` 필드에서 로컬 경로로 직접 참조합니다

## 5. PL5 — 월간 예상 Wokwi CI 분(分) 실측

계획(`.omc/plans/how-to-use-arduino-implementation.md` "2.4 Wokwi 칩 + L3")의 `PL5` 요구사항은 **대표 시나리오 1건을 실제로 실행해 벽시계 시간을 측정**하고, 이를 근거로 월간 예상 Wokwi CI 사용 분이 무료 한도(50분)의 80%인 **40분 이하**임을 확정하는 것입니다. 시나리오당 20초 벽시계 상한도 함께 강제됩니다.

- [ ] ⚠️ 이 실측은 1~4단계(계정, 토큰, CI 설치, 칩 WASM 패키징)가 모두 끝나야 가능합니다. 그 전까지는 코드로 증명할 수 없는 항목입니다
- [ ] 준비가 끝나면 대표 시나리오(카나리 2종 중 하나, 예: pendulum)에 대해 다음과 같은 형태의 명령을 실행합니다:
  ```bash
  npx wokwi-cli --scenario <path-to-scenario> --timeout 20000
  ```
  ⚠️ **정확한 `wokwi-cli` 호출 문법(플래그명 포함)은 이 세션에서 검증하지 못했습니다** — 3단계와 마찬가지로, 실행 시점의 Wokwi 공식 CLI 문서에서 정확한 인자를 재확인하세요
- [ ] 측정된 벽시계 시간을 기록하고, 예상 실행 빈도(일일 크론·PR·게시 전 요청 등, 계획 문서 2.1절 "트리거" 참고)를 곱해 월간 예상 분을 계산합니다
- [ ] 계산된 월간 예상 분이 40분(무료 50분의 80%) 이하인지 확인하고, 결과를 프로젝트 문서(예: `OPERATIONS.md` 또는 이 문서의 갱신)에 기록합니다

## 이 체크리스트가 소비하는 기존 산출물

Wokwi 설정은 이 저장소가 이미 생성해 둔 다음 파일들을 입력으로 사용합니다:

- [`src/wokwi/buildDiagram.ts`](../src/wokwi/buildDiagram.ts) (US-201) — 레시피의 `wiring[]`과 센서의 `wokwi` 디스크립터로부터 Wokwi `diagram.json` 구조(`parts[]`, `connections[]`)를 생성합니다. CI에서 [`scripts/extract-content.ts`](../scripts/extract-content.ts)(US-202)가 이를 호출해 `diagram/{recipeId}.json`으로 디스크에 씁니다 (빌드 산출물이며 저장소에 커밋되지 않음, `.gitignore` 처리됨)
- [`src/verification/extractContent.ts`](../src/verification/extractContent.ts) (US-202) — 같은 CI 스크립트가 `sketches/{id}.ino`도 함께 생성합니다. 4단계의 `chip.json`이 참조할 `diagram/*.json`과, 실제 스케치 코드가 여기서 나옵니다
- [`chips/ina219.c`](../chips/ina219.c) / [`chips/ina219.h`](../chips/ina219.h), [`chips/tsl2591.c`](../chips/tsl2591.c) / [`chips/tsl2591.h`](../chips/tsl2591.h) (US-207) — 4단계에서 WASM으로 컴파일할 레지스터 로직의 원본이자, 그 로직이 옳다는 것의 증거(host doctest로 이미 검증됨)

## 완료 후

- [ ] 위 1~4단계를 모두 완료했습니다 (계정, 토큰, CI 설치, 칩 패키징)
- [ ] 5단계의 실측을 최소 1회 실행하고 월간 예상 분을 기록했습니다
- [ ] 계산된 예상치가 40분 이하임을 확인했습니다 (초과 시 시나리오 수 축소 또는 트리거 빈도 조정 필요 — 계획 문서 2.1절 참고)

**이 체크리스트가 끝나면 Phase 2의 L3(Wokwi 시뮬레이션)와 `PL5`가 코드로 증명 가능한 상태가 됩니다.**
