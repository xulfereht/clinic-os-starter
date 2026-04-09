# 구현 계획 (Plan) - SPEC-LEAD-NOTIF-001

## 개요

이 문서는 리드 알림 시스템 개선을 위한 구현 계획을 설명합니다.

---

## 마일스톤 (Milestones)

### 마일스톤 1: API 개선 (Primary Goal)
- 상태 필터 제거 및 모든 리드 타입 지원
- 하드코딩된 타입 매핑 제거
- 응답 데이터 구조 단순화

### 마일스톤 2: 프론트엔드 리팩토링 (Primary Goal)
- Web Audio API 기반 사운드 구현
- window.toast API 통합
- 하드코딩 제거 및 동적 처리

### 마일스톤 3: UI/UX 개선 (Secondary Goal)
- 알림 메시지 형식 개선
- 컨텍스트 정보 표시 최적화
- 링크 및 설명 필드 활용

### 마일스톤 4: 테스트 및 검증 (Primary Goal)
- 통합 테스트
- 다양한 리드 타입 테스트
- 브라우저 호환성 테스트

---

## 기술적 접근 (Technical Approach)

### 1. API 개선

#### 1.1 상태 필터 제거

**현재 코드** (check.ts:17-25):
```typescript
const leadResult = await db.prepare(`
    SELECT
        COUNT(*) as count,
        MAX(created_at) as latest_timestamp,
        MAX(id) as latest_id
    FROM leads
    WHERE status IN ('new', 'pending')  -- 하드코딩된 필터
`).first();
```

**개선안**:
```typescript
// 모든 리드를 대상으로 최신 리드 조회
const leadResult = await db.prepare(`
    SELECT
        COUNT(*) as count,
        MAX(created_at) as latest_timestamp,
        MAX(id) as latest_id
    FROM leads
`).first();
```

#### 1.2 타입 매핑 제거

**현재 코드** (check.ts:51-86):
```typescript
const typeMap: Record<string, string> = {
    'visit': '내원상담',
    'consultation': '전화상담',
    // ... 하드코딩된 매핑
};
typeLabel = typeMap[String(lead.type)] || String(lead.type);
```

**개선안**:
```typescript
// 원본 타입을 그대로 반환
latestLeadData = {
    id: lead.id,
    name: lead.name,
    type: lead.type,           // 원본 유지
    patientType: lead.patient_type,  // 원본 유지
    channel: lead.channel,     // 원본 유지
    // ... 나머지 필드
};
```

**이유**:
- 프론트엔드에서 타입에 따른 라벨링을 담당하도록 분리
- API는 데이터 전달에 집중
- 새로운 타입 추가 시 API 수정 불필요

#### 1.3 응답 데이터 구조

**새로운 응답 구조**:
```typescript
interface LeadNotificationResponse {
    leads: {
        count: number;
        newCount: number;
        latestLead: {
            id: number;
            name: string;
            type: string;           // 원본 타입
            patient_type: string;   // 원본 환자 유형
            channel: string;        // 원본 채널
            intake_data?: string;   // JSON 문자열
            summary?: string;
            patient_id?: number;
            isReturning: boolean;
        } | null;
    };
    // ... 나머지 필드 (customerSupport, teamChat 등)
}
```

---

### 2. 프론트엔드 개선

#### 2.1 Web Audio API 사운드

**새로운 사운드 함수** (AdminLayout.astro):
```typescript
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
```

**특징**:
- ToastContainer와 동일한 사운드 패턴 사용
- Base64 인코딩 불필요
- 파일 크기 감소

#### 2.2 window.toast API 통합

**현재 코드**:
```typescript
window.notify(message, "info", {
    link: `/admin/leads/${latest.id}`,
    description: `${channelStr} ${contextStr}`,
});
```

**개선안**:
```typescript
window.toast.info(message, {
    link: `/admin/leads/${latest.id}`,
    description: `${channelStr} ${contextStr}`,
    duration: 5000,  // 리드 알림은 조금 더 길게
});
```

#### 2.3 동적 타입 처리

**타입 라벨링 유틸리티**:
```typescript
// 프론트엔드에서 필요한 경우 선택적 라벨링
function getLeadTypeLabel(type: string): string {
    const labels: Record<string, string> = {
        'visit': '내원상담',
        'consultation': '전화상담',
        'procedure': '시술예약',
        // ...
    };
    return labels[type] || type;  // 기본값으로 원본 타입 반환
}

function getChannelLabel(channel: string): string {
    const labels: Record<string, string> = {
        'chatgpt_app': 'AI 상담',
        'intake_form': '접수 양식',
        // ...
    };
    return labels[channel] || channel;  // 기본값으로 원본 채널 반환
}
```

**장점**:
- 새로운 타입이 추가되어도 기본값으로 표시
- API 변경 불필요
- 유연한 확장성

---

### 3. UI/UX 개선

#### 3.1 알림 메시지 형식

**기본 형식**:
```
제목: 📞 새 리드: [이름]
설명: [유형] | [채널]
```

**상세 형식** (컨텍스트 포함):
```
제목: 📞 [초진/재진] 문의: [이름]
설명: [유형] via [채널]
       "[주증상/관심프로그램]"
```

#### 3.2 링크 및 상호작용

```typescript
window.toast.info(title, {
    description: description,
    link: `/admin/leads/${lead.id}`,
    duration: 5000,
});
```

**사용자 경험**:
- 알림 클릭 시 해당 리드 상세 페이지로 이동
- 5초 후 자동 dismiss (긴 시간으로 충분한 확인 기간 제공)

---

### 4. 아키텍처 변경사항

#### 4.1 관심사 분리

**이전**: API에서 라벨링 처리 → 프론트엔드 표시
**개선**: API는 원본 데이터 전달 → 프론트엔드에서 라벨링 및 표시

**장점**:
- API가 데이터 전달에 집중
- 프론트엔드가 표현 로직 담당
- 새로운 타입 추가 시 API 수정 불필요

#### 4.2 타입에 구애받지 않는 처리

**핵심 원칙**:
- 모든 리드 타입을 동적으로 처리
- 새로운 타입이 추가되어도 코드 수정 불필요
- 기본값(fallback) 처리로 안전성 확보

---

## 리스크 관리 (Risk Management)

### 리스크 1: Web Audio API 호환성

**문제**: 일부 구형 브라우저에서 Web Audio API 미지원

**완화책**:
```typescript
try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    // ... 사운드 재생
} catch (e) {
    console.warn("Sound play failed", e);
    // 조용히 실패 처리 - 알림은 표시되지만 사운드만 재생 안됨
}
```

### 리스크 2: localStorage 사용 불가

**문제**: 프라이빗 모드에서 localStorage 작동 안함

**완화책**:
```typescript
// localStorage 백업으로 메모리 변수 사용
let lastLeadTimestamp = parseInt(
    localStorage.getItem(LEAD_NOTIFICATION_KEY) || "0"
);

// 저장 시 try-catch로 처리
try {
    localStorage.setItem(LEAD_NOTIFICATION_KEY, currentTimestamp.toString());
} catch (e) {
    // localStorage 실패 시 메모리 변수만 업데이트
}
```

### 리스크 3: 기존 window.notify 의존성

**문제**: 다른 코드에서 window.notify를 사용할 수 있음

**완화책**:
```typescript
// AdminLayout.astro에서 기존 어댑터 유지
window.showToast = (message, type = "info", options = {}) => {
    const mappedType = type === "warning" ? "info" : type;
    if (window.toast) {
        window.toast[mappedType](message, options);
    }
};

// window.notify도 window.toast로 라우팅
window.notify = (message, type, options) => {
    if (window.toast) {
        window.toast[type](message, options);
    }
};
```

---

## 테스트 계획 (Test Plan)

### 통합 테스트 시나리오

1. **새 리드 생성**: 다양한 타입의 리드 생성 시 알림 발생 확인
2. **사운드 재생**: Web Audio API로 사운드 정상 재생 확인
3. **링크 이동**: 알림 클릭 시 상세 페이지 정상 이동 확인
4. **타입 매핑**: 새로운 리드 타입 추가 시 알림 정상 작동 확인

### 브라우저 호환성 테스트

- Chrome 90+
- Edge 90+
- Safari 14+
- Firefox 88+

---

## 다음 단계 (Next Steps)

1. **API 수정 시작**: check.ts 파일에서 상태 필터 및 타입 매핑 제거
2. **프론트엔드 수정**: AdminLayout.astro에서 사운드 및 toast API 통합
3. **테스트**: 다양한 시나리오로 통합 테스트 수행
4. **배포**: 개선된 알림 시스템 배포

---

## 참고 자료 (References)

- **ToastContainer SPEC**: SPEC-TOAST-001
- **Web Audio API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- **AdminLayout**: `/src/layouts/AdminLayout.astro`
- **Notification API**: `/src/pages/api/admin/notifications/check.ts`
