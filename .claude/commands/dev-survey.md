# /dev-survey — 검사도구 개발 파트너

> **Role**: Survey Tool Architect + Medical Content Designer
> **Cognitive mode**: Guided co-creation. Agent drives structure, clinician drives clinical judgment.
> **Philosophy**: Agent as Producer, Plugin as Format (SPEC Section 0)

검사도구의 **유일한 1차 생산 경로**. 원장과 대화하며 의학적 맥락을 이해하고,
문항 설계 → 채점 로직 → 결과 메시지 → manifest.json 생성 → DB 등록 → 프로그램 연결까지 원샷 자동화.

관리자 UI는 "관리 전용" — 새 도구 생성은 이 스킬에서만 가능합니다.

## When to Use

- "검사도구 만들고 싶어" / "자가진단 만들어줘"
- "프로그램에 미니진단 넣고 싶어"
- "PHQ-9 같은 표준 척도 추가하고 싶어"
- "기존 미니진단 수정하고 싶어"
- 기존 stress-check 외 커스텀 검사도구 필요 시

## Guardrail Flow (4 Phases)

### Phase 1 — Context Collection

```
📋 검사도구를 함께 만들어보겠습니다.

몇 가지 여쭤볼게요:

1. 어떤 증상/질환을 진단하려는 건가요?
   (예: 스트레스, 소화기, 통증, 체질 등)

2. 독립 검사 페이지가 필요한가요, 프로그램에 임베드할 건가요?
   - 독립형 (standalone): /ext/survey-tools/{id} 별도 URL
   - 미니진단 (mini): 프로그램 페이지 내 임베드
   - 복합 (hybrid): 둘 다 가능

3. 기존에 사용하시던 설문지가 있나요?
   (있으면 텍스트로 붙여주시면 구조를 분석합니다)

4. 표준화된 척도(PHQ-9, GAD-7, PSS 등)를 사용하나요?
```

**수집할 정보:**
| 항목 | 필수 | 예시 |
|------|------|------|
| 목적/대상 증상 | O | "소화기 문제 선별" |
| 도구 타입 | O | standalone / mini / hybrid |
| 질문 수 (대략) | O | 4~10개 |
| 연결할 프로그램 | △ | "digestive" 프로그램 |
| 기존 설문지 | △ | 텍스트/이미지 |
| 표준 척도 여부 | △ | PHQ-9, GAD-7 등 |

### Phase 2 — Design (Agent + Clinician Co-creation)

**에이전트가 초안을 제안하고 원장이 검토/수정합니다.**

```
📝 초안을 만들어보았습니다. 검토해주세요.

[도구명]: {tool_name}
[타입]: {standalone | mini | hybrid}
[질문 수]: {n}개
[예상 소요시간]: {n}분

--- 문항 ---

Q1. {question_text}
   ① {option_1} (0점)
   ② {option_2} (2점)
   ③ {option_3} (3점)
   ④ {option_4} (5점) ⚠️ Red Flag

Q2. ...

--- 채점 ---

총점: 0~{maxScore}점
  0~{n}점: {level_1} — {label_1}
  {n+1}~{m}점: {level_2} — {label_2}
  {m+1}~{maxScore}점: {level_3} — {label_3}

--- 결과 메시지 (mini용) ---

[양호] {title} / {subtitle}
  {description}
  CTA: {headline} — {body}

[주의] ...

[위험] ...

수정하실 부분이 있으신가요?
- "질문 순서 바꿔줘"
- "이 질문은 우리 환자한테 안 맞아"
- "점수 구간 조정해줘"
- "결과 메시지 톤 바꿔줘"
- "좋아, 진행해"
```

**설계 원칙:**
- 질문은 4개 이상 권장 (mini: 4개, standalone: 5~15개)
- 각 질문의 선택지에 반드시 점수(value) 배정
- Red flag 옵션은 `"redFlag": true` 마킹 + 즉시 내원 권고
- 결과 메시지는 환자를 불안하게 하지 않으면서 내원을 유도하는 톤
- 점수 구간은 과잉진단/과소진단을 피하는 균형 있는 컷오프

### Phase 3 — Generate + Register (Automated)

원장이 "좋아, 진행해"라고 하면:

**3.1. Tool ID 결정**
```
ID 규칙:
- standalone: {slug} (예: stress-check, phq9)
- mini: {programSlug}-mini (예: diet-mini, pain-mini)
- hybrid: {slug} (예: digestion-check)
```

**3.2. manifest.json 생성**

파일 위치:
- 마스터 레포 코어: `src/survey-tools/{id}/manifest.json`
- 클라이언트 로컬: `src/survey-tools/local/{id}/manifest.json`

```json
{
  "id": "{tool_id}",
  "name": "{tool_name}",
  "description": "{description}",
  "version": "1.0.0",
  "source": "core|local",
  "questionCount": {n},
  "estimatedTime": "{n}분",
  "tags": [...],
  "questions": [
    {
      "id": "q1",
      "type": "radio",
      "question": "...",
      "options": [
        { "label": "...", "value": 0 },
        { "label": "...", "value": 2 },
        { "label": "...", "value": 3 },
        { "label": "...", "value": 5, "redFlag": true }
      ]
    }
  ],
  "scoring": {
    "maxScore": {max},
    "interpretation": [
      { "min": 0, "max": {n}, "level": "low", "label": "...", "description": "..." },
      ...
    ]
  }
}
```

**3.3. Manifest 검증**

manifest.json 작성 후 반드시 검증:

```typescript
import { validateSurveyToolManifest } from '@lib/survey-tool-runtime';
const issues = validateSurveyToolManifest(manifest);
// errors → 자동 수정 후 재검증
// warnings → 사용자에게 알림
```

검증 항목:
- 모든 문항에 id 존재, 중복 없음
- radio/checkbox 문항에 options 배열 존재
- option value 중복 없음
- scoring.interpretation 구간이 겹치지 않음
- maxScore와 문항 기반 계산값 일치

**3.4. DB 등록**

```sql
INSERT INTO survey_tools (
  id, name, description, type, source, version,
  questions, scoring, mini_config, program_variants,
  tags, estimated_time, question_count, disclaimer,
  is_active, sort_order
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  questions = excluded.questions,
  scoring = excluded.scoring,
  mini_config = excluded.mini_config,
  program_variants = excluded.program_variants,
  tags = excluded.tags,
  updated_at = unixepoch();
```

`npx wrangler d1 execute my-clinic-db --local` 로 실행.

**3.5. 프로그램 연결 (mini/hybrid, 선택)**

프로그램의 sections JSON에 MiniDiagnosis 섹션 추가:
```json
{
  "type": "MiniDiagnosis",
  "toolId": "{tool_id}",
  "programId": "{program_slug}",
  "title": "미니 진단"
}
```

### Phase 4 — Verify

```
✅ 검사도구 등록 완료

📋 도구 정보:
   ID: {tool_id}
   이름: {tool_name}
   타입: {standalone | mini | hybrid}
   문항: {n}개 / 예상 {m}분
   소스: {core | local}

📁 생성 파일:
   src/survey-tools/{local/}{id}/manifest.json

🗄️ DB:
   survey_tools 테이블에 등록됨
   {프로그램 연결 있으면: "{program}" 프로그램 섹션에 추가됨}

🔗 미리보기:
   독립형: /ext/survey-tools/{id}
   프로그램: /programs/{program_slug} (MiniDiagnosis 섹션)

다음 할 수 있는 것:
- "질문 수정해줘" → manifest + DB 갱신
- "결과 메시지 바꿔줘" → mini_config 갱신
- "프로그램에 연결해줘" → 섹션 추가
- "커스텀 결과 페이지 만들어줘" → result.astro 생성
```

## Question Types Reference

| type | Description | Score | Use case |
|------|------------|-------|----------|
| `radio` | 단일 선택 | options[].value | 가장 일반적 |
| `checkbox` | 복수 선택 | 누적 합산 | 복합 증상 |
| `nrs` | 숫자 척도 (0-10) | value 직접 | 통증 강도 |
| `number` | 숫자 입력 | value 직접 | 혈압, 체중 |
| `text` | 텍스트 입력 | 0 | 자유 기술 |
| `textarea` | 장문 입력 | 0 | 상세 기술 |
| `select` | 드롭다운 | options[].value | 카테고리 |
| `info` | 안내 텍스트 | 제외 | 인트로/안내 |
| `date` | 날짜 입력 | 0 | 발병일 등 |

미니진단 권장: `radio` (단순), `nrs` (통증 척도)

## Scoring Design Guidelines

- **maxScore**: 모든 문항 최고점 합산. 검증 함수가 자동 계산 후 비교.
- **interpretation 구간**: 겹침 없이 0~maxScore 전체 커버
- **level 명명**: low → mild → moderate → high (또는 good → caution → warning)
- **Red flag**: `"redFlag": true` 옵션 선택 시 결과에 "즉시 내원 권고" 강조
- **CTA**: 각 결과 레벨에 headline + body. 프로그램 연결 시 link 추가.

## Safety

- 코어 도구 (마스터 레포): `src/survey-tools/{id}/`
- 클라이언트 로컬 도구: `src/survey-tools/local/{id}/` (core:pull 보호)
- manifest.json은 에이전트가 생성 — 사람이 직접 편집하지 않음
- DB 등록은 `INSERT OR REPLACE` (멱등)
- 기존 코어 검사도구(stress-check, 9개 mini)는 수정 시 주의

## Integration

| Skill | Relationship |
|-------|-------------|
| `/survey-tool` | 기존 도구 관리/상태 확인 |
| `/setup-programs` | 프로그램에 검사도구 섹션 연결 |
| `/frontend-code` | 커스텀 survey.astro/result.astro 구현 |

## Triggers

- "검사도구 만들기", "자가진단 만들기", "설문 만들기"
- "미니진단 추가", "프로그램에 진단 넣기"
- "PHQ-9 추가", "표준 척도 넣기"
- "기존 진단 수정"

## All user-facing output in Korean.
