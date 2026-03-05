---
hq_slug: device-migration-guide
hq_title: "디바이스 마이그레이션"
hq_category: "01. 설치 가이드"
hq_sort: 5
hq_active: true
---
# 디바이스 마이그레이션

기존 작업을 새 컴퓨터(또는 다른 컴퓨터)로 옮기는 방법입니다.
GitHub과 Cloudflare가 연결되어 있으면 간단하게 이전할 수 있습니다.

> **소프트게이트 Gate M** — Gate 1(GitHub)이 완료되어야 사용 가능합니다.

---

## 전제 조건

| 조건 | 필수 | 확인 방법 |
|------|------|----------|
| GitHub 연결 | 필수 | `git remote -v`에 github.com origin 존재 |
| Cloudflare 계정 | 권장 | `npx wrangler whoami`로 확인 |
| 최신 코드 push | 필수 | `git status`로 미저장 변경 없음 확인 |

> **GitHub 미연결 상태라면**: 먼저 [GitHub 연동 가이드](GITHUB_SETUP_GUIDE.md)를 따라 연결하세요.

---

## 마이그레이션 절차

### Step 1: 기존 컴퓨터에서 최종 백업

기존 컴퓨터에서 작업 중인 내용을 모두 저장합니다:

```bash
# 1. 미저장 코드 확인
git status

# 2. 변경사항 저장 & 업로드
git add -A
git commit -m "마이그레이션 전 최종 저장"
git push origin main

# 3. DB 스냅샷 생성 & 업로드
npx wrangler d1 export {db-name} --local --output .backups/d1-snapshot-latest.sql
git add .backups/d1-snapshot-latest.sql
git commit -m "DB 스냅샷 백업"
git push origin main
```

에이전트에게 한 번에 요청할 수도 있습니다:

```
마이그레이션 준비해줘. 모든 코드와 DB를 백업해서 GitHub에 올려줘.
```

### Step 2: 새 컴퓨터 환경 설정

#### macOS

```bash
# Node.js 설치 (v18 이상)
brew install node

# Git 확인 (macOS에 기본 포함)
git --version
```

#### Windows

WSL(Windows Subsystem for Linux) 설치가 필요합니다:

```powershell
# PowerShell (관리자)에서 실행
wsl --install
```

WSL 설치 후 Ubuntu 터미널에서:

```bash
# Node.js 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

> 자세한 내용: [Windows 설치 가이드](../hq/guides/windows-guide.md)

### Step 3: 코드 가져오기

```bash
# GitHub에서 프로젝트 복제
git clone https://github.com/username/clinic-os-seoul.git
cd clinic-os-seoul

# 의존성 설치
npm install
```

### Step 4: Cloudflare 연결

```bash
# Cloudflare 로그인 (기존과 같은 계정)
npx wrangler login
```

> 기존 컴퓨터와 **같은 Cloudflare 계정**으로 로그인해야 합니다.
> D1 데이터베이스와 R2 버킷이 계정에 연결되어 있습니다.

### Step 5: 설정 확인

```bash
# 초기 설정 실행 (기존 clinic.json 자동 감지)
npm run setup
```

`clinic.json`이 Git에 포함되어 있으므로, setup이 기존 설정을 감지하고 최소한의 단계만 실행합니다.

### Step 6: 로컬 DB 복원 (선택)

프로덕션 데이터는 이미 Cloudflare에 있으므로 추가 작업이 필요 없습니다.
로컬 개발용 DB가 필요하면:

```bash
# 방법 1: Git에 포함된 SQL 스냅샷으로 복원
npx wrangler d1 execute {db-name} --local --file .backups/d1-snapshot-latest.sql

# 방법 2: 프로덕션 DB에서 가져오기
npm run db:pull

# 방법 3: 빈 DB로 시작
npm run db:init
npm run db:seed
```

### Step 7: 확인

```bash
# 개발 서버 시작
npm run dev

# 전체 환경 체크
npm run doctor
```

---

## 에이전트에게 요청하기

새 컴퓨터에서 AI 코딩 에이전트에게 간단히 요청할 수 있습니다:

```
"다른 컴퓨터에서 가져온 프로젝트야. 환경 설정 확인해줘."
```

에이전트가 자동으로:
1. `npm run doctor`로 환경 점검
2. 누락된 설정 안내
3. 로컬 DB 상태 확인 및 복원 제안
4. softgate 상태 업데이트

---

## GitHub 미연결 상태에서 마이그레이션

GitHub 없이 수동으로 옮기는 방법 (비추천):

```bash
# 기존 컴퓨터에서
# 1. 프로젝트 폴더를 USB/클라우드 드라이브에 복사
cp -r ~/clinic-os-seoul /Volumes/USB/

# 새 컴퓨터에서
# 2. 복사
cp -r /Volumes/USB/clinic-os-seoul ~/
cd ~/clinic-os-seoul

# 3. 의존성 재설치
npm install

# 4. 설정 확인
npm run setup
```

> **주의**: 이 방법은 `.wrangler/` 폴더의 로컬 DB를 함께 복사하므로
> 데이터는 보존되지만, 이후 Git 관리가 어려워집니다.

---

## 문제 해결

### "Permission denied" (GitHub clone 실패)

```bash
# GitHub CLI로 인증
gh auth login
# 또는
git config --global credential.helper store
```

### "npm run setup이 처음부터 다시 시작"

`clinic.json`이 Git에 포함되지 않았을 수 있습니다:

```bash
# 기존 컴퓨터에서
git add clinic.json
git commit -m "clinic.json 추가"
git push
```

### "Cloudflare 리소스에 접근 불가"

다른 Cloudflare 계정으로 로그인했을 수 있습니다:

```bash
# 현재 로그인 확인
npx wrangler whoami

# 다시 로그인
npx wrangler login
```

### 프로덕션 데이터는 있는데 로컬 DB가 비어있음

```bash
# 프로덕션에서 로컬로 동기화
npm run db:pull
```

---

## 마이그레이션 체크리스트

- [ ] 기존 컴퓨터: 모든 코드 commit & push 완료
- [ ] 기존 컴퓨터: DB 스냅샷 생성 & push 완료
- [ ] 새 컴퓨터: Node.js v18+ 설치
- [ ] 새 컴퓨터: `git clone` 완료
- [ ] 새 컴퓨터: `npm install` 완료
- [ ] 새 컴퓨터: `npx wrangler login` (같은 계정)
- [ ] 새 컴퓨터: `npm run setup` 실행
- [ ] 새 컴퓨터: `npm run dev` 정상 동작 확인
- [ ] 새 컴퓨터: `npm run doctor` 모든 항목 통과

---

## 관련 문서

| 문서 | 설명 |
|------|------|
| [GitHub 연동](GITHUB_SETUP_GUIDE.md) | 마이그레이션의 기본 전제 |
| [백업 가이드](BACKUP_GUIDE.md) | DB 백업 & 복원 |
| [Windows 설치](../hq/guides/windows-guide.md) | Windows 환경 설정 |
| [macOS 설치](../hq/guides/macos-guide.md) | macOS 환경 설정 |
