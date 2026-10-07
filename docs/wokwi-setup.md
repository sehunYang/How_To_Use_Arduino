# Wokwi 시뮬레이션 설정 및 검증 체크리스트

이 문서는 How To Use Arduino 프로젝트의 Wokwi L3 시뮬레이션과 PL5 월간
사용량 검증 상태를 기록합니다.

## 1. 계정과 토큰

- [x] Wokwi 계정을 생성했습니다.
- [x] Wokwi CI Dashboard에서 CLI 토큰을 발급했습니다.
- [x] GitHub 저장소의 Actions secret에 `WOKWI_CLI_TOKEN`을 등록했습니다.
- [x] 토큰은 저장소 파일이나 로그에 저장하지 않습니다.

로컬 PowerShell 세션에서 실행할 때만 다음 환경변수를 설정합니다.

```powershell
$env:WOKWI_CLI_TOKEN = "발급받은 토큰"
```

## 2. 로컬 CLI와 Arduino Uno 펌웨어

- [x] Windows용 Wokwi CLI를 설치했습니다.
- [x] `wokwi-cli --help`로 설치를 확인했습니다.
- [x] Arduino Uno R3용 pendulum 펌웨어를 HEX/ELF로 빌드했습니다.
- [x] Uno, MPU6050, INA219, TSL2591을 포함한 `diagram.json`을 구성했습니다.

재현 명령:

```powershell
npm ci
npm run setup:arduino-cli
npm run build:wokwi
```

생성되는 펌웨어:

- `.tools/wokwi/pendulum/pendulum.ino.hex`
- `.tools/wokwi/pendulum/pendulum.ino.elf`

`.tools/`는 Git에 커밋하지 않으며 CI에서도 매번 다시 생성합니다.

## 3. INA219 / TSL2591 커스텀 칩

- [x] 기존 레지스터 모델의 host doctest를 유지했습니다.
- [x] INA219 Wokwi I2C 어댑터를 구현했습니다.
- [x] TSL2591 Wokwi I2C 어댑터와 COMMAND 바이트 처리를 구현했습니다.
- [x] 두 칩의 `.chip.json` 핀/컨트롤 정의를 작성했습니다.
- [x] 두 칩을 WASM으로 컴파일했습니다.
- [x] `wokwi.toml`의 `[[chip]]` 항목에서 로컬 WASM을 참조합니다.
- [x] GitHub Actions가 WASM을 소스에서 다시 빌드합니다.

관련 파일:

- `chips/ina219.chip.c`
- `chips/ina219.chip.json`
- `chips/ina219.chip.wasm`
- `chips/tsl2591.chip.c`
- `chips/tsl2591.chip.json`
- `chips/tsl2591.chip.wasm`
- `chips/wokwi-api.h`

로컬 빌드:

```powershell
npm run build:wokwi:chips
```

## 4. 자동화 시나리오: 프로젝트 3개

레시피 회로와 칩 검증 리그는 분리된 Wokwi 프로젝트입니다. 레시피의 `diagram.json`은
`recipe.wiring[]`이 선언한 회로와 정확히 일치해야 하므로(`src/wokwi/netlist.ts` 게이트),
레시피가 쓰지도 않는 조도계·전류계를 회로에 끼워 넣을 수 없기 때문입니다.

### 4-1. pendulum 레시피 (루트 프로젝트)

- [x] `wokwi/pendulum.test.yaml`
- [x] MPU6050이 연결되어 `MPU6050_OK`를 출력하는지 확인합니다.
- [x] 회로는 MPU6050 4선을 Uno에 직결한 것으로, 레시피 배선 스텝과 동일합니다.

```powershell
wokwi-cli . --scenario wokwi/pendulum.test.yaml --timeout 10000
```

### 4-2. 커스텀 칩 적합성 리그 (`wokwi/chip-conformance`)

- [x] `wokwi/chip-conformance/scenario.test.yaml`
- [x] Arduino Uno가 INA219의 CURRENT 레지스터를 I2C로 읽습니다.
- [x] Arduino Uno가 TSL2591의 CH0 레지스터를 I2C로 읽습니다.
- [x] 초기값이 맞으면 `CUSTOM_CHIPS_OK`를 출력합니다.
- [x] 시나리오가 TSL2591의 `ch0Raw` 컨트롤을 2048로 변경합니다.
- [x] 펌웨어가 변경값을 읽어 `TSL_CH0=2048`을 출력하는지 확인합니다.

이 프로젝트는 자기완결형입니다. `wokwi.toml`의 모든 경로가 프로젝트 루트 기준으로
해석되므로 `npm run build:wokwi`가 펌웨어와 칩 WASM을 디렉터리 안으로 복사합니다.
`npm run build:wokwi:chips`를 `npm run build:wokwi`보다 먼저 실행해야
방금 빌드한 WASM이 리그에 반영됩니다.

```powershell
npm run build:wokwi:chips
npm run build:wokwi
wokwi-cli wokwi/chip-conformance --scenario scenario.test.yaml --timeout 10000
```

### 4-3. INA219 레시피 카나리 (`wokwi/ina219-current`)

- [x] 레시피의 `wiring[]`과 동일한 4선 I2C 회로를 생성합니다.
- [x] 레시피 스케치가 INA219 CURRENT 레지스터를 반복해서 읽습니다.
- [x] 시나리오가 `shuntRaw`를 100에서 250으로 바꾸고 출력 변화를 검사합니다.
- [ ] 실제 GitHub Actions에서 신규 시나리오 성공을 확인합니다.

```powershell
npm run build:wokwi:chips
npm run build:wokwi
wokwi-cli wokwi/ina219-current --scenario scenario.test.yaml --timeout 10000
```

### 4-4. Phase 5 행동 검증 (`wokwi/phase5/*`, 28개 중 26개)

부팅 스모크는 `Serial.begin()` 직후 주입한 마커만 기다리므로 센서가 빠져 있어도
통과합니다. 행동 검증은 그 빈틈을 막습니다.

- [x] 학생이 받는 스케치를 **수정 없이** 실행합니다(마커 주입 없음).
- [x] 레시피마다 `src/wokwi/behaviorSpecs.ts`에 물리 상황의 순서(단계)를 적습니다. 예를 들어
      "물이 60 → 45 → 30°C로 식는다", "램프를 0.5 → 1 → 0.25 m로 옮긴다"처럼 적습니다.
      시나리오는 `set-control`·`delay`·`wait-serial`·`expect-pin`으로 그 상황을 만듭니다.
- [x] 기대값은 스케치가 아니라 `src/wokwi/sensorOracles.ts`의 데이터시트 변환식에서 나옵니다.
      Bosch BME280 보정식(데이터시트 예제 25.08 °C / 1006.53 hPa 재현), TSL2591 lux 식,
      INA219 션트 물리식, 그리고 레시피가 다루는 물리 법칙(V·I, d²·E 일정, cos θ, 기압 고도식)입니다.
- [x] wokwi-cli 표준출력에서 복원한 시리얼 로그의 **모든 행**을 `src/wokwi/serialBehavior.ts`가 판정합니다.
      헤더, 열 개수, `nan`·진단 메시지 없음, 샘플 간격, 단계 순서(역행 금지), 행 간 불변식을 봅니다.
- [x] 릴레이·LED·모터 핀은 `expect-pin`으로 확인합니다(팬 히스테리시스, 주차 경보 LED, 조명 최소 유지 시간).
- [ ] PIR 레시피 2개(S3, automatic-door)는 부팅 스모크로 남아 있습니다. 센서 안정화에 30초가
      필요해 시나리오 상한(20초)을 넘고, Wokwi PIR에는 문서화된 자동화 컨트롤이 없습니다.
- [x] 실제 GitHub Actions에서 26개 모두 통과: run `37566001857` (2026-10-07).

행동 검증이 처음 찾아낸 문제(모두 수정함):

| 문제 | 영향 |
| --- | --- |
| TSL2591 칩 모델에 ID 레지스터(0x12 = 0x50)가 없음 | Adafruit 라이브러리 `begin()` 실패, 조도 레시피 5개가 시뮬레이션에서 `nan` |
| INA219 칩 모델이 POWER를 상태 비트를 밀어내지 않은 버스 레지스터로 계산 | 전력이 실제 V·I의 8배 |
| 여러 DS18B20이 같은 ROM ID를 공유 | 다점 온도 레시피의 1-Wire 검색이 센서를 1개만 찾음 |
| 1-Wire 드라이버가 인터럽트를 켠 채 µs 타이밍을 만듦 | 측정 직전 시리얼 출력이 있으면 온도가 -0.06 °C로 읽힘(실물에서도 생길 수 있음) |

명세가 있는 레시피는 `npm run generate:wokwi:phase5`가 행동 시나리오를 생성하고,
`npm run test:wokwi:phase5`가 실행·판정합니다.

## 5. GitHub Actions L3 검증

- [x] `.github/workflows/verify-pr.yml`에 `workflow_dispatch`를 제공합니다.
- [x] `main` 대상 Pull Request에서 검증을 자동 실행합니다.
- [x] CI에서 Uno 펌웨어 2종과 커스텀 칩 WASM을 소스에서 다시 빌드합니다.
- [x] `WOKWI_CLI_TOKEN` secret으로 실제 Wokwi 시뮬레이션을 실행합니다.
- [x] 기존 두 프로젝트(pendulum 레시피 / 칩 적합성 리그)의 L3를 실행합니다.
- [x] 신규 INA219 레시피 프로젝트의 L3를 실제 Actions에서 실행합니다.
- [x] L1, 배선 넷리스트 게이트, 보안 규칙, L2, L5, 커스텀 칩 빌드, L3가 한 실행에서 모두 통과했습니다.

검증된 실행:

- 2026-07-27
- GitHub Actions run `30281813853`
- https://github.com/sehunYang/How_To_Use_Arduino/actions/runs/30281813853
- 전체 job 시간: 2분 18초
- 세 시나리오 모두 `Scenario completed successfully`

> 이전 기록(run `30238726360`)은 커스텀 칩이 pendulum 레시피 회로에 함께 배선되어 있던
> 분리 이전 구성의 결과이며, run `30255933543`은 INA219 레시피 카나리 추가 전
> 기록입니다. 위 실행이 세 시나리오 구성의 최신 검증 근거입니다.

## 6. PL5 월간 Wokwi 사용량

무료 한도는 월 50분이며 프로젝트 목표는 그 80%인 40분 이하입니다.

계획 2.4는 "대표 시나리오 1건 실측 → 예산 산출"을 요구합니다. 아래는 가정이 아니라
run `30281813853`의 `Starting simulation...`부터 `Scenario completed successfully`
까지 로그 타임스탬프에서 읽은 실측치입니다.

| 시나리오 | 실측 시뮬레이션 시간 |
| --- | ---: |
| pendulum 레시피 | 약 0.51초 |
| INA219 레시피 | 약 0.30초 |
| 칩 적합성 리그 | 약 0.29초 |
| **PR 1회 합계** | **약 1.1초** |

| 항목 | 실측 기반 | 타임아웃 최악 |
| --- | ---: | ---: |
| 실행 1회 | 1.1초 | 30초 (10초 × 3 시나리오) |
| 40분 목표 내 가능 실행 수 | 약 2,181회/월 | 80회/월 |

- [x] 시나리오당 벽시계 20초 상한(계획 제약)을 만족합니다. 타임아웃은 시나리오당 10초로
      설정되어 있고 실측은 1초 미만입니다.
- [x] 실측 기준 월 사용량이 40분 목표에 도달하려면 월 약 2,181회를 실행해야 하므로,
      현재 트리거(PR + 수동)로는 예산 초과가 사실상 불가능합니다.
- [x] 월 1회 전체 L3 schedule은 실측 약 1.1초/월이며, 일일 크론
      (`verify-daily.yml`)에는 L3를 넣지 않아 불필요한 Wokwi 시간을 방지합니다.
- [ ] Phase 5에서 레시피가 34건으로 늘면 시나리오 수에 비례해 재측정합니다.
      레시피당 약 1초라면 전량 1회가 약 34초이므로, 월 1회 전량 스윕을 추가해도
      예산에 영향이 없습니다.

### 6-1. 행동 검증 이후 (2026-10-07 재측정)

행동 시나리오는 물리 상황을 실제 시간만큼 흘려야 하므로 부팅 스모크보다 깁니다.
run `37566001857`의 프로젝트별 벽시계 시간 합은 약 244초이고, 연결 오버헤드(스모크 프로젝트 기준
약 2초 × 28)를 빼면 **PR 1회당 약 3분**입니다. 가장 긴 것은 rpm-meter(약 29초), plant-growth(약 21초),
fan-control(약 19초)입니다.

매번 전체를 돌리면 40분 목표 안에서 PR 실행이 월 약 12회로 제한됩니다. 그래서 다음처럼 나눕니다.

- [x] **PR**: 바뀐 레시피만 시뮬레이션합니다(`npm run test:wokwi:phase5 -- --changed-against origin/main`).
      판단 기준은 `src/wokwi/phase5Selection.ts`에 있습니다.
  - `wokwi/phase5/manifest.json`의 프로젝트별 `fingerprint`(스케치·회로·시나리오·행동 기대값의 해시)가
    base 브랜치와 다른 레시피, 또는 새로 생긴 레시피
  - 바뀐 커스텀 칩(`chips/<칩>.*`)을 쓰는 레시피
  - 판정기·오라클·생성기·러너·툴체인·워크플로(`PHASE5_GLOBAL_INPUTS`)가 바뀌면 전체
- [x] **월 1회 스케줄과 수동 실행**: 지금처럼 전체를 돌립니다(약 3분).
- 레시피 1개만 고친 PR은 대략 5–30초만 씁니다.

## 완료 기준

- [x] 계정, 토큰, CLI 설정 완료
- [x] Uno 펌웨어와 다이어그램 구성 완료
- [x] INA219/TSL2591 커스텀 칩 패키징 완료
- [x] 자동화 시나리오 3종 중 신규 INA219 레시피의 원격 실행 확인
- [x] 실제 GitHub Actions에서 세 L3 모두 성공
- [x] PL5 월간 사용량을 실측 기반으로 산출하고 40분 이하임을 확인
- [x] 레시피 회로가 `recipe.wiring[]`과 일치함을 넷리스트 게이트가 강제
