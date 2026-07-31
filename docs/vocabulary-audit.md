# 사용자 노출 문구 어휘 검토 목록

- 작성일: 2026-07-31
- 상태: **검토 완료 — 승인된 범위를 실제 문구에 반영함**
- 범위: Phase 5·6 레시피 75개, 센서·구동 부품 설명, 배선·코드 안내, 학생 화면, 관리자 화면, 사용자 노출 오류 문구
- 제외: 개발자만 읽는 코드 주석, 테스트 이름, 내부 설계 문서의 필수 제품명·명령어

## 판단 기준

이 문서는 다음 표현을 후보로 모았습니다.

1. 고등학교 과학 교과서에서 바로 뜻을 파악하기 어렵고 별도 설명이 필요한 용어
2. 영어를 그대로 옮겼거나, 개발·전자공학 현장에서만 자주 쓰는 표현
3. 쉬운 우리말이 있는데도 사용된 외래어·명사형 표현
4. 표준 용어이지만 첫 등장 때 뜻을 풀어 써야 하는 약어와 장치 이름
5. 코드 내부 구조가 사용자 오류 문구에 그대로 노출된 표현

과학·전자공학의 표준 용어를 모두 없애는 것은 권장하지 않습니다. 필요한 표준 용어는 **쉬운 설명 → 괄호 안 표준 용어** 순서로 처음 한 번 소개하고, 이후에는 표준 용어를 사용하는 방식을 제안합니다.

> 이 목록은 저장소 문구를 기준으로 한 어휘 감사 결과입니다. 특정 출판사의 교과서 말뭉치와 대조한 결과는 아니므로, 최종 교체 여부는 교과 내용의 정확성과 수업 맥락을 함께 보고 결정해야 합니다.

## 적용 결정

- 1절의 우선 순화 권장 표현은 모두 적용했습니다.
- 2절에서는 `결정계수`, `불확도`, `자이로스코프`, `영점 오차`, `저역통과 필터`, `프로브`, `분해능`, `스펙트럼`을 유지하고 나머지를 쉬운 설명으로 바꿨습니다.
- 3절에서는 `같은 시간축`, `광환경`, `한 버스 최대 N개`, `시뮬레이션 검증됨`, `MM/MF/FF 점퍼선`, `학습 문서 트리`만 바꿨습니다.
- 4절의 관리자 화면과 오류 문구는 기존 상태를 유지했습니다.
- 5절의 부품명, 핀명, 통신 규격 등은 기존 상태를 유지했습니다.

## 1. 우선 순화 권장 표현

| 우선도 | 현재 표현 | 권장 표현 | 판단 이유 | 대표 위치 |
|:---:|---|---|---|---|
| 높음 | 폴링 | 값을 계속 반복해서 확인하는 방식(폴링) | 컴퓨터·임베디드 분야 용어 | `src/data/phase6/pinRecipes.ts:85` |
| 높음 | 논리 전위 | HIGH/LOW 전압 상태 | 교과 수준보다 추상적인 전자공학 표현 | `src/data/phase6/pinRecipes.ts:105` |
| 높음 | 교차상관 | 두 파형을 시간 방향으로 옮겨 가장 잘 겹치는 시간차 찾기 | 통계·신호처리 선수 지식 필요 | `src/data/phase6/pinRecipes.ts:108` |
| 높음 | 타임스탬프 | 발생 시각 기록 | 불필요한 외래어 | `src/data/phase6/pinRecipes.ts:126` |
| 높음 | 기준선을 제거 | 충돌 전 평균값을 모든 측정값에서 빼기 | 수행 방법이 불분명함 | `src/data/phase6/pinRecipes.ts:126` |
| 높음 | bypass 모드 | 보조 센서를 주 통신선에 직접 연결하는 모드(bypass) | 영문 모드명이 설명 없이 노출됨 | `src/data/phase6/pinRecipes.ts:143` |
| 높음 | master 모드 | MPU6050이 보조 통신선을 제어하는 모드(master) | 영문 모드명이 설명 없이 노출됨 | `src/data/phase6/pinRecipes.ts:143` |
| 높음 | active-low | LOW일 때 작동하는 방식(active-low) | 영문 전자공학 용어 | `src/data/phase6/pinRecipes.ts:162` |
| 높음 | 히트맵 | 색으로 값의 크기를 나타낸 분포도(히트맵) | 시각화 용어가 설명 없이 사용됨 | `src/data/phase6/pinRecipes.ts:187` |
| 높음 | 잔차 | 측정값과 예측값의 차이 | 통계 용어 | `src/data/phase6/physicsRecipes.ts:32` |
| 높음 | 포락선 | 진폭의 바깥 경계를 이은 선 | 신호처리 용어 | `src/data/phase6/physicsRecipes.ts:102` |
| 높음 | 온도구배 | 거리에 따른 온도 변화율 | 대학 수준에서 더 흔한 합성어 | `src/data/phase6/physicsRecipes.ts:138` |
| 높음 | 시간 드리프트 | 시간이 지나며 기준값이 서서히 변하는 현상 | 계측 분야 용어 | `src/data/phase6/physicsRecipes.ts:173` |
| 높음 | 열 드리프트 | 온도 변화 때문에 기준값이 서서히 변하는 현상 | 계측 분야 용어 | `src/data/phase6/physicsRecipes.ts:307` |
| 높음 | 암전값 | 빛을 완전히 막았을 때 센서가 나타내는 기준값 | 광학 계측 용어 | `src/data/phase6/physicsRecipes.ts:342` |
| 높음 | 검출 입체각 | 센서가 빛을 받아들이는 방향과 범위 | 대학 수준 광학 용어 | `src/data/phase6/physicsRecipes.ts:356` |
| 높음 | 구경 | 빛이 통과하는 구멍(구경) | 일상어와 의미가 달라 혼동 가능 | `src/data/phase6/physicsRecipes.ts:370` |
| 높음 | 상승 에지 | 신호가 LOW에서 HIGH로 바뀌는 순간 | 임베디드 용어 | `src/data/phase5/bioRoboticsProjects.ts:437` |
| 높음 | 에지 검출 | 신호가 기준을 넘는 순간 찾기 | 임베디드·영상처리 용어와 혼동 가능 | `src/data/phase5/bioRoboticsProjects.ts:622` |
| 높음 | 히스테리시스 | 켜는 기준과 끄는 기준을 다르게 두는 방식(히스테리시스) | 제어공학 용어 | `src/data/phase5/bioRoboticsProjects.ts:75` |
| 높음 | 채터링 | 릴레이가 빠르게 켜졌다 꺼지는 반복 동작 | 현장 전문 용어 | `src/data/phase5/bioRoboticsProjects.ts:463` |
| 높음 | 데드밴드 | 작은 차이에는 반응하지 않는 범위 | 제어공학 외래어 | `src/data/phase5/bioRoboticsProjects.ts:548` |
| 높음 | 양자화 오차 | 짧은 측정 시간 때문에 생기는 회전수 반올림 오차 | 현재 문맥에서는 구체 설명이 더 정확함 | `src/data/phase5/bioRoboticsProjects.ts:622` |
| 높음 | 공통모드 전압 | 센서 입력에 허용되는 전체 전압 범위 | 고급 전자공학 용어 | `src/data/phase5/sensorExamples.ts:495` |
| 높음 | 상호 보정 계수 | 센서끼리 비교해 구한 값 보정 비율 | 명사가 겹쳐 의미 파악이 어려움 | `src/data/phase5/e5.ts:35` |
| 높음 | 버스 정전용량 | 긴 배선에 저장되는 전하 때문에 생기는 통신 부담 | 고급 전자공학 용어 | `src/data/phase5/e6.ts:17` |
| 높음 | 축 오정렬 | 센서 축과 운동 방향이 어긋남 | 기계·계측 분야 용어 | `src/data/phase5/p5.ts:17` |
| 높음 | 비자성 자 | 자석에 붙지 않는 재질의 자 | 어색하고 순간적으로 뜻을 알기 어려움 | `src/data/phase5/p6.ts:16` |
| 높음 | 쌍극자 축 자기장 | 막대자석의 중심축 방향 자기장 | 대학 수준 압축 표현 | `src/data/phase5/p6.ts:17` |
| 높음 | 민감축 | 센서가 자기장에 가장 잘 반응하는 방향 | 센서 계측 용어 | `src/data/phase5/p6.ts:21` |
| 높음 | 등방성 점광원 | 모든 방향으로 똑같이 빛을 내는 매우 작은 광원 | 여러 개념을 압축한 대학 수준 표현 | `src/data/phase5/p8.ts:28` |
| 높음 | 상태 방정식을 탐구 | 온도·습도·기압의 관계를 탐구 | BME280 측정만으로 확인할 범위를 더 분명히 표현 | `src/data/canary/rationales.ts:27` |

## 2. 표준 용어를 남기되 첫 사용 때 풀이가 필요한 표현

| 현재 표현 | 첫 사용 권장 표현 | 이후 사용 | 대표 위치 |
|---|---|---|---|
| 결정계수 | 직선이 측정값을 얼마나 잘 설명하는지 나타내는 값($R^2$) | 결정계수 또는 $R^2$ | `src/data/phase6/physicsRecipes.ts:12` |
| 불확도 | 반복 측정값이 퍼진 범위(측정 불확도) | 불확도 | `src/data/phase6/physicsRecipes.ts:261` |
| 광자속밀도(PPFD) | 식물이 받는 빛의 입자 수를 나타내는 값(PPFD) | PPFD | `src/data/phase5/bioRoboticsProjects.ts:463` |
| 션트 저항 | 전류 측정용 작은 저항(션트 저항) | 션트 저항 | `src/data/sensorProfiles.ts:38` |
| 버스 전압 | 회로 쪽 전압(버스 전압) | 버스 전압 | `src/data/sensorProfiles.ts:36` |
| ADC 값 | 아날로그 전압을 숫자로 바꾼 값(ADC 값) | ADC 값 | `src/data/sensorProfiles.ts:122` |
| 원시값 | 센서가 읽은 가공 전 값(원시값) | 원시값 | `src/data/sensorProfiles.ts:51` |
| 적분 시간 | 빛을 모아 측정하는 시간(적분 시간) | 적분 시간 | `src/data/sensorProfiles.ts:54` |
| 레귤레이터 | 전압 조절 회로(레귤레이터) | 레귤레이터 | `src/data/sensorProfiles.ts:57` |
| 인터럽트 출력 | 조건이 맞으면 즉시 알림 신호를 내는 핀(INT) | INT 핀 | `src/data/sensorProfiles.ts:57` |
| 게인 | 신호 증폭 정도(게인) | 게인 | `src/data/sensorProfiles.ts:60` |
| 포화 | 측정 범위를 넘어 최댓값에 머무는 현상(포화) | 포화 | `src/data/sensorProfiles.ts:60` |
| 자이로스코프 | 회전 속도 센서(자이로스코프) | 자이로스코프 | `src/data/sensorProfiles.ts:65` |
| 영점 오차 | 움직이지 않을 때도 0이 아닌 값(영점 오차) | 영점 오차 | `src/data/sensorProfiles.ts:75` |
| 저역통과 필터 | 빠른 흔들림을 줄이는 필터(저역통과 필터) | 저역통과 필터 | `src/data/sensorProfiles.ts:75` |
| 풀업 저항 | 신호선을 기본 HIGH 상태로 유지하는 저항(풀업 저항) | 풀업 저항 | `src/data/sensorProfiles.ts:102` |
| 프로브 | 방수 센서의 금속 측정부(프로브) | 프로브 | `src/data/sensorProfiles.ts:102` |
| 멀티플렉서 | 여러 센서 연결 중 하나를 골라 주는 장치(멀티플렉서) | 멀티플렉서 | `src/data/sensorProfiles.ts:107` |
| 제어 바이트·채널 비트 | 사용할 채널을 고르는 8비트 제어값 | 채널 선택값 | `src/data/sensorProfiles.ts:108` |
| 버스 구간 분할 | I2C 배선 구간 나누기 | 배선 구간 나누기 | `src/data/sensorProfiles.ts:112` |
| 분압 접점 | 두 저항 사이의 전압 측정 지점 | 분압 지점 | `src/data/sensorProfiles.ts:125` |
| PIR | 인체 움직임 감지용 적외선 센서(PIR 센서) | PIR 센서 | `src/data/sensorProfiles.ts:135` |
| ECHO 펄스 폭 | ECHO 핀이 HIGH로 유지되는 시간 | ECHO 시간 | `src/data/sensorProfiles.ts:149` |
| 분해능 | 구별할 수 있는 가장 작은 거리(분해능) | 분해능 | `src/data/sensorProfiles.ts:152` |
| 스펙트럼 | 빛에 포함된 색과 파장의 분포(스펙트럼) | 스펙트럼 | `src/data/phase5/sensorExamples.ts:519` |
| 전압 강하 | 저항이나 부품을 지날 때 생기는 전압 차이(전압 강하) | 전압 강하 | `src/data/canary/rationales.ts:22` |

## 3. 쉬운 문장으로 바로 바꿀 수 있는 표현

| 현재 표현 | 권장 표현 | 대표 위치 |
|---|---|---|
| 비선형적으로 변화 | 일정한 비율로 변하지 않음 | `src/data/sensorProfiles.ts:126` |
| 원뿔형 영역 | 센서 앞쪽으로 퍼지는 감지 범위 | `src/data/sensorProfiles.ts:139` |
| 실측 | 직접 측정 | `src/data/sensorProfiles.ts:169` |
| 정량화 | 수치로 나타내기 | `src/data/phase5/rationales.ts:6` |
| 같은 시간축 | 같은 시간 기준 | `src/data/phase5/rationales.ts:5` |
| 광환경 | 주변 빛 조건 | `src/data/phase5/rationales.ts:23` |
| 데이터베이스 | 레시피 모음 / 센서 목록 | `src/pages/RecipeListPage.tsx:23` |
| 갤러리 모드 | 카드 보기 | `src/pages/RecipeListPage.tsx:25` |
| 테이블 모드 | 표 보기 | `src/pages/RecipeListPage.tsx:26` |
| 인터페이스 | 연결 방식 | `src/pages/SensorDetailPage.tsx:51` |
| 출력 인터페이스 | 출력 방식 | `src/pages/SensorListPage.tsx:48` |
| 구체적인 스펙 | 자세한 사양 | `src/pages/SensorDetailPage.tsx:59` |
| 한 버스 최대 N개 | 한 통신선에 최대 N개 | `src/pages/SensorDetailPage.tsx:18` |
| 고유 1-Wire 주소 | 센서마다 다른 1-Wire 번호 | `src/pages/SensorDetailPage.tsx:18` |
| 하프 브레드보드 | 반쪽 크기 브레드보드 | `src/components/wokwiParts.tsx:135` |
| 휠·핀치 | 마우스 휠·두 손가락으로 확대/축소 | `src/components/WiringIllustration.tsx:125` |
| 드래그 | 끌어서 이동 | `src/components/WiringIllustration.tsx:160` |
| 시뮬레이션 검증됨 | Wokwi에서 실행 확인됨 | `src/components/ui/SimBadge.tsx:18` |
| 미검증 | 아직 실행 확인 안 됨 | `src/components/ui/SimBadge.tsx:20` |
| 클립보드에 복사되었습니다 | 복사되었습니다 | `src/components/ui/CodeBlock.tsx:55` |
| 레이아웃 | 화면 구성 | `src/pages/RecipeDetailPage.tsx:192` |
| MM/MF/FF 점퍼선 | 수-수(MM)/수-암(MF)/암-암(FF) 점퍼선 | `src/pages/RecipeDetailPage.tsx:37` |
| 학습 문서 트리 | 학습 메뉴 | `src/components/AppShell.tsx:51` |

## 4. 관리자 화면과 오류 문구

관리자에게는 일부 기술 용어가 필요하지만, 현재는 내부 코드 이름이 그대로 노출되는 경우가 있어 작업 의미를 바로 이해하기 어렵습니다.

| 현재 표현 | 권장 표현 | 대표 위치 |
|---|---|---|
| 대시보드 | 학습 현황 | `src/pages/AdminDashboardPage.tsx:11` |
| 단계별 중도 이탈 | 단계별로 그만둔 학생 수 | `src/pages/AdminDashboardPage.tsx:29` |
| 집계된 | 모아진 / 기록된 | `src/pages/AdminDashboardPage.tsx:53` |
| 검색 인덱스 재생성 | 검색 목록 새로 만들기 | `src/pages/AdminRecipeListPage.tsx:28` |
| 저작 검증 | 작성 내용 검사 | `src/firebase/adminRepository.ts:36` |
| 기기 검증 | 실제 기기 작동 확인 | `src/pages/AdminRecipeEditorPage.tsx:238` |
| 고정 식별자 | 바꾸지 않는 주소용 ID | `src/pages/AdminRecipeEditorPage.tsx:277` |
| 통신 속도(baud) | 직렬 통신 속도(bps) | `src/pages/AdminRecipeEditorPage.tsx:307` |
| 조정값 | 바꿔볼 값 | `src/pages/AdminRecipeEditorPage.tsx:349` |
| 코드 기준점 | 코드에서 찾을 문구 | `src/pages/AdminRecipeEditorPage.tsx:366` |
| sensor-example | 센서 예제 | `src/validation/corpusCheck.ts:53` |
| SensorRationale.whyText | 센서 활용 이유 | `src/validation/corpusCheck.ts:78` |
| 보유 인벤토리 | 등록된 부품 목록 | `src/validation/staticCheck.ts:151` |
| 액추에이터 | 구동 장치 | `src/validation/staticCheck.ts:156` |
| wiring[] | 배선 단계 | `src/validation/staticCheck.ts:173` |
| focus 영역 | 강조 표시 영역 | `src/validation/staticCheck.ts:194` |
| 매니페스트 | 코드 설정 정보 | `src/validation/staticCheck.ts:256` |
| 튜너블 | 바꿔볼 값 | `src/validation/staticCheck.ts:340` |
| 5MiB | 5MB | `src/firebase/adminRepository.ts:385` |

문장 틀의 `센서 X이(가)`, `핀 X이(가)`처럼 조사가 코드 형태로 노출되는 표현은 `X 센서가`, `X 핀이`처럼 문장 구조를 바꾸는 것이 자연스럽습니다. 대표 위치는 `src/validation/staticCheck.ts:71`, `src/validation/staticCheck.ts:124`입니다.

## 5. 유지해야 하는 명칭

다음은 순화해서 없애기보다 정확한 설명을 붙여 유지해야 합니다.

- 부품명: INA219, TSL2591, MPU6050, BME280, DS18B20, TCA9548A, HC-SR04, HC-SR501, HBE0704
- 핀명: VCC, GND, SDA, SCL, VIN+, VIN−, INT, TRIG, ECHO 등
- 통신 규격: I2C, 1-Wire, PWM, ADC
- 단위: V, mA, mW, °C, hPa, lux, µs, Hz
- 코드에서 실제로 사용해야 하는 상수·함수·레지스터 이름

권장 표기 예시는 `아날로그 전압을 숫자로 바꾸는 장치(ADC)`, `초음파를 보내기 시작하는 TRIG 핀`, `반사파가 돌아온 시간을 나타내는 ECHO 핀`입니다.

## 6. 검토 후 적용 순서 제안

1. 학생 레시피의 **높음** 항목부터 순화합니다.
2. 센서 상세 화면에서 약어와 표준 용어의 첫 사용 설명을 통일합니다.
3. 버튼·도움말·배지의 외래어를 쉬운 동작 표현으로 바꿉니다.
4. 관리자 오류 문구에서 내부 필드명과 배열 표기를 제거합니다.
5. 변경 후 과학적 의미, 핀 이름, 코드 복사 내용이 달라지지 않았는지 회귀 검사합니다.

## 근거와 한계

- **직접 확인:** 위 표현과 위치는 현재 저장소의 사용자 노출 문자열에서 확인했습니다.
- **판단:** “교과서에서 바로 이해하기 어려움”과 우선도는 표현의 전문성, 약어 설명 여부, 문장 문맥을 바탕으로 분류했습니다.
- **한계:** 출판사별 고등학교 과학 교과서 전체와의 자동 대조는 수행하지 않았습니다. 따라서 표준 과학 용어 자체를 삭제하기보다, 첫 사용 때 쉬운 풀이를 병기하는 방향을 기본안으로 삼았습니다.
