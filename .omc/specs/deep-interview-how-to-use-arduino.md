# Deep Interview Spec: How to use Arduino

## Metadata
- Interview ID: `arduino-guide-2026-07-26`
- Rounds: 23 (Round 0 토폴로지 + 23 스코어링 라운드)
- Final Ambiguity Score: **4.9%**
- Type: greenfield
- Generated: 2026-07-26
- Threshold: **0.05** (사용자 명시 지시)
- Threshold Source: **user explicit override** — settings.json에 `omc.deepInterview.ambiguityThreshold` 미설정이므로 기본값 `0.2`(source: `default`)가 해석되었으나, "모호도 5% 미만이 될 때까지 반복" 지시가 우선 적용됨
- Initial Context Summarized: no
- Status: **PASSED**

---

## Clarity Breakdown

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.956 | 0.40 | 0.382 |
| Constraint Clarity | 0.949 | 0.30 | 0.285 |
| Success Criteria Clarity | 0.945 | 0.30 | 0.284 |
| **Total Clarity** | | | **0.951** |
| **Ambiguity** | | | **0.049** |

Greenfield 가중치 적용 (Goal 40% / Constraints 30% / Criteria 30%).
컴포넌트별 점수는 `0.5 × min + 0.5 × mean` 으로 집계 — 한 컴포넌트가 명확해져도 형제 컴포넌트의 모호함을 가리지 못하도록 함.

---

## Topology

Round 0에서 확정된 7개 최상위 컴포넌트. 보류(deferred) 없음.

| # | Component | Status | Description | Coverage |
|---|-----------|--------|-------------|----------|
| 1 | 의도 정제 퍼널 | active | 학생의 자유 서술을 비생성형으로 레시피에 연결 | `A1.1`~`A1.5` |
| 2 | 센서 추천 | active | 매칭 결과에서 필요 센서를 근거와 함께 제시 | `A2.1`~`A2.3` |
| 3 | 센서 대표 예제 | active | 센서 10종 단독 사용법 + 완성 코드 | `A3.1`~`A3.9` |
| 4 | 프로젝트 레시피 | active | 프로젝트 24건의 배선·코드·응용 | `A4.1`~`A4.3` |
| 5 | 배선 단계 뷰어 | active | 완성 이미지 + 포커스 오버레이 단계 안내 | `A5.1`~`A5.9` |
| 6 | 콘텐츠 데이터 모델 & 저작 | active | Firestore 스키마 + `/admin` 저작 UI | `A6.1`~`A6.6` |
| 7 | Notion풍 디자인 시스템 | active | 시각 스타일 + 사이드바 트리 + 블록 + DB 뷰 | `A7.1`~`A7.6` |

> **인수 조건 총계: 44건** (G 3 + A1 5 + A2 3 + A3 9 + A4 3 + A5 9 + A6 6 + A7 6). 아래 Acceptance Criteria 절이 정본이다.

---

## Goal

**아두이노를 전혀 모르는 중·고등학생이, 하고 싶은 탐구 주제 하나만 들고 들어와서, 생성형 AI 없이 사전 저작된 콘텐츠만으로 센서 선정 → 센서 사용법 습득 → 프로젝트 배선·코드까지 완주할 수 있는 Notion 스타일 가이드 사이트.**

학생은 **QR로 접속한 휴대폰을 가이드북처럼 들고** 배선을 따라하고, 코드는 아두이노 IDE가 있는 PC에서 복사한다.

핵심 사용자 흐름:

```
자유 문장 입력  ("진자 운동에서 에너지가 보존되는지 알고 싶어요")
      ↓  동의어 사전 스코어링 → (미달 시) Fuse.js 퍼지 폴백
결과 화면       상단: 필요한 센서 + 왜 이 센서인가
                하단: 관련 프로젝트 갤러리
      ↓  (양방향 진입 가능)
센서 대표 예제  단독 사용법 · 완성 코드 · 바꿀 값 안내
      ↓
프로젝트 레시피 배선 단계 뷰어 → 코드 → 응용 가이드 → 문제해결
      ↓
진도 저장(localStorage) · 익명 이탈 이벤트 전송 → 교사 대시보드 → 콘텐츠 개선
```

---

## Constraints

### 제품 원칙
- **생성형 AI 금지.** 모든 답변은 사전 저작된 콘텐츠와 결정론적 규칙에서만 나온다.
- **학생은 코드를 직접 작성하지 않는다.** 완성된 스케치를 제공하고, 바꿔야 할 값은 위치·의미·변경 방법을 명시한다.
- **주석은 "이 줄이 무엇을 하는지" 수준만.** 코드를 가리지 않는다.
- **빈 결과 화면 금지.** 어떤 입력에도 최소 2~3건의 관련 레시피가 나와야 한다.
- **보유하지 않은 센서·액추에이터는 어떤 경로로도 등장하지 않는다.**

### 하드웨어
- **보드: Arduino Uno R3 단일 기준, 5V.** 보드 선택 UI 없음, 전압 경고 불필요, I2C는 `A4`(SDA)/`A5`(SCL) 고정.
- 감수하는 제약: SRAM 2KB(장기 로깅 불가 → 측정값은 시리얼로 PC 전송), WiFi 없음.
- 보유 센서 10종:

  | 센서 | 인터페이스 | 주소 | 비고 |
  |---|---|---|---|
  | INA219 | I2C | 0x40·0x41·0x44·0x45 (A0/A1 납땜 점퍼) | 멀티플렉서 없이 4개까지 |
  | TSL2591 | I2C | **0x29 고정, 변경 불가** (0x28 동시 점유) | 2개 이상 → TCA9548A 필수 |
  | BME280 | I2C | 0x76·0x77 (SDO) | 최대 2개 |
  | MPU6050 | I2C | 0x68·0x69 (AD0) | 최대 2개 |
  | TCA9548A | I2C | 0x70~0x77 | **주소 고정 센서 다중 연결용** |
  | DS18B20 | 1-Wire | 64bit ROM ID | 한 핀에 다수 연결 가능 |
  | HBE0704 | **아날로그** (`A0`~`A5`) | — | 홀 센서, OH49E/SS49E 호환. 자기장 세기 + 극성 |
  | CDS 조도센서 | 아날로그 | — | |
  | HC-SR501 | 디지털 | — | PIR 인체 감지 |
  | HC-SR04 | 디지털 (Trig/Echo) | — | 초음파 거리 |

- 보유 액추에이터 4계열: 수동부품(LED·부저·저항) / 모터·구동계(DC·서보·스텝·드라이버) / 스위칭(릴레이·팬) / 디스플레이(LCD·OLED)
- **센서·액추에이터 추가 여지를 반드시 남긴다** (→ `A6.1`)

### 기술
- **배포: GitHub Pages** (정적 파일 전용, 서버 없음)
- **프론트엔드: Vite + React + TypeScript**
- **스타일: Tailwind CSS + shadcn/ui** (디자인 토큰 강제)
- **라우팅: React Router + `404.html` 폴백** (GitHub Pages는 리라이트 규칙 없음 → `index.html`을 `404.html`로 복사해 클린 URL 유지)
- **본문 렌더링: react-markdown + remark-directive + remark-gfm + rehype-sanitize**
- **검색: 자체 동의어 사전 스코어러(1차) + Fuse.js(2차)** — 전부 클라이언트
- **백엔드: Firebase BaaS** (브라우저 SDK 직접 접근)
  - Firestore — 레시피, 센서 예제, 익명 이벤트
  - Firebase Auth — 관리자 1계정
  - Cloud Storage — 배선 이미지 (**Blaze 요금제 필수**: 2024-10-30부터 신규 버킷, 2026-02-03부터 기존 포함 결제 계정 연결 필요. 무료 한도 10GB/360MB일 내에서는 $0)
- **필수 설정 3가지**
  1. Firebase Auth 승인 도메인에 `<계정>.github.io` 등록 (누락 시 관리자 로그인 불가)
  2. Cloud Storage 버킷 CORS에 GitHub Pages 오리진 허용 (누락 시 배선 이미지 미표시)
  3. **Firestore 보안 규칙이 유일한 방어선** — 웹 API 키는 번들에 노출됨(설계상 공개 정보). `recipes` 읽기 공개/쓰기 관리자 UID 한정, `events` 쓰기만 허용·읽기 차단

### 콘텐츠
- **v1 범위: 34건** — 센서 대표 예제 10건 + 프로젝트 레시피 24건 (물리 8 / 화학·환경 6 / 생물 4 / 공학·로봇 6)
- **배선 이미지: 레시피당 Fritzing 다이어그램 1장 + 스텝별 포커스 영역 좌표.** 실물 사진 미사용
- **논리적 배선 데이터 병기 필수** (`from`/`to`/`color`) — v1에서는 검증용, 향후 SVG 렌더러 전환 시 무손실 마이그레이션 경로
- **본문: 확장 마크다운 문자열** (Firestore `body` 필드, 런타임 렌더링). MDX 미사용
- **문장 톤: 중·고등학생 공통 2층 서술** — 본문은 수식 없이 중학생 수준, 수식·오차분석·심화는 전부 토글 블록
- **언어: 한국어 전용**
- **기기 우선순위: 모바일 우선** (기준폭 360px), 데스크톱은 2단 확장

---

## Non-Goals

- LLM·생성형 AI를 통한 답변 생성 (명시적 금지)
- 학생 계정·로그인·개인정보 수집 → 학교 심의·보호자 동의 불필요
- 교사가 학생 **개인별** 진도를 조회하는 기능 (익명 집계만)
- 다국어 지원
- 서버 렌더링 / 백엔드 API 서버 (GitHub Pages 제약)
- **34건 전량 실물 하드웨어 검증** (시뮬레이션·정적·컴파일 검증으로 대체)
- 사이트 내 실물 사진
- 브라우저 내 코드 편집기 / 아두이노 업로드 기능

### v2 이월 목록
- TCA9548A 커스텀 Wokwi 칩 (남은 미검증 2건 해소)
- SVG 배선 렌더러 전환 (Option B) — 레시피 45~60건 돌파 시 손익분기
- 진도 코드 내보내기/불러오기 (공용 PC·기기 간 이전)
- 학생용 브라우저 시뮬레이션 (커스텀 칩 자산 재활용)
- 저작 UI 블록 에디터화

---

## Acceptance Criteria

### 전역
- [ ] `G1` 학생이 3단계까지 진행 후 브라우저를 닫았다 다시 열면 "이어서 하기"로 복원된다
- [ ] `G2` 익명 이벤트 전송 페이로드에 이름·학번·이메일 등 식별자가 **0건** 포함된다
- [ ] `G3` 대시보드가 레시피별 시작 수 / 완주 수 / 이탈 단계를 표시한다

### 1. 의도 정제 퍼널
- [ ] `A1.1` 사전 작성한 테스트 문장 **30개 중 25개(83%) 이상**이 관련 레시피를 상위 3위 안에 반환한다
- [ ] `A1.2` 매칭 0건인 입력에서도 **반드시** 유사 레시피 2~3개 + 응용 가이드가 표시된다 (빈 화면 금지)
- [ ] `A1.3` 검색 결과가 1.5초 이내 표시된다
- [ ] `A1.4` 사전 매칭으로 성공한 결과는 **매칭 근거**(어떤 키워드가 걸렸는지)를 표시한다
- [ ] `A1.5` 퍼지 폴백으로 나온 결과는 "정확히 맞는 건 없지만 이건 어떤가요?"로 구분 표시되고, 실패 문장이 **정규화된 토큰 배열로만**(원문 미저장) 익명 로그에 기록된다 *(개정 확정, 아래 Amendment Log 참조)*

### 2. 센서 추천
- [ ] `A2.1` 결과 상단에 매칭된 레시피들의 센서가 중복 제거되어 집계 표시된다
- [ ] `A2.2` 표시된 모든 센서에 "왜 이 센서인가" 문장이 존재한다 (빈 값 0건)
- [ ] `A2.3` 보유하지 않은 센서는 어떤 경로로도 추천되지 않는다

### 3. 센서 대표 예제
- [ ] `A3.1` 보유 센서 10종 전부에 대표 예제가 존재한다
- [ ] `A3.2` **34/34 `arduino-cli` 컴파일 검증** (CI 자동, Uno R3 타깃)
- [ ] `A3.3` 학생이 바꿀 값(`TunableParam`)은 코드에서 시각적으로 강조되고, **어느 줄의 무엇을 어떻게 바꾸는지** 문장이 붙는다
- [ ] `A3.4` 주석은 "이 줄이 무엇을 하는지" 수준으로만 달리고, 코드를 가리지 않는다
- [ ] `A3.5` **34/34 정적 검증** — 핀 중복 사용 · I2C 주소 충돌 · 미보유 부품 · 존재하지 않는 핀 이름
- [ ] `A3.6` **34/34 로직 단위 테스트** — 계산식(에너지·평균·임계값)을 센서 모킹으로 호스트에서 검증. **계산 로직이 없는 레시피도 pass-through 단언으로 하네스를 둔다** (34/34 범위 확정, 아래 Amendment Log 참조)
- [ ] `A3.7` **32/34 Wokwi 시뮬레이션 검증** — `wokwi-cli` 시나리오로 시리얼 출력 단언
- [ ] `A3.8` 시뮬 검증된 레시피에 "시뮬레이션 검증됨" 배지가 표시된다
- [ ] `A3.9` 시뮬레이션이 원리적으로 못 잡는 항목(**I2C 주소 변형 `0x76`/`0x77`, 풀업 저항, 전원 용량, 접촉 불량**)은 레시피마다 **문제해결 섹션**으로 대응한다

### 4. 프로젝트 레시피
- [ ] `A4.1` 24건 존재, 과목 배분(물리 8 / 화학·환경 6 / 생물 4 / 공학·로봇 6)을 충족한다
- [ ] `A4.2` 모든 레시피의 `sensors[]`·`actuators[]`가 보유 인벤토리 안에 있다 (빌드 타임 검증)
- [ ] `A4.3` 모든 레시피에 "이렇게 바꿔 응용하세요" 섹션이 존재한다

### 5. 배선 단계 뷰어
- [ ] `A5.1` 완성 이미지가 스텝 목록보다 **먼저** 나온다
- [ ] `A5.2` 데스크톱에서 좌측 이미지(sticky) / 우측 단계 목록, 스텝 선택 시 해당 영역이 강조된다
- [ ] `A5.3` 34건 전부 배선 스텝 1개 이상, 각 스텝에 `from`·`to`·`color`·`focus`·`text`가 모두 채워져 있다
- [ ] `A5.4` 빌드 타임 검증기가 핀 중복 사용 · I2C 주소 충돌 · 존재하지 않는 핀 이름을 전부 잡는다 (의도적 오류 주입 테스트 통과)
- [ ] `A5.5` 모바일에서 이미지 상단 sticky / 단계 목록 아래 스크롤로 전환된다
- [ ] `A5.6` 배선 이미지 핀치 줌 · 더블탭 확대를 지원한다
- [ ] `A5.7` 스텝 이동·체크 컨트롤이 모바일 화면 하단 엄지 영역에 위치한다
- [ ] `A5.8` **체크박스 상호작용이 모바일·데스크톱에서 동일하게 동작한다** — ① 완료 표시 ② 다음 단계 승격 ③ 이미지 강조 영역 이동 ④ 부드러운 스크롤 ⑤ localStorage 진도 갱신 ⑥ 익명 이벤트 전송. 체크 해제 시 되돌아간다
- [ ] `A5.9` 마지막 단계 체크 시 "배선 완료 → 이제 코드" 안내와 `PC에서 이 페이지 열기` 수단이 표시된다

### 6. 콘텐츠 데이터 모델 & 저작
- [ ] `A6.1` **신규 센서 1종을 코드 수정 없이 데이터 추가만으로 등록**할 수 있다 (실제로 1종 추가해 증명)
- [ ] `A6.2` `/admin`에서 레시피 1건을 저작 → 저장 → 사이트 반영까지 **코드 편집기 없이** 완료된다 (재배포 불필요)
- [ ] `A6.3` 스키마 위반 데이터는 저장 시점에 거부되고 무엇이 잘못됐는지 알려준다
- [ ] `A6.4` 인증 없이 `/admin` 및 쓰기 API 접근 시 차단된다 (Firestore 보안 규칙 테스트)
- [ ] `A6.5` 렌더러는 원시 HTML을 실행하지 않고 정의된 블록만 그린다 (스크립트 주입 테스트 통과)
- [ ] `A6.6` 저작 UI에 블록 문법 삽입 버튼(콜아웃·토글·코드·체크리스트)이 제공된다

### 7. Notion풍 디자인 시스템
- [ ] `A7.1` 토글 · 콜아웃 · 코드블록(복사 버튼) · 체크리스트 4종이 모두 동작한다
- [ ] `A7.2` 좌측 사이드바 트리가 접힘/펼침되고 현재 위치를 표시한다
- [ ] `A7.3` 레시피 목록이 갤러리/테이블 뷰로 전환되고 과목·난이도·센서로 필터·정렬된다
- [ ] `A7.4` 색상·간격·타이포가 토큰으로 정의되고 하드코딩 값이 없다
- [ ] `A7.5` 라이트/다크 모드 모두 대비비 WCAG AA를 충족한다
- [ ] `A7.6` **360px~1920px** 전 구간에서 가로 스크롤이 없다

---

## v1 콘텐츠 목록 (확정 34건)

### 센서 대표 예제 10건

| ID | 센서 | 예제 | 시뮬(L3) |
|---|---|---|---|
| `S1` | MPU6050 | 기울기와 흔들림 읽기 | ✅ 네이티브 |
| `S2` | HC-SR04 | 초음파로 거리 재기 | ✅ 네이티브 |
| `S3` | HC-SR501 | 사람이 지나가면 감지하기 | ✅ 네이티브 |
| `S4` | CDS | 밝기를 아날로그로 재기 | ✅ 네이티브 |
| `S5` | DS18B20 | 물의 온도 재기 | ✅ 네이티브 |
| `S6` | BME280 | 온도·습도·기압 한 번에 읽기 | ✅ 커뮤니티 칩 |
| `S7` | INA219 | 전압·전류·전력 측정하기 | ✅ 자체 커스텀 칩 |
| `S8` | TSL2591 | 밝기를 정밀하게 재기 | ✅ 자체 커스텀 칩 |
| `S9` | TCA9548A + TSL2591×2 | 주소가 같은 센서 여러 개 연결하기 | ❌ 미지원 |
| `S10` | HBE0704 | 자기장 세기와 극성 읽기 | ✅ 가변저항 대역 |

### 프로젝트 레시피 24건

**물리 8**

| ID | 제목 | 부품 |
|---|---|---|
| `P1` | 단진자의 주기 측정하기 | MPU6050 |
| `P2` | 역학적 에너지 보존 확인하기 | MPU6050 |
| `P3` | 자유낙하 가속도 g 구하기 | HC-SR04 |
| `P4` | 마찰에 의한 에너지 손실 측정 | MPU6050 + HC-SR04 |
| `P5` | 경사면에서의 가속도 | MPU6050 |
| `P6` | 자석의 거리에 따른 자기장 감쇠 | HBE0704 |
| `P7` | 태양광 패널 각도별 효율 | INA219 + TSL2591 |
| `P8` | 거리에 따른 빛의 세기 (역제곱 법칙) | TSL2591 + HC-SR04 |

> `P7`의 응용 섹션에 INA219 다중 연결을 안내: *"패널 3장을 동시에 비교하려면 A0·A1 점퍼를 납땜해 주소를 다르게 하거나, 납땜이 어려우면 TCA9548A를 쓰세요."*

**화학·환경 6**

| ID | 제목 | 부품 |
|---|---|---|
| `E1` | 온습도에 따른 자동 환풍기 제어 | BME280 + 릴레이 + 팬 |
| `E2` | 발열·흡열 반응의 온도 변화 기록 | DS18B20 |
| `E3` | 물의 냉각 곡선 (뉴턴 냉각법칙) | DS18B20 |
| `E4` | 기압 변화로 날씨 관측 | BME280 |
| `E5` | 위치별 광량 분포 측정 | TCA9548A + TSL2591×3 |
| `E6` | 여러 지점 온도 동시 측정 | DS18B20 다중 (1-Wire) |

**생물 4**

| ID | 제목 | 부품 |
|---|---|---|
| `B1` | 식물 생장 환경 기록기 | TSL2591 + BME280 |
| `B2` | 야행성 활동 감지 | HC-SR501 + CDS |
| `B3` | 광합성 조건 탐구 (조도 제어) | TSL2591 + 릴레이 + LED |
| `B4` | 사람의 활동량 측정 | MPU6050 |

**공학·로봇 6**

| ID | 제목 | 부품 |
|---|---|---|
| `R1` | 장애물 회피 자율주행 자동차 | HC-SR04 + MPU6050 + 모터드라이버 |
| `R2` | 빛을 따라가는 자동차 | CDS×2 + DC모터 |
| `R3` | 자동 개폐 문 | HC-SR501 + 서보 |
| `R4` | 주차 보조 거리 경보기 | HC-SR04 + 부저 + LED |
| `R5` | 바퀴 회전수(RPM) 측정기 | HBE0704 + 자석 |
| `R6` | 스마트 조명 | HC-SR501 + CDS + 릴레이 |

**검증 결과**
- ✅ 보유 센서 10종 전부가 최소 1건 이상의 프로젝트에서 사용됨
- ✅ 보유 액추에이터 4계열 전부 사용
- ✅ 시뮬레이션 커버리지 **32/34 (94%)** — 미커버는 TCA9548A 의존 `S9`·`E5` 2건
- ❌ 장비 부재로 제외된 주제: 공기질(가스센서), 소리(마이크), 라인트레이서(적외선 라인센서), 수질(pH·EC)

---

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|---|---|---|
| 학생 요구는 위저드/카테고리로 좁힌다 | "첫 30초에 실제로 무엇을 클릭하는가?" | **자유 문장 입력 + 규칙 기반 키워드 매칭** |
| 레시피는 조합 가능한 블록으로 쪼갠다 | "매칭 실패는 예외가 아니라 정상 경로다" | **레시피 = 프로젝트 통짜 단위**, 폴백은 유사 레시피 + 응용 가이드 |
| Wokwi로 단계 이미지를 공짜로 뽑는다 | 공개 렌더링 경로 없음 + 학교 센서 50% 미지원 | Wokwi는 이미지 생산에서 **탈락**, 검증 용도로 재등장 |
| 레시피가 많아야 좋은 사이트다 | "100개 있는데 아무도 완주 못 하는 사이트 vs 3개인데 반드시 완주하는 사이트" | 교과 커버(34건) 채택 + **측정 가능한 합격선**(매칭률 83%) 확보 |
| "Notion 같은"은 시각 스타일이다 | Notion은 독립적 특징 4개의 묶음 | **4요소 전부 채택** → 7번이 UI 엔진으로 승격 |
| 센서 추천은 별도 엔진이 필요하다 | "레시피에 센서가 이미 있는데 왜 별도 알고리즘?" | **알고리즘 삭제.** 추천 = 매칭된 레시피의 `sensors[]` 집계 |
| 보유 장비는 센서 10종이다 | 출력 장치 0건인데 환풍기·자율주행 레시피 12건 | 액추에이터 4계열 전부 보유 확인, `actuators[]` 필드 신설 |
| 사이트는 읽는 문서다 | "체크박스를 켜면 무슨 일이 일어나는가?" | **기억하는 절차** — localStorage 진도, 완주 측정 가능 |
| 정적 배포로 충분하다 | 저작 UI는 파일을 쓸 수 없다 | 백엔드 도입(Firebase), 단 **학생 쪽 개인정보 0 유지** |
| YAML + MDX 파일로 저작한다 | Firestore 런타임 저작과 MDX 빌드타임 컴파일은 양립 불가 | **확장 마크다운 문자열**, MDX 폐기 |
| 실물 검증이 최선이다 | 시간 부담 + 검증 산출물 재활용 가정 | 실물 검증 **철회** → 계층적 시뮬/정적/컴파일 검증 |
| 데스크톱 우선이다 | QR로 폰을 가이드북처럼 들고 배선한다 | **모바일 우선 역전**, 좌/우 배치는 데스크톱 확장으로 격하 |
| TCA9548A는 INA219 다중 연결용이다 | INA219는 A0/A1 점퍼로 4주소, TSL2591은 0x29 고정 | 멀티플렉서의 실제 필수 용처는 **TSL2591**, `S9`·`E5` 재작성 |

---

## Technical Context

### 데이터 모델 (Firestore)

```
recipes/{recipeId}
  type          : "sensor-example" | "project"
  title         : string
  subject       : "물리" | "화학·환경" | "생물" | "공학·로봇" | null
  difficulty    : "초급" | "중급" | "고급"
  minutes       : number
  board         : "uno-r3"
  sensors       : string[]      // 인벤토리 참조, 빌드 타임 검증
  actuators     : string[]      // 인벤토리 참조, 빌드 타임 검증
  keywords      : { core: string[], synonyms: Record<string, string[]> }
  imageUrl      : string        // Cloud Storage. 저장소 교체 가능하도록 추상화
  wiring        : WiringStep[]
  sketch        : string        // .ino 소스
  tunables      : TunableParam[]
  body          : string        // 확장 마크다운
  applicationGuide : string
  troubleshooting  : TroubleshootingItem[]
  simVerified   : boolean
  updatedAt     : timestamp

WiringStep
  from   : string   // "MPU6050.VCC"
  to     : string   // "UNO.5V"
  color  : string   // "red"
  focus  : { x, y, w, h }
  text   : string

TunableParam
  line   : number
  name   : string
  hint   : string

sensors/{sensorId}
  name, interface, addresses[], pins[], notes, exampleRecipeId

events/{autoId}          // 쓰기만 허용, 읽기 차단
  anonId, recipeId, step, event, at
```

### 검증 파이프라인

| 층 | 도구 | 커버리지 |
|---|---|---|
| L1 정적 | 자체 검증기 (핀 충돌·주소 중복·미보유 부품) | 34/34 |
| L2 컴파일 | `arduino-cli` (CI, Uno R3 타깃) | 34/34 |
| L3 시뮬레이션 | `wokwi-cli` + 시나리오 파일 (시리얼 출력 단언) | 32/34 |
| L5 로직 단위 테스트 | 센서 모킹 + 호스트 네이티브 컴파일 | 34/34 |

Wokwi CI 무료 50분/월 · Hobby 200분/월. 커스텀 칩 3종 필요: **INA219 · TSL2591**(자체 제작), **BME280**(커뮤니티 `bonnyr/wokwi-bme280-custom-chip` 활용). 아날로그 센서(HBE0704·CDS)는 `wokwi-potentiometer`를 아날로그 소스 대역으로 사용.

### 사이트맵

```
/                        홈 (자유 입력 검색)
/search?q=               검색 결과 (상단 센서 + 하단 레시피 갤러리)
/sensors                 센서 목록
/sensors/:id             센서 상세 = 대표 예제
/recipes                 레시피 목록 (갤러리 / 테이블 뷰 + 필터·정렬)
/recipes/:id             레시피 상세 (#step-n 앵커 지원)
/admin                   로그인 → 레시피 편집 · 이탈 대시보드
```

### 알려진 실행 작업 항목
- Fritzing에 파트가 없는 모듈(HBE0704 등) → 파트 직접 제작 또는 근사 모듈 대체
- 테스트 문장 30개 세트 작성 (`A1.1`의 판정 기준 자체)
- 동의어 사전 초기 구축 (레시피 34건 × 핵심어 3~5개 × 동의어 5~7개)
- Firebase Blaze 전환 + 예산 상한·알림 설정

---

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|---|---|---|---|
| Student | 외부 행위자 | anonId | Progress를 가짐, AnonEvent를 발생 |
| Intent | 핵심 도메인 | rawText | Keyword로 분해됨 |
| Keyword | 핵심 도메인 | core, synonyms | Recipe에 속함 |
| SynonymDictionary | 지원 | entries | Intent와 Recipe를 연결 |
| SimilarityScore | 지원 | value, matchedKeywords | Intent×Recipe |
| Recipe | **핵심 도메인** | 위 스키마 참조 | Sensor·Actuator·WiringStep·Sketch를 가짐 |
| SensorExample | 핵심 도메인 | Recipe의 `type` 변형 | Sensor 1:1 |
| Sensor | 핵심 도메인 | name, interface, addresses | Recipe에 다수 등장 |
| SensorRationale | 지원 | sensor, whyText | Sensor×Subject 맥락 |
| Actuator | 핵심 도메인 | name, category | Recipe에 다수 등장 |
| Board | 지원 | uno-r3 (고정) | 전역 |
| HardwareInventory | 지원 | sensors[], actuators[] | 빌드 타임 검증 기준 |
| WiringStep | **핵심 도메인** | from, to, color, focus, text | Recipe가 다수 소유 |
| WiringConnection | 지원 | from, to | 핀 충돌 검사 대상 |
| FocusRegion | 지원 | x, y, w, h | WiringStep 1:1 |
| Sketch | 핵심 도메인 | source (.ino) | Recipe 1:1 |
| TunableParam | 핵심 도메인 | line, name, hint | Sketch가 다수 소유 |
| ApplicationGuide | 지원 | text | Recipe 1:1 |
| TroubleshootingItem | 지원 | symptom, cause, fix | Recipe가 다수 소유 |
| Subject | 지원 | 물리/화학·환경/생물/공학·로봇 | Recipe 분류 |
| Progress | **핵심 도메인** | recipeId, stepIndex, completedAt | Student 로컬 |
| StepCompletion | 지원 | stepIndex, checked | Progress가 다수 소유 |
| AnonEvent | 핵심 도메인 | anonId, recipeId, step, event | 서버 기록 |
| DropoutStat | 파생 | recipeId, started, completed, dropStep | AnonEvent 집계 |
| Author | 외부 행위자 | uid | Recipe를 저작 |
| AdminAccount | 지원 | uid, email | Firebase Auth |
| RecipeDraft | 지원 | Recipe의 미저장 상태 | 저작 UI |
| NavTree | UI | nodes[] | 사이드바 |
| Block | UI | type: toggle/callout/code/checklist | body 파싱 산출 |
| DatabaseView | UI | gallery/table + filters | Recipe 목록 |
| SimulationScenario | 지원 | steps, expectSerial | Recipe 0:1 |
| AcceptanceCriterion | 메타 | id, text, verified | 전 컴포넌트 |

---

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability |
|---|---|---|---|---|---|
| 1 | 10 | 10 | – | – | N/A |
| 2 | 11 | 2 | 1 | 9 | 82% |
| 3 | 13 | 2 | 0 | 11 | 85% |
| 4 | 14 | 1 | 0 | 13 | 93% |
| 5 | 17 | 3 | 0 | 14 | 82% |
| 6 | 18 | 1 | 0 | 17 | 94% |
| 7 | 20 | 2 | 0 | 18 | 90% |
| 8 | 21 | 1 | 0 | 20 | 95% |
| 9 | 23 | 2 | 0 | 21 | 91% |
| 10 | 25 | 2 | 0 | 23 | 92% |
| 11 | 26 | 1 | 0 | 25 | 96% |
| 12 | 28 | 2 | 0 | 26 | 93% |
| 14 | 29 | 1 | 0 | 28 | 97% |
| 17 | 30 | 1 | 0 | 29 | 97% |
| 21 | 32 | 2 | 0 | 30 | 94% |
| 23 | 33 | 1 | 0 | 32 | **97%** |

엔티티 안정도가 R11 이후 90%대에서 유지되며, 후반 라운드의 신규 엔티티는 전부 기존 개념의 파생(`DropoutStat`, `SimulationScenario`, `TroubleshootingItem`)입니다. 도메인 모델이 수렴했습니다.

---

## Interview Transcript

<details>
<summary>전체 Q&A (Round 0 + 23 라운드)</summary>

### Round 0 — 토폴로지 확정
**Q:** 6개 최상위 컴포넌트 구성이 맞습니까?
**A:** 디자인 시스템을 7번으로 분리
**결과:** 7개 컴포넌트 확정, 보류 0

### Round 1 | 1.의도정제 | Goal
**Q:** 학생이 진입 후 요구를 정제하는 주된 메커니즘은?
**A:** 자유 입력 + 키워드 매칭
**Ambiguity:** 80.5% (G 0.30 / C 0.15 / S 0.10)

### Round 2 | 4.레시피 | Constraints
**Q:** 레시피 완전 매칭 실패 시 폴백 전략은?
**A:** 가장 가까운 레시피 + 응용 가이드
**Ambiguity:** 77.4%

### Round 3 | 5.배선뷰어 | Constraints
**Q:** 배선 다이어그램 이미지를 실제로 누가, 어떤 도구로 만듭니까?
**A:** (분석 요청 후) E안 — 완성 이미지 1장 + 포커스 오버레이, 향후 B안(SVG 렌더러) 전환 여지
**Ambiguity:** 72.5%

### Round 4 | 전역 | Success Criteria | 🔥 CONTRARIAN
**Q:** v1을 공개할 수 있다고 판단하는 기준(범위 + 성공 지표)은?
**A:** 교과 영역 커버 34건, 자유입력 테스트 문장 30개 중 25개 매칭
**Ambiguity:** 67.5%

### Round 5 | 7.디자인 | Constraints
**Q:** "Notion 같은 디자인"의 요소를 모두 고르면?
**A:** 4요소 전부 (시각 스타일 + 사이드바 트리 + 블록 + DB 뷰)
**Ambiguity:** 56.8%

### Round 6 | 2.센서추천 | Goal | 🔥 SIMPLIFIER
**Q:** 검색 직후 결과 화면은 무엇을 보여주고 어디로 보냅니까?
**A:** 센서 및 레시피 나란히 (하이브리드)
**Ambiguity:** 48.6%

### Round 7 | 4·6 | Constraints
**Q:** 보유 중인 출력·구동 장치는?
**A:** 4계열 전부 보유
**Ambiguity:** 47.5%

### Round 8 | 5·6 | Constraints
**Q:** v1 34건의 기준 보드는?
**A:** Arduino Uno R3 단일
**Ambiguity:** 45.1%

### Round 9 | 전역 | Success Criteria | 🔥 ONTOLOGIST
**Q:** 다음날 다시 열었을 때 사이트는 무엇을 기억하고 있어야 합니까?
**A:** 이 기기에서의 진도 (localStorage)
**Ambiguity:** 35.7% (정체 탈출)

### Round 10 | 6.콘텐츠모델 | Goal
**Q:** 레시피 1건 추가 시 저작자가 만드는 산출물은?
**A:** 관리자용 저작 UI를 사이트 안에 만들기
**Ambiguity:** 36.3% (↑ — 신규 제품 추가 + R9와 충돌 발생)

### Round 11 | 6.콘텐츠모델 | Constraints
**Q:** 저작 UI에서 [저장]을 누르면 무슨 일이 일어납니까?
**A:** 백엔드를 추가합니다 (R9 결정 변경)
**Ambiguity:** 34.7%

### Round 12 | 6·전역 | Constraints
**Q:** 백엔드가 담당하는 범위는?
**A:** 관리자 + 익명 통계 대시보드 / Firebase
**Ambiguity:** 32.4%

### Round 13 | 5·6 | Constraints
**Q:** 배선 이미지의 저장소는?
**A:** Blaze 전환 + Cloud Storage
**Ambiguity:** 31.4%

### Round 14 | 전 컴포넌트 | Success Criteria
**Q:** 인수 조건 27건을 승인하시면서 코드 검증 수준을 고르면?
**A:** 엄격 — 34건 전량 실물 검증 *(→ R17에서 철회)*
**Ambiguity:** 17.8%

### Round 15 | 5.배선뷰어 | Goal/Constraints
**Q:** 실물 사진 비용이 0이 된 지금 배선 이미지 전략은?
**A:** 실물 사진은 일절 사용하지 않음 — 다이어그램만 (R3 유지)
**Ambiguity:** 17.3%

### Round 16 | 1.의도정제 | Constraints
**Q:** 한국어 자유 입력을 레시피에 연결하는 방식은?
**A:** 사전 + 퍼지 하이브리드
**Ambiguity:** 23.4% (↑ — 실물 검증 철회 반영)

### Round 17 | 3·4 | Success Criteria
**Q:** 하드웨어 없는 검증을 어느 층까지 v1에 넣습니까?
**A:** L1+L2+L3+L5 *(→ R21에서 커스텀 칩도 v1로 승격)*
**Ambiguity:** 16.3%

### Round 18 | 6·7 | Goal/Constraints
**Q:** Firestore에 저장되는 레시피 본문의 형식은?
**A:** 확장 마크다운 문자열 (런타임 렌더링)
**Ambiguity:** 12.4%

### Round 19 | 7·전역 | Constraints
**Q:** 프론트엔드 프레임워크와 배포 방식은?
**A:** 배포는 GitHub Pages, 프론트엔드는 위임 → Vite + React + TS 확정
**Ambiguity:** 10.0%

### Round 20 | 전역 | 잔여 일괄
**Q:** 잔여 항목 승인 + 대상 학년과 문장 톤은?
**A:** 중·고등학생 공통 · 2층 서술
**Ambiguity:** 6.4%

### Round 21 | 3·4 | 콘텐츠 목록
**Q:** 34건 목록 초안을 승인하시겠습니까? (HBE0704 정체 포함)
**A:** INA219·TSL2591 커스텀 칩을 v1로 / TCA9548A는 INA219용(정정) / HBE0704 = 홀 센서
**+ 사용자 추가 지시:** 모바일 우선 (QR 스캔 → 가이드북)
**Ambiguity:** 10.0% (↑ — 모바일 우선이 5·7번을 재개방)

### Round 22 | 5.배선뷰어 | 상호작용
**Q:** 폰을 들고 배선하는 학생에게 단계를 어떤 모양으로 보여줍니까?
**A:** 상단 고정 이미지 + 스크롤, **체크박스를 누르면 자동으로 다음 단계로 전환**, 데스크톱도 동일 로직
**Ambiguity:** 5.9%

### Round 23 | 3·4 | 최종 목록
**Q:** 정정 2건(S9·E5를 TSL2591 기반으로)을 반영해 34건을 최종 확정합니까?
**A:** 확정 — 명세서 작성 시작
**Ambiguity:** **4.9%** ✅ 기준 달성

</details>

---

## 출처

- [Wokwi Parts Catalog](https://docs.wokwi.com/parts/wokwi-arduino-uno)
- [Wokwi Supported Hardware](https://docs.wokwi.com/getting-started/supported-hardware)
- [Wokwi Custom Chips API](https://docs.wokwi.com/chips-api/getting-started)
- [Wokwi diagram.json Format](https://docs.wokwi.com/diagram-format)
- [Wokwi CI Getting Started](https://docs.wokwi.com/wokwi-ci/getting-started)
- [bonnyr/wokwi-bme280-custom-chip](https://github.com/bonnyr/wokwi-bme280-custom-chip)
- [Firebase Pricing](https://firebase.google.com/pricing)
- [Cloud Storage for Firebase — billing changes (Sept 2024)](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)
- [Adafruit INA219 — Assembly & Addressing](https://learn.adafruit.com/adafruit-ina219-current-sensor-breakout/assembly)
- [Adafruit TSL2591 — Pinouts](https://learn.adafruit.com/adafruit-tsl2591/pinouts)

---

---

## Amendment Log (post-consensus, 2026-07-26)

omc-plan --consensus --direct 합의 검토(Architect·Critic 3회전) 과정에서 계획이 명세서에 요청한 개정 3건. 사용자가 전건 승인, **개발 착수 전 확정**.

| # | 개정 대상 | 확정 내용 |
|---|---|---|
| 1 | `A3.6` 범위 | **34/34 유지.** 계산 로직이 없는 레시피(예: PIR 감지 후 출력)도 pass-through 단언으로 하네스를 둔다. 예외 목록을 관리하지 않는다 |
| 2 | `A1.5` 저장 형태 | **정규화 토큰 배열만 저장, 원문 미저장.** 학생 자유 입력 원문이 서버에 남거나 교사 대시보드에 노출되는 경로를 원천 차단 |
| 3 | 데이터 모델 개정 6건 + 홀드아웃 임계치 | **전건 승인** — 아래 표 |

**개정 3의 세부 내역 (구현 계획 Revision 3.1 기준):**

| 항목 | 변경 |
|---|---|
| `simVerified` | `recipes` 필드 → `simStatus/{recipeId}` 컬렉션으로 이관 (CI 전용 쓰기) |
| `keywords:{core,synonyms}` | → `Recipe.coreKeywords` + 전역 `meta/synonyms` 문서 |
| `TunableParam.line` | → `TunableParam.anchor` (마커 문자열, 줄 번호 아님) |
| 레시피 저작 상태 | `status: draft\|published` + `versions` 서브컬렉션 신설 |
| 사람 검토 플래그 | `reviewedOnDevice`·`commentReviewed`를 `{at, verifyHash}` 객체로 신설 — 편집 시 자동 만료 |
| 관리자 판정 방식 | `uid == ADMIN_UID` → 커스텀 클레임 `token.admin` |
| **홀드아웃 임계치 (신규 게이트, `A1.1` 상향)** | 테스트 문장 홀드아웃 15개 중 **73%(11/15) 이상**이 출시 직전 1회 측정에서 통과해야 한다 |

이 로그 이후 위 항목들은 "제안"이 아니라 **확정된 인수 조건**으로 취급한다. 구현 세부는 `.omc/plans/how-to-use-arduino-implementation.md` (Revision 3.1)를 따른다.

---

**Status: `pending approval`** — 실행은 별도의 명시적 승인이 있어야 진행됩니다. (2026-07-26 기준: 개정 3건 확정 완료, 개발 착수 승인은 아직 없음)
