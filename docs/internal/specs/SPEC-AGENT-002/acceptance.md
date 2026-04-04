# Acceptance Criteria

## Given/When/Then Scenarios

### Scenario 1: 기본 작업 위임

**Given**: Orchestrator가 Sub-agent에게 작업을 위임할 준비가 됨

**When**: Orchestrator가 `Task(agent_type="expert-backend", prompt="API 설계")`를 호출

**Then**:
- TaskMessage가 생성되어야 함
- 메시지에 message_id, correlation_id가 포함되어야 함
- 메시지가 EventBus를 통해 전송되어야 함
- Sub-agent가 메시지를 수신해야 함

### Scenario 2: 성공적인 응답 반환

**Given**: Sub-agent가 작업을 완료하고 결과를 생성함

**When**: Sub-agent가 AgentResponse를 생성하여 반환

**Then**:
- 응답 메시지가 SUCCESS 상태여야 함
- result 필드에 작업 결과가 포함되어야 함
- execution_time이 기록되어야 함
- Orchestrator가 응답을 수신해야 함

### Scenario 3: 에러 전파 및 복구

**Given**: Sub-agent에서 ValidationError가 발생함

**When**: 에러가 상위로 전파됨

**Then**:
- ErrorDetail 메시지가 생성되어야 함
- error_code가 VALIDATION_ERROR여야 함
- recovery_suggestion이 포함되어야 함
- Orchestrator가 에러를 적절히 처리해야 함

### Scenario 4: 타임아웃 처리

**Given**: Sub-agent가 장시간 실행 중 (timeout=30초 설정)

**When**: 30초가 경과함

**Then**:
- 시스템이 TimeoutError를 발생시켜야 함
- Sub-agent 실행이 중단되어야 함
- Timeout 메시지가 기록되어야 함
- Orchestrator가 타임아웃을 처리해야 함

### Scenario 5: 진행 상황 보고

**Given**: Sub-agent가 5단계 작업을 실행 중

**When**: 각 단계가 완료될 때마다

**Then**:
- ProgressUpdate 메시지가 전송되어야 함
- progress가 20%, 40%, 60%, 80%, 100%로 업데이트되어야 함
- current_step에 현재 단계 설명이 포함되어야 함
- Orchestrator가 진행 상황을 표시해야 함

### Scenario 6: 메시지 타입 검증

**Given**: 잘못된 형식의 메시지가 수신됨

**When**: Pydantic 모델이 메시지를 검증

**Then**:
- ValidationError가 발생해야 함
- 에러 메시지에 누락된 필드가 명시되어야 함
- 메시지가 거부되어야 함
- 에러 로그가 기록되어야 함

### Scenario 7: 중첩 에이전트 호출

**Given**: Agent A가 Agent B를 호출하고, Agent B가 Agent C를 호출

**When**: 각 에이전트가 메시지를 전송

**Then**:
- 각 메시지에 고유한 message_id가 있어야 함
- parent_id가 올바르게 설정되어야 함
- correlation_id가 모든 중첩 호출에서 동일해야 함
- 호출 추적이 가능해야 함

### Scenario 8: 대용량 메시지 처리

**Given**: 9,000 토큰 크기의 메시지가 생성됨

**When**: 메시지가 전송됨

**Then**:
- 메시지 크기 검증을 통과해야 함 (최대 10,000 토큰)
- 직렬화가 성공해야 함
- 메시지가 정상적으로 전달되어야 함

### Scenario 9: 대용량 메시지 거부

**Given**: 12,000 토큰 크기의 메시지가 생성됨

**When**: 메시지가 검증됨

**Then**:
- 크기 검증이 실패해야 함
- ValidationError가 발생해야 함
- 사용자에게 명확한 에러 메시지가 표시되어야 함

### Scenario 10: 동시 메시지 처리

**Given**: 3개의 Orchestrator가 동시에 5개씩 메시지 전송 (총 15개)

**When**: 모든 메시지가 EventBus에 도착

**Then**:
- 모든 메시지가 순서대로 처리되어야 함
- 메시지 손실이 없어야 함
- 각 에이전트가 올바른 메시지를 수신해야 함

## Edge Cases

### EC-AGENT-001: 순환 참조

**조건**: Agent A → Agent B → Agent A 호출

**예상 동작**:
- 순환 참조 감지
- 최대 중첩 깊이(5) 도달 시 에러
- 사용자에게 명확한 에러 메시지

### EC-AGENT-002: 누락된 필드

**조건**: message_id가 없는 메시지 수신

**예상 동작**:
- Pydantic 검증 실패
- 구체적인 에러 메시지
- 메시지 거부

### EC-AGENT-003: 잘못된 메시지 타입

**조건**: MessageType 열거형에 없는 타입

**예상 동작**:
- 타입 검증 실패
- 지원되는 타입 목록 제안
- 메시지 거부

### EC-AGENT-004: 만료된 correlation_id

**조건**: 오래된 correlation_id로 응답 수신

**예상 동작**:
- correlation_id 미등록 감지
- 응답 처리 불능 로그
- 적절한 에러 처리

### EC-AGENT-005: 비정상적인 에이전트 종료

**조건**: 메시지 처리 중 에이전트 프로세스 종료

**예상 동작**:
- 에러 감지
- 대기 중인 응답 타임아웃
- 복구 가능 여부 판단

## Performance Criteria

### PC-AGENT-001: 메시지 처리 시간

| 메트릭 | 목표 | 측정 방법 |
|--------|------|-----------|
| 직렬화 | < 5ms | 객체 → JSON 변환 시간 |
| 역직렬화 | < 5ms | JSON → 객체 변환 시간 |
| 전달 (동일 프로세스) | < 1ms | 송신 → 수신 시간 |
| 전체 라운드트립 | < 50ms | 요청 → 응답 전체 시간 |

### PC-AGENT-002: 처리량

| 메트릭 | 목표 | 측정 방법 |
|--------|------|-----------|
| 메시지 처리량 | ≥ 100 msg/s | 초당 처리 메시지 수 |
| 동시 연결 | ≥ 50 | 동시 활성 에이전트 수 |
| 큐 깊이 | ≥ 1000 | 대기 가능 메시지 수 |

### PC-AGENT-003: 메모리 사용

| 메트릭 | 목표 | 측정 방법 |
|--------|------|-----------|
| 에이전트당 버퍼 | < 10MB | 평균 메모리 점유 |
| 메시지당 오버헤드 | < 1KB | 직렬화 후 크기 |
| 전체 시스템 | < 500MB | 모든 에이전트 합계 |

## Quality Gates

### TRUST 5 기준

#### Tested
- 단위 테스트 커버리지 ≥ 90% (프로토콜 핵심)
- 모든 시나리오 통과
- 엣지 케이스 테스트 포함

#### Readable
- 명확한 메시지 필드 명명
- Pydantic 모델 도큐먼트
- 타입 힌트 포함

#### Unified
- Pydantic 모델 형식 일관
- 에러 처리 패턴 통일
- 로그 형식 표준화

#### Secured
- 입력 검증 완료
- 민감 정보 필터링
- 메시지 크기 제한

#### Trackable
- correlation_id 기반 추적
- 모든 메시지 로깅
- 타임스탬프 기록

## Testing Strategy

### 단위 테스트

```python
@pytest.mark.asyncio
async def test_task_message_creation():
    """TaskMessage 생성 테스트"""
    message = TaskMessage(
        message_id="msg-001",
        sender="orchestrator",
        receiver="expert-backend",
        correlation_id="corr-001",
        task_id="task-001",
        agent_type="expert-backend",
        prompt="API 설계"
    )
    assert message.message_type == MessageType.TASK
    assert message.task_id == "task-001"
```

### 통합 테스트

```python
@pytest.mark.asyncio
async def test_round_trip_communication():
    """전체 통신 라운드트립 테스트"""
    event_bus = EventBus()

    # 응답 대기
    response_future = asyncio.Future()

    async def handle_response(msg: BaseMessage):
        if msg.message_type == MessageType.RESPONSE:
            response_future.set_result(msg)

    event_bus.subscribe(MessageType.RESPONSE, handle_response)

    # 작업 전송
    task = TaskMessage(...)
    await event_bus.publish(task)

    # 응답 수신 대기
    response = await asyncio.wait_for(response_future, timeout=5.0)
    assert response.status == ResponseStatus.SUCCESS
```

### 성능 테스트

```python
@pytest.mark.asyncio
async def test_message_throughput():
    """메시지 처리량 테스트"""
    event_bus = EventBus()
    await event_bus.start()

    start_time = time.time()
    messages_sent = 0

    for i in range(1000):
        message = TaskMessage(...)
        await event_bus.publish(message)
        messages_sent += 1

    elapsed = time.time() - start_time
    throughput = messages_sent / elapsed
    assert throughput >= 100  # msg/s

    await event_bus.stop()
```

### 스트레스 테스트

```python
@pytest.mark.asyncio
async def test_concurrent_agents():
    """동시 에이전트 테스트"""
    event_bus = EventBus()
    await event_bus.start()

    async def agent_simulation(agent_id: str, message_count: int):
        for i in range(message_count):
            message = TaskMessage(
                sender=agent_id,
                receiver="orchestrator",
                ...
            )
            await event_bus.publish(message)

    # 50개 에이전트, 각 20개 메시지
    tasks = [agent_simulation(f"agent-{i}", 20) for i in range(50)]
    await asyncio.gather(*tasks)

    await event_bus.stop()
```

## Definition of Done

- [x] 모든 Given/When/Then 시나리오 통과
- [x] 엣지 케이스 처리 완료
- [x] 성능 기준 충족
- [x] TRUST 5 품질 게이트 통과
- [x] 테스트 커버리지 90% 이상 (프로토콜 핵심)
- [x] 기존 에이전트와 호환성 확인
- [x] API 문서 완성
- [x] 에이전트 개발 가이드 작성
- [x] 마이그레이션 가이드 작성
- [x] 코드 리뷰 완료

### 완료 정보

**완료일자**: 2026-02-08
**커밋**: 5a76e6a (feat(agent): 에이전트 통신 프로토콜 표준화)

**품질 검증 결과**:
- TRUST 5: 5/5 PASS
  - Tested: 90% 커버리지 (84개 테스트 통과)
  - Readable: 95% (명확한 명명 규칙, 타입 힌트 100%)
  - Unified: 90% (일관된 Pydantic 모델 형식)
  - Secured: 85% (입력 검증, 크기 제한, 민감 정보 필터링)
  - Trackable: 85% (correlation_id 추적, 구조화된 로그)
- LSP 게이트: 에러 0, 타입 에러 0, 린트 에러 0
- EARS 요구사항: 5/5 충족 (REQ-AGENT-001~005)

**생성된 파일** (26개):
- 메시지 타입 (7개): `src/moai_adk/agent/messages/`
- 통신 프로토콜 (4개): `src/moai_adk/agent/protocol/`
- 직렬화 (4개): `src/moai_adk/agent/serialization/`
- 타입 검증 (3개): `src/moai_adk/agent/validation/`
- 테스트 (10개): `tests/agent/`

## Rollback Criteria

다음 경우 이전 버전으로 롤백 고려:

- 기존 에이전트 동작 파기
- 성능 저하가 50% 이상
- 심각한 메시지 손실 발생
- 추적 불가능한 에러 발생
- 48시간 내 해결 불가능한 문제
