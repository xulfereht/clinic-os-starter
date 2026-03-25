---
hq_slug: github-setup-guide
hq_title: "GitHub 연동 가이드"
hq_category: "01. 시작하기"
hq_sort: 4
hq_active: true
---
# GitHub 연동 가이드

GitHub을 연결하면 코드가 클라우드에 안전하게 백업되어, 컴퓨터 고장이나 실수로 파일을 지워도 복구할 수 있습니다.
다른 컴퓨터에서 이어서 작업하는 것도 가능해집니다.

> **소프트게이트 Gate 1** — 코드 수정을 시작하기 전에 권장됩니다.

---

## 1. GitHub 계정 만들기

이미 계정이 있다면 [2단계](#2-저장소-만들기)로 건너뛰세요.

1. [github.com/signup](https://github.com/signup) 접속
2. 이메일, 비밀번호, 사용자명 입력
3. **무료 플랜(Free)** 선택 — 비공개 저장소 무제한 포함

> 비용은 없습니다. 무료 플랜으로 충분합니다.

---

## 2. 저장소 만들기

1. GitHub 로그인 후 우측 상단 **+** > **New repository** 클릭
2. 설정:
   - **Repository name**: `clinic-os-{한의원이름}` (예: `clinic-os-seoul`)
   - **Visibility**: **Private** (비공개) — 반드시 비공개로 설정하세요
   - 나머지는 기본값 유지
3. **Create repository** 클릭
4. 생성된 URL을 복사합니다 (예: `https://github.com/username/clinic-os-seoul.git`)

---

## 3. 프로젝트 연결

사용자는 GitHub 저장소 URL만 전달하면 됩니다. 실제 연결과 첫 백업은 에이전트가 진행하는 것을 권장합니다.

에이전트에게 다음과 같이 요청하세요:

```
GitHub 저장소 연결해줘. URL: https://github.com/username/clinic-os-seoul.git
```

에이전트가 내부적으로 보통 실행하는 작업:

```bash
# 1. GitHub 원격 저장소 등록
git remote add origin https://github.com/username/clinic-os-seoul.git

# 2. 현재 코드를 백업
git add -A
git commit -m "초기 설정 완료 — Clinic-OS 프로젝트 시작"

# 3. GitHub에 업로드
git push -u origin main
```

> **인증 요청 시**: 브라우저에서 GitHub 로그인 화면이 뜨면 로그인하세요. 한 번만 하면 됩니다.

---

## 4. 자동 백업 (커밋/푸시)

GitHub 연결 후, 에이전트는 다음 시점에 자동으로 코드를 백업합니다:

| 시점 | 설명 |
|------|------|
| 기능 완료 후 | 온보딩 기능 하나를 마칠 때마다 |
| 배포 전 | `npm run deploy` 실행 전 자동 백업 |
| 대규모 수정 후 | 여러 파일이 변경된 작업 후 |
| 세션 종료 시 | 작업을 마칠 때 저장 제안 |

에이전트가 "작업 내용을 저장할까요?"라고 물으면 **"네"**라고 답하세요.
"자동으로 해줘"라고 하면 이후에는 묻지 않고 자동 저장합니다.

---

## 5. GitHub 연결 확인

이 확인도 에이전트에게 맡길 수 있습니다. 사용자는 "GitHub 연결 상태 확인해줘"라고 요청하면 충분합니다.

```bash
# 연결 상태 확인
git remote -v

# 정상 출력 예시:
# origin  https://github.com/username/clinic-os-seoul.git (fetch)
# origin  https://github.com/username/clinic-os-seoul.git (push)
# upstream  (HQ 코어 — 자동 설정, push 비활성화)
```

---

## 6. 보안 주의사항

| 항목 | 설명 |
|------|------|
| 비공개 저장소 필수 | 환자 데이터 보호를 위해 반드시 Private으로 설정 |
| `.env` 파일 안전 | `.gitignore`에 포함되어 있어 GitHub에 업로드되지 않음 |
| wrangler.toml 안전 | 비밀번호는 `[vars]`에 있지만 Private 저장소에서만 관리 |
| `clinic.json` | 라이선스 키 포함, Private 저장소에서 안전하게 관리 |

---

## 7. 문제 해결

### "permission denied" 오류

GitHub 인증이 필요합니다:

```bash
# 방법 1: GitHub CLI 사용 (권장)
brew install gh  # macOS
gh auth login    # 브라우저에서 인증

# 방법 2: Personal Access Token
# GitHub > Settings > Developer settings > Personal access tokens > Generate
# 생성된 토큰을 비밀번호 대신 입력
```

### "remote origin already exists" 오류

이미 다른 URL이 연결되어 있습니다:

```bash
# 현재 연결 확인
git remote -v

# 기존 연결 변경
git remote set-url origin https://github.com/NEW-URL.git
```

### "rejected - non-fast-forward" 오류

GitHub 저장소에 이미 파일이 있을 때 발생합니다:

```bash
# 빈 저장소를 다시 만들거나, 아래 명령으로 강제 업로드
git push -u origin main --force
```

> **주의**: `--force`는 GitHub의 기존 내용을 덮어씁니다. 새 저장소일 때만 사용하세요.

---

## 8. GitHub 없이 작업할 경우

GitHub 연결 없이도 작업은 가능하지만, 다음 위험이 있습니다:

- 컴퓨터 고장 시 모든 코드를 잃습니다
- 다른 컴퓨터로 작업을 옮길 수 없습니다
- 실수로 파일을 지워도 복구할 수 없습니다
- DB 스냅샷의 원격 백업이 불가능합니다

에이전트는 3세션마다 GitHub 연결을 다시 안내합니다.

---

## 관련 문서

| 문서 | 설명 |
|------|------|
| [디바이스 마이그레이션](DEVICE_MIGRATION_GUIDE.md) | 다른 컴퓨터로 작업 옮기기 |
| [백업 가이드](BACKUP_GUIDE.md) | D1 데이터베이스 백업 |
| [안전한 작업 흐름](WORKFLOW_GUIDE.md) | 로컬 → 프로덕션 작업 절차 |
