# Clinic-OS

> 이 파일은 Claude Code가 자동으로 읽습니다.
> 현재 상태를 감지하여 설치 또는 운영 모드로 동작합니다.

## 상태 감지

```
[체크] clinic.json 존재?
  ├── ❌ 없음 → 설치 모드 (아래 Section A)
  └── ✅ 있음 → 운영 모드 (아래 Section C)
      [참고] .agent/onboarding-state.json이 없으면 온보딩 미진행 상태.
             /onboarding 스킬로 시작 가능. 운영 모드는 정상 동작.
```

---

## Section A: 설치 모드 (신규)

> 스타터킷 초기 상태입니다. 자동 설치를 진행하세요.

```bash
npm run setup:agent          # 완전 자동 (HQ 인증 포함)
npm run setup:step -- --next # 단계별 진행
npm run setup:step -- --status  # 현재 상태 확인
```

설치 중 문제 시:
| 상황 | 해결 |
|------|------|
| 인증 실패 | `npm run setup:agent -- --reauth` |
| 중간에 멈춤 | `npm run setup:agent` 재실행 |
| 상태 확인 | `npm run setup:step -- --status` |

---

## Section B: 설치 진행중

```bash
npm run setup:step -- --next    # 다음 단계
npm run setup:step -- --status  # 진행 상태
npm run agent:doctor -- --json  # 진단
```

---

## 레거시 파일 정리

세션 시작 시 아래 파일이 존재하면 `.deprecated/` 디렉토리로 이동합니다:

```
AGENTS.md, GEMINI.md, .cursorrules, .windsurfrules, .clinerules
```

이 파일들은 Claude Code 단일 환경 전환(v1.32.4) 이전의 멀티에이전트 잔재입니다.
CLAUDE.md(이 파일)가 유일한 에이전트 진입점입니다.

**정리 절차:**
1. `.deprecated/` 디렉토리 생성 (없으면)
2. 레거시 파일을 `.deprecated/{filename}` 으로 이동 (삭제하지 않음)
3. `.deprecated/README.md`에 기록:
   ```
   | 파일 | 이동일 | 사유 | 대체 |
   |------|--------|------|------|
   | AGENTS.md | 2026-03-29 | Claude Code 단일 환경 전환 | CLAUDE.md |
   ```
4. 사용자에게 보고: "레거시 파일 {N}개를 .deprecated/로 이동했습니다."

> `.deprecated/`는 local 경로이므로 core:pull에 영향 없습니다.

---

## Section C: 운영 모드

**읽는 순서 (SOT hierarchy):**
1. **`SOUL.local.md`** — 에이전트 정체성, 목적, 관계
2. **`MANIFEST.local.md`** — 스킬 맵, 데이터 커넥터, 실행 원칙
3. **이 파일** (CLAUDE.md) — 레포 구조, 안전 규칙, 명령어
4. **`.claude/rules/*.md`** — 자동 로드 가드레일 (파일 안전, 문제해결)

문서 충돌 시 위쪽이 우선합니다.

### 세션 시작 체크리스트

```
1. SOUL.local.md 읽기 (정체성 + 목적)
2. MANIFEST.local.md 읽기 (스킬 + 데이터 커넥터)
3. .agent/handoff.json 확인 (이전 세션 기록)
4. .agent/onboarding-state.json 확인 (온보딩 진행 상태)
5. .agent/skill-registry.json 확인 (가용 스킬 목록 — SOT)
6. .agent/ 디렉토리에 파이프라인 산출물 확인:
   - clinic-profile.json (추출된 한의원 프로파일)
   - style-card.yaml (톤앤매너 + 라이터 페르소나)
   - edge-profile.yaml (포지셔닝 + 차별점)
   - references.yaml (경쟁사/디자인 레퍼런스)
   - site-plan.yaml (홈페이지/프로그램 기획)
   - pipeline-context.yaml (파이프라인 진행 상태)
7. clinic.json 확인 (한의원 식별 정보)
```

### 스킬 찾기

```bash
# 가용 스킬 목록 (SOT)
cat .agent/skill-registry.json

# 스킬 가이드
/help
```

스킬은 `.claude/commands/` 디렉토리에 있습니다. `skill-registry.json`이 SOT이며, scope가 "local" 또는 "universal"인 스킬을 사용할 수 있습니다.

### 콘텐츠 파이프라인

블로그 추출 → 분석 → 기획 → 카피 → 홈페이지 → 프로그램 순서로 진행합니다:

```
/extract-content → clinic-profile.json + DB posts
    ↓
/collect-references (선택) → references.yaml
    ↓
/analyze-content → style-card.yaml + pipeline-context.yaml
    ↓
/discover-edge → edge-profile.yaml
    ↓
/plan-content → site-plan.yaml (readiness + blog 딥링킹)
    ↓
/write-copy → 실제 카피 작성
    ↓
/setup-homepage + /setup-programs → 사이트 구성
```

각 단계는 이전 단계의 산출물을 읽습니다. `pipeline-context.yaml`로 충분성을 체크하고, 데이터가 부족하면 사용자에게 보충을 요청합니다.

상세: `.agent/workflows/content-bootstrap.md`

### 런북 & 문서 네비게이션

| 상황 | 참조 (SOT) |
|------|-----------|
| **초기 설치 중** | `.agent/workflows/setup-runbook.md` — DB 정책, 실패 복구, 체크리스트 |
| **온보딩 진행** | `.agent/workflows/onboarding.md` — 33피처, 5티어, 파이프라인 연결 |
| **콘텐츠 파이프라인** | `.agent/workflows/content-bootstrap.md` — 추출→분석→기획→제작 |
| **코어 업데이트 수신** | `.agent/workflows/operations-runbook.md` — core:pull 절차, 자동 적용 항목 |
| **배포** | `.agent/workflows/operations-runbook.md` — deploy-guard 체크 항목 |
| **문제 해결** | `.agent/workflows/troubleshooting.md` — 에러별 대응 |
| **DB 스키마/시드** | `.agent/workflows/setup-runbook.md` — DDL/DML 분리, d1_seeds 추적 |
| 파일 안전 규칙 | `.claude/rules/clinic-os-safety.md` (자동 로드) |

### 개발 명령어

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run deploy       # Cloudflare Pages 배포
npm run health       # 환경 건강 점수
npm run doctor       # DB 스키마 검증
npm run core:pull    # 코어 업데이트 수신
```

### _local 오버라이드 원칙 (CRITICAL)

core:pull 후 `audit-local.js`가 자동 실행됩니다. 결과를 반드시 확인하세요:
- **STALE**: 코어와 동일하거나 열화된 _local → 즉시 삭제
- **DRIFT**: 코어와 차이 있는 _local → diff 확인 후 코어가 더 나으면 삭제, _local이 필요하면 코어 변경을 머지
- **ORPHAN**: 코어에 없는 _local → 더 이상 필요 없으면 삭제

**_local은 코어 업데이트를 차단합니다.** 반드시 필요한 경우에만 유지하고, 이유를 기록하세요.
_local 생성 시: "왜 코어 대신 _local인가? 코어 흡수 계획은?" 을 `.agent/core-patches.log`에 기록.

### 안전 규칙 (HARD)

- **코어 파일 직접 수정 금지**: `src/pages/`, `src/components/`, `src/lib/`, `scripts/` 등
- **커스텀은 `_local/`과 `local/`에**: `src/pages/_local/`, `src/lib/local/`, `src/plugins/local/`
- **보호 파일 절대 수정 금지**: `wrangler.toml`, `clinic.json`, `.docking/config.yaml`
- core:pull은 코어 파일을 덮어씁니다 → 직접 수정하면 손실됨

상세: `.claude/rules/clinic-os-safety.md`

### 응답 규칙

- 모든 사용자 대면 응답은 **한국어**로
- Markdown 포맷 사용
- 코드 설명은 요청 시에만
- 데이터 변경 전 반드시 확인
