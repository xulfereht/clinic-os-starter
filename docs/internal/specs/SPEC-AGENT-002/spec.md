---
id: SPEC-AGENT-002
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

# 에이전트 통신 프로토콜 표준화

## Overview

본 SPEC은 MoAI-ADK 시스템 내 에이전트 간 통신 프로토콜을 표준화하여 일관되고 확장 가능한 통신 체계를 수립합니다. 에이전트 통신은 MoAI의 핵심 메커니즘으로, Orchestrator가 전문화된 Sub-agents에게 작업을 위임하는 방식을 정의합니다.

### 주요 목표

- **표준화된 메시지 형식**: 모든 에이전트 간 통신에 일관된 구조 정의
- **타입 안전성**: 강력한 타입 검증으로 런타임 에러 방지
- **확장성**: 새로운 에이전트와 메시지 타입의 용이한 추가
- **호환성**: 기존 에이전트와의 하위 호환성 보장
- **디버깅 지원**: 구조화된 로그와 추적 기능

### 통신 범위

- Orchestrator → Sub-agent 위임 통신
- Sub-agent → Orchestrator 응답 통신
- Sub-agent 간 간접 통신 (Orchestrator 통해)
- 에이전트 상태 동기화
- 에러 전파 및 복구

## Environment

### 시스템 환경

- **Python 버전**: 3.13+
- **직렬화**: JSON, MessagePack (바이너리 옵션)
- **전송**: 프로세스 내 호출 (Task() API), 추후 RPC 확장 가능

### 제약 사항

- **토큰 제한**: 단일 메시지 최대 10,000 토큰
- **타임아웃**: 기본 30초, 최대 5분
- **중첩 깊이**: 최대 5단계 에이전트 호출

## Assumptions

### 기술 가정 (신뢰도: 높음)

- Pydantic v2를 통한 타입 검증이 충분히 빠름
- JSON 직렬화가 대부분의 사용 사례에 적합
- 비동기 처리가 필수적임

### 아키텍처 가정 (신뢰도: 중간)

- 향후 분산 처리를 위한 RPC 지원이 필요할 수 있음
- 메시지 큐를 통한 비동기 통신이 요구될 수 있음

### 운영 가정 (신뢰도: 높음)

- 모든 에이전트가 동일한 Python 프로세스에서 실행
- 공유 메모리 접근이 가능함

## EARS Requirements

### Requirements (이벤트 기반)

#### REQ-AGENT-001: 메시지 전송
**WHEN** Orchestrator가 Sub-agent에게 작업을 위임하면, 시스템은 표준화된 TaskMessage를 전송해야 한다.

#### REQ-AGENT-002: 응답 반환
**WHEN** Sub-agent가 작업을 완료하면, 시스템은 AgentResponse를 Orchestrator에게 반환해야 한다.

#### REQ-AGENT-003: 에러 전파
**WHEN** Sub-agent에서 에러가 발생하면, 시스템은 구조화된 ErrorDetail을 전파해야 한다.

#### REQ-AGENT-004: 진행 상황 보고
**WHEN** 장기 실행 작업이 진행 중이면, 시스템은 주기적으로 ProgressUpdate를 전송해야 한다.

#### REQ-AGENT-005: 타입 검증
**WHEN** 메시지가 수신되면, 시스템은 Pydantic 모델을 통해 타입을 검증해야 한다.

### Behavior (상태 기반)

#### BEH-AGENT-001: 타임아웃 처리
**IF** 에이전트가 지정된 시간 내에 응답하지 않으면, 시스템은 TimeoutError를 발생시켜야 한다.

#### BEH-AGENT-002: 재시도 로직
**IF** 일시적인 에러가 발생하면, 시스템은 Exponential Backoff로 재시도해야 한다.

#### BEH-AGENT-003: 메시지 순서 보장
**IF** 여러 메시지가 동시에 전송되면, 시스템은 메시지 순서를 보장해야 한다.

#### BEH-AGENT-004: 컨텍스트 보존
**IF** 에이전트 호출이 중첩되면, 시스템은 각 호출의 컨텍스트를 분리하여 보존해야 한다.

### Data (시스템 데이터)

#### DAT-AGENT-001: 메시지 형식
**THE 시스템 SHALL** 모든 통신 메시지에 메시지 ID, 타임스탬프, 발신자, 수신자, 페이로드를 포함해야 한다.

#### DAT-AGENT-002: 에러 세부정보
**THE 시스템 SHALL** 에러 메시지에 에러 코드, 메시지, 스택 트레이스, 복구 제안을 포함해야 한다.

#### DAT-AGENT-003: 통신 로그
**THE 시스템 SHALL** 모든 에이전트 통신을 구조화된 로그에 기록해야 한다.

#### DAT-AGENT-004: 성능 메트릭
**THE 시스템 SHALL** 메시지 크기, 처리 시간, 대기 시간 메트릭을 수집해야 한다.

### Performance (성능)

#### PERF-AGENT-001: 직렬화 오버헤드
**THE 시스템 SHALL** 메시지 직렬화/역직렬화를 5ms 이내에 완료해야 한다.

#### PERF-AGENT-002: 메시지 전달
**THE 시스템 SHALL** 동일 프로세스 내 메시지 전달을 1ms 이내에 완료해야 한다.

#### PERF-AGENT-003: 처리량
**THE 시스템 SHALL** 초당 최소 100개의 에이전트 메시지를 처리해야 한다.

#### PERF-AGENT-004: 메모리 사용
**THE 시스템 SHALL** 메시지 버퍼가 에이전트당 최대 10MB를 초과하지 않아야 한다.

### Interface (인터페이스)

#### INT-AGENT-001: 메시지 기본 클래스
**THE 시스템 SHALL** BaseMessage 추상 클래스를 제공해야 한다.

#### INT-AGENT-002: TaskMessage
**THE 시스템 SHALL** 작업 위임을 위한 TaskMessage 메시지 타입을 제공해야 한다.

#### INT-AGENT-003: AgentResponse
**THE 시스템 SHALL** 응답 반환을 위한 AgentResponse 메시지 타입을 제공해야 한다.

#### INT-AGENT-004: EventBus
**THE 시스템 SHALL** 이벤트 구독 및 발행을 위한 EventBus 인터페이스를 제공해야 한다.

### Security (보안)

#### SEC-AGENT-001: 메시지 검증
**THE 시스템 SHALL** 수신 메시지의 서명과 무결성을 검증해야 한다.

#### SEC-AGENT-002: 권한 확인
**THE 시스템 SHALL** 에이전트 간 호출 권한을 확인해야 한다.

#### SEC-AGENT-003: 민감 정보 필터링
**THE 시스템 SHALL** 로그에 민감 정보(API Key, 비밀번호)가 포함되지 않도록 필터링해야 한다.

#### SEC-AGENT-004: 리소스 제한
**THE 시스템 SHALL** 단일 에이전트의 메시지 처리량을 제한해야 한다.

## Specifications

### 사양 상세

#### SP-AGENT-001: 메시지 기본 구조

```python
from pydantic import BaseModel, Field
from typing import Any, Optional
from datetime import datetime
from enum import Enum

class MessageType(str, Enum):
    """메시지 타입 열거형"""
    TASK = "task"
    RESPONSE = "response"
    ERROR = "error"
    PROGRESS = "progress"
    HEARTBEAT = "heartbeat"

class BaseMessage(BaseModel):
    """모든 통신 메시지의 기본 클래스"""
    message_id: str = Field(..., description="고유 메시지 ID")
    message_type: MessageType = Field(..., description="메시지 타입")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    sender: str = Field(..., description="발신 에이전트 ID")
    receiver: str = Field(..., description="수신 에이전트 ID")
    parent_id: Optional[str] = Field(None, description="부모 메시지 ID (중첩 호출)")
    correlation_id: str = Field(..., description="상관관계 ID (추적용)")
    payload: dict[str, Any] = Field(default_factory=dict)
```

#### SP-AGENT-002: TaskMessage 구조

```python
class TaskMessage(BaseMessage):
    """작업 위임 메시지"""
    message_type: MessageType = MessageType.TASK

    # 작업 정보
    task_id: str = Field(..., description="작업 식별자")
    agent_type: str = Field(..., description="대상 에이전트 타입")
    prompt: str = Field(..., description="작업 프롬프트")
    context: dict[str, Any] = Field(default_factory=dict)

    # 실행 옵션
    timeout: float = Field(default=30.0, description="타임아웃(초)")
    retry_count: int = Field(default=3, description="재시도 횟수")
    priority: int = Field(default=5, description="우선순위 (1-10)")
```

#### SP-AGENT-003: AgentResponse 구조

```python
class ResponseStatus(str, Enum):
    """응답 상태"""
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"
    TIMEOUT = "timeout"

class AgentResponse(BaseMessage):
    """에이전트 응답 메시지"""
    message_type: MessageType = MessageType.RESPONSE
    status: ResponseStatus = Field(..., description="응답 상태")

    # 응답 데이터
    result: dict[str, Any] = Field(default_factory=dict)
    artifacts: list[str] = Field(default_factory=list, description="생성된 파일/리소스")

    # 실행 정보
    execution_time: float = Field(..., description="실행 시간(초)")
    token_usage: dict[str, int] = Field(default_factory=dict)
```

#### SP-AGENT-004: ErrorDetail 구조

```python
class ErrorCode(str, Enum):
    """에러 코드"""
    VALIDATION_ERROR = "VALIDATION_ERROR"
    TIMEOUT_ERROR = "TIMEOUT_ERROR"
    RESOURCE_ERROR = "RESOURCE_ERROR"
    PERMISSION_ERROR = "PERMISSION_ERROR"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"

class ErrorDetail(BaseMessage):
    """에러 상세 메시지"""
    message_type: MessageType = MessageType.ERROR

    # 에러 정보
    error_code: ErrorCode = Field(..., description="에러 코드")
    error_message: str = Field(..., description="에러 메시지")
    stack_trace: Optional[str] = Field(None, description="스택 트레이스")

    # 복구 정보
    recovery_suggestion: Optional[str] = Field(None, description="복구 제안")
    retry_able: bool = Field(default=False, description="재시도 가능 여부")
```

#### SP-AGENT-005: 진행 상황 업데이트

```python
class ProgressUpdate(BaseMessage):
    """진행 상황 업데이트 메시지"""
    message_type: MessageType = MessageType.PROGRESS

    # 진행 정보
    progress: float = Field(..., ge=0, le=100, description="진행률 (0-100)")
    current_step: str = Field(..., description="현재 단계 설명")
    total_steps: int = Field(..., description="전체 단계 수")
    completed_steps: int = Field(..., description="완료된 단계 수")

    # 추정 정보
    estimated_remaining: Optional[float] = Field(None, description="예상 남은 시간(초)")
```

#### SP-AGENT-006: 통신 프로토콜 인터페이스

```python
from abc import ABC, abstractmethod
from typing import Callable, AsyncGenerator

class AgentCommunicationProtocol(ABC):
    """에이전트 통신 프로토콜 인터페이스"""

    @abstractmethod
    async def send_message(self, message: BaseMessage) -> None:
        """메시지 전송"""

    @abstractmethod
    async def receive_message(self, timeout: float = 30.0) -> BaseMessage:
        """메시지 수신 (타임아웃 포함)"""

    @abstractmethod
    async def send_and_wait(
        self,
        message: BaseMessage,
        timeout: float = 30.0
    ) -> BaseMessage:
        """메시지 전송 및 응답 대기"""

    @abstractmethod
    def subscribe(
        self,
        message_type: MessageType,
        handler: Callable[[BaseMessage], None]
    ) -> None:
        """메시지 타입 구독"""

    @abstractmethod
    async def stream_messages(
        self,
        message: BaseMessage
    ) -> AsyncGenerator[BaseMessage, None]:
        """스트리밍 메시지 수신"""
```

#### SP-AGENT-007: 메시지 버스 구현

```python
class EventBus:
    """이벤트 기반 메시지 버스"""

    def __init__(self):
        self._subscribers: dict[MessageType, list[Callable]] = {}
        self._message_queue: asyncio.Queue = asyncio.Queue()
        self._running: bool = False

    async def publish(self, message: BaseMessage) -> None:
        """메시지 발행"""
        await self._message_queue.put(message)

    def subscribe(
        self,
        message_type: MessageType,
        handler: Callable[[BaseMessage], None]
    ) -> None:
        """메시지 핸들러 등록"""
        if message_type not in self._subscribers:
            self._subscribers[message_type] = []
        self._subscribers[message_type].append(handler)

    async def start(self) -> None:
        """이벤트 루프 시작"""
        self._running = True
        while self._running:
            message = await self._message_queue.get()
            handlers = self._subscribers.get(message.message_type, [])
            for handler in handlers:
                await handler(message)

    async def stop(self) -> None:
        """이벤트 루프 중지"""
        self._running = False
```

### 메시지 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                       Orchestrator                          │
│                                                             │
│  1. TaskMessage 생성                                        │
│     - task_id, agent_type, prompt, context                 │
│     - message_id, correlation_id 생성                       │
│                                                             │
│  2. send_message(task_message)                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Message Bus                              │
│                                                             │
│  3. 메시지 라우팅                                           │
│  4. 타입 검증 (Pydantic)                                    │
│  5. 로깅                                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     Sub-agent                               │
│                                                             │
│  6. 메시지 수신 및 역직렬화                                  │
│  7. 작업 실행                                               │
│  8. AgentResponse 생성                                      │
│     - result, artifacts, execution_time, token_usage        │
│                                                             │
│  9. send_message(response)                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 Orchestrator (복귀)                         │
│                                                             │
│  10. 응답 수신                                              │
│  11. correlation_id로 요청 매칭                             │
│  12. 결과 처리                                              │
└─────────────────────────────────────────────────────────────┘
```

## Traceability

### 태그 매핑

| 요구사항 ID | 태그 | 관련 컴포넌트 |
|-------------|------|---------------|
| REQ-AGENT-001 | agent:msg:send | TaskMessage, EventBus |
| REQ-AGENT-002 | agent:msg:response | AgentResponse |
| REQ-AGENT-003 | agent:error:propagate | ErrorDetail |
| REQ-AGENT-004 | agent:progress | ProgressUpdate |
| REQ-AGENT-005 | agent:validation | BaseMessage (Pydantic) |
| PERF-AGENT-001 | agent:perf:serialize | MessageSerializer |
| SEC-AGENT-001 | agent:security:verify | MessageValidator |

### 구현 매핑

- `src/moai_adk/agent/protocol/`: 통신 프로토콜 정의
- `src/moai_adk/agent/messages/`: 메시지 타입 구현
- `src/moai_adk/agent/bus.py`: 이벤트 버스 구현
- `src/moai_adk/agent/validators.py`: 메시지 검증기
- `tests/agent/test_protocol/`: 통신 프로토콜 테스트

### 통합 포인트

- `.claude/agents/`: 에이전트 정의 (메시지 형식 사용)
- `CLAUDE.md`: Orchestrator 위임 로직
- `.moai/config/sections/agent.yaml`: 에이전트 통신 설정
