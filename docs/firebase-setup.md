# Firebase 프로젝트 수동 프로비저닝 체크리스트

이 문서는 How to use Arduino의 실제 Firebase/GCP 프로젝트 구성에 필요한 **사람이 직접 하는 단계만** 담고 있습니다. Phase 0.4/0.5에 해당하는 모든 수작업을 순서대로 나열했습니다.

## 1. Google 계정 선택 (선행 조건 — 가장 먼저)

- [ ] **학교 Workspace 계정 vs 개인 계정을 결정합니다.**
  - 학교 Workspace(Google Workspace for Education): 도메인 관리자가 결제/Blaze 업그레이드를 차단할 수 있습니다
  - 개인 계정(gmail.com 등): 소유자가 직접 제어 가능

- [ ] **이 단계가 가장 중요합니다.** 학교 계정을 선택했다면:
  - 도메인 관리자에게 **Blaze 플랜(종량제) 업그레이드 권한이 있는지 확인**합니다
  - 차단되어 있으면 **이 접근 방식 전체가 불가능**하며, 별도의 폴백 전략이 필요합니다 (현재 문서 범위 외)

---

## 2. Firebase 프로젝트 생성 및 Blaze 플랜 업그레이드

- [ ] [Firebase 콘솔](https://console.firebase.google.com)에서 새 프로젝트를 생성합니다
  - 프로젝트 이름: `how-to-use-arduino` (또는 선호하는 이름)
  - 기본 위치: 아시아-남동부 (asia-southeast1) 또는 아시아-동북동부 (asia-northeast3)

- [ ] 프로젝트 생성 직후 즉시 **Blaze(종량제) 플랜으로 업그레이드**합니다
  - Spark(무료) 플랜에서는 Firestore 예약 백업(8단계) 등 일부 기능이 제한됩니다
  - "업그레이드" 버튼을 찾아 결제 정보를 연결합니다

---

## 2.5 Firestore 데이터베이스 생성

> ⚠️ **이 단계가 문서에 빠져 있었습니다.** Firebase 프로젝트를 만든다고 Firestore 데이터베이스가 자동으로 생기지 않습니다 — 아래를 안 하면 8단계에서 "Databases" 페이지에 아무것도 안 보입니다.

- [ ] Firebase 콘솔 → 왼쪽 메뉴 **"Firestore Database"** → **"데이터베이스 만들기"**
- [ ] **모드: 네이티브 모드(Native mode)**를 선택합니다 (Datastore 모드 아님 — 이 프로젝트의 클라이언트 SDK·보안 규칙은 네이티브 모드 전용입니다)
- [ ] **위치**를 선택합니다. ⚠️ **한 번 정하면 이후 변경 불가**. `asia-northeast3`(서울) 권장 — 2단계의 프로젝트 기본 위치와 맞추면 좋습니다
- [ ] 보안 규칙 시작 모드는 "프로덕션 모드(잠금)"로 시작해도 됩니다 — 어차피 저장소의 `firestore.rules`를 곧 배포해서 덮어씁니다 (문서 맨 아래 "배포해야 할 보안 규칙" 절 참고)

---

## 3. 예산 알림 설정 ($1)

- [ ] GCP 콘솔([console.cloud.google.com](https://console.cloud.google.com))의 "결제 > 예산 및 알림"에서 새 예산을 생성합니다
  - 예산 액수: $1 USD
  - 알림 임계값: 100% (예산 금액에 도달하면 알림)

- [ ] ⚠️ **중요: GCP 예산 알림은 지출을 차단하지 않습니다.** 이것은 알림일 뿐이며 수 시간 지연될 수 있습니다.
  - 실제 지출 상한이 아니라 **모니터링 도구**일 뿐입니다
  - 비용 초과를 피하려면 App Check와 Firestore 보안 규칙(다음 단계들)이 실질적 방어선입니다
  - 긴급 시에는 수동으로 결제 방법을 제거하거나 프로젝트를 비활성화해야 합니다

---

## 4. Firebase 인증 설정 및 커스텀 클레임 발급

### 4.1 이메일/비밀번호 인증 활성화

- [ ] Firebase 콘솔의 "Authentication > Sign-in method"에서:
  - "이메일/비밀번호" 공급자를 **활성화**합니다
  - "이메일 링크 로그인" 옵션은 비활성화합니다 (필요 없음)

### 4.2 관리자 계정 생성

- [ ] "Users" 탭에서 "사용자 추가"를 클릭하여 **관리자용 계정 1개를 생성**합니다
  - 예: `admin@example.com` / 강력한 비밀번호
  - 이 계정은 `/admin` 페이지에서 레시피 저작에 사용됩니다

### 4.3 커스텀 클레임 발급 (로컬 Admin SDK 사용)

- [ ] 프로젝트 설정에서 **서비스 계정 키를 다운로드**합니다
  - "서비스 계정" 탭 → "새 키 생성" → JSON 형식
  - ⚠️ **이 키는 GitHub, CI, 또는 번들된 코드에 절대 저장하지 마세요**
  - 다운로드한 JSON 파일은 **로컬에서만 사용**하고 즉시 삭제합니다

- [ ] 로컬 환경에서 Node.js 스크립트를 실행하여 커스텀 클레임을 설정합니다 (1회만):
  ```javascript
  // 임시 스크립트: set-custom-claims.js
  const admin = require('firebase-admin');
  const serviceAccount = require('./path-to-downloaded-key.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const adminUid = 'UID_OF_YOUR_ADMIN_ACCOUNT'; // Firebase 콘솔에서 복사
  const ciUid = 'UID_OF_CI_ACCOUNT'; // 아래 단계에서 생성

  // 관리자 클레임 설정
  admin.auth().setCustomUserClaims(adminUid, { admin: true })
    .then(() => console.log(`Admin claim set for ${adminUid}`));

  // CI 아이덴티티 클레임 설정
  admin.auth().setCustomUserClaims(ciUid, { ci: true })
    .then(() => console.log(`CI claim set for ${ciUid}`));
  ```

- [ ] **CI 서비스 계정을 별도로 생성**합니다:
  - Firebase 콘솔의 "Users" 탭에서 자동화 전용 계정 1개 추가
  - 예: `ci-automation@example.com` / 복잡한 자동 생성 비밀번호
  - 이 계정은 오직 GitHub Actions의 자동화 검증 작업에만 사용됩니다
  - 위 스크립트에서 이 계정의 UID에 `ci: true` 클레임을 설정합니다

- [ ] ⚠️ **Admin SDK 서비스 계정 키를 GitHub Actions Secret에 저장하지 마세요.**
  - 그 키는 보안 규칙을 완전히 우회하며 모든 보안 방어를 무력화합니다
  - 대신 이메일/비밀번호 계정(위의 CI 계정)을 사용하여 로그인하고 클레임 검증에 의존합니다
  - 이것이 설계된 보안 경계의 핵심입니다

### 4.4 검증 큐 GitHub Actions 비밀값

- [ ] Firebase 콘솔의 `App Check > Apps`에서 웹 앱의 점 3개 메뉴를 열고
  `디버그 토큰 관리`에서 GitHub Actions 전용 디버그 토큰을 생성합니다.
  이 토큰은 CI Secret에만 저장하고 저장소나 로그에 기록하지 않습니다.
- [ ] GitHub 저장소의 `Settings > Secrets and variables > Actions`에 다음
  repository secret 6개를 등록합니다.
  - `FIREBASE_PROJECT_ID`: 실제 Firebase 프로젝트 ID
  - `FIREBASE_API_KEY`: Firebase 웹 앱의 API 키
  - `FIREBASE_APP_ID`: Firebase 웹 앱 설정의 앱 ID (`appId`)
  - `FIREBASE_CI_EMAIL`: 위에서 만든 CI 자동화 계정 이메일
  - `FIREBASE_CI_PASSWORD`: CI 자동화 계정 비밀번호
  - `FIREBASE_APPCHECK_DEBUG_TOKEN`: 위에서 만든 CI 전용 App Check 디버그 토큰
- [ ] Actions에서 **Verify Queue Drain** 워크플로를 한 번 수동 실행합니다.
- [ ] 실행 로그가 `verifyRequests queue drained successfully.`로 끝나는지 확인합니다.
- [ ] 첫 성공 후 `.github/workflows/verify-queue.yml`의 `on:` 아래에 다음
  15분 크론을 추가합니다.

  ```yaml
  schedule:
    - cron: '*/15 * * * *'
  ```

---

## 5. 인증 승인 도메인 추가

- [ ] Firebase 콘솔의 "Authentication > Settings"에서 "승인된 도메인" 섹션으로 이동합니다

- [ ] 다음 도메인을 추가합니다:
  - **커스텀 도메인을 연결한 경우** (예: `shy.ai.kr`): 실제 서빙되는 그 도메인을 추가합니다. 이것이 우선입니다
  - `<github-username-or-org>.github.io` (GitHub Pages 기본 도메인)도 함께 추가해 두면 안전합니다 — 커스텀 도메인은 이 주소로 리다이렉트되지만, 전환 중 잠깐이라도 접근될 가능성을 막아줍니다
  - ⚠️ 커스텀 도메인을 쓰는 경우 `.github/workflows/deploy.yml`의 `VITE_BASE_PATH`를 `/`로, `public/CNAME`에 도메인을 넣어야 합니다(둘 다 이 저장소에 이미 반영됨) — 그렇지 않으면 자산 경로가 `/<repo>/assets/...`로 잘못 잡혀 흰 화면이 뜹니다

- [ ] ⚠️ **이 단계를 건너뛰면 조용히 실패합니다.** 
  - 도메인이 승인되지 않으면 `/admin` 페이지의 로그인이 (유용한 오류 메시지 없이) 작동하지 않습니다
  - 학생 페이지는 정상이지만 관리자 기능이 완전히 차단됩니다

---

## 6. Cloud Storage 버킷 생성 및 CORS 설정

### 6.1 버킷 생성

- [ ] Firebase 콘솔의 "Storage"에서 새 버킷을 생성합니다
  - 버킷 이름: `<project-id>-wiring` (또는 선호하는 이름)
  - 기본 위치: 프로젝트와 동일한 지역
  - 액세스 제어: "공개" (나중에 규칙으로 제어)

### 6.2 CORS 설정

- [ ] 로컬에서 `cors.json` 파일을 생성합니다:
  ```json
  [
    {
      "origin": ["https://<github-username-or-org>.github.io"],
      "method": ["GET", "HEAD", "DELETE"],
      "responseHeader": ["Content-Type"],
      "maxAgeSeconds": 3600
    }
  ]
  ```
  - `<github-username-or-org>`를 실제 GitHub 사용자명 또는 조직명으로 교체합니다

- [ ] Google Cloud CLI를 사용하여 CORS를 적용합니다 (최신 방식):
  ```bash
  gcloud storage buckets update gs://<project-id>-wiring --cors-file=cors.json
  ```
  또는 레거시 gsutil:
  ```bash
  gsutil cors set cors.json gs://<project-id>-wiring
  ```

- [ ] ⚠️ **CORS가 설정되지 않으면** 브라우저에서 Storage의 배선도 이미지에 접근할 수 없습니다.
  - 이는 Firestore 쿼리는 성공하지만 이미지 렌더링이 CORS 오류로 실패하는 조용한 버그를 만듭니다

---

## 7. App Check 설정 (reCAPTCHA v3)

### 7.1 reCAPTCHA v3 등록

- [ ] [Google reCAPTCHA 관리 콘솔](https://www.google.com/recaptcha/admin)에서 새 사이트를 등록합니다
  - 레이블: `How to use Arduino`
  - reCAPTCHA 타입: **v3**
  - 도메인: `<github-username-or-org>.github.io`
  - 약관 동의 후 "만들기"

- [ ] **Site Key**와 **Secret Key**를 복사합니다
  - Site Key는 클라이언트 번들에 저장됩니다 (공개 정보)
  - Secret Key는 Firebase 콘솔에서만 사용됩니다

### 7.2 Firebase App Check 활성화

- [ ] Firebase 콘솔의 "App Check"에서:
  - "App Check 활성화"를 클릭합니다
  - reCAPTCHA v3 공급자를 추가하고 위의 Site Key와 Secret Key를 입력합니다
  - Firestore와 Cloud Storage 모두에 App Check를 **적용합니다**

### 7.3 Fail-Open 정책 (중요)

- [ ] ⚠️ **텔레메트리(이벤트) 쓰기는 fire-and-forget이며 학생 상호작용을 절대 블록하지 않습니다.**
  - reCAPTCHA는 광고 차단기, uBlock Origin, 학교 네트워크 필터에 의해 차단될 수 있습니다
  - App Check 토큰 획득이 실패해도 학생의 주요 기능(레시피 열기, 배선 보기, 코드 보기)이 멈추지 않아야 합니다
  - 이벤트/통계 수집이 실패하면 그냥 `catch` 블록에서 조용히 무시합니다
  - **이는 설계된 제약이며 선택사항이 아닙니다.**

---

## 8. Firestore 예약 백업 및 복원 훈련

> ⚠️ **이 절의 이전 버전은 Cloud Scheduler + Pub/Sub + Cloud Function을 조합하는 구식 방법을 안내하고 있었습니다.** 실제로 만들려면 함수 코드 작성, 배포, 서비스 계정 권한 부여까지 필요한 별도 프로젝트급 작업이라 여기 적힌 몇 줄로는 따라 할 수 없었습니다. Firestore가 **콘솔에서 클릭만으로 되는 예약 백업 기능**을 정식 제공하므로, 아래는 그 기능만 사용합니다. Cloud Scheduler, Pub/Sub, Cloud Functions 중 아무것도 만들 필요가 없습니다.

### 8.1 예약 백업 켜기 (콘솔 클릭만)

- [ ] [Google Cloud 콘솔의 Firestore "Databases" 페이지](https://console.cloud.google.com/firestore/databases)를 엽니다
- [ ] 프로젝트의 데이터베이스(보통 `(default)`)를 찾습니다. 그 행의 **"Scheduled backups"(예약 백업) 열**에서 **"Edit settings"**를 클릭합니다
- [ ] 빈도를 선택합니다:
  - **매일(Daily)** 권장 — 학기 중 매일 콘텐츠가 바뀔 수 있으므로
  - 매주(Weekly)를 원하면 요일도 선택
- [ ] **보존 기간(retention period)**을 설정합니다 (최대 14주)
  - 특별한 이유가 없으면 4주 정도면 충분합니다
- [ ] **저장(Save)**을 클릭하면 즉시 활성화됩니다

- [ ] ⚠️ 정확한 시각은 지정할 수 없습니다 — "매일" 백업은 날마다 다른 시각에 실행됩니다. 정상입니다.
- [ ] ⚠️ 이 기능은 **Blaze 플랜이 필요**합니다 (2단계에서 이미 업그레이드하셨으므로 추가 조치 불필요). 백업 저장 용량에 비례한 소액 비용이 발생합니다 — [가격 정책](https://firebase.google.com/pricing) 참고.

### 8.2 복원 훈련 (필수 — 한 번은 실행)

- [ ] ⚠️ **"백업을 받은 적이 없다면 그것은 백업이 아닙니다."**
  - **최소 1회는 실제로 복원해보고 성공을 기록합니다.** 클릭 몇 번이면 되니 미루지 마세요.

- [ ] 8.1에서 설정한 후 **최소 하루가 지나** 첫 백업이 하나 이상 생성된 뒤 진행합니다 (즉시 만들어지지 않습니다)
- [ ] 같은 "Databases" 페이지 → 예약 백업 화면으로 돌아갑니다
- [ ] "Backups" 표에서 아무 백업 항목이나 선택하고, **작업(Actions) 열의 점 3개(⋮) 메뉴**를 클릭합니다
- [ ] **"Restore with Cloud Shell"**을 선택합니다 — Cloud Shell이 열리고 복원 명령이 미리 채워져 있습니다
- [ ] 명령의 새 데이터베이스 이름 자리(placeholder)를 원하는 이름(예: `restore-test`)으로 바꾸고 실행합니다
  - ⚠️ 복원은 **완전히 새로운 데이터베이스**에 씁니다. 기존 운영 중인 데이터베이스를 덮어쓰지 않으니 안심하고 테스트하셔도 됩니다
- [ ] 복원이 끝나면 Firestore 콘솔에서 그 새 데이터베이스를 열어 데이터가 제대로 들어왔는지 확인합니다
- [ ] 확인이 끝나면 테스트용으로 만든 그 데이터베이스는 삭제해도 됩니다 (비용 방지)

- [ ] 복원 결과를 기록합니다:
  - 날짜, 사용한 백업 시점, 복원 성공 여부
  - 이 기록을 프로젝트 문서에 추가합니다 (예: `OPERATIONS.md`)

---

## 배포해야 할 보안 규칙 및 설정 파일

프로젝트가 생성되면 저장소의 다음 파일들을 배포합니다:

- [ ] `firestore.rules` — Firestore 보안 규칙
- [ ] `storage.rules` — Cloud Storage 보안 규칙 (**기본 버킷이 아니라 6단계에서 만든 `<project-id>-wiring` 버킷**에 적용됩니다)
- [ ] `firebase.json` — Firebase 프로젝트 설정 (이미 `storage` 항목이 named target(`wiring`)을 쓰도록 구성되어 있습니다)

### 최초 1회 — Storage target 등록

Storage 규칙을 기본 버킷이 아니라 이름 지정 버킷(`<project-id>-wiring`)에 배포하려면, **최초 1회** target을 등록해야 합니다 (등록 결과는 `.firebaserc`에 저장되고 저장소에 커밋됩니다 — 한 번만 하면 됩니다):

```bash
firebase target:apply storage wiring <project-id>-wiring --project <실제-프로젝트-id>
```

### 배포 명령

⚠️ `.firebaserc`의 기본 프로젝트는 로컬 에뮬레이터 전용 가짜 프로젝트(`*-test`)로 되어 있으므로, **실제 배포에는 반드시 `--project`를 명시**해야 합니다.

⚠️ Storage에 named target(`wiring`)을 등록한 뒤에는 `--only storage:rules`가 아니라 **`--only storage:<target이름>`**을 써야 합니다. `storage:rules`로 쓰면 "Could not find rules for the following storage targets: rules"라는 오해하기 쉬운 오류가 납니다 (`rules`를 target 이름으로 잘못 해석해서 나는 오류입니다).

```bash
firebase deploy --project <실제-프로젝트-id> --only firestore:rules,storage:wiring
```

성공하면 출력에 다음과 같이 나옵니다:
```
+ storage: released rules storage.rules to firebase.storage
+ firestore: released rules firestore.rules to cloud.firestore
+ Deploy complete!
```

**Phase 0 완료 조건:** 위 "released" 두 줄이 나오면 로컬 파일 그대로가 배포된 것입니다(CLI가 파일 바이트를 그대로 업로드하므로 별도 diff 불필요). 눈으로 한 번 더 확인하고 싶으면 Firebase 콘솔의 Firestore/Storage 각 "규칙" 탭에서 방금 배포한 내용이 보이는지 확인하세요.

---

## 체크리스트 완료 후

- [ ] 위의 8개 섹션을 모두 완료했습니다
- [ ] 모든 ⚠️ 경고를 읽고 이해했습니다
- [ ] 보안 규칙을 배포하고 드리프트를 확인했습니다
- [ ] Firestore 내보내기/복원 훈련을 최소 1회 실행했습니다

**이제 Phase 0이 완료되었습니다.** Phase 1 개발(데이터 모델, 검증기)로 진행할 수 있습니다.
