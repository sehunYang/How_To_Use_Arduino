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

## 4. 자동화 시나리오 — 프로젝트 3개

레시피 회로와 칩 검증 리그는 **분리된 Wokwi 프로젝트**입니다. 레시피의 `diagram.json`은
`recipe.wiring[]`이 선언한 회로와 정확히 일치해야 하므로(`src/wokwi/netlist.ts` 게이트),
레시피가 쓰지도 않는 조도계·전류계를 회로에 끼워 넣을 수 없기 때문입니다.

### 4-1. pendulum 레시피 (루트 프로젝트)

- [x] `wokwi/pendulum.test.yaml`
- [x] MPU6050이 연결되어 `MPU6050_OK`를 출력하는지 확인합니다.
- [x] 회로는 MPU6050 4선을 Uno에 직결 — 레시피 배선 스텝과 동일합니다.

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
따라서 **`npm run build:wokwi:chips`를 `npm run build:wokwi`보다 먼저** 실행해야
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

## 5. GitHub Actions L3 검증

- [x] `.github/workflows/verify-pr.yml`에 `workflow_dispatch`를 제공합니다.
- [x] `main` 대상 Pull Request에서 검증을 자동 실행합니다.
- [x] CI에서 Uno 펌웨어 2종과 커스텀 칩 WASM을 소스에서 다시 빌드합니다.
- [x] `WOKWI_CLI_TOKEN` secret으로 실제 Wokwi 시뮬레이션을 실행합니다.
- [x] 기존 두 프로젝트(pendulum 레시피 / 칩 적합성 리그)의 L3를 실행합니다.
- [ ] 신규 INA219 레시피 프로젝트의 L3를 실제 Actions에서 실행합니다.
- [x] L1, 배선 넷리스트 게이트, 보안 규칙, L2, L5, 커스텀 칩 빌드, L3가 한 실행에서 모두 통과했습니다.

검증된 실행:

- 2026-07-27
- GitHub Actions run `30255933543`
- https://github.com/sehunYang/How_To_Use_Arduino/actions/runs/30255933543
- 전체 job 시간: 2분 11초
- 두 시나리오 모두 `Scenario completed successfully`

> 이전 기록(run `30238726360`)은 커스텀 칩이 pendulum 레시피 회로에 함께 배선되어 있던
> 분리 이전 구성의 결과입니다. 위 실행이 분리 이후 구성의 검증 근거입니다.

## 6. PL5 월간 Wokwi 사용량

무료 한도는 월 50분이며 프로젝트 목표는 그 80%인 40분 이하입니다.

계획 2.4는 "대표 시나리오 1건 실측 → 예산 산출"을 요구합니다. 아래는 가정이 아니라
run `30255933543`의 로그에서 읽은 **실측치**입니다.

| 시나리오 | 실측 시뮬레이션 시간 |
| --- | ---: |
| pendulum 레시피 | 0.86초 |
| 칩 적합성 리그 | 0.33초 |
| **PR 1회 합계** | **약 1.2초** |

INA219 레시피 시나리오는 로컬 코드·펌웨어 검증까지 완료했지만 아직 원격 Wokwi
실측 전입니다. 첫 성공 실행 후 이 표와 월 예상치를 3개 시나리오 기준으로 갱신합니다.

| 항목 | 실측 기반 | 타임아웃 최악 |
| --- | ---: | ---: |
| 실행 1회 | 1.2초 | 20초 (10초 × 2 시나리오) |
| 40분 목표 내 가능 실행 수 | **약 2,000회/월** | 120회/월 |

- [x] **시나리오당 벽시계 20초 상한**(계획 제약)을 만족합니다 — 타임아웃은 시나리오당 10초로
      설정되어 있고 실측은 1초 미만입니다.
- [x] 실측 기준 월 사용량이 40분 목표에 도달하려면 월 2,000회를 실행해야 하므로,
      현재 트리거(PR + 수동)로는 예산 초과가 사실상 불가능합니다.
- [x] 현재 workflow에는 정기 schedule이 없어 불필요한 Wokwi 시간을 사용하지 않습니다.
      일일 크론(`verify-daily.yml`)에 L3를 넣지 않는 이유가 이것입니다.
- [ ] Phase 5에서 레시피가 34건으로 늘면 시나리오 수에 비례해 재측정합니다.
      레시피당 약 1초라면 전량 1회가 약 34초이므로, 월 1회 전량 스윕을 추가해도
      예산에 영향이 없습니다.

## 완료 기준

- [x] 계정, 토큰, CLI 설정 완료
- [x] Uno 펌웨어와 다이어그램 구성 완료
- [x] INA219/TSL2591 커스텀 칩 패키징 완료
- [ ] 자동화 시나리오 3종 중 신규 INA219 레시피의 원격 실행 확인
- [ ] 실제 GitHub Actions에서 세 L3 모두 성공
- [x] PL5 월간 사용량을 **실측 기반으로** 산출하고 40분 이하임을 확인
- [x] 레시피 회로가 `recipe.wiring[]`과 일치함을 넷리스트 게이트가 강제

신규 INA219 레시피 시나리오의 첫 원격 성공과 실측 갱신이 남아 있습니다.
