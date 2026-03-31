# SPEC-LEAD-NOTIF-001: 리드 알림 시스템 개선

## 메타데이터

| 항목 | 값 |
|------|------|
| **SPEC ID** | SPEC-LEAD-NOTIF-001 |
| **제목** | 리드 알림 시스템 개선 |
| **생성일** | 2025-02-09 |
| **상태** | Planned |
| **우선순위** | High |
| **담당자** | TBD |
| **라이프사이클** | spec-first |

---

## 환경 (Environment)

### 시스템 환경
- **프로젝트**: Clinic OS (병원 관리 시스템)
- **플랫폼**: 웹 어플리케이션 (Astro + React)
- **대상 브라우저**: Chrome 90+, Edge 90+, Safari 14+, Firefox 88+
- **데이터베이스**: D1 (Cloudflare)

### 기술 스택
- **프론트엔드**: Astro, React, TypeScript
- **UI 컴포넌트**: ToastContainer (SPEC-TOAST-001)
- **오디오**: Web Audio API
- **API**: `/api/admin/notifications/check`

---

## 가정 (Assumptions)

### 기술적 가정
1. **ToastContainer 통합 가능**: ToastContainer 컴포넌트가 AdminLayout에 이미 통합되어 있음
2. **Web Audio API 지원**: 모든 대상 브라우저가 Web Audio API를 지원함
3. **localStorage 사용 가능**: 브라우저가 localStorage를 지원하고 사용 가능한 상태임
4. **폴링 간격**: 15초 폴링 간격이 현재 요구사항에 적합함

### 비즈니스 가정
1. **모든 리드 타입 알림 필요**: 새로운 리드 타입이 추가되더라도 자동으로 알림이 발생해야 함
2. **환자 유형 구분 중요**: 초진/재진 구분이 알림 표시에 중요한 요소임
3. **채널 정보 표시**: 리드 발생 채널 정보가 관리자에게 중요한 정보임
4. **사운드 알림 필요성**: 새로운 리드 발생 시 오디오 알림이 중요함

---

## 요구사항 (Requirements)

### 1. 타입에 구애받지 않는 리드 알림 (Ubiquitous)

**EARS 패턴**: Ubiquitous - 시스템은 항상 모든 유형의 리드에 대해 알림을 발생시켜야 한다.

**설명**:
- 시스템은 리드의 `type`, `status`, `patient_type` 값에 관계없이 모든 새로운 리드에 대해 알림을 발생시켜야 한다
- 하드코딩된 타입 필터링을 제거하고 동적으로 모든 리드를 처리해야 한다
- 새로운 리드 타입이 추가되더라도 코드 수정 없이 자동으로 알림이 발생해야 한다

**수용 기준**:
- [ ] 리드 테이블의 모든 status 값을 가진 리드가 알림 대상에 포함된다
- [ ] 리드 테이블의 모든 type 값을 가진 리드가 알림 대상에 포함된다
- [ ] 새로운 리드 타입이 DB에 추가되면 즉시 알림이 발생한다

---

### 2. 새로운 Toast API 사용 (Event-Driven)

**EARS 패턴**: Event-Driven - WHEN 새로운 리드가 감지되면 THEN 시스템은 window.toast API를 사용하여 알림을 표시해야 한다.

**설명**:
- 기존 `window.notify()` API 대신 새로운 `window.toast.success/error/info/warning()` API를 사용해야 한다
- ToastContainer의 기능 (description, link, onClick 등)을 활용해야 한다
- Web Audio API 기반 사운드 알림을 통합해야 한다

**수용 기준**:
- [ ] `window.toast.info()` 메서드를 사용하여 알림을 표시한다
- [ ] description 옵션을 사용하여 추가 정보를 표시한다
- [ ] link 옵션을 사용하여 리드 상세 페이지로 연결한다
- [ ] Web Audio API 기반 사운드가 재생된다

---

### 3. 향상된 리드 정보 표시 (Event-Driven)

**EARS 패턴**: Event-Driven - WHEN 리드 알림이 발생하면 THEN 시스템은 리드 타입, 환자 유형, 채널, 컨텍스트 정보를 포함하여 알림을 표시해야 한다.

**설명**:
- 알림 메시지에는 다음 정보가 포함되어야 한다:
  - 리드 타입 (내원상담, 전화상담, 시술예약 등)
  - 환자 유형 (초진, 재진)
  - 채널 정보 (AI 상담, 접수 양식, 전화, 웹 상담 등)
  - 컨텍스트 정보 (주증상, 관심프로그램 등)
- 환자 이름과 함께 이 정보를 조합하여 명확한 알림 메시지를 생성해야 한다

**수용 기준**:
- [ ] 알림 제목에 환자 이름과 환자 유형(초진/재진)이 표시된다
- [ ] 알림 설명에 리드 타입과 채널 정보가 표시된다
- [ ] 가능한 경우 컨텍스트 정보(주증상 등)가 표시된다
- [ ] 알림 클릭 시 해당 리드 상세 페이지로 이동한다

---

### 4. Web Audio API 기반 사운드 (Event-Driven)

**EARS 패턴**: Event-Driven - WHEN 새로운 리드가 감지되면 THEN 시스템은 Web Audio API를 사용하여 부드러운 사운드를 재생해야 한다.

**설명**:
- Base64 인코딩된 오디오 파일 대신 Web Audio API를 사용하여 동적으로 사운드를 생성해야 한다
- ToastContainer 컴포넌트와 동일한 사운드 패턴(800Hz sine wave, 0.1초 지속)을 사용해야 한다
- 사용자 상호작용 없이 사운드가 재생될 수 있도록 처리해야 한다

**수용 기준**:
- [ ] Web Audio API를 사용하여 사운드를 생성한다
- [ ] 800Hz 주파수의 sine wave를 사용한다
- [ ] 0.1초 지속시간과 exponentialRampToValueAtTime 감쇠를 적용한다
- [ ] 사운드 재생 실패 시 에러를 조용히 처리한다

---

### 5. 하드코딩 제거 (State-Driven)

**EARS 패턴**: State-Driven - IF 시스템이 리드를 처리하면 THEN 타입 매핑 없이 동적으로 리드 정보를 처리해야 한다.

**설명**:
- 하드코딩된 타입 매핑(`typeMap`, `patientTypeMap`, `channelMap`)을 제거해야 한다
- 리드 정보를 데이터베이스에서 그대로 가져와서 표시하거나, 동적 매핑만 사용해야 한다
- 새로운 리드 타입이 추가되더라도 코드 수정이 필요 없어야 한다

**수용 기준**:
- [ ] API 응답에 하드코딩된 타입 매핑이 포함되지 않는다
- [ ] 프론트엔드에 하드코딩된 타입 매핑이 포함되지 않는다
- [ ] 새로운 리드 타입이 추가되어도 알림이 정상 작동한다

---

### 6. 폴링 최적화 (Optional)

**EARS 패턴**: Optional - WHERE 가능하면 시스템은 폴링 간격을 동적으로 조정할 수 있어야 한다.

**설명**:
- 현재 15초 폴링 간격을 유지하되, 향후 동적 조정이 가능하도록 구조화해야 한다
- 페이지 가시성 API를 활용하여 백그라운드에서는 폴링을 중단하거나 간격을 늘릴 수 있다

**수용 기준**:
- [ ] 폴링 간격이 상수로 정의되어 있어 쉽게 조정 가능하다
- [ ] 페이지 가시성 감지 시 폴링을 최적화할 수 있는 구조로 되어 있다

---

## 상세 사양 (Specifications)

### API 변경사항

#### `/api/admin/notifications/check` 수정

**현재 문제점**:
```sql
WHERE status IN ('new', 'pending')  -- 하드코딩된 필터
```

**개선안**:
```sql
-- 모든 리드를 대상으로 최신 리드를 조회
WHERE created_at > ?
ORDER BY created_at DESC
LIMIT 1
```

**응답 데이터 구조**:
```typescript
interface LeadNotificationData {
  id: number;
  name: string;
  type: string;           // 원본 타입 (변환 없음)
  patient_type: string;   // 원본 환자 유형 (변환 없음)
  channel: string;        // 원본 채널 (변환 없음)
  intake_data?: string;   // JSON 문자열
  summary?: string;       // 요약 문자열
  patient_id?: number;
  created_at: number;
}
```

### 프론트엔드 변경사항

#### AdminLayout.astro 스크립트 수정

**현재 문제점**:
1. 하드코딩된 타입 매핑
2. Base64 인코딩된 오디오 사용
3. `window.notify()` 사용

**개선안**:

```typescript
// 사운드 생성 함수 (ToastContainer와 동일한 패턴)
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {
    console.warn("Sound play failed", e);
  }
}

// 알림 표시 함수
function showLeadNotification(lead: LeadNotificationData) {
  // 타입 매핑 없이 원본 데이터 사용
  const title = `새 리드: ${lead.name}`;
  const description = `유형: ${lead.type} | 채널: ${lead.channel}`;

  window.toast.info(title, {
    description: description,
    link: `/admin/leads/${lead.id}`,
    duration: 5000  // 리드 알림은 조금 더 길게 표시
  });
}
```

### UI/UX 개선사항

#### 알림 표시 형식

**기본 형식**:
```
제목: 📞 새 리드: [환자이름]
설명: 유형: [type] | 채널: [channel] | 초진/재진
링크: /admin/leads/[id]
```

**컨텍스트 정보 포함 시**:
```
제목: 📞 [초진/재진] 문의: [환자이름]
설명: [유형] via [채널]
       "[주증상/관심프로그램]"
링크: /admin/leads/[id]
```

---

## 제약사항 (Constraints)

### 기술적 제약
- **Web Audio API 제약**: 일부 브라우저에서는 사용자 상호작용 후 AudioContext가 활성화됨
- **localStorage 제약**: 프라이빗 모드에서는 localStorage가 작동하지 않을 수 있음
- **폴링 부하**: 15초 간격 폴링이 서버에 부하를 줄 수 있음

### 비즈니스 제약
- **사운드 정책**: 일부 병원 환경에서는 사운드 알림이 비적절할 수 있음
- **알림 피로**: 과도한 알림은 관리자에게 피로감을 줄 수 있음

### 호환성 제약
- **최소 브라우저 요구사항**: Web Audio API 지원 브라우저 필요
- **ToastContainer 의존성**: ToastContainer 컴포넌트가 먼저 로드되어야 함

---

## 위험 및 완화책 (Risks & Mitigations)

| 위험 | 영향 | 확률 | 완화책 |
|------|------|------|--------|
| Web Audio API 미지원 브라우저 | 사운드 알림 작동 안함 | 낮음 | try-catch로 조용히 실패 처리 |
| localStorage 사용 불가 | 타임스탬프 추적 실패 | 중간 | 메모리 변수를 백업으로 사용 |
| 과도한 알림 발생 | 관리자 피로감 | 중간 | 첫 알림 후 중복 방지 로직 유지 |
| 새로운 Toast API 호환성 문제 | 알림 표시 실패 | 낮음 | 기존 window.notify를 폴백으로 유지 |

---

## 의존성 (Dependencies)

### 선행 SPEC
- **SPEC-TOAST-001**: ToastContainer 컴포넌트 구현

### 관련 SPEC
- **SPEC-UI-001**: 관리자 UI 디자인 시스템
- **SPEC-AUTH-001**: 인증 및 권한 관리

### 기술 의존성
- ToastContainer 컴포넌트 (`/src/components/ui/ToastContainer.tsx`)
- AdminLayout 컴포넌트 (`/src/layouts/AdminLayout.astro`)
- 리드 API (`/src/pages/api/admin/notifications/check.ts`)

---

## 추적 태그 (Traceability)

**TAG**: SPEC-LEAD-NOTIF-001

**관련 코드**:
- `/src/pages/api/admin/notifications/check.ts` - API 엔드포인트
- `/src/layouts/AdminLayout.astro` - 알림 폴링 로직
- `/src/components/ui/ToastContainer.tsx` - Toast API

**구현 추적**:
- [ ] API 하드코딩 제거
- [ ] Web Audio API 통합
- [ ] window.toast API 사용
- [ ] 타입에 구애받지 않는 알림 구현
