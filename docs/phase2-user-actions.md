# Phase 2 사용자 작업 체크리스트

이 문서는 코드로 자동 처리할 수 없는 Firebase 권한, GitHub Secrets, 원격 Wokwi
검증 작업만 정리합니다.

## 1. 현재 변경사항 보존

- [ ] `git status`로 현재 수정·추가 파일을 확인합니다.
- [ ] 기존에 작업하던 Wokwi geometry 변경과 이번 Phase 2 변경을 함께 검토합니다.
- [x] 변경사항을 새 브랜치에 커밋하고 원격 저장소에 push합니다.
- [x] `main` 대상 Pull Request를 생성합니다.

현재 작업트리에는 기존 작업과 Phase 2 변경이 함께 있으므로, 파일을 삭제하거나
`git reset --hard`를 실행하면 안 됩니다.

## 2. Firebase CI 자동화 사용자 준비

Firebase Console의 `Authentication > Users`에서 자동화 전용 이메일/비밀번호
사용자를 만듭니다.

- [x] CI 자동화 사용자 생성
- [x] 로컬 Admin SDK를 이용해 해당 사용자에게 `ci: true` 커스텀 클레임 부여
- [x] Admin SDK 서비스 계정 JSON은 GitHub에 올리지 않고 사용 후 로컬에서 삭제

상세 절차는 [`firebase-setup.md`](firebase-setup.md)의 4.3절을 따릅니다.

## 3. GitHub Actions Secrets 등록

GitHub 저장소의 `Settings > Secrets and variables > Actions`에 다음 repository
secret을 등록합니다.

- [x] `FIREBASE_PROJECT_ID`
- [x] `FIREBASE_API_KEY`
- [x] `FIREBASE_APP_ID`
- [x] `FIREBASE_CI_EMAIL`
- [x] `FIREBASE_CI_PASSWORD`
- [x] `FIREBASE_APPCHECK_DEBUG_TOKEN`

`FIREBASE_APPCHECK_DEBUG_TOKEN`은 Firebase Console의
`App Check > Apps > 웹 앱 메뉴 > 디버그 토큰 관리`에서 CI 전용으로 생성합니다.
이 토큰은 App Check가 적용된 Firebase 서비스를 GitHub Actions에서 호출할 때만
사용하며, 저장소나 로그에 기록하지 않습니다.

기존 `WOKWI_CLI_TOKEN`도 그대로 존재하는지 확인합니다.

- [x] `WOKWI_CLI_TOKEN` 존재 확인

## 4. Phase 2 원격 검증

Pull Request가 생성되면 **PR Verification** 워크플로를 확인합니다.

- [x] L1 corpus/static checks 성공
- [x] L2 compile check 성공
- [x] L5 logic + chip-register harness 성공
- [x] `L3 Wokwi simulation — pendulum recipe` 성공
- [x] `L3 Wokwi simulation — INA219 recipe` 성공
- [x] `L3 Wokwi simulation — custom chip conformance rig` 성공

신규 INA219 시나리오 성공 전에는 `src/data/canary/simStatus.ts`의 상태를
`simPass: true`로 바꾸지 않습니다.

## 5. 게시 전 검증 큐 확인

GitHub Actions에서 **Verify Queue Drain** 워크플로를 수동 실행합니다.

- [x] 워크플로가 Firebase CI 사용자로 로그인함
- [x] 로그가 `verifyRequests queue drained successfully.`로 종료됨
- [ ] 테스트용 `verifyRequests/{recipeId}` 문서가 처리 후 삭제됨
- [ ] 대응하는 `simStatus/{recipeId}` 문서가 생성 또는 갱신됨

첫 수동 실행이 성공한 뒤 `.github/workflows/verify-queue.yml`에 15분 크론을
활성화합니다.

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: '*/15 * * * *'
```

## 6. 결과 전달

다음 두 URL을 Codex에 전달합니다.

- [x] PR Verification 성공 실행 URL:
      https://github.com/sehunYang/How_To_Use_Arduino/actions/runs/30281813853
- [x] Verify Queue Drain 성공 실행 URL:
      https://github.com/sehunYang/How_To_Use_Arduino/actions/runs/30281905800

URL을 전달하면 다음 후속 작업을 코드로 처리할 수 있습니다.

- INA219 카나리의 `simPass` 확정
- 실제 실행 시간을 이용한 PL5 월간 사용량 재계산
- Wokwi 설정 문서의 실행 ID와 실측값 갱신
- 검증 큐 15분 schedule 최종 활성화와 재검증

---

# OMX 오류 대응

## 관측된 오류

현재 Codex App은 outside-tmux 환경이며 Stop 훅이 stale-dead 세션 포인터를
반복 선택하고 있습니다.

실행된 사전검사:

```text
omx ralplan preflight --json
```

결과:

```json
{"ok":false,"reason":"unsupported_documented_leader_proof"}
```

이 결과는 설치 파일 손상보다 **현재 App 세션이 유효한 attached-tmux OMX 리더
세션을 증명하지 못하는 상태**를 가리킵니다.

## 권장 순서

OMX를 바로 삭제·재설치하지 않습니다. 재설치만으로 저장소의 stale 포인터나
실행 중이던 세션 상태가 정리된다는 보장이 없고, 정상 설정까지 잃을 수 있습니다.

1. 현재 Codex App 작업을 종료합니다.
2. attached-tmux가 제공되는 OMX CLI 터미널에서 저장소를 엽니다.
3. `omx doctor`를 실행하고 진단 결과를 보존합니다.
4. doctor가 설치 구성 문제를 보고할 때만 `omx setup`으로 구성요소를 복구합니다.
5. 복구 후 `omx ralplan preflight --json`이 `ok: true`인지 확인합니다.
6. 같은 stale 포인터가 계속 선택되면 진단 출력과 함께 OMX 세션 상태 복구를
   진행합니다. 포인터 파일을 추측해서 수동 삭제하지 않습니다.

## 재설치를 고려할 조건

다음 중 하나가 `omx doctor`에서 확인될 때만 재설치를 고려합니다.

- OMX 실행 파일 또는 설치 구성요소 누락
- 훅 설치 파일 손상
- 설치 버전 불일치
- `omx setup` 복구 실패

재설치 전에는 다음을 별도 위치에 백업합니다.

- 저장소의 `.omx/`
- 사용자 Codex 설정과 훅 구성
- 현재 `git status` 출력

단순히 `unsupported_documented_leader_proof`만 반복되는 경우에는 전체 재설치보다
attached-tmux 세션에서 포인터 증거를 복구하는 것이 우선입니다.
