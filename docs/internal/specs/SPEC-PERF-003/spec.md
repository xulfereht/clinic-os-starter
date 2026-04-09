---
id: SPEC-PERF-003
version: 1.0.0
status: completed
created: 2026-02-08
updated: 2026-02-08
completed: 2026-02-08
author: moai
priority: P1
lifecycle_level: spec-anchored
---

# HISTORY

## 2026-02-08
- Initial SPEC creation

# 오케스트레이션 성능 최적화

## Overview

본 SPEC은 MoAI-ADK 시스템의 전반적인 오케스트레이션 성능을 최적화하여 사용자 경험을 개선하고 리소스 효율성을 높이는 방안을 정의합니다. 오케스트레이션은 MoAI의 핵심 메커니즘으로, 사용자 요청을 받아 적절한 에이전트에게 위임하고 결과를 종합하는 역할을 담당합니다.

### 주요 목표

- **응답 시간 단축**: Time to First Token(TTFT) 및 전체 응답 시간 개선
- **처리량 향상**: 단위 시간당 더 많은 요청 처리
- **리소스 효율화**: 메모리, CPU, 네트워크 사용 최적화
- **스케일링 개선**: 동시 요청 처리 능력 향상
- **사용자 경험 개선**: 지연 시간 감소 및 피드백 개선

### 최적화 범위

- Orchestrator 내부 로직
- 에이전트 호출 파이프라인
- 토큰 관리 및 컨텍스트 최적화
- 캐싱 전략
- 병렬 처리
- 비동기 I/O 최적화

## Environment

### 시스템 환경

- **Python 버전**: 3.13+ (asyncio 개선 활용)
- **운영체제**: macOS, Linux (이벤트 루프 차이 고려)
- **하드웨어**: 8GB+ RAM, 4+ 코어 CPU 권장

### 현재 성능 벤치마크

- **TTFT**: 평균 3-5초
- **전체 응답 시간**: 평균 15-30초
- **동시 요청 처리**: ~5 req/s
- **메모리 사용**: 1-2GB (큰 컨텍스트에서)

## Assumptions

### 기술 가정 (신뢰도: 높음)

- Python 3.13의 asyncio 개선이 성능에 도움이 됨
- 병렬 에이전트 호출이 독립적일 때 효과적임
- 캐싱이 반복 요청에 효과적임

### 워크로드 가정 (신뢰도: 중간)

- 60%의 요청이 독립적 병렬 처리 가능
- 30%의 요청이 이전 결과와 유사함
- 10%의 요청이 순차적 처리가 필요함

### 사용자 가정 (신뢰도: 높음)

- 사용자는 빠른 피드백을 선호함
- 첫 번째 토큰이 중요함 (TTFT)
- 전체 응답 속도도 중요함

## EARS Requirements

### Requirements (이벤트 기반)

#### REQ-PERF-001: 요청 수신
**WHEN** 사용자 요청이 수신되면, 시스템은 100ms 이내에 처리를 시작해야 한다.

#### REQ-PERF-002: 에이전트 병렬 호출
**WHEN** 독립적인 에이전트 호출이 있으면, 시스템은 동시에 실행해야 한다.

#### REQ-PERF-003: 컨텍스트 최적화
**WHEN** 토큰 한도에 근접하면, 시스템은 자동으로 컨텍스트를 최적화해야 한다.

#### REQ-PERF-004: 캐시 조회
**WHEN** 요청이 수신되면, 시스템은 먼저 캐시를 조회해야 한다.

#### REQ-PERF-005: 스트리밍 시작
**WHEN** 에이전트가 첫 번째 응답을 생성하면, 시스템은 즉시 스트리밍을 시작해야 한다.

### Behavior (상태 기반)

#### BEH-PERF-001: 로드 밸런싱
**IF** 동시 요청이 10개를 초과하면, 시스템은 요청을 큐에 분산해야 한다.

#### BEH-PERF-002: 우선순위 처리
**IF** 높은 우선순위 요청이 있으면, 시스템은 먼저 처리해야 한다.

#### BEH-PERF-003: 리소스 모니터링
**IF** CPU나 메모리 사용량이 80%를 초과하면, 시스템은 새 요청을 제한해야 한다.

#### BEH-PERF-004: 적응형 최적화
**IF** 성능 메트릭이 저하되면, 시스템은 자동으로 최적화 전략을 조정해야 한다.

### Data (시스템 데이터)

#### DAT-PERF-001: 성능 메트릭
**THE 시스템 SHALL** TTFT, 전체 응답 시간, 처리량, 리소스 사용량을 수집해야 한다.

#### DAT-PERF-002: 병목 현상 기록
**THE 시스템 SHALL** 각 단계별 소요 시간을 기록하여 병목을 식별해야 한다.

#### DAT-PERF-003: 캐시 통계
**THE 시스템 SHALL** 캐시 적중률, 미스율, 저장 크기를 추적해야 한다.

#### DAT-PERF-004: 에이전트 성능
**THE 시스템 SHALL** 각 에이전트의 평균 응답 시간과 성공률을 기록해야 한다.

### Performance (성능)

#### PERF-PERF-001: Time to First Token
**THE 시스템 SHALL** TTFT를 1초 이내로 달성해야 한다 (현재 3-5초).

#### PERF-PERF-002: 전체 응답 시간
**THE 시스템 SHALL** 전체 응답 시간을 10초 이내로 달성해야 한다 (현재 15-30초).

#### PERF-PERF-003: 처리량
**THE 시스템 SHALL** 초당 20개 이상의 요청을 처리해야 한다 (현재 ~5 req/s).

#### PERF-PERF-004: 메모리 효율
**THE 시스템 SHALL** 메모리 사용량을 50% 이상 감소시켜야 한다.

#### PERF-PERF-005: 캐시 적중률
**THE 시스템 SHALL** 캐시 적중률을 40% 이상으로 높여야 한다.

### Interface (인터페이스)

#### INT-PERF-001: 성능 모니터링 API
**THE 시스템 SHALL** 실시간 성능 메트릭을 조회할 수 있는 API를 제공해야 한다.

#### INT-PERF-002: 최적화 제어 API
**THE 시스템 SHALL** 최적화 레벨을 조정할 수 있는 API를 제공해야 한다.

#### INT-PERF-003: 캐시 관리 API
**THE 시스템 SHALL** 캐시를 수동으로 제어할 수 있는 API를 제공해야 한다.

#### INT-PERF-004: 프로파일링 API
**THE 시스템 SHALL** 상세한 프로파일링 정보를 제공하는 API를 제공해야 한다.

## Specifications

### 사양 상세

#### SP-PERF-001: 병렬 에이전트 호출

```python
from typing import Any, Dict, List
import asyncio

class ParallelOrchestrator:
    """병렬 에이전트 호출 오케스트레이터"""

    async def execute_parallel_tasks(
        self,
        tasks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """독립적인 작업을 병렬로 실행"""
        # 의존성 분석
        independent_tasks = self._analyze_dependencies(tasks)

        # 병렬 실행
        results = await asyncio.gather(
            *[self._execute_task(task) for task in independent_tasks],
            return_exceptions=True
        )

        # 결과 종합
        return self._aggregate_results(results)

    def _analyze_dependencies(
        self,
        tasks: List[Dict[str, Any]]
    ) -> List[List[Dict[str, Any]]]:
        """작업 간 의존성 분석 및 병렬 그룹 생성"""
        # 의존성 그래프 구축
        # 위상 정렬로 그룹 분리
        pass
```

#### SP-PERF-002: 스마트 캐싱

```python
from typing import Optional, Any
from datetime import datetime, timedelta
import hashlib

class SmartCache:
    """스마트 캐싱 시스템"""

    def __init__(self, max_size: int = 1000, ttl: int = 3600):
        self._cache: Dict[str, tuple[Any, datetime]] = {}
        self._max_size = max_size
        self._ttl = ttl
        self._access_count: Dict[str, int] = {}

    def generate_key(self, prompt: str, context: Dict) -> str:
        """프롬프트와 컨텍스트로 캐시 키 생성"""
        # 중요한 컨텍스트만 포함
        relevant_context = self._extract_relevant_context(context)
        key_data = f"{prompt}:{relevant_context}"
        return hashlib.sha256(key_data.encode()).hexdigest()

    async def get(self, key: str) -> Optional[Any]:
        """캐시 조회 (LRU 고려)"""
        if key in self._cache:
            value, timestamp = self._cache[key]
            if datetime.now() - timestamp < timedelta(seconds=self._ttl):
                self._access_count[key] = self._access_count.get(key, 0) + 1
                return value
            else:
                del self._cache[key]
        return None

    async def set(self, key: str, value: Any) -> None:
        """캐시 저장 (크기 제한 고려)"""
        if len(self._cache) >= self._max_size:
            self._evict_lru()
        self._cache[key] = (value, datetime.now())

    def _extract_relevant_context(self, context: Dict) -> str:
        """컨텍스트에서 캐시 관련 정보만 추출"""
        # 사용자 ID, 프로젝트 ID 등
        # 세부 구현은 사용 패턴에 따라 다름
        return str(context.get("user_id", ""))

    def _evict_lru(self) -> None:
        """LRU(Least Recently Used) 항목 제거"""
        if self._access_count:
            lru_key = min(self._access_count, key=self._access_count.get)
            del self._cache[lru_key]
            del self._access_count[lru_key]
```

#### SP-PERF-003: 컨텍스트 최적화

```python
class ContextOptimizer:
    """컨텍스트 최적화 엔진"""

    def __init__(self, max_tokens: int = 180000):
        self._max_tokens = max_tokens
        self._token_estimator = TokenEstimator()

    def optimize(
        self,
        messages: List[Dict],
        priority_sections: List[str] = None
    ) -> List[Dict]:
        """토큰 한도 내에서 컨텍스트 최적화"""
        estimated_tokens = self._token_estimator.estimate(messages)

        if estimated_tokens <= self._max_tokens:
            return messages

        # 전략 1: 오래된 메시지 제거
        optimized = self._remove_old_messages(messages)

        # 전략 2: 요약 적용
        if self._token_estimator.estimate(optimized) > self._max_tokens:
            optimized = self._summarize_old_messages(optimized)

        # 전략 3: 우선 섹션 유지
        if priority_sections:
            optimized = self._preserve_priority(optimized, priority_sections)

        return optimized

    def _remove_old_messages(self, messages: List[Dict]) -> List[Dict]:
        """오래된 메시지 제거 (최근 N개 유지)"""
        # 시스템 프롬프트는 항상 유지
        system_messages = [m for m in messages if m["role"] == "system"]
        user_messages = [m for m in messages if m["role"] != "system"]

        # 최근 10개 대화 유지
        recent_messages = user_messages[-10:]

        return system_messages + recent_messages
```

#### SP-PERF-004: 비동기 I/O 최적화

```python
import asyncio
from typing import AsyncGenerator, Callable

class AsyncIOOptimizer:
    """비동기 I/O 최적화"""

    def __init__(self, max_concurrent: int = 10):
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._connection_pool = ConnectionPool(size=max_concurrent)

    async def execute_with_limit(
        self,
        coro: Callable,
        *args,
        **kwargs
    ) -> Any:
        """동시성 제한과 함께 실행"""
        async with self._semaphore:
            return await coro(*args, **kwargs)

    async def batch_execute(
        self,
        coros: List[Callable]
    ) -> List[Any]:
        """배치 실행 (연결 풀 활용)"""
        tasks = [
            self.execute_with_limit(coro)
            for coro in coros
        ]
        return await asyncio.gather(*tasks, return_exceptions=True)

    async def stream_with_optimization(
        self,
        source: AsyncGenerator
    ) -> AsyncGenerator:
        """스트리밍 최적화 (버퍼링)"""
        buffer = []
        buffer_size = 100  # 토큰 단위

        async for chunk in source:
            buffer.append(chunk)
            if sum(len(c) for c in buffer) >= buffer_size:
                for item in buffer:
                    yield item
                buffer = []

        # 남은 버퍼 처리
        for item in buffer:
            yield item
```

#### SP-PERF-005: 성능 모니터링

```python
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List
import time

@dataclass
class PerformanceMetric:
    """성능 메트릭"""
    timestamp: datetime
    ttft_ms: float  # Time to First Token
    total_time_ms: float
    token_count: int
    cache_hit: bool
    agent_type: str

class PerformanceMonitor:
    """성능 모니터링 시스템"""

    def __init__(self, window_size: int = 1000):
        self._metrics: List[PerformanceMetric] = []
        self._window_size = window_size
        self._stage_timings: Dict[str, List[float]] = {}

    def record_metric(self, metric: PerformanceMetric) -> None:
        """메트릭 기록"""
        self._metrics.append(metric)
        if len(self._metrics) > self._window_size:
            self._metrics.pop(0)

    def record_stage_time(self, stage: str, duration_ms: float) -> None:
        """단계별 시간 기록"""
        if stage not in self._stage_timings:
            self._stage_timings[stage] = []
        self._stage_timings[stage].append(duration_ms)

    def get_summary(self) -> Dict[str, float]:
        """성능 요약 통계"""
        if not self._metrics:
            return {}

        return {
            "avg_ttft_ms": sum(m.ttft_ms for m in self._metrics) / len(self._metrics),
            "avg_total_time_ms": sum(m.total_time_ms for m in self._metrics) / len(self._metrics),
            "cache_hit_rate": sum(1 for m in self._metrics if m.cache_hit) / len(self._metrics),
            "throughput_per_sec": len(self._metrics) / self._get_time_span_seconds(),
            "p50_ttft": self._percentile([m.ttft_ms for m in self._metrics], 50),
            "p95_ttft": self._percentile([m.ttft_ms for m in self._metrics], 95),
            "p99_ttft": self._percentile([m.ttft_ms for m in self._metrics], 99),
        }

    def identify_bottlenecks(self) -> List[str]:
        """병목 현상 식별"""
        bottlenecks = []
        for stage, timings in self._stage_timings.items():
            avg_time = sum(timings) / len(timings)
            if avg_time > 1000:  # 1초 이상
                bottlenecks.append(f"{stage}: {avg_time:.2f}ms")
        return bottlenecks

    def _percentile(self, values: List[float], p: int) -> float:
        """백분위수 계산"""
        sorted_values = sorted(values)
        index = int(len(sorted_values) * p / 100)
        return sorted_values[min(index, len(sorted_values) - 1)]
```

### 최적화 파이프라인

```
사용자 요청
    ↓
┌─────────────────────────────────────────┐
│         1. 캐시 조회 (5ms)              │
│    - 캐시 적중 시 즉시 반환              │
└────────────┬────────────────────────────┘
             ↓ (캐시 미스)
┌─────────────────────────────────────────┐
│         2. 요청 분석 (10ms)             │
│    - 의존성 분석                        │
│    - 병렬 가능 여부 판단                │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│      3. 컨텍스트 최적화 (50ms)          │
│    - 토큰 추정                          │
│    - 불필요한 컨텍스트 제거             │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│     4. 병렬 에이전트 호출 (변동)        │
│    - 독립적 작업 병렬 실행              │
│    - 결과 집계                          │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│     5. 스트리밍 시작 (즉시)             │
│    - 첫 번째 토큰 전송                  │
│    - 나머지 토큰 스트리밍               │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│         6. 캐시 저장 (10ms)             │
│    - 결과 캐싱                          │
└────────────┬────────────────────────────┘
             ↓
       최종 응답 반환
```

## Traceability

### 태그 매핑

| 요구사항 ID | 태그 | 관련 컴포넌트 |
|-------------|------|---------------|
| REQ-PERF-002 | perf:parallel:exec | ParallelOrchestrator |
| REQ-PERF-004 | perf:cache:lookup | SmartCache |
| REQ-PERF-003 | perf:context:opt | ContextOptimizer |
| PERF-PERF-001 | perf:ttft | StreamingOptimizer |
| PERF-PERF-002 | perf:response:time | PerformanceMonitor |
| PERF-PERF-003 | perf:throughput | ParallelOrchestrator |

### 구현 매핑

- `src/moai_adk/orchestrator/parallel.py`: 병렬 실행 로직
- `src/moai_adk/orchestrator/cache.py`: 스마트 캐싱
- `src/moai_adk/orchestrator/context.py`: 컨텍스트 최적화
- `src/moai_adk/orchestrator/monitor.py`: 성능 모니터링
- `src/moai_adk/orchestrator/streaming.py`: 스트리밍 최적화
- `tests/orchestrator/test_performance/`: 성능 테스트

### 통합 포인트

- `CLAUDE.md`: Orchestrator 메인 로직
- `.claude/agents/`: 에이전트 정의 (병렬 호출 대상)
- `.moai/config/sections/performance.yaml`: 성능 설정
