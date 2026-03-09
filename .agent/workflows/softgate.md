---
description: 로컬 작업 보호를 위한 소프트게이트 가드레일. 에이전트가 주도적으로 안내합니다.
---

# 소프트게이트 가드레일

이 문서는 클라이언트의 로컬 작업(코드, 데이터, 에셋)을 보호하기 위한 에이전트 행동 규칙입니다.
`npm run setup` 이후, 온보딩 시작 **전에** 이 게이트들을 순서대로 통과합니다.

---

## 전체 흐름

```
npm run setup 완료
    ↓
[Gate 0] 클리닉 프로파일링 ← 가장 먼저. "당신의 한의원을 알려주세요"
    ↓
[Gate 1] 코드 안전망 (GitHub) ← 작업 시작 전 필수
    ↓
[Gate 2] 데이터 안전망 (D1) ← DB 변경 전 필수
    ↓
[Gate 3] 에셋 안전망 (R2/Cloudflare) ← 이미지 업로드 전 필수
    ↓
온보딩 시작 (Tier 1~5)
    ↓
[Gate M] 디바이스 마이그레이션 ← 필요 시
```

> **소프트게이트**: 차단하지 않고 강하게 권장합니다. 사용자가 "나중에"를 선택할 수 있지만,
> 에이전트는 위험을 명확히 설명하고 주기적으로 다시 안내합니다.

---

## Gate 0: 클리닉 프로파일링 (First Contact)

> **목적**: 에이전트가 한의원의 맥락을 파악하여 이후 모든 작업의 기반 데이터로 활용
> **시점**: npm run setup 완료 직후, 온보딩 시작 전
> **저장**: `.agent/clinic-profile.json` (로컬, core:pull 보호)

### 에이전트 행동

```
에이전트: "안녕하세요! 한의원 홈페이지를 만들어 드리겠습니다.
          먼저 한의원에 대해 알려주세요.

          가장 빠른 방법: 아래 중 하나를 알려주시면 기본 정보를 자동으로 가져옵니다.
          
          1. 기존 홈페이지 URL (예: https://my-clinic.com)
          2. 네이버 플레이스 URL (예: https://naver.me/xxxx 또는 검색명)
          3. 카카오맵 URL
          4. 없으면 직접 입력해도 됩니다"
```

### URL이 제공된 경우 — 자동 학습

```
사람:     "https://naver.me/FaKe1234" 또는 "네이버에서 서울한의원 검색하면 나와요"

에이전트: → WebFetch로 페이지 크롤링
        → 추출 시도:
           - 한의원 이름
           - 주소 (도로명)
           - 전화번호
           - 진료시간
           - 진료 과목/프로그램
           - 의료진 이름
           - 사진 (대표 이미지)
           - 한 줄 소개
           
        → 추출 결과를 사용자에게 확인:
        
        "다음 정보를 찾았습니다:
        
         🏥 서울한의원
         📍 서울시 강남구 테헤란로 123
         📞 02-1234-5678
         🕐 평일 09:00-18:00 / 토 09:00-13:00
         👨‍⚕️ 의료진: 김한의 원장, 박한의 원장
         💊 진료: 한방 다이어트, 추나요법, 교통사고
         
         맞나요? 수정할 부분이 있으면 알려주세요."

사람:     "전화번호가 바뀌었어. 02-5678-1234"

에이전트: → 수정 반영
        → clinic-profile.json 저장
```

### 기존 웹사이트가 있는 경우 — 추가 학습

```
에이전트: → 기존 사이트의 디자인 톤앤매너 분석
        → 메인 컬러, 폰트 스타일 파악
        → "기존 사이트의 컬러 톤을 유지할까요? (메인: #2B6CB0 파란계열)"
        → 콘텐츠 구조 분석 (어떤 페이지들이 있는지)
        → "기존 사이트의 블로그 글도 가져올까요?" (마이그레이션 제안)
```

### clinic-profile.json 구조

```json
{
  "$comment": "에이전트가 관리하는 클리닉 프로파일. 온보딩의 기반 데이터.",
  "source": {
    "type": "naver_place|website|manual",
    "url": "https://naver.me/xxxx",
    "scraped_at": "2026-02-26T06:00:00Z"
  },
  "clinic": {
    "name_ko": "서울한의원",
    "name_en": "Seoul Korean Medicine Clinic",
    "tagline": "20년 전통의 한방 치료",
    "representative": "김한의",
    "business_number": "123-45-67890"
  },
  "contact": {
    "phone": "02-5678-1234",
    "address": "서울시 강남구 테헤란로 123",
    "email": "info@seoul-clinic.com",
    "kakao_channel": "@seoul-clinic"
  },
  "hours": {
    "weekdays": "09:00 - 18:00",
    "saturday": "09:00 - 13:00",
    "lunch": "13:00 - 14:00",
    "closed": ["일요일", "공휴일"]
  },
  "services": [
    { "name": "한방 다이어트", "keywords": ["비만", "체중관리"] },
    { "name": "추나요법", "keywords": ["허리", "목", "디스크"] },
    { "name": "교통사고", "keywords": ["자동차보험", "통증"] }
  ],
  "staff": [
    { "name": "김한의", "title": "대표원장", "specialties": ["다이어트", "추나"] },
    { "name": "박한의", "title": "원장", "specialties": ["교통사고", "통증"] }
  ],
  "branding": {
    "primary_color": null,
    "existing_logo_url": null,
    "tone": null
  },
  "migration": {
    "has_existing_site": true,
    "existing_url": "https://old-site.com",
    "migrate_blog": false,
    "migrate_images": false
  }
}
```

### 프로파일 활용

이 데이터는 이후 온보딩에서 자동 반영됩니다:

| 온보딩 단계 | 자동 반영 항목 |
|-------------|----------------|
| clinic-info | name, tagline, representative, business_number |
| clinic-contact | phone, address, email, kakao_channel |
| clinic-hours | weekdays, saturday, lunch, closed |
| branding-minimal | primary_color, tone |
| staff-management | staff 배열 → 의료진 초기 등록 |
| program-management | services 배열 → 프로그램 초기 등록 |
| seo-setup | name, tagline → 메타 태그 |
| terms-management | name, representative → 약관 자동 치환 |

```
에이전트: "프로파일 정보를 기반으로 온보딩을 시작합니다.
          이미 파악된 정보는 자동으로 채워넣고, 확인만 받겠습니다."
```

---

## Gate 1: 코드 안전망 (GitHub)

> **목적**: 모든 코드 변경사항을 버전 관리하여 되돌리기/마이그레이션 가능하게
> **시점**: 첫 번째 코드 수정 전
> **체크**: `.git/config`에 remote origin이 GitHub인지

### 에이전트 체크 로직

```
1. git remote -v 확인
2. origin이 설정되어 있고 github.com을 가리키면 → PASS
3. origin이 없거나 HQ git만 있으면 → 안내 시작
```

### GitHub 미연결 시 안내

```
에이전트: "작업을 시작하기 전에 코드 백업을 설정합니다.
          지금 작성하는 코드가 안전하게 보관되려면 GitHub 연결이 필요합니다.
          
          GitHub 계정이 있으신가요?
          [A] 있어요 → 바로 연결
          [B] 없어요 → 가입 안내
          [C] 나중에 할게요 → ⚠️ 경고 후 진행"
```

#### [A] 계정 있음 → 연결

```
에이전트: "좋습니다! 아래 단계를 안내해드리겠습니다.
          
          1. GitHub에서 새 프라이빗 저장소를 만들어주세요:
             이름: clinic-os-서울한의원 (또는 원하시는 이름)
             공개 설정: Private (비공개)
             
          2. 저장소 URL을 알려주세요:
             예) https://github.com/username/clinic-os-seoul.git"

사람:     "https://github.com/drkim/clinic-os-seoul.git"

에이전트: → git remote add origin https://github.com/drkim/clinic-os-seoul.git
        → git add -A
        → git commit -m "초기 설정 완료 — Clinic-OS 프로젝트 시작"
        → git push -u origin main
        → "✅ 코드가 GitHub에 안전하게 백업되었습니다!"
```

#### [B] 계정 없음 → 가입 안내

```
에이전트: "GitHub는 무료 계정으로 충분합니다. 가입 방법:
          
          1. https://github.com/signup 접속
          2. 이메일, 비밀번호, 사용자명 입력
          3. 무료 플랜(Free) 선택
          
          가입 후 알려주시면 저장소 연결을 도와드리겠습니다."
```

#### [C] 나중에 → 경고

```
에이전트: "⚠️ GitHub 없이도 작업할 수 있지만, 다음 위험이 있습니다:
          
          - 컴퓨터 고장 시 모든 작업을 잃습니다
          - 다른 컴퓨터로 옮길 수 없습니다
          - 실수로 파일을 지워도 복구할 수 없습니다
          
          작업을 진행하되, 나중에 꼭 연결하시는 걸 권장합니다.
          다음 세션에서 다시 안내드리겠습니다."

에이전트: → .agent/softgate-state.json에 github_reminded_at 기록
        → 3세션마다 재안내
```

### 자동 커밋 가드레일 (GitHub 연결 후)

에이전트는 다음 시점에 자동으로 커밋을 제안합니다:

| 시점 | 커밋 메시지 패턴 |
|------|------------------|
| 온보딩 기능 완료 | `feat: {feature-name} 온보딩 완료` |
| 배포 전 | `release: 배포 준비 — Tier {N} 완료` |
| 대규모 수정 후 | `chore: {변경 요약}` |
| 세션 종료 시 | `wip: 작업 중 저장` |

```
에이전트: → 변경된 파일 확인 (git status)
        → 변경이 있으면: "작업 내용을 저장(커밋)할까요?"
        → 사용자 동의 시: git add + commit + push
        → 사용자가 "자동으로 해줘" 하면: 이후 자동 모드
```

### softgate-state.json

```json
{
  "github": {
    "connected": true,
    "remote_url": "https://github.com/drkim/clinic-os-seoul.git",
    "connected_at": "2026-02-26T06:00:00Z",
    "auto_commit": true,
    "last_push_at": "2026-02-26T07:00:00Z"
  },
  "d1_backup": {
    "enabled": true,
    "last_backup_at": "2026-02-26T06:30:00Z",
    "backup_count": 3
  },
  "r2": {
    "configured": true,
    "bucket_name": "seoul-clinic-uploads"
  },
  "reminders": {
    "github_reminded_at": null,
    "backup_reminded_at": null
  }
}
```

---

## Gate 2: 데이터 안전망 (D1)

> **목적**: DB 데이터를 잃지 않도록 보호
> **시점**: DB 변경 전, 배포 전, 주기적

### D1 보호 전략: 3중 안전망

```
┌──────────────────────────────────────────────┐
│                    Layer 1                     │
│         로컬 자동 백업 (이미 존재)               │
│    ~/.clinic-os-backups/{project}/             │
│    npm run db:backup — 5개 로테이션             │
└──────────────────────┬───────────────────────┘
                       │
┌──────────────────────▼───────────────────────┐
│                    Layer 2                     │
│           SQL 덤프 → Git 저장 (NEW)            │
│    .backups/d1-snapshot-{date}.sql             │
│    git commit과 함께 백업 히스토리 관리           │
└──────────────────────┬───────────────────────┘
                       │
┌──────────────────────▼───────────────────────┐
│                    Layer 3                     │
│         프로덕션 D1 (Cloudflare Remote)         │
│    배포 시 자동으로 remote D1에 반영             │
│    Cloudflare가 자체적으로 관리                  │
└──────────────────────────────────────────────┘
```

### 에이전트 행동 규칙

#### 파괴적 DB 작업 전 (DROP, DELETE, ALTER)

```
에이전트: → npm run db:backup 실행 (자동)
        → "DB 백업을 만들었습니다. (backup_2026-02-26_15-30-00)"
        → 작업 실행
        → 문제 발생 시: "백업에서 복원할까요?"
```

#### 배포 전

```
에이전트: → 로컬 D1과 remote D1 상태 비교
        → 차이가 있으면: "로컬 DB에 새로운 데이터가 있습니다. 배포 시 반영됩니다."
        → npm run db:backup (배포 전 스냅샷)
```

#### SQL 덤프 → Git (Layer 2)

주요 데이터 변경 후 에이전트가 자동 실행:

```bash
# 에이전트가 내부적으로 실행
wrangler d1 export clinic-db --local --output .backups/d1-snapshot-latest.sql
```

이 파일은 git에 포함되어 GitHub에 백업됩니다.
디바이스 마이그레이션 시 이 파일로 DB를 복원합니다.

#### 주기적 안내 (GitHub 미연결 시)

```
에이전트: "💾 로컬 백업은 있지만, 컴퓨터 문제 시 데이터가 사라질 수 있습니다.
          GitHub에 연결하면 DB 스냅샷도 함께 백업됩니다.
          지금 연결할까요?"
```

---

## Gate 3: 에셋 안전망 (R2/Cloudflare)

> **목적**: 이미지, 파일 등 에셋을 클라우드에 보관하여 유실 방지
> **시점**: 에셋 업로드 시점, Cloudflare 미설정 시

### Cloudflare 설정 확인

`setup-clinic.js`의 Step 9에서 Cloudflare 설정이 이미 진행되지만,
사용자가 건너뛸 수 있습니다. 에이전트는 이를 추적합니다.

```
에이전트: → wrangler.toml에서 R2 binding 확인
        → database_id가 플레이스홀더인지 확인
        → bucket_name이 설정되어 있는지 확인
```

### R2 미설정 시 안내

```
에이전트: "이미지를 업로드하려면 Cloudflare 스토리지(R2) 설정이 필요합니다.
          
          Cloudflare 계정이 이미 있으신가요?
          [A] 있어요 → R2 버킷 생성 안내
          [B] 없어요 → 가입부터 안내
          [C] 나중에 → 로컬 저장만 (유실 위험 안내)"
```

#### Cloudflare 설정 원스텝

```
에이전트: "Cloudflare에 로그인합니다."

→ npx wrangler login

에이전트: "브라우저에서 로그인을 완료해주세요...
          ✅ 로그인 성공!
          
          이제 자동으로 설정합니다:"

→ npx wrangler d1 create {clinic-name}-db
→ npx wrangler r2 bucket create {clinic-name}-uploads

에이전트: "✅ 데이터베이스와 파일 저장소가 생성되었습니다!
          
          📦 DB: {clinic-name}-db (ID: xxxx)
          🗂️ 저장소: {clinic-name}-uploads
          
          wrangler.toml에 자동 반영했습니다."
```

### R2 보호 전략

```
1. 관리자 페이지에서 업로드하는 이미지 → R2에 직접 저장 (이미 구현됨)
2. 코드에서 사용하는 정적 에셋 → public/local/ 에 저장 → git으로 관리
3. R2는 Cloudflare 인프라이므로 별도 백업 불필요
4. 로컬에만 있는 에셋은 git에 포함되어 GitHub으로 백업
```

---

## Gate M: 디바이스 마이그레이션

> **목적**: 다른 컴퓨터에서 기존 작업을 이어서 할 수 있게
> **전제**: Gate 1 (GitHub) 완료 필수

### 마이그레이션 트리거

```
사람:     "새 컴퓨터에서 작업하고 싶어요" 또는
          "다른 노트북으로 옮기고 싶어요" 또는
          "집에서도 작업할 수 있어?"
          
에이전트: "기존 작업을 새 컴퓨터로 옮기는 방법을 안내합니다."
```

### 마이그레이션 플로우

```
[새 컴퓨터]

1. 기본 환경 설치 (Node.js, Git)
   → Windows 호스트: WSL Ubuntu 먼저 설치 (windows-guide 참조)
   → macOS: 바로 진행 가능

2. GitHub에서 코드 가져오기
   → git clone https://github.com/drkim/clinic-os-seoul.git
   → cd clinic-os-seoul
   → npm install

3. Cloudflare 연결
   → npx wrangler login
   → (같은 Cloudflare 계정으로 로그인)

4. HQ 디바이스 등록
   → npm run setup (기존 clinic.json이 git에 포함)
   → setup이 기존 설정을 감지하고 최소 단계만 실행

5. DB 복원 (선택)
   → 프로덕션 DB 사용: 추가 작업 없음 (이미 Cloudflare에 있음)
   → 로컬 DB도 필요하면: 
     wrangler d1 execute clinic-db --local --file .backups/d1-snapshot-latest.sql

6. 완료 확인
   → npm run dev
   → npm run doctor
```

### 에이전트의 마이그레이션 안내

```
에이전트: "새 컴퓨터에서 다음 명령어를 순서대로 실행해주세요:

          # 1. 코드 가져오기
          git clone https://github.com/drkim/clinic-os-seoul.git
          cd clinic-os-seoul
          npm install
          
          # 2. Cloudflare 연결
          npx wrangler login
          
          # 3. 설정 확인
          npm run setup
          
          # 4. 로컬 서버 시작
          npm run dev
          
          프로덕션 데이터는 이미 Cloudflare에 있어서 별도 작업이 필요 없습니다.
          로컬 DB가 필요하면 말씀해주세요."
```

### GitHub 미연결 상태에서 마이그레이션 요청 시

```
에이전트: "⚠️ 현재 코드가 GitHub에 백업되어 있지 않아서
          다른 컴퓨터로 자동 이전이 어렵습니다.
          
          지금 GitHub을 먼저 연결하면:
          1. 코드를 GitHub에 백업하고
          2. 새 컴퓨터에서 바로 가져올 수 있습니다.
          
          GitHub 연결을 먼저 할까요?"
```

---

## 소프트게이트 체크 타이밍

에이전트는 다음 시점에 자동으로 게이트를 체크합니다:

| 시점 | 체크 항목 |
|------|----------|
| **첫 대화** | Gate 0 (프로파일) — clinic-profile.json 유무 |
| **코드 수정 전** | Gate 1 (GitHub) — remote origin 유무 |
| **DB 변경 전** | Gate 2 (D1 백업) — 최근 백업 유무 |
| **이미지 업로드 전** | Gate 3 (R2) — R2 binding 유무 |
| **배포 전** | Gate 1 + 2 + 3 전체 체크 |
| **세션 시작 시** | 미완료 게이트 재안내 (3세션마다) |

### 체크 코드 (에이전트 내부 로직)

```
function checkSoftgates() {
  // Gate 0: 프로파일
  const profile = readFile('.agent/clinic-profile.json');
  if (!profile) return { gate: 0, action: 'profile_interview' };
  
  // Gate 1: GitHub
  const remotes = exec('git remote -v');
  if (!remotes.includes('github.com')) return { gate: 1, action: 'github_setup' };
  
  // Gate 2: D1 백업
  const state = readFile('.agent/softgate-state.json');
  const daysSinceBackup = daysBetween(state.d1_backup.last_backup_at, now());
  if (daysSinceBackup > 7) return { gate: 2, action: 'backup_reminder' };
  
  // Gate 3: R2
  const wrangler = readFile('wrangler.toml');
  if (!wrangler.includes('r2_buckets')) return { gate: 3, action: 'r2_setup' };
  
  return { gate: 'all_clear' };
}
```

---

## 통합 예시: 첫 세션 전체 흐름

```
[npm run setup 완료 — 로컬 서버 동작 중]

에이전트: "안녕하세요! 한의원 홈페이지를 함께 만들어보겠습니다.
          먼저 한의원에 대해 알려주세요.
          기존 홈페이지나 네이버 플레이스 주소가 있으면 가장 빠릅니다."

사람:     "네이버에 서울한의원으로 검색하면 나와요"

에이전트: → [Gate 0] 네이버 플레이스 크롤링 → 정보 추출 → 확인 → 저장
        
        "기본 정보를 파악했습니다!
         이제 작업을 안전하게 보관하기 위해 GitHub을 연결하겠습니다."

사람:     "깃허브 계정 있어요"

에이전트: → [Gate 1] GitHub repo 생성 안내 → 연결 → 초기 커밋 → 푸시
        
        "코드 백업 완료!
         Cloudflare 설정도 확인할게요..."

에이전트: → [Gate 3] wrangler.toml 확인 → R2 설정 상태 체크
        → 이미 setup에서 완료됐으면: "✅ Cloudflare 설정 확인 완료"
        → 안 됐으면: Cloudflare 로그인 + R2 생성 안내

에이전트: → [Gate 2] 초기 DB 백업 실행
        
        "모든 안전장치가 완료되었습니다!
         
         ✅ 클리닉 프로파일 저장
         ✅ GitHub 코드 백업 연결
         ✅ Cloudflare DB/스토리지 설정
         ✅ 초기 DB 백업 완료
         
         이제 홈페이지를 본격적으로 만들어볼까요?
         파악된 정보를 기반으로 자동으로 채워나가겠습니다."

에이전트: → 온보딩 워크플로우 시작 (Tier 1)
        → clinic-profile.json 데이터로 자동 반영
        → 확인만 받으면서 빠르게 진행
```

---

## 에이전트 행동 원칙

### DO
- **프로파일링을 가장 먼저** — 한의원을 이해해야 모든 것이 빨라짐
- **URL 하나로 최대한 추출** — 사람에게 물어보는 횟수 최소화
- **GitHub 연결을 강하게 권장** — 그러나 차단하지는 않음
- **백업을 자동으로** — 사람이 기억하지 않아도 되게
- **마이그레이션 경로를 항상 유지** — GitHub + Cloudflare = 어디서든 복원

### DON'T
- Git 용어로 설명하지 않기 ("커밋", "푸시" 대신 "저장", "백업")
- 한 번에 모든 게이트를 강요하지 않기
- 기술적 세부사항을 늘어놓지 않기
- 사용자가 "나중에"를 선택했을 때 같은 세션에서 다시 묻지 않기

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `.agent/clinic-profile.json` | 한의원 프로파일 (Gate 0 결과) |
| `.agent/softgate-state.json` | 게이트 통과 상태 추적 |
| `.agent/onboarding-state.json` | 온보딩 진행 상태 |
| `.agent/onboarding-registry.json` | 기능 스펙 (읽기 전용) |
| `.backups/d1-snapshot-latest.sql` | DB 스냅샷 (Gate 2) |
| `wrangler.toml` | Cloudflare 설정 (Gate 3 체크 대상) |
