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

## 4. 대표 자동화 시나리오

- [x] `wokwi/pendulum.test.yaml`을 작성했습니다.
- [x] Arduino Uno가 INA219의 CURRENT 레지스터를 I2C로 읽습니다.
- [x] Arduino Uno가 TSL2591의 CH0 레지스터를 I2C로 읽습니다.
- [x] 초기값이 맞으면 `CUSTOM_CHIPS_OK`를 출력합니다.
- [x] 시나리오가 TSL2591의 `ch0Raw` 컨트롤을 2048로 변경합니다.
- [x] 펌웨어가 변경값을 읽어 `TSL_CH0=2048`을 출력하는지 확인합니다.

로컬 실행:

```powershell
wokwi-cli . --scenario wokwi/pendulum.test.yaml --timeout 10000
```

## 5. GitHub Actions L3 검증

- [x] `.github/workflows/verify-pr.yml`에 `workflow_dispatch`를 제공합니다.
- [x] `main` 대상 Pull Request에서 검증을 자동 실행합니다.
- [x] CI에서 Uno 펌웨어와 두 커스텀 칩 WASM을 다시 빌드합니다.
- [x] `WOKWI_CLI_TOKEN` secret으로 실제 Wokwi 시뮬레이션을 실행합니다.
- [x] L1, 보안 규칙, L2, L5, 커스텀 칩 빌드, L3가 한 실행에서 모두 통과했습니다.

검증된 실행:

- 2026-07-27
- GitHub Actions run `30238726360`
- https://github.com/sehunYang/How_To_Use_Arduino/actions/runs/30238726360
- 전체 job 시간: 2분 13초
- Wokwi 시뮬레이션 제한: 실행당 최대 10초

## 6. PL5 월간 Wokwi 사용량

무료 한도는 월 50분이며 프로젝트 목표는 그 80%인 40분 이하입니다.
아래 계산은 시나리오가 조기 성공하더라도 항상 10초를 모두 사용한다고 보는
보수적인 상한 계산입니다.

| 항목 | 상한 |
| --- | ---: |
| 시뮬레이션 1회 | 10초 |
| 월 PR/수동 실행 예산 | 200회 |
| 월 예상 사용량 | 2,000초 = 33분 20초 |
| 프로젝트 목표 | 40분 이하 |
| 무료 한도 | 50분 |

- [x] 200회/월까지 예상 사용량이 40분 이하입니다.
- [x] 현재 workflow에는 정기 schedule이 없어 불필요한 Wokwi 시간을 사용하지 않습니다.
- [x] 월 실행 수가 200회에 가까워지면 timeout 또는 실행 트리거를 재검토합니다.

## 완료 기준

- [x] 계정, 토큰, CLI 설정 완료
- [x] Uno 펌웨어와 다이어그램 구성 완료
- [x] INA219/TSL2591 커스텀 칩 패키징 완료
- [x] 대표 자동화 시나리오 완료
- [x] 실제 GitHub Actions L3 성공
- [x] PL5 월간 사용량이 40분 이하임을 확인

Wokwi 설정 체크리스트는 완료 상태입니다.
