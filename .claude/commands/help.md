# /help — Skill Guide

> **Role**: Skill Navigator
> **Cognitive mode**: Read the skill registry, detect context, show relevant skills. Help the user find the right skill for their intent.

Shows available skill list and recommends skills matching the user's intent.

## Source of Truth

- `.agent/skill-registry.json` — Full skill registry (meta + local)

## Procedure

### Step 1 — Detect environment + load registry

```bash
# Master vs client
if [ -d "hq" ] && [ -d ".mirror-staging" ]; then
  echo "CONTEXT=meta"
else
  echo "CONTEXT=local"
fi

# Read registry
cat .agent/skill-registry.json
```

### Step 2 — Display skill list

Filter by `scope` from registry:

- **Local context**: Show only `scope == "local"` or `scope == "universal"`
- **Meta context**: Show all (meta + local + universal)

Group by category and display:

```
📋 사용 가능한 스킬

🚀 초기 설정
  /onboarding          — 병원 개별화 설정 (53개 기능, 5단계)
  /setup-clinic-info   — 이름, 연락처, 주소 (플레이스 자동 매핑)

📊 데이터 수집/분석
  /extract-content     — 네이버 블로그/플레이스 콘텐츠 임포트
  /curate-images       — 수집된 이미지 분류
  /analyze-content     — 톤앤매너 + 글쓴이 페르소나 추출

🎯 전략/기획
  /discover-edge       — 한의원 강점 발굴 + 포지셔닝
  /plan-content        — 사이트/블로그/프로그램 기획

✍️ 콘텐츠 제작
  /write-copy          — 마케팅 카피 작성
  /write-blog          — 블로그 글 작성 (페르소나 기반)
  /review-compliance   — 의료광고 심의 검토

🏗️ 사이트 구축
  /setup-homepage      — 홈페이지 구성 (프리셋 + 데이터)
  /frontend-code       — 프론트엔드 코드 (레퍼런스 기반 디자인)
  /setup-programs      — 프로그램 페이지 구성
  /setup-skin          — 스킨/테마 적용

🖼️ 이미지
  /enhance-portrait    — 원장 사진 가공
  /generate-scenes     — 장면 이미지 생성

🧩 확장
  /plugin              — 플러그인 관리
  /survey-tool         — 검사도구 관리

🔧 시스템
  /status              — 시스템 대시보드
  /infra-check         — 인프라 점검
  /troubleshoot        — 문제 해결 도우미
  /core-update         — 코어 업데이트
  /migration-test      — 업데이트 시뮬레이션
  /safety-check        — 보호 규칙 점검

📋 운영
  /handoff             — 세션 기록 (어디까지 했는지)
```

In meta context, additionally show:

```
--- 마스터 전용 ---

📦 릴리스
  /clinic-release      — 7단계 릴리스 파이프라인
  /changelog           — 릴리스 노트 생성

🏢 HQ
  /hq-admin            — HQ D1 관리
  /guide-sync          — HQ 가이드 동기화

🔍 클라이언트 운영
  /client-debug        — 원격 클라이언트 진단

📅 마케팅
  /content-calendar    — 발송 추적

📋 운영/추적
  /issue               — 이슈 수집 + 코어 반영
  /audit               — 감사 보고서
  /improvement         — 개선 추적
```

### Step 3 — Intent-based recommendation

When user states a specific intent, match from registry:

| Intent | Recommendation |
|------|------|
| "처음 시작", "셋업" | → `/onboarding` |
| "네이버", "블로그 가져오기" | → `/extract-content` |
| "홈페이지", "디자인" | → `/setup-homepage` or `/frontend-code` |
| "블로그 써줘" | → `/write-blog` |
| "에러", "안 돼" | → `/troubleshoot` |
| "지난번에 뭐 했지" | → `/handoff` |
| "상태", "점검" | → `/status` |
| "업데이트" | → `/core-update` |
| "스킨", "테마" | → `/setup-skin` |
| "강점", "USP" | → `/discover-edge` |

### Step 4 — Flow recommendation

For connected tasks, recommend from registry's `flows`:

```
💡 추천 플로우: 신규 클리닉 셋업

  /setup-clinic-info → /extract-content → /curate-images
  → /analyze-content → /discover-edge → /write-copy
  → /review-compliance → /plan-content → /setup-homepage
  → /frontend-code → /setup-programs → /setup-skin
```

### Step 5 — Guidance

```
💡 /스킬이름 으로 실행하세요.
   무엇을 하고 싶은지 말씀하시면 적절한 스킬을 추천합니다.

   전체 스킬 수: {N}개 ({context}에서 사용 가능: {M}개)
```

## Triggers

- "도움", "도움말", "뭘 할 수 있어?", "명령어", "스킬"
- "help", "what can you do"
- "어떤 기능이 있어?", "뭐부터 해야 해?"

## All user-facing output in Korean.
