# 수용 기준 (Acceptance Criteria) - SPEC-LEAD-NOTIF-001

## 개요

이 문서는 리드 알림 시스템 개선을 위한 수용 기준을 정의합니다. 모든 기준은 Given-When-Then 형식으로 작성되었습니다.

---

## 1. 타입에 구애받지 않는 리드 알림

### AC-1.1: 모든 상태의 리드 알림

**Given**: 데이터베이스에 다양한 상태(new, pending, waiting, processing, completed 등)의 리드가 존재하고

**When**: 새로운 리드가 어떤 상태로든 생성되면

**Then**: 시스템은 해당 리드에 대해 알림을 발생시켜야 한다

**검증 방법**:
```sql
-- 테스트 데이터 삽입 (다양한 상태)
INSERT INTO leads (name, type, status, patient_type, channel, created_at)
VALUES
  ('테스트 환자1', 'new_type', 'waiting', 'new', 'chatgpt_app', datetime('now')),
  ('테스트 환자2', 'new_type', 'processing', 'returning', 'intake_form', datetime('now'));

-- 예상: 두 리드 모두 알림 발생
```

---

### AC-1.2: 모든 타입의 리드 알림

**Given**: 데이터베이스에 기존 타입(visit, consultation 등)과 새로운 타입의 리드가 존재하고

**When**: 새로운 타입의 리드가 생성되면

**Then**: 시스템은 코드 수정 없이 해당 리드에 대해 알림을 발생시켜야 한다

**검증 방법**:
```sql
-- 기존 타입
INSERT INTO leads (name, type, status, patient_type, channel, created_at)
VALUES ('테스트1', 'consultation', 'new', 'new', 'phone', datetime('now'));

-- 새로운 타입 (존재하지 않는 타입)
INSERT INTO leads (name, type, status, patient_type, channel, created_at)
VALUES ('테스트2', 'brand_new_type', 'new', 'new', 'web_widget', datetime('now'));

-- 예상: 두 리드 모두 알림 발생, 새로운 타입도 기본값으로 표시
```

---

### AC-1.3: 하드코딩된 필터 제거

**Given**: API 코드가 하드코딩된 상태 필터를 제거하고

**When**: API가 리드를 조회하면

**Then**: 모든 상태의 리드가 조회 대상에 포함되어야 한다

**검증 방법**:
- API 응답에 `WHERE status IN (...)` 조건이 없는지 확인
- 모든 상태의 리드가 응답에 포함되는지 확인

---

## 2. 새로운 Toast API 사용

### AC-2.1: window.toast.info() 사용

**Given**: AdminLayout에 ToastContainer가 로드되어 있고

**When**: 새로운 리드가 감지되면

**Then**: 시스템은 `window.toast.info()` 메서드를 사용하여 알림을 표시해야 한다

**검증 방법**:
```javascript
// 브라우저 콘솔에서 확인
window.toast.info("테스트 알림", {
    description: "설명",
    link: "/admin/leads/1"
});

// 예상: 알림이 표시됨
```

---

### AC-2.2: description 옵션 사용

**Given**: 리드 알림이 발생하고

**When**: 알림이 표시되면

**Then**: description 필드에 리드 상세 정보(유형, 채널, 컨텍스트)가 표시되어야 한다

**검증 방법**:
```javascript
// 알림 표시 확인
window.toast.info("📞 새 리드: 홍길동", {
    description: "consultation | 전화 | 초진",
    link: "/admin/leads/123"
});

// 예상: description이 알림에 표시됨
```

---

### AC-2.3: link 옵션 사용

**Given**: 리드 알림이 표시되어 있고

**When**: 사용자가 알림을 클릭하면

**Then**: 해당 리드의 상세 페이지(`/admin/leads/{id}`)로 이동해야 한다

**검증 방법**:
1. 새로운 리드 생성
2. 알림 대기
3. 알림 클릭
4. URL이 `/admin/leads/{id}`로 변경되는지 확인

---

## 3. 향상된 리드 정보 표시

### AC-3.1: 환자 유형 표시

**Given**: 리드가 환자 유형(patient_type) 정보를 포함하고

**When**: 리드 알림이 발생하면

**Then**: 알림 제목 또는 설명에 초진/재진 정보가 표시되어야 한다

**검증 방법**:
```javascript
// 초진 리드
{
    patient_type: 'new',
    // 예상: "📞 [초진] 문의: 홍길동"
}

// 재진 리드
{
    patient_type: 'returning',
    // 예상: "📞 [재진] 문의: 홍길동"
}
```

---

### AC-3.2: 채널 정보 표시

**Given**: 리드가 채널(channel) 정보를 포함하고

**When**: 리드 알림이 발생하면

**Then**: 알림 설명에 채널 정보가 표시되어야 한다

**검증 방법**:
```javascript
// 다양한 채널 테스트
const channels = ['chatgpt_app', 'intake_form', 'phone', 'web_widget', 'kakao'];

channels.forEach(channel => {
    // 예상: 각 채널이 설명에 표시됨
});
```

---

### AC-3.3: 컨텍스트 정보 표시

**Given**: 리드가 intake_data 또는 summary 정보를 포함하고

**When**: 리드 알림이 발생하면

**Then**: 가능한 경우 컨텍스트 정보(주증상, 관심프로그램 등)가 표시되어야 한다

**검증 방법**:
```javascript
// intake_data 포함
{
    intake_data: '{"main_symptom": "두통"}',
    // 예상: 설명에 "두통" 표시
}

// summary 포함
{
    summary: "[관심프로그램] 다이어트 프로그램",
    // 예상: 설명에 "다이어트 프로그램" 표시
}
```

---

## 4. Web Audio API 기반 사운드

### AC-4.1: Web Audio API 사용

**Given**: 브라우저가 Web Audio API를 지원하고

**When**: 새로운 리드가 감지되면

**Then**: 시스템은 Web Audio API를 사용하여 사운드를 재생해야 한다

**검증 방법**:
```javascript
// 코드 확인
const audioContext = new (window.AudioContext || window.webkitAudioContext);
const oscillator = audioContext.createOscillator();
// ...

// 예상: AudioContext 및 Oscillator 사용
```

---

### AC-4.2: 사운드 패턴

**Given**: 사운드가 재생되고

**When**: 사운드가 생성되면

**Then**: ToastContainer와 동일한 패턴(800Hz sine wave, 0.1초)이어야 한다

**검증 방법**:
```javascript
// 파라미터 확인
oscillator.frequency.value = 800;  // 800Hz
oscillator.type = 'sine';          // sine wave
gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);  // 0.1초

// 예상: 부드럽고 짧은 알림음
```

---

### AC-4.3: 사운드 실패 처리

**Given**: 브라우저가 Web Audio API를 지원하지 않거나 사용자 상호작용이 없고

**When**: 사운드 재생이 시도되면

**Then**: 에러를 조용히 처리하고 알림은 정상 표시되어야 한다

**검증 방법**:
```javascript
// try-catch 확인
try {
    // 사운드 재생
} catch (e) {
    console.warn("Sound play failed", e);
    // 알림은 계속 표시됨
}

// 예상: 사운드 실패 시 알림은 정상 표시
```

---

## 5. 하드코딩 제거

### AC-5.1: API 타입 매핑 제거

**Given**: API가 리드 정보를 반환하고

**When**: 응답을 확인하면

**Then**: 하드코딩된 타입 매핑이 포함되지 않아야 한다

**검증 방법**:
```typescript
// API 응답 확인
{
    "type": "visit",  // 원본 타입
    "patient_type": "new",  // 원본 환자 유형
    "channel": "chatgpt_app",  // 원본 채널
    // 한글로 변환된 라벨이 없어야 함
}

// 예상: 모든 필드가 원본 값
```

---

### AC-5.2: 프론트엔드 타입 매핑 제거

**Given**: 프론트엔드가 리드 알림을 표시하고

**When**: 코드를 확인하면

**Then**: 필수적이지 않은 타입 매핑은 제거되어야 한다

**검증 방법**:
- 프론트엔드 코드에 `typeMap`, `patientTypeMap`, `channelMap` 등이 제거되었는지 확인
- 새로운 타입이 추가되어도 기본값으로 표시되는지 확인

---

### AC-5.3: 새로운 타입 자동 지원

**Given**: 데이터베이스에 새로운 리드 타입이 추가되고

**When**: 해당 타입의 리드가 생성되면

**Then**: 코드 수정 없이 알림이 발생하고 표시되어야 한다

**검증 방법**:
```sql
-- 완전히 새로운 타입 삽입
INSERT INTO leads (name, type, status, patient_type, channel, created_at)
VALUES ('테스트', 'future_type_2025', 'new_status', 'new', 'new_channel', datetime('now'));

-- 예상: 알림 정상 발생, 타입이 "future_type_2025"로 표시됨
```

---

## 6. 품질 기준 (Quality Gates)

### TRUST-5 준수

**Tested (테스트됨)**:
- [ ] 모든 수용 기준에 대한 테스트 케이스 작성
- [ ] 다양한 리드 타입으로 통합 테스트 완료
- [ ] 브라우저 호환성 테스트 완료

**Readable (가독성)**:
- [ ] 코드가 명확한 네이밍을 사용
- [ ] 주석이 복잡한 로직을 설명
- [ ] 일관된 코드 스타일 유지

**Unified (통합됨)**:
- [ ] 기존 ToastContainer API와 통합
- [ ] AdminLayout 스타일과 일관성 유지
- [ ] 에러 처리 패턴 통일

**Secured (보안)**:
- [ ] 사용자 입력에 대한 적절한 검증
- [ ] XSS 공격 방지 (이스케이프 처리)
- [ ] 링크 URL 검증

**Trackable (추적 가능)**:
- [ ] Git 커밋 메시지에 SPEC ID 포함
- [ ] 코드 변경 사항 문서화
- [ ] 테스트 결과 기록

---

## 7. 정의 완료 (Definition of Done)

리드 알림 시스템 개선은 다음 조건이 모두 충족될 때 완료로 간주합니다:

1. **기능 완료**:
   - [ ] 모든 수용 기준(AC-1.1 ~ AC-5.3) 충족
   - [ ] API 하드코딩 제거 완료
   - [ ] Web Audio API 통합 완료
   - [ ] window.toast API 사용 완료

2. **품질 보증**:
   - [ ] TRUST-5 품질 기준 충족
   - [ ] 모든 테스트 케이스 통과
   - [ ] 브라우저 호환성 확인 완료

3. **문서화**:
   - [ ] 코드 변경 사항 문서화
   - [ ] 사용자 가이드 업데이트 (필요 시)
   - [ ] Git 커밋 완료

4. **검증**:
   - [ ] 개발 환경에서 테스트 완료
   - [ ] 스테이징 환경에서 검증 완료
   - [ ] 프로덕션 배포 준비 완료

---

## 8. 테스트 시나리오 (Test Scenarios)

### 시나리오 1: 새로운 리드 타입 테스트

**Given**: 데이터베이스에 존재하지 않는 리드 타입
**When**: 해당 타입의 리드가 생성됨
**Then**: 알림 정상 발생, 타입이 기본값으로 표시됨

### 시나리오 2: 사운드 재생 테스트

**Given**: Web Audio API 지원 브라우저
**When**: 새로운 리드 감지
**Then**: 800Hz sine wave 사운드 0.1초 재생

### 시나리오 3: 링크 이동 테스트

**Given**: 리드 알림 표시됨
**When**: 알림 클릭
**Then**: `/admin/leads/{id}`로 이동

### 시나리오 4: 다양한 상태 테스트

**Given**: 다양한 상태의 리드 (new, pending, waiting, processing)
**When**: 각 상태의 리드가 생성됨
**Then**: 모든 리드에 알림 발생

### 시나리오 5: Web Audio API 미지원 브라우저 테스트

**Given**: Web Audio API 미지원 브라우저
**When**: 새로운 리드 감지
**Then**: 알림만 표시되고 사운드는 조용히 실패

---

## 9. 자동화된 테스트 (Automated Tests)

### 단위 테스트

```typescript
// API 테스트
describe('Lead Notification API', () => {
    it('should return all leads regardless of status', async () => {
        const response = await fetch('/api/admin/notifications/check');
        const data = await response.json();
        expect(data.leads.count).toBeGreaterThan(0);
    });

    it('should return original type without mapping', async () => {
        const response = await fetch('/api/admin/notifications/check');
        const data = await response.json();
        if (data.leads.latestLead) {
            expect(data.leads.latestLead.type).toBeDefined();
            expect(typeof data.leads.latestLead.type).toBe('string');
        }
    });
});
```

### 통합 테스트

```typescript
// 프론트엔드 테스트
describe('Lead Notification UI', () => {
    it('should display toast notification for new lead', () => {
        const lead = {
            id: 1,
            name: '테스트',
            type: 'new_type',
            channel: 'test_channel'
        };
        // 알림 표시 로직 테스트
    });

    it('should play sound using Web Audio API', () => {
        // 사운드 재생 로직 테스트
    });
});
```

---

## 10. 검증 체크리스트 (Verification Checklist)

### 사전 배포 확인

- [ ] 모든 수용 기준 충족
- [ ] TRUST-5 품질 기준 충족
- [ ] 테스트 시나리오 통과
- [ ] 브라우저 호환성 확인
- [ ] 성능 영향 평가
- [ ] 보안 검토 완료
- [ ] 문서화 완료

### 배포 후 확인

- [ ] 프로덕션 환경에서 알림 정상 작동
- [ ] 사운드 정상 재생
- [ ] 링크 정상 이동
- [ ] 새로운 리드 타입 자동 지원
- [ ] 에러 로그 모니터링
