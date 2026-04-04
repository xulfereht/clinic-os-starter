# Plugin Admin Page Starters

로컬 코딩 에이전트가 새 플러그인 관리자 페이지를 만들 때 바로 복사해서 쓸 수 있는 선택형 스타터 템플릿이다.

이 문서는 강제 규칙이 아니다.
기본값으로는 이 구조를 쓰고, 필요할 때만 예외를 둔다.

## 1. 기본 관리자 페이지 스타터

대상:

- 플러그인 설정 페이지
- 목록 페이지
- 요약 대시보드
- 읽기 중심 상세 페이지

```astro
---
import AdminLayout from "../../../layouts/AdminLayout.astro";
import PageContainer from "../../../components/admin/common/PageContainer.astro";
import PageHeader from "../../../components/admin/common/PageHeader.astro";
---

<AdminLayout title="플러그인 관리자">
  <PageContainer class="space-y-6">
    <PageHeader
      title="플러그인 관리자"
      description="기본적인 관리자 설정/목록 화면용 스타터입니다."
    />

    <section class="rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-6 shadow-[var(--shadow-card)]">
      <h2 class="text-lg font-semibold text-[color:var(--text-main)]">섹션 제목</h2>
      <p class="mt-2 text-sm text-[color:var(--text-muted)]">
        관리자 토큰을 그대로 상속하는 기본 카드입니다.
      </p>
    </section>
  </PageContainer>
</AdminLayout>
```

언제 쓰는가:

- 화면 바깥 여백이 자연스러운 경우
- 카드, 폼, 표 중심인 경우
- 메신저/빌더처럼 작업영역이 화면을 꽉 채울 필요가 없는 경우

## 2. 편집기형 관리자 페이지 스타터

대상:

- 메신저형 페이지
- 빌더/에디터
- 본문 편집 + 미리보기 + 보조 패널 레이아웃

```astro
---
import AdminLayout from "../../../layouts/AdminLayout.astro";
---

<AdminLayout title="플러그인 편집기">
  <div class="flex min-h-full overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] shadow-[var(--shadow-card)]">
    <aside class="w-72 shrink-0 border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-body)]">
      <div class="p-4">
        <h2 class="text-sm font-semibold text-[color:var(--text-main)]">사이드 패널</h2>
        <p class="mt-1 text-xs text-[color:var(--text-muted)]">필터/탭/목록</p>
      </div>
    </aside>

    <main class="min-w-0 flex-1 overflow-auto">
      <div class="p-6">
        <h1 class="text-xl font-semibold text-[color:var(--text-main)]">편집 영역</h1>
        <p class="mt-2 text-sm text-[color:var(--text-muted)]">
          전체 화면형 관리자 UI용 스타터입니다.
        </p>
      </div>
    </main>
  </div>
</AdminLayout>
```

언제 쓰는가:

- 작업영역을 넓게 써야 하는 경우
- 내부 패널별 스크롤이 필요한 경우
- `PageContainer` 바깥 여백이 오히려 어색한 경우

## 3. 금지 패턴

아래는 새 플러그인 페이지에서 기본적으로 피한다.

- 루트에 `min-h-screen`
- 루트에 `bg-white`
- `var(--primary)`, `var(--primary-dark)`
- `h-[calc(100dvh-64px)]` 같은 고정 오프셋 높이
- 레이아웃 루트에서 또 다른 전체 페이지 스크롤 컨테이너 만들기

## 4. 선택 기준

질문:

- 카드/설정/목록 중심인가?
  - 예: 기본 관리자 페이지 스타터
- 편집/빌드/채팅 중심인가?
  - 예: 편집기형 관리자 페이지 스타터

## 5. 로컬 에이전트용 지시 문구

새 플러그인 관리자 페이지를 만들 때 아래 기준을 우선 적용한다.

- 기본값은 `기본 관리자 페이지 스타터`
- 메신저/빌더/편집기인 경우에만 `편집기형 관리자 페이지 스타터`
- 관리자 공통 토큰을 유지하고 하드코딩 색/높이는 마지막 수단으로만 사용
- 예외 레이아웃을 쓰면 이유를 코드 주석 또는 작업 메모에 남김
