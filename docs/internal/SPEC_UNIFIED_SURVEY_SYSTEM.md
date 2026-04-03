# Spec: Unified Survey & Diagnosis System

> **Status**: Draft
> **Author**: AMU + Claude
> **Date**: 2026-03-27
> **Scope-risk**: wide — touches survey-tools plugin, diagnosis system, program editor, admin, agent skill

---

## 0. Design Philosophy — Agent as Producer, Plugin as Format

Clinic-OS는 코드를 배포하는 시스템이 아니라 **에이전트를 배포하는 시스템**이다.
검사도구도 같은 원칙을 따른다.

### 기존 모델 (플러그인 마켓플레이스)
```
개발자가 JSON 작성 → 플러그인 스토어에 등록 → 관리자가 설치
```
문제: 원장님이 JSON을 직접 만들 수 없음. 개발자 의존.

### 새 모델 (에이전트 매니폴드)
```
원장 + 로컬 에이전트 → /dev-survey 스킬로 대화하며 설계
→ 에이전트가 manifest.json 생성 + DB 등록 + 프로그램 연결
→ core:push 시 manifest.json이 플러그인 포맷으로 도킹
→ 다른 클라이언트가 core:pull로 수신
```

**스킬이 생산자, 플러그인은 유통 포맷.**

- `/dev-survey` 스킬이 의학적 맥락을 이해하고, 문항 설계 → 채점 로직 → 결과 메시지까지 원샷 생성
- 관리자 페이지는 "만드는 곳"이 아니라 "관리하는 곳" — 활성화/비활성화, 순서 변경, 미리보기
- manifest.json은 에이전트가 만든 결과물의 **직렬화 포맷**이지 사람이 편집하는 인터페이스가 아님
- 마스터 에이전트가 코어 검사도구를 만들면 → core:push로 모든 클라이언트에 배포
- 로컬 에이전트가 클라이언트 전용 검사도구를 만들면 → local/에 저장, core:pull에서 보호

### 에이전트 캐스케이드에서의 위치

```
마스터 에이전트 (코어 검사도구 제작)
  ↓ core:push (manifest.json 포함)
로컬 에이전트 (클라이언트별 커스텀)
  ├── 코어 검사도구 활성화/비활성화
  ├── 로컬 검사도구 생성 (/dev-survey)
  ├── 프로그램에 검사도구 연결
  └── 결과지/리포트 커스텀
```

---

## 1. Goal

검사도구(Survey Tools)와 미니진단(MiniDiagnosis)을 하나의 통합 시스템으로 재설계한다.

**현재 문제**:
- Survey Tools(파일 기반)와 Self Diagnosis(하드코딩 + DB)가 완전 분리
- 새로 만든 검사도구를 프로그램에 연결 불가
- MiniDiagnosis 데이터가 코드에 하드코딩 (9개 고정, 커스텀 불가)
- `self_diagnosis_templates` DB 테이블이 존재하나 실제 사용되지 않음
- 관리자가 raw JSON을 직접 입력해야 하는 잘못된 UX

**목표 상태**:
- 에이전트 스킬(`/dev-survey`)이 **유일한 1차 생산 경로** → JSON 직접 편집 불필요
- 에이전트가 만든 검사도구를 프로그램에 바로 연결 (원샷)
- MiniDiagnosis도 에이전트가 커스텀 생성 가능 → 프로그램 섹션으로 삽입
- 결과지(result)와 리포트(report) 기본 렌더러 제공 + 에이전트가 커스텀 가능
- 관리자 UI는 관리 전용 (활성화, 순서, 미리보기)
- 향후 결제 모듈 연동 시 유료 검사도구 지원 가능한 구조

---

## 2. Architecture Overview

### 통합 모델

```
/dev-survey 스킬 (생산)
  ↓ manifest.json 생성 + DB 등록
survey_tools (DB — runtime SOT)
  ├── type: 'standalone'   → 독립 URL (/ext/survey-tools/{id})
  ├── type: 'mini'         → 프로그램 섹션 임베드용
  └── type: 'hybrid'       → 둘 다 가능

manifest.json (파일)       → 유통 포맷 (core:push/pull 배포)
  ↓ sync (서버 시작 시)
survey_tools (DB)          → 런타임 SOT
  ↓
프로그램 편집기             → 드롭다운에서 선택
  ↓
프로그램 페이지             → MiniDiagnosis 또는 RelatedDiagnosis 렌더링
```

### 핵심 원칙

1. **에이전트가 유일한 생산자** — `/dev-survey` 스킬이 설계 + 생성 + 등록 + 연결까지 자동화. 관리자 UI는 관리 전용
2. **DB가 런타임 SOT** — 파일 시스템 manifest는 유통 포맷일 뿐, 런타임은 DB에서 읽음
3. **코어는 기본, 로컬은 커스텀** — 코어 검사도구는 core:pull로 배포, 클라이언트는 local/에서 커스텀
4. **기본 렌더러 제공** — 커스텀 안 하면 기본 UI로 동작, 에이전트가 필요하면 survey.astro/result.astro 생성

---

## 3. Data Model

### 3.1 `survey_tools` 테이블 (신규 — runtime SOT)

```sql
CREATE TABLE survey_tools (
    id TEXT PRIMARY KEY,              -- slug (e.g., 'stress-check', 'digestion-mini')
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'standalone',   -- 'standalone' | 'mini' | 'hybrid'
    source TEXT DEFAULT 'local',      -- 'core' | 'store' | 'local'
    version TEXT DEFAULT '1.0.0',

    -- 질문 데이터 (JSON)
    questions TEXT NOT NULL,          -- JSON: [{id, type, question, options[], ...}]

    -- 채점 (JSON)
    scoring TEXT NOT NULL,            -- JSON: {maxScore, interpretation[{min,max,level,label,description}]}

    -- 미니진단 전용 (type='mini' or 'hybrid')
    mini_config TEXT,                 -- JSON: {results[{level,minScore,maxScore,title,subtitle,description,tags,cta{headline,body,link}}]}

    -- 프로그램 연결
    program_variants TEXT,            -- JSON: [{programSlug, results[override]}] — 같은 질문, 프로그램별 결과 오버라이드

    -- 메타데이터
    thumbnail TEXT,
    tags TEXT,                        -- JSON array
    estimated_time INTEGER DEFAULT 5,
    question_count INTEGER,

    -- 결과지/리포트 커스텀
    use_custom_survey INTEGER DEFAULT 0,
    use_custom_result INTEGER DEFAULT 0,
    use_custom_report INTEGER DEFAULT 0,

    -- 상태
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);
```

### 3.2 기존 테이블 활용

| 테이블 | 용도 | 변경 |
|--------|------|------|
| `survey_tool_results` | 독립형 검사 결과 저장 | 유지 |
| `self_diagnosis_results` | 미니진단 익명 결과 | `tool_id` 컬럼 추가 |
| `saved_diagnosis_results` | 미니진단 회원 결과 | `tool_id` 컬럼 추가 |
| `self_diagnosis_templates` | **deprecated** → `survey_tools`로 마이그레이션 |
| `self_diagnosis_template_translations` | 번역 오버레이 | `survey_tools`에 대응하도록 FK 변경 |

### 3.3 `diagnosis-data.ts` → DB 마이그레이션

기존 9개 하드코딩 데이터를 `survey_tools` 테이블에 `type='mini'`로 시드:

```
diet, skin, digestive, pain, women, pediatric, neuro, wellness, head
```

마이그레이션 후 `diagnosis-data.ts`는 DB 폴백 전용으로 유지 (오프라인/빌드 타임 호환).

---

## 4. Question Types (통합)

현재 SurveyTools와 MiniDiagnosis의 질문 타입을 통합:

| type | 설명 | 점수 | SurveyTools | MiniDiagnosis |
|------|------|------|-------------|---------------|
| `radio` | 단일 선택 | options[].score | O | O (유일) |
| `checkbox` | 복수 선택 | 누적 합산 | O | - |
| `nrs` | 숫자 척도 (0-10) | value 직접 | O | - |
| `number` | 숫자 입력 | value 직접 | O | - |
| `text` | 텍스트 입력 | 0 | O | - |
| `textarea` | 장문 입력 | 0 | O | - |
| `select` | 드롭다운 | options[].score | O | - |
| `info` | 안내 텍스트 | 제외 | O | - |
| `date` | 날짜 입력 | 0 | O | - |

미니진단용 권장 타입: `radio` (단순), `nrs` (통증 척도)

---

## 5. Scoring & Results

### 5.1 채점 엔진 (통합)

기존 `survey-tool-runtime.ts`의 `calculateSurveyToolScore()`를 SOT로 사용.
MiniDiagnosis의 단순 합산도 이 엔진으로 통합 (weight=1, reverseScored=false가 기본값).

### 5.2 결과 해석 (standalone)

```json
{
  "scoring": {
    "maxScore": 27,
    "interpretation": [
      { "min": 0, "max": 4, "level": "low", "label": "정상", "description": "..." },
      { "min": 5, "max": 9, "level": "mild", "label": "경미", "description": "..." }
    ]
  }
}
```

### 5.3 결과 해석 (mini — 프로그램 임베드용)

```json
{
  "mini_config": {
    "results": [
      {
        "level": "good",
        "minScore": 0,
        "maxScore": 2,
        "title": "양호합니다",
        "subtitle": "...",
        "description": "...",
        "tags": ["정상", "건강"],
        "cta": {
          "headline": "예방 프로그램 안내",
          "body": "...",
          "link": "/programs/{programSlug}"
        }
      }
    ]
  }
}
```

### 5.4 프로그램별 결과 오버라이드 (programVariants)

같은 질문셋이지만 프로그램에 따라 결과 메시지/CTA가 달라지는 경우:

```json
{
  "program_variants": [
    {
      "programSlug": "digestive",
      "results": [
        { "level": "good", "title": "소화기 건강 양호", "cta": { "link": "/programs/digestive" } }
      ]
    }
  ]
}
```

### 5.5 결과지 페이지 (result)

- **기본 렌더러**: 원형 프로그레스 + 점수 + interpretation 표시 (현재 [...tool].astro)
- **커스텀**: `src/survey-tools/{id}/result.astro` 또는 `src/survey-tools/local/{id}/result.astro`
- `use_custom_result = 1`이면 커스텀 렌더러 사용

### 5.6 리포트 페이지 (report)

- **기본 렌더러**: A4 인쇄용, 한의원 로고 + 환자 정보 + 문항별 응답 + 총점 + 해석 + 권고사항
- **커스텀**: `src/survey-tools/{id}/report.astro`
- 한의원 로고/이름은 `clinic_settings`에서 자동 로드
- PDF 변환은 향후 확장 (브라우저 print → PDF로 현재 충분)

---

## 6. Creation Flow (에이전트 스킬 — 유일한 1차 생산 경로)

### 6.0 왜 에이전트인가

검사도구 제작에는 **도메인 전문성**이 필요하다:
- 어떤 질문을 넣어야 임상적으로 의미 있는지
- 점수 구간을 어떻게 나눠야 과잉진단/과소진단을 피하는지
- 결과 메시지가 환자를 불안하게 하지 않으면서 내원을 유도하는 톤
- red flag 기준 (즉시 내원 권고)

원장님은 임상 판단을 제공하고, 에이전트가 이를 구조화된 도구로 변환한다.
관리자 UI에서 JSON을 편집하는 것은 이 과정의 대체물이 아니다.

### 6.1 `/dev-survey` 스킬 가드레일

```
Phase 1: 컨텍스트 수집
  - "어떤 증상/질환을 진단하려는 건가요?"
  - "독립 검사 페이지가 필요한가요, 프로그램에 임베드할 건가요?"
  - "기존에 사용하시던 설문지가 있나요?" (있으면 구조 분석)
  - "표준화된 척도(PHQ-9, GAD-7 등)를 사용하나요?"

Phase 2: 설계 (에이전트 + 원장 협업)
  - 에이전트가 의학적 근거 기반 문항 초안 제안
  - 원장이 검토/수정 — "이 질문은 우리 환자한테 안 맞아" → 수정
  - 채점 로직 설계 — 점수 범위, 해석 레벨, red flag 기준
  - 결과 메시지 — 레벨별 제목/설명/CTA (원장이 톤 결정)

Phase 3: 생성 + 등록 (에이전트 자동)
  - manifest.json 생성 → src/survey-tools/local/{id}/manifest.json
  - validateSurveyToolManifest() 실행 → 에러 있으면 자동 수정
  - DB 등록 → survey_tools 테이블 INSERT
  - 프로그램 연결 (선택) → 섹션 자동 추가

Phase 4: 검증
  - 미리보기 URL 제공 → 원장이 직접 체험
  - "질문 순서 바꾸고 싶어" → 에이전트가 수정 + 재등록
  - 만족하면 배포
```

### 6.2 생성 결과물

```
src/survey-tools/local/{tool-id}/
  ├── manifest.json          (필수 — 질문, 채점, 결과 정의)
  ├── survey.astro           (선택 — 에이전트가 커스텀 UI 필요 판단 시 생성)
  ├── result.astro           (선택 — 커스텀 결과 페이지)
  └── report.astro           (선택 — 커스텀 리포트)
```

manifest.json은 에이전트가 만든 결과물의 직렬화 포맷. 사람이 직접 편집하는 것이 아님.

### 6.3 등록 자동화

에이전트가 manifest.json 생성 후 자동으로:
1. `validateSurveyToolManifest()` 실행 → 에러 있으면 수정
2. DB에 `INSERT INTO survey_tools` (manifest 데이터를 각 컬럼에 분해 저장)
3. 프로그램 연결 시 해당 프로그램의 sections에 MiniDiagnosis 또는 RelatedDiagnosis 섹션 추가
4. 미리보기 URL 출력: `/ext/survey-tools/{id}`

### 6.4 코어 검사도구 제작 (마스터 에이전트)

마스터 레포에서 `/dev-survey`로 제작한 코어 검사도구:
- `src/survey-tools/{id}/manifest.json`에 저장 (core 경로)
- core:push 시 모든 클라이언트에 배포
- 클라이언트의 로컬 에이전트가 DB sync로 자동 등록
- 클라이언트가 비활성화는 가능하지만 삭제/수정은 불가 (core:pull로 복원됨)

### 6.5 관리자 UI의 역할 (관리 전용, 제작 아님)

| 할 수 있는 것 | 할 수 없는 것 |
|--------------|-------------|
| 검사도구 활성화/비활성화 | 새 검사도구 생성 |
| 순서 변경 | 질문/채점 로직 수정 |
| 미리보기 | manifest.json 편집 |
| 프로그램 연결 확인 | — |

생성/수정은 터미널에서 에이전트와 대화(`/dev-survey`)로만 가능.
관리자 UI에는 "새 검사도구를 만들려면 터미널에서 에이전트에게 요청하세요" 안내 표시.

---

## 7. Program Integration

### 7.1 프로그램 편집기 변경

현재 `[id].astro:103`의 쿼리:
```sql
SELECT ... FROM self_diagnosis_templates WHERE program_id = ?
```

변경 후:
```sql
SELECT id, name, type, description, estimated_time
FROM survey_tools
WHERE is_active = 1
ORDER BY sort_order
```

**모든 활성 검사도구**를 드롭다운에 표시. `program_id` 필터 제거.

### 7.2 섹션 타입 통합

| 현재 | 변경 후 | 설명 |
|------|---------|------|
| `MiniDiagnosis` (programId) | `MiniDiagnosis` (toolId) | DB에서 도구 로드, programId 폴백 유지 |
| `RelatedDiagnosis` (diagnosisId) | `RelatedDiagnosis` (toolId) | 동일하게 toolId 기반 |
| `related-diagnosis` | deprecated → `RelatedDiagnosis`로 통합 | |

### 7.3 `MiniDiagnosisSection.astro` 변경

```
현재: DIAGNOSIS_DATA[programId] || DIAGNOSIS_DATA["diet"]
변경: DB.survey_tools.findById(toolId) → 없으면 DIAGNOSIS_DATA[programId] 폴백
```

1차: `toolId`로 DB에서 `survey_tools` 조회
2차 (폴백): `programId`로 `DIAGNOSIS_DATA` 하드코딩 조회
3차 (최종 폴백): 빈 상태 표시 ("진단 도구를 선택해주세요")

### 7.4 섹션 스키마 변경

`section-schemas.ts`:
```
MiniDiagnosis: {
  fields: [
    title(text),
    toolId(survey-tool-selector),    // 신규 — survey_tools 드롭다운
    programId(text)                   // 유지 — 폴백용
  ]
}

RelatedDiagnosis: {
  fields: [
    title(text),
    subtitle(text),
    toolId(survey-tool-selector)     // diagnosisId → toolId 변경
  ]
}
```

---

## 8. Admin UI

### 8.1 검사도구 관리 (`/admin/surveys/tools`)

현재: 파일 시스템 manifest 목록 + JSON 편집기
변경:
- DB 기반 목록 (survey_tools 테이블)
- 각 도구에 "미리보기", "결과지 미리보기", "프로그램 연결" 버튼
- 신규 생성은 "터미널에서 `/dev-survey` 스킬을 사용하세요" 안내
- 활성/비활성 토글
- 도구 타입 배지 (standalone / mini / hybrid)

### 8.2 프로그램 편집기 (`/admin/programs/[id]`)

섹션 추가 → "관련 자가진단" 선택 시:
- `survey_tools` 테이블에서 `is_active = 1`인 전체 목록 로드
- 타입 필터 (mini 전용 / 전체)
- 선택하면 `toolId`가 섹션 데이터에 저장

---

## 9. Backward Compatibility

| 항목 | 전략 |
|------|------|
| `diagnosis-data.ts` 하드코딩 | DB 폴백용으로 유지. DB에 없으면 여기서 로드 |
| `self_diagnosis_templates` 테이블 | 데이터를 `survey_tools`로 마이그레이션 후 deprecated |
| `self_diagnosis_results` / `saved_diagnosis_results` | `tool_id` 컬럼 추가, 기존 데이터는 NULL 허용 |
| 기존 manifest.json 파일 | `survey-tools-loader.ts`가 빌드 타임에 로드 → DB에 upsert하는 sync 단계 추가 |
| 기존 프로그램의 `programId` 기반 MiniDiagnosis | `toolId` 없으면 `programId`로 폴백 |

---

## 10. Implementation Phases

### Phase 1: DB 기반 전환 (코어)
- [ ] Migration: `survey_tools` 테이블 생성
- [ ] Migration: 기존 9개 `DIAGNOSIS_DATA` → `survey_tools` type='mini' 시드
- [ ] Migration: `stress-check` manifest → `survey_tools` type='standalone' 시드
- [ ] `self_diagnosis_results`에 `tool_id` 컬럼 추가
- [ ] `survey-tools-loader.ts` 수정: 파일 → DB sync 로직 추가 (빌드 타임 또는 서버 시작 시)

### Phase 2: 렌더링 통합 (코어)
- [ ] `MiniDiagnosisSection.astro`: DB 우선 조회 + programId 폴백
- [ ] `section-schemas.ts`: toolId 필드 추가
- [ ] `[id].astro` 프로그램 편집기: `survey_tools` 테이블에서 드롭다운 로드
- [ ] `[...tool].astro`: DB에서 도구 로드 (manifest 파일 폴백)

### Phase 3: 에이전트 스킬 강화 (코어)
- [ ] `/dev-survey` 스킬 리라이트: 가드레일 + DB 등록 자동화
- [ ] manifest 검증 강화: `validateSurveyToolManifest()` 업데이트
- [ ] 프로그램 연결 자동화: 섹션 추가까지 원샷

### Phase 4: 어드민 개선 (코어)
- [ ] `/admin/surveys/tools` DB 기반 목록 + 프리뷰
- [ ] 프로그램 편집기 survey-tool-selector 위젯
- [ ] 결과지/리포트 미리보기 링크

### Phase 5: 결과지/리포트 커스텀 (확장)
- [ ] 기본 결과지 템플릿 개선 (한의원 브랜딩 자동 적용)
- [ ] 기본 리포트 템플릿 (A4 인쇄, 로고, 환자 정보)
- [ ] 커스텀 렌더러 가이드 (dev-survey 스킬에서 안내)

---

## 11. Target Files

| Phase | 파일 | 변경 |
|-------|------|------|
| 1 | `migrations/0932_unified_survey_tools.sql` | 신규 테이블 + 시드 |
| 1 | `src/lib/survey-tools-loader.ts` | DB sync 로직 추가 |
| 2 | `src/components/programs/MiniDiagnosisSection.astro` | DB 우선 조회 |
| 2 | `src/lib/section-schemas.ts` | toolId 필드 추가 |
| 2 | `src/pages/admin/programs/[id].astro` | 드롭다운 소스 변경 |
| 2 | `src/plugins/survey-tools/pages/[...tool].astro` | DB 로드 추가 |
| 3 | `.claude/commands/dev-survey.md` | 가드레일 리라이트 |
| 4 | `src/pages/admin/surveys/tools/index.astro` | DB 기반 목록 |

---

## 12. Verification (DoD)

- [ ] 에이전트로 검사도구 생성 → DB 등록 → 프로그램 섹션 추가 → 환자 페이지에서 실행 가능
- [ ] 기존 9개 미니진단이 기존과 동일하게 렌더링 (폴백 동작)
- [ ] 기존 stress-check 검사도구가 기존과 동일하게 동작
- [ ] 프로그램 편집기에서 새로 만든 검사도구 선택 가능
- [ ] 결과지 페이지에서 점수 + 해석 + 한의원 브랜딩 표시
- [ ] local/ 검사도구가 core:pull에서 보호됨

---

## 13. Constraints

- `src/lib/diagnosis-data.ts`는 삭제하지 않음 (빌드 타임 폴백 + 오프라인 동작)
- `self_diagnosis_templates` 테이블은 deprecated 마킹만, DROP하지 않음
- 코어 검사도구 (stress-check, 9개 미니진단)는 core:pull로 배포
- 클라이언트 커스텀 검사도구는 `src/survey-tools/local/`에만 배치
- manifest.json 스키마는 현재와 100% 호환 유지 (필드 추가만, 삭제 없음)
