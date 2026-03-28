---
id: SPEC-CONTEXT-001
version: 1.0.0
status: draft
created: 2026-02-08
author: moai
priority: P1
lifecycle_level: spec-anchored
---

# 맥락 인지 및 코드 최신성 유지 시스템

## Overview

본 SPEC은 Support Agent가 질의를 올바르게 파악하고, 최신 코드베이스 정보를 반영하여 적절한 답변을 제공하기 위한 시스템을 정의합니다.

기존 SPEC-PERF-003이 응답 속도(TTFT, 처리량)에 집중했다면, 본 SPEC은 **맥락 이해도**와 **코드 최신성**에 집중합니다.

### 핵심 문제

현재 Support Agent의 맥락 파악 및 코드 최신성 유지에 다음과 같은 한계가 있습니다:

1. **코드 인덱싱이 수동임**: `scripts/index-codebase.sh`를 수동으로 실행해야 함
2. **파일 제한**: 최대 200개 파일만 인덱싱됨
3. **자동 업데이트 없음**: 코드 변경이 자동으로 감지되지 않음
4. **맥락 파악 부족**: 질의의 의도를 정확히 파악하지 못함
5. **최신성 보장 불가**: 인덱스가 오래될 수 있음

### 목표

- **자동 인덱싱**: 코드 변경 감지 시 자동으로 Vectorize 인덱스 업데이트
- **맥락 파악 강화**: 질의 의도를 정확히 파악하고 적절한 검색 전략 적용
- **최신성 유지**: 항상 최신 코드를 기반으로 답변 제공
- **전략적 검색**: 질의 유형에 따라 다른 검색 전략 적용

## Environment

### 현재 시스템

- **Support Agent**: Cloudflare Workers (TypeScript/JavaScript)
- **검색 엔진**: Cloudflare Vectorize (벡터 검색)
- **데이터베이스**: D1 (SQLite)
- **인덱싱**: 수동 스크립트 (`index-codebase.sh`)

### 제약 사항

- Cloudflare Workers 환경에서 실행되어야 함
- Vectorize API 사용
- D1 데이터베이스 활용
- Workers AI (Claude/LLaMA) 호출 가능

## EARS Requirements

### Requirements (이벤트 기반)

#### REQ-CTX-001: 코드 변경 감지
**WHEN** 코드베이스에 변경이 발생하면, 시스템은 자동으로 이를 감지해야 한다.

#### REQ-CTX-002: 질의 맥락 파악
**WHEN** 사용자 질의가 수신되면, 시스템은 질의의 의도와 맥락을 파악해야 한다.

#### REQ-CTX-003: 검색 전략 선택
**WHEN** 질의 유형이 파악되면, 시스템은 적절한 검색 전략을 선택해야 한다.

#### REQ-CTX-004: 최신 코드 반영
**WHEN** 답변을 생성할 때, 시스템은 최신 코드베이스 정보를 반영해야 한다.

### Behavior (상태 기반)

#### BEH-CTX-001: 파일 변경 모니터링
**IF** 파일 시스템 변경을 감지할 수 있으면, 시스템은 실시간으로 변경을 추적해야 한다.

#### BEH-CTX-002: 주기적 인덱싱
**IF** 자동 감지가 불가능하면, 시스템은 주기적으로 전체 인덱싱을 수행해야 한다.

#### BEH-CTX-003: 품질 높은 검색
**IF** 질의가 구체적이면, 시스템은 코드 검색을 우선해야 한다.

#### BEH-CTX-004: 지식 우선 검색
**IF** 질의가 추상적이면, 시스템은 지식 베이스(버그/세션) 검색을 우선해야 한다.

### Data (시스템 데이터)

#### DAT-CTX-001: 인덱스 메타데이터
**THE 시스템 SHALL** 인덱스 생성 시간, 파일 수, 마지막 업데이트 시점을 저장해야 한다.

#### DAT-CTX-002: 질의 분류
**THE 시스템 SHALL** 질의를 코드 문제, 지식 질문, 일반 질문으로 분류해야 한다.

#### DAT-CTX-003: 검색 품질
**THE 시스템 SHALL** 검색 결과의 품질(관련성, 신선도)을 추적해야 한다.

### Performance (성능)

#### PERF-CTX-001: 인덱싱 지연
**THE 시스템 SHALL** 코드 변경 후 인덱싱이 5분 이내에 완료되어야 한다.

#### PERF-CTX-002: 검색 응답 시간
**THE 시스템 SHALL** 맥락 파악+검색을 2초 이내에 완료해야 한다.

## Specifications

### SP-CTX-001: 질의 맥락 파악

질의를 분석하여 적절한 검색 전략을 선택합니다.

```typescript
interface QueryIntent {
  type: 'code' | 'knowledge' | 'general' | 'hybrid';
  specificity: 'specific' | 'abstract';
  urgency: 'low' | 'medium' | 'high';
  fileMentions: string[];  // 언급된 파일 경로
  errorContext?: {      // 에러 컨텍스트
    message: string;
    file?: string;
    stack?: string;
  };
}

function analyzeQuery(query: string): QueryIntent {
  const intent: QueryIntent = {
    type: 'general',
    specificity: 'abstract',
    urgency: 'low',
    fileMentions: [],
  };

  // 파일 언급 감지
  const fileMatches = query.match(/[\w\-./]+\.(ts|tsx|js|astro|md)/gi);
  if (fileMatches) {
    intent.fileMentions = [...new Set(fileMatches)];
    intent.type = 'code';
    intent.specificity = 'specific';
  }

  // 에러 패턴 감지
  if (query.includes('Error:') || query.includes('오류') ||
      query.includes('failed') || query.includes('실패')) {
    intent.errorContext = { message: query };
    intent.type = 'code';
    intent.urgency = 'high';
  }

  // 일반적인 질문 감지
  const generalPhrases = [
    '어떻게', 'how to', '방법', 'how do i',
    '설명', 'explain', '가이드', 'guide'
  ];

  if (generalPhrases.some(phrase => query.toLowerCase().includes(phrase))) {
    intent.type = 'knowledge';
    intent.specificity = 'abstract';
  }

  return intent;
}
```

### SP-CTX-002: 자동 코드 인덱싱

GitHub Webhook 또는 파일 시스템 감지를 통한 자동 인덱싱.

```typescript
interface IndexMetadata {
  lastIndexed: number;    // Unix timestamp
  fileCount: number;
  indexedFiles: string[]; // 인덱싱된 파일 목록
  indexVersion: string;   // 인덱스 버전 (commit hash 등)
}

class CodeIndexer {
  async function onCodeChange(event: FileChangeEvent): Promise<void> {
    // 1. 변경된 파일 식별
    // 2. Vectorize 인덱스 업데이트
    // 3. 메타데이터 업데이트
  }

  async function fullIndex(options?: IndexOptions): Promise<void> {
    // 전체 코드베이스를 인덱싱
  }
}
```

### SP-CTX-003: 최신성 검증

답변 생성 전 코드 최신성을 확인합니다.

```typescript
interface CodeFreshnessCheck {
  isFresh: boolean;
  staleness: 'fresh' | 'stale' | 'unknown';
  lastIndexed: number;
  ageSeconds: number;
  recommendation: string;
}

async function checkFreshness(): Promise<CodeFreshnessCheck> {
  // 현재 시간과 마지막 인덱싱 시간 비교
  // 변경된 파일이 있는지 확인
  // 적절한 조치 권장
}
```

### SP-CTX-004: 하이브리드 검색 전략

코드 검색과 지식 검색을 결합합니다.

```typescript
interface HybridSearchResult {
  codeResults: SearchResult[];
  knowledgeResults: KnowledgeSearchResult;
  intent: QueryIntent;
  confidence: number;
}

async function hybridSearch(
  query: string,
  intent: QueryIntent
): Promise<HybridSearchResult> {
  const results: HybridSearchResult = {
    codeResults: [],
    knowledgeResults: { similar_bugs: [], similar_sessions: [], trending_issues: [] },
    intent,
    confidence: 0.5,
  };

  // 코드 검색 (구체적 질문)
  if (intent.type === 'code' || intent.type === 'hybrid') {
    if (intent.fileMentions.length > 0) {
      results.codeResults = await searchFiles(intent.fileMentions, query);
    } else {
      results.codeResults = await searchCodebase(query, { topK: 5 });
    }
  }

  // 지식 검색 (추상적 질문)
  if (intent.type === 'knowledge' || intent.type === 'hybrid') {
    results.knowledgeResults = await searchKnowledgeBase(query);
  }

  // 신�도 계산
  results.confidence = calculateConfidence(results);

  return results;
}
```

## 구현 계획

### Phase 1: 질의 맥락 파악 (PRIORITY: P1)

**파일**: `support-agent-worker/src/lib/query-intent.ts`

```typescript
export function analyzeQueryIntent(query: string): QueryIntent {
  // 1. 파일 언급 추출
  // 2. 에러 컨텍스트 감지
  // 3. 질문 유형 분류
  // 4. 긴급도 평가
}
```

**테스트**: `tests/support-agent/test-query-intent.ts`

### Phase 2: 자동 인덱싱 트리거 (PRIORITY: P0)

**파일**: `support-agent-worker/src/lib/code-indexer.ts`

**기능**:
- GitHub Webhook 수신 (`/webhook`)
- 파일 변경 감지
- Vectorize 인덱스 업데이트
- 인덱스 메타데이터 관리

**엔드포인트**:
- `POST /webhook/github` - GitHub push 이벤트
- `POST /internal/trigger-index` - 수동 인덱싱 트리거

### Phase 3: 최신성 검증 (PRIORITY: P1)

**파일**: `support-agent-worker/src/lib/freshness.ts`

**기능**:
- 인덱스 나이 확인
- 파일 변경 감지 (GitHub API 활용)
- 재인덱싱 필요 여부 판단

### Phase 4: 하이브리드 검색 (PRIORITY: P2)

**파일**: `support-agent-worker/src/lib/hybrid-search.ts`

**기능**:
- 질의 의도에 따른 검색 전략
- 코드 + 지식 결합 검색
- 결과 신�도 계산

## Traceability

### 태그 매핑

| 요구사항 ID | 태그 | 관련 컴포넌트 |
|-------------|------|---------------|
| REQ-CTX-001 | ctx:change:detect | CodeIndexer |
| REQ-CTX-002 | ctx:query:intent | query-intent.ts |
| REQ-CTX-003 | ctx:strategy:select | hybrid-search.ts |
| REQ-CTX-004 | ctx:fresh:ensure | freshness.ts |
| PERF-CTX-001 | ctx:index:delay | CodeIndexer |

### 구현 매핑

- `support-agent-worker/src/lib/query-intent.ts` - 질의 맥락 파악
- `support-agent-worker/src/lib/code-indexer.ts` - 자동 인덱싱
- `support-agent-worker/src/lib/freshness.ts` - 최신성 검증
- `support-agent-worker/src/lib/hybrid-search.ts` - 하이브리드 검색
- `support-agent-worker/src/routes/webhook.ts` - GitHub Webhook 핸들러

### 통합 포인트

- `support-agent-worker/src/lib/ai.ts` - processChat()에서 검색 전략 적용
- `support-agent-worker/src/routes/chat.ts` - 질의 처리 메인 로직

## 마이그레이션 안내

### 기존 시스템과의 호환

- 기존 수동 인덱싱 스크립트 유지
- Vectorize 인덱스 구조 유지
- Knowledge 시스템 확장

### 롤백 계획

1. Phase 1: 질의 맥락 파악 구현 (수동 인덱싱 환경에서 테스트)
2. Phase 2: 자동 인덱싱 구현 (GitHub Webhook 연동)
3. Phase 3: 최신성 검증 구현
4. Phase 4: 하이브리드 검색 구현

### 롤백 전략

- 기존 Vectorize 인덱스와 호환되도록 구현
- 기존 Knowledge 시스템을 확장하는 방식
- 점진적 롤백: 맥락 파악 → 자동 인덱싱 → 최신성 검증 → 하이브리드

## Acceptance Criteria

### AC-CTX-001: 질의 맥락 파악
- **Given**: 사용자가 "pages/API 라우터에서 오류가 발생해"라고 질문
- **When**: 질문이 수신되면
- **Then**:
  - 질의 유형: `code`
  - 긴급도: `high`
  - 언급 파일: `src/pages/api/`
  - 에러 컨텍스트: 포함됨

### AC-CTX-002: 자동 코드 변경 감지
- **Given**: GitHub repository에 push가 발생함
- **When**: Webhook이 수신되면
- **Then**:
  - 변경된 파일 목록 추출
  - Vectorize 인덱스 업데이트
  - 메타데이터 갱신
  - 완료까지 5분 이내

### AC-CTX-003: 최신 코드 반영
- **Given**: 코드가 변경되고 인덱싱됨
- **When**: 사용자가 관련 질문을 하면
- **Then**:
  - 최신 코드가 검색 결과에 포함됨
  - 답변에 최신 파일 경로/내용이 반영됨

### AC-CTX-004: 지식 우선 검색
- **Given**: 사용자가 "예약 시스템은 어떻게 작동하나?"라고 질문
- **When**: 질문이 수신되면
- **Then**:
  - 질의 유형: `knowledge`
  - 유사한 세션/버그 검색 우선
  - 코드 검색은 선택적 수행

### AC-CTX-005: 하이브리드 검색
- **Given**: 사용자가 "pages API에서 D1 연동 오류가 나"라고 질문
- **When**: 질문이 수신되면
- **Then**:
  - 코드 검색: `src/pages/api/` 관련 파일
  - 지식 검색: D1 관련 버그/세션
  - 두 결과를 종합하여 답변

## Dependencies

- **필요 의존성**: 없음 (새로운 기능)
- **관련 SPEC**:
  - SPEC-AGENT-002: 에이전트 통신 프로토콜
  - SPEC-SA-RAG-FIX: RAG 품질 개선

## Risks

### 위험 요소

1. **GitHub Webhook 한도**: Webhook 수신이 실패하면 인덱싱이 누락됨
2. **Vectorize API 비용**: 빈번한 인덱싱으로 비용 증가 가능
3. **검색 결과 노이즈**: 하이브리드 검색으로 검색 결과가 너무 많아질 수 있음

### 완화책

1. **주기적 재인덱싱**: 자동 감지와 병행하여 주기 전체 인덱싱 수행
2. **인덱싱 큐 관리**: 너무 자주 인덱싱하지 않도록 제한 (예: 1회/1시간)
3. **결과 랭킹**: 관련성 순으로 결과 정렬 후 상위 N개만 사용
