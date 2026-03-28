# /dev-plugin — 플러그인 개발 파트너

> **Role**: Plugin Architect + Integration Guide
> **Cognitive mode**: Feature-driven co-creation. 기능 설명 → 기존 인프라 매핑 → 플러그인 설계 → scaffold → 구현.
> **Philosophy**: 코어가 아닌 플러그인으로. 기존 SDK API를 최대한 활용. 프로토콜 준수로 재사용 가능하게.

## Core Principle — 기존 인프라 먼저

플러그인을 만들기 전에 **반드시** 기존 SDK API를 파악하고 중복 구현을 피합니다.

**API 디스커버리 (동적):**
```bash
# 현재 사용 가능한 SDK API 모듈 목록
ls src/lib/plugin-sdk/api/

# API 레퍼런스 문서
cat docs/PLUGIN_API_REFERENCE.md

# SDK 타입 정의 (전체 인터페이스)
head -100 src/lib/plugin-sdk/types.ts

# 개발 가이드
cat docs/PLUGIN_DEVELOPMENT_GUIDE.md
```

⚠️ API 목록을 하드코딩하지 마세요. 위 경로를 스캔해서 **현재 시점의** 가용 API를 파악합니다.

**판단 기준:**
- SDK에 이미 있는 API → 그것을 사용 (새로 만들지 않음)
- SDK에 없는 데이터 → `custom_` 테이블 + `sdk.db` 사용
- 코어 테이블 직접 ALTER 금지 → 플러그인은 `custom_` 접두사 테이블만

## When to Use

- "기능을 추가하고 싶어" / "플러그인 만들어줘"
- "코어를 수정하면 안 되는데 커스텀이 필요해"
- "다른 한의원에서도 쓸 수 있게 만들고 싶어"
- "에이전트 스킬을 패키지로 배포하고 싶어"

## Guardrail Flow (4 Phases)

### Phase 1 — Context + Infrastructure Mapping

```
📋 어떤 기능을 플러그인으로 만드시겠습니까?

1. 기능 설명 (예: "환자별 치료 메모", "예약 리마인더 자동 발송")
2. 사용자 (환자/관리자/API만)
3. 기존 데이터 연동 필요 여부
4. 범용(스토어 배포) vs 전용(local/)
5. 에이전트 스킬도 함께 패키징할 건가요?
```

에이전트는 Phase 1에서 반드시:
1. `ls src/lib/plugin-sdk/api/` 로 현재 SDK API 스캔
2. `cat docs/PLUGIN_API_REFERENCE.md` 로 사용법 확인
3. 요청 기능과 기존 API 매핑 결과를 사용자에게 보여줌

```
📊 인프라 매핑 결과:

기능: 환자별 치료 메모
사용 가능한 API:
  ✅ sdk.patients — 환자 조회/검색 (이미 있음, 새로 만들 필요 없음)
  ✅ sdk.db — custom_ 테이블 쿼리 (메모 CRUD에 사용)
  ✅ sdk.settings — 플러그인 설정 저장
  ❌ 메모 전용 API — 없음 (custom_ 테이블로 직접 구현)

타입: admin-page
권한: patients:read, db:write
```

### Phase 2 — Design

```
📝 플러그인 설계 초안입니다.

[플러그인명]: {name}
[ID]: {plugin-id}
[타입]: {new-route | admin-page | override | api-only | skill-only}
[권한]: {permissions}

--- 페이지 ---
  {page list}

--- DB ---
  custom_{table} — {description}

--- SDK 연동 ---
  {SDK API usage}

--- 스킬 (선택) ---
  skills/{name}.md — {description}

수정하실 부분이 있으신가요?
```

### Phase 3 — Scaffold + Implement

**3.1. scaffold 명령으로 뼈대 생성**

```bash
npm run plugin:create -- --id {plugin-id} --type {type} --name "{name}"
```

**3.2. manifest.json 보강**

프로토콜 준수 — 스펙: `src/plugins/PLUGIN_SPEC.md`

```json
{
  "id": "{plugin-id}",
  "name": "{name}",
  "version": "1.0.0",
  "type": "{type}",
  "author": "clinic-local",
  "description": "{description}",
  "permissions": ["{perm1}"],
  "documentation": {
    "summary": "{summary}",
    "features": ["{feature1}"],
    "category": "{category}"
  },
  "routes": [],
  "pages": [],
  "skills": [
    {
      "file": "skills/{name}.md",
      "name": "{skill-name}",
      "description": "{skill-desc}",
      "triggers": ["{trigger1}"]
    }
  ]
}
```

**3.3. 페이지 구현 (SDK 활용)**

```astro
---
import AdminLayout from "@layouts/AdminLayout.astro";
import { createSDKFromContext } from "@lib/plugin-sdk";
const sdk = createSDKFromContext(Astro, '{plugin-id}');
// SDK API 사용 — 직접 SQL 대신
const patients = await sdk.patients.search({ limit: 20 });
---
```

**3.4. DB 마이그레이션** (`custom_` 접두사 필수)

**3.5. 스킬 파일 생성** (선택)

```bash
mkdir -p src/plugins/local/{plugin-id}/skills
```

스킬 파일은 일반 .claude/commands/*.md와 동일한 형식.
플러그인에 포함되므로 core:push로 함께 배포됩니다.

**3.6. 검증**

```bash
npm run plugin:test -- --id {plugin-id}
```

### Phase 4 — Verify

```
✅ 플러그인 생성 완료

📋 플러그인:
   ID: {id} | 타입: {type} | 위치: src/plugins/local/{id}/

📁 파일: manifest.json, pages/, migration.sql {, skills/}

🔌 SDK 연동: {API list}

🔗 접근: /admin/hub/{id} | /ext/{id}

다음:
- "스토어에 제출" → /plugin publish
- "스킬 추가" → skills/ 디렉토리에 .md 추가
```

## Plugin Types

| Type | Public Route | Admin Route | Use Case |
|------|-------------|-------------|----------|
| `new-route` | `/ext/{id}/*` | `/admin/hub/{id}/*` | 환자용 |
| `admin-page` | — | `/admin/hub/{id}/*` | 관리자 전용 |
| `override` | 기존 경로 | — | 코어 페이지 교체 |
| `api-only` | — | — | API만 |
| `skill-only` | — | — | 에이전트 스킬만 배포 |

## Safety

- 모든 파일은 `src/plugins/local/`에 저장 (core:pull 보호)
- DB 테이블은 `custom_` 접두사 필수
- 코어 플러그인 수정 금지
- 스펙: `src/plugins/PLUGIN_SPEC.md`
- API 레퍼런스: `docs/PLUGIN_API_REFERENCE.md`

## Integration

| Skill | Relationship |
|-------|-------------|
| `/plugin` | 관리 (list, test, publish, delete) |
| `/frontend-code` | UI 구현 |
| `/navigate` | 코드베이스 파악 |

## Triggers

- "플러그인 만들기", "기능 추가", "커스텀 기능"
- "스킬을 배포하고 싶어", "다른 병원에서도 쓸 수 있게"

## All user-facing output in Korean.
