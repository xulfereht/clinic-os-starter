# 온볼딩 Agent-First 워크플로우

> 에이전트가 주도하고, 사용자는 검토/피드백/정보 제공만 하는 온볼딩 프로세스

---

## 개요

**기존 방식**: 사용자가 `/admin/settings` 들어가서 직접 입력
**Agent-First 방식**: 에이전트가 대화하며 하나씩 설정, 사용자는 확인/수정

시작 전에 현재 설치본 시나리오를 먼저 확인합니다:

```bash
npm run agent:lifecycle -- --json
```

- `fresh_install`, `resume_setup`, `onboarding_ready`이면 일반 온보딩 진행
- `legacy_reinstall_migration`이면 신규 설치 + snapshot 이관을 먼저 제안
- `production_binding_drift`이면 wrangler 연결 검토 전까지 배포/전환 보류

---

## 체크포인트 기반 진행

각 기능은 **3단계 체크포인트**를 거칩니다:

```
[🔍 분석] → [⚙️ 실행] → [✅ 검증]
   ↓           ↓           ↓
정보 수집    설정 적용     결과 확인
제안 생성    사용자 확인   상태 저장
```

### 체크포인트 상태

```json
{
  "featureId": "clinic-info",
  "checkpoints": {
    "analyze": { "status": "done", "timestamp": "2026-03-05T10:00:00Z" },
    "execute": { "status": "done", "timestamp": "2026-03-05T10:05:00Z" },
    "verify": { "status": "pending" }
  }
}
```

---

## 게이트 종류별 처리

### Gate A: 정보 수집 게이트 (Information Gate)

사용자로부터 정보를 받아야 하는 기능

**예시: clinic-info (병원 기본 정보)**

```
[에이전트] "병원 기본 정보를 설정하겠습니다."

1️⃣ 분석 단계:
   - clinic.json 확인 → "샘플한의원" 추출
   - 네이버 플레이스 검색 → "바른한의원" 발견
   - 제안: "'바른한의원'으로 설정하시겠습니까?"

2️⃣ 사용자 선택:
   ┌─────────────────────────────────────┐
   │  1. ✅ 네, '바른한의원'으로 해주세요  │
   │  2. 📝 다른 이름으로 할게요          │
   │  3. 🔍 더 검색해줘                   │
   │  4. ⏭️  나중에 설정할게요            │
   └─────────────────────────────────────┘

3️⃣ 실행:
   - 사용자가 "1" 선택 → DB 업데이트
   - 또는 사용자가 "서울한의원" 입력 → DB 업데이트

4️⃣ 검증:
   - 홈페이지 미리보기 URL 제공
   - "이렇게 표시됩니다. 괜찮나요?"

5️⃣ 상태 저장:
   - onboarding-state.json 업데이트
   - clinic-info: done
```

### Gate B: 선택 게이트 (Selection Gate)

여러 옵션 중 선택해야 하는 기능

**예시: branding-minimal (브랜딩)**

```
[에이전트] "브랜드 컬러를 선택하겠습니다."

1️⃣ 분석:
   - 한의원 특성 분석 (전통/현대/고급 등)
   - 제안: "전통적인 느낌의 'teal'을 추천합니다"

2️⃣ 선택지 제시:
   ┌─────────────────────────────────────┐
   │  🎨 추천: Teal (전통/신뢰)          │
   │                                    │
   │  다른 옵션:                         │
   │  - 🌿 Green (자연/건강)            │
   │  - 💙 Blue (전문/깨끗)             │
   │  - 🟤 Brown (안정/전통)            │
   │                                    │
   │  [직접 선택하기]                    │
   └─────────────────────────────────────┘

3️⃣ 실행:
   - 선택된 컬러로 테마 업데이트
   - 실시간 미리보기 생성

4️⃣ 검증:
   - "이런 느낌으로 적용됩니다."
   - 스크린샷 또는 미리보기 URL
```

### Gate C: 검토 게이트 (Review Gate)

결과물을 사용자가 검토해야 하는 기능

**예시: homepage-setup (홈페이지 구성)**

```
[에이전트] "홈페이지를 구성하겠습니다."

1️⃣ 분석:
   - clinic-profile.json에서 수집된 정보 분석
   - 진료 프로그램, 의료진 정보 확인
   - 자동 섹션 구성 제안

2️⃣ 제안안 생성:
   ┌─────────────────────────────────────┐
   │  📄 홈페이지 구성 제안안            │
   │                                    │
   │  1. 히어로 섹션                     │
   │     - 제목: "바른한의원"            │
   │     - 서브: "20년 전통의 한방치료"   │
   │                                    │
   │  2. 프로그램 소개 (3개)             │
   │     - 다이어트 한약                 │
   │     - 통증 치료                     │
   │     - 한방 재활                     │
   │                                    │
   │  3. 의료진 소개 (2명)               │
   │     - 김대표 원장                   │
   │     - 이한의사 원장                 │
   │                                    │
   │  [✅ 전체 적용]  [📝 수정]  [⏭️ 나중] │
   └─────────────────────────────────────┘

3️⃣ 사용자 검토:
   - "히어로 제목을 '서울 바른한의원'으로 바꿔줘"
   - 에이전트 수정 → 다시 제시

4️⃣ 실행:
   - 사용자 확인 후 DB 저장

5️⃣ 검증:
   - 실제 홈페이지에서 확인
   - "홈페이지를 확인해 주세요"
```

### Gate D: 위험 게이트 (Risk Gate)

영향도가 큰 작업

**예시: 배포 (deploy)**

```
[에이전트] "⚠️  프로덕션 배포를 진행하겠습니다."

1️⃣ 사전 체크:
   - 미완료 Tier 1 기능 확인
   - DB 백업 상태 확인
   - 이전 배포 버전 확인

2️⃣ 위험 알림:
   ┌─────────────────────────────────────┐
   │  ⚠️  배포 전 확인사항               │
   │                                    │
   │  ✅ 완료된 기능:                    │
   │     - 관리자 계정 보안              │
   │     - 병원 기본 정보                │
   │     - 연락처 설정                   │
   │                                    │
   │  ⚠️  미완료 (필수 아님):            │
   │     - 진료 시간 상세 설정           │
   │                                    │
   │  🔄 자동 생성됨:                    │
   │     - DB 백업 (10:30)               │
   │     - 롤백 준비 완료                │
   │                                    │
   │  [🚀 배포 진행]  [🔍 더 확인]  [⏸️ 취소] │
   └─────────────────────────────────────┘

3️⃣ 배포 진행 (에이전트가 단계별로 보고):
   - "빌드 중..."
   - "Cloudflare 업로드 중..."
   - "DNS 확인 중..."

4️⃣ 완료 보고:
   - "✅ 배포 완료! https://my-clinic.pages.dev"
   - "확인해 주세요. 문제 있으면 즉시 롤백 가능합니다."
```

---

## Tier별 진행 흐름

### Tier 1: 배포 필수 (7개 기능)

**모든 기능이 사용자 확인 필수**

```
1. admin-account
   └─ 게이트: 정보 수집 (비밀번호 변경)

2. clinic-info  
   └─ 게이트: 정보 수집 (병원명, 소개 등)

3. clinic-contact
   └─ 게이트: 정보 수집 (주소, 전화 등)

4. clinic-hours
   └─ 게이트: 선택 (진료 시간)

5. branding-minimal
   └─ 게이트: 선택 (컬러, 로고)

6. terms-management
   └─ 게이트: 검토 (약관 문구 확인)

7. admin-password-env
   └─ 게이트: 정보 수집 (환경변수)

[Tier 1 완료 게이트]
에이전트: "🎉 Tier 1 완료! 1차 배포 가능합니다.
         배포하시겠습니까, Tier 2도 먼저 진행할까요?"
```

### Tier 2: 핵심 콘텐츠 (6개 기능)

```
1. staff-management
   └─ 게이트: 정보 수집 (의료진 프로필)

2. program-management
   └─ 게이트: 검토 (프로그램 구성 확인)

3. homepage-setup
   └─ 게이트: 검토 (섹션 구성 확인)

4. navigation-management
   └─ 게이트: 선택 (메뉴 구성)

5. og-image
   └─ 게이트: 검토 (이미지 확인)

6. location-page
   └─ 게이트: 검토 (지도/교통편 확인)

[Tier 2 완료 게이트]
에이전트: "✨ 핵심 콘텐츠 완료!
         환자가 봤을 때 실제 운영 중인 병원으로 보입니다.
         배포 후 Tier 3를 진행할까요?"
```

### Tier 3+: 선택적 (사용자가 원할 때)

**사용자가 "진행해줘" 요청 시에만 진행**

```
사용자: "예약 시스템도 설정해줘"

에이전트: "예약 시스템을 설정하겠습니다."
         → reservation-setup 진행
         → clinic-schedule 진행
```

---

## 세션 관리

### 중단/복구

```
[세션 1] 에이전트: "병원 이름을 설정하겠습니다..."
         사용자: "잠시만요" (30분 경과 → 세션 종료)

[세션 2] 에이전트: (onboarding-state.json 읽음)
         "이전에 clinic-info를 설정하던 중이었습니다.
          '서울한의원'으로 계속할까요, 다시 시작할까요?"
```

### 일시 중단 (Skip)

```
에이전트: "OG 이미지를 설정하겠습니다."
사용자: "지금 안 할래, 나중에 할게"

→ onboarding-state.json:
   "og-image": { "status": "skipped", "reason": "user_deferred" }

→ 다음에 "skipped" 항목 목록 제시:
   "이전에 미룬 설정이 있습니다: OG 이미지"
```

---

## 구현 체크리스트

### 에이전트가 구현해야 할 것

- [ ] `onboarding-state.json` 읽기/쓰기
- [ ] `onboarding-registry.json`에서 기능 정의 읽기
- [ ] Tier 순서대로 기능 순회
- [ ] 각 게이트 타입별 처리 로직
- [ ] 사용자 입력 받기 (confirm, input, select)
- [ ] 미리보기/검증 URL 생성
- [ ] 세션 복구 로직

### 상태 파일 관리

```javascript
// 에이전트가 상태 업데이트
async function updateFeatureStatus(featureId, status, notes) {
  const state = await readOnboardingState();
  state.features[featureId] = {
    status,  // 'pending', 'in_progress', 'done', 'skipped'
    updated_at: new Date().toISOString(),
    notes
  };
  state.last_updated = new Date().toISOString();
  await saveOnboardingState(state);
}
```

---

## 명령어 인터페이스

```bash
# 온볼딩 상태 확인
npm run onboarding:status

# 다음 기능 진행
npm run onboarding:next

# 특정 기능만 진행
npm run onboarding:step -- --feature=clinic-info

# Tier 전체 진행
npm run onboarding:tier -- --tier=1

# 미완료/미룬 기능 목록
npm run onboarding:pending
```
