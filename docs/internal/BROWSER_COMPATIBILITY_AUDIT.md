# 브라우저 호환성 감사 보고서

> **작성일**: 2026-01-25
> **대상**: Clinic-OS 클라이언트 코드 (Core/Starter Kit)
> **범위**: 인증, 쿠키, fetch API, CSS, JavaScript

---

## 1. 요약 (Executive Summary)

### 발견된 주요 이슈

| 우선순위 | 이슈 | 영향 브라우저 | 파일 수 |
|---------|------|-------------|--------|
| 🔴 높음 | 쿠키 `sameSite` 속성 누락 | Safari, Edge | 8개 |
| 🔴 높음 | fetch `credentials` 옵션 누락 | Safari (Private) | 113개 |
| 🟡 중간 | `secure: true` 로컬 개발 이슈 | 모든 브라우저 (localhost) | 6개 |
| 🟢 낮음 | CSS `backdrop-filter` | 구형 Firefox | 미확인 |

### 영향받는 기능
- **Admin 로그인** - Safari에서 로그인 후 세션 유지 실패
- **회원 로그인** - 동일 이슈
- **API 요청** - 쿠키가 전송되지 않아 401 에러

---

## 2. 상세 분석

### 2.1 쿠키 설정 이슈 (Critical)

#### 문제점
Astro의 `cookies.set()`에서 `sameSite` 옵션이 누락됨.
Safari ITP(Intelligent Tracking Prevention)는 명시적 `sameSite` 없이는 쿠키를 차단할 수 있음.

#### 영향받는 파일

| 파일 | 라인 | 쿠키명 | 현재 설정 |
|------|------|-------|----------|
| `src/pages/api/auth/admin-login.ts` | 52-57 | `admin_session` | `sameSite` 없음 |
| `src/pages/api/auth/admin-login.ts` | 86-91 | `admin_session` | `sameSite` 없음 |
| `src/pages/api/auth/login.ts` | 43-48 | `session` | `sameSite` 없음 |
| `src/pages/api/auth/signup.ts` | 51-56 | `session` | `sameSite` 없음 |
| `src/pages/api/auth/change-password.ts` | 65-70 | `admin_session` | `sameSite` 없음 |
| `src/pages/api/auth/logout.ts` | 13-18, 21-26 | 삭제용 | `sameSite` 없음 |
| `src/middleware.ts` | 11-15 | `brd_locale` | `sameSite` 없음 |
| `src/lib/demo-utils.ts` | 64 | `demo_mode` | `sameSite` 없음 |

#### 권장 수정

```typescript
// Before
cookies.set("admin_session", sessionId, {
    path: "/",
    httpOnly: true,
    secure: true,
    maxAge: 60 * 60 * 24,
});

// After
cookies.set("admin_session", sessionId, {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,  // localhost에서도 동작
    sameSite: "lax",               // 🔴 추가 필수
    maxAge: 60 * 60 * 24,
});
```

### 2.2 Fetch API 이슈 (High)

#### 문제점
클라이언트 사이드 fetch 호출에서 `credentials` 옵션이 누락됨.
Safari Private 모드나 일부 Edge 버전에서 쿠키가 자동 전송되지 않을 수 있음.

#### 영향받는 파일 (113개)
주요 파일만 나열:

| 파일 | 설명 |
|------|------|
| `src/pages/admin/login.astro` | Admin 로그인 |
| `src/pages/admin/index.astro` | 대시보드 API 호출 |
| `src/pages/admin/*.astro` | 모든 Admin 페이지 |
| `src/components/admin/**/*.astro` | Admin 컴포넌트 |
| `src/components/**/*.tsx` | React 컴포넌트 |

#### 권장 수정

```javascript
// Before
const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
});

// After
const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "same-origin",  // 🔴 추가 권장
});
```

### 2.3 Secure 쿠키 로컬 개발 이슈 (Medium)

#### 문제점
`secure: true` 설정은 HTTPS에서만 쿠키 전송.
로컬 개발환경(http://localhost)에서 쿠키가 설정되지 않음.

#### 영향받는 파일
- `src/pages/api/auth/admin-login.ts` (2곳)
- `src/pages/api/auth/login.ts`
- `src/pages/api/auth/signup.ts`
- `src/pages/api/auth/change-password.ts`
- `src/pages/api/auth/logout.ts`

#### 권장 수정

```typescript
// Before
secure: true,

// After
secure: import.meta.env.PROD,  // 프로덕션에서만 secure
```

---

## 3. 수정 체크리스트

### Phase 1: Critical (즉시 수정) ✅ 완료

- [x] **Task 1.1**: `admin-login.ts` - sameSite 추가 (2곳)
- [x] **Task 1.2**: `login.ts` - sameSite 추가
- [x] **Task 1.3**: `signup.ts` - sameSite 추가 (이미 적용됨)
- [x] **Task 1.4**: `change-password.ts` - sameSite 추가
- [x] **Task 1.5**: `logout.ts` - sameSite 추가 (2곳)
- [x] **Task 1.6**: 모든 쿠키에 `secure: import.meta.env.PROD` 적용

### Phase 2: High (1주일 내) - 핵심 완료

- [x] **Task 2.1**: `login.astro` - fetch에 credentials 추가
- [x] **Task 2.2**: `change-password.astro` - fetch에 credentials 추가
- [x] **Task 2.3**: `index.astro` (대시보드) - fetch에 credentials 추가
- [x] **Task 2.4**: `settings/account.astro` - fetch에 credentials 추가 (2곳)
- [ ] **Task 2.5**: 나머지 Admin 페이지들 fetch 수정 (56개 파일 중 나머지)
- [ ] **Task 2.6**: React 컴포넌트 fetch 수정

### Phase 3: Medium (2주일 내)

- [ ] **Task 3.1**: `middleware.ts` - brd_locale 쿠키 sameSite 추가
- [ ] **Task 3.2**: `demo-utils.ts` - demo_mode 쿠키 sameSite 추가
- [ ] **Task 3.3**: CSS 호환성 검토 (backdrop-filter 등)

### Phase 4: Testing

- [ ] **Task 4.1**: Safari (macOS) 테스트
- [ ] **Task 4.2**: Safari (iOS) 테스트
- [ ] **Task 4.3**: Edge (Windows) 테스트
- [ ] **Task 4.4**: Chrome Private Mode 테스트
- [ ] **Task 4.5**: Firefox 테스트

---

## 4. 브라우저별 주의사항

### Safari
- **ITP (Intelligent Tracking Prevention)**: 7일 후 쿠키 만료 가능
- **Private Browsing**: localStorage/sessionStorage 차단
- **sameSite 기본값**: Safari는 None으로 처리할 수 있음 (비일관적)

### Edge
- **InPrivate 모드**: localStorage 제한
- **Tracking Prevention**: 설정에 따라 쿠키 차단 가능

### Firefox
- **Enhanced Tracking Protection**: 서드파티 쿠키 차단
- **Private Browsing**: 세션 종료 시 모든 데이터 삭제

### Chrome
- **Third-party cookie deprecation**: 2024년 이후 단계적 폐지
- **Incognito Mode**: localStorage는 세션 단위

---

## 5. 테스트 방법

### 5.1 Safari 테스트

```bash
# macOS Safari에서 테스트
1. Safari > 환경설정 > 개인 정보 보호
2. "크로스 사이트 추적 방지" 활성화 확인
3. /admin/login 접속 후 로그인
4. /admin 페이지 정상 접근 확인
5. 새로고침 후 세션 유지 확인
```

### 5.2 Edge InPrivate 테스트

```bash
1. Edge > 새 InPrivate 창
2. /admin/login 접속 후 로그인
3. /admin 페이지 정상 접근 확인
```

---

## 6. 추가 권장사항

### 6.1 세션 관리 개선
- 현재: 쿠키만 사용
- 권장: 쿠키 + Authorization 헤더 폴백

### 6.2 에러 핸들링 개선
- 401 응답 시 자동 로그인 페이지 리다이렉트
- 쿠키 설정 실패 시 사용자 알림

### 6.3 모니터링
- 로그인 실패율 모니터링 (브라우저별)
- 세션 만료 패턴 분석

---

## 변경 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2026-01-25 | 1.1 | Phase 1 전체 완료, Phase 2 핵심 파일 완료 |
| 2026-01-25 | 1.0 | 초기 감사 보고서 작성 |
