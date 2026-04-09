# Admin Page Layout Patterns

로컬 코딩 에이전트가 `/admin` 하위 페이지나 로컬 플러그인 관리자 화면을 만들 때 따라야 하는 기준이다.

## 목적

- 관리자 UI의 패딩, 폭, 높이, 스크롤 방식을 일관되게 유지한다.
- 스킨/테마 변경 시 관리자 토큰 상속이 깨지지 않게 한다.
- 편집기형 화면과 일반 설정/목록 화면을 같은 방식으로 만들지 않도록 구분한다.

## 패턴 1: 공통 컨테이너 페이지

대상:

- 목록 페이지
- 설정 페이지
- 대시보드
- 읽기 중심 상세 페이지
- 플러그인 관리자 목록/설정 화면

구성:

```astro
---
import AdminLayout from "../../../layouts/AdminLayout.astro";
import PageContainer from "../../../components/admin/common/PageContainer.astro";
import PageHeader from "../../../components/admin/common/PageHeader.astro";
---

<AdminLayout title="페이지 제목">
  <PageContainer>
    <PageHeader title="페이지 제목" description="설명" />

    <!-- content -->
  </PageContainer>
</AdminLayout>
```

규칙:

- 기본적으로 `PageContainer`를 사용한다.
- 기본 spacing은 `PageContainer`의 `px-4 sm:px-6 lg:px-8 py-8`를 따른다.
- 커스텀 `max-w-*`, `px-*`, `py-*`를 페이지 루트에 다시 쓰지 않는다.
- 폭만 달라야 하면 `PageContainer maxWidth="full|narrow"` 또는 `class="max-w-[...]"`만 추가한다.
- 카드/표/폼은 `bg-[color:var(--bg-surface)]`, `border-[color:var(--border-subtle)]`, `text-[color:var(--text-main)]` 토큰을 우선 사용한다.

## 패턴 2: 편집기 앱 페이지

대상:

- 메신저
- 빌더
- 라이브 프리뷰 편집기
- 본문 에디터 + 사이드 패널 + 미리보기 2~3단 레이아웃
- 플러그인 관리자에서 화면 전체를 써야 하는 custom editor

대표 예:

- `/admin/messages`
- `/admin/programs/[id]`
- `/admin/events/[id]`
- `/admin/pages/[id]`
- `/admin/posts/[id]`

구성 원칙:

```astro
<AdminLayout title="편집기">
  <div class="min-h-full flex overflow-hidden">
    <!-- left / center / right panels -->
  </div>
</AdminLayout>
```

규칙:

- 바깥 `PageContainer`를 억지로 쓰지 않는다.
- 화면을 넓게 쓰는 것이 자연스러우면 padding 없이 둔다.
- 대신 루트 높이는 `min-h-full` 또는 `h-full` 기준으로 잡는다.
- `h-[calc(100dvh-64px)]` 같은 고정 오프셋 계산은 가급적 피한다.
- 내부 패널 스크롤로 해결하고, `AdminLayout` 바깥 스크롤 계약과 충돌하지 않게 한다.
- 모바일에서만 다른 높이가 필요하면 별도 utility class를 두고, 기존 높이 클래스를 CSS selector로 직접 잡는 방식은 피한다.

## 토큰 규칙

관리자 화면은 아래 토큰만 사용한다.

- 색:
  - `--accent`
  - `--accent-strong`
  - `--accent-soft`
  - `--bg-body`
  - `--bg-surface`
  - `--text-main`
  - `--text-muted`
  - `--text-subtle`
  - `--border-subtle`
  - `--danger`
- radius:
  - `--radius-sm`
  - `--radius-md`
  - `--radius-lg`
- shadow:
  - `--shadow-card`

금지:

- `var(--primary)`
- `var(--primary-dark)`
- 하드코딩 색상 남발
- 페이지 루트에서 `bg-white`, `min-h-screen`로 관리자 배경 계약 덮어쓰기

## 플러그인 관리자 페이지 기준

로컬 플러그인에서 `/admin/hub/{pluginId}` 또는 새 관리자 라우트를 만들 때도 같은 기준을 적용한다.

판단 기준:

- 설정/목록/요약 중심이면 `패턴 1`
- 에디터/빌더/메신저형이면 `패턴 2`

추천:

- 플러그인 관리자 첫 화면은 기본적으로 `PageContainer + PageHeader`
- 플러그인에서 full-screen editor가 정말 필요할 때만 편집기 앱 패턴 사용
- 새 페이지를 만들 때는 `docs/internal/PLUGIN_ADMIN_PAGE_STARTERS.md`의 스타터 템플릿을 우선 사용

## 빠른 체크리스트

- 이 페이지는 `PageContainer`가 필요한가?
- 아니면 편집기 앱이라 padding 없는 full-width가 자연스러운가?
- 색상/보더/텍스트가 관리자 토큰을 쓰고 있는가?
- `100dvh - Npx` 같은 하드코딩 높이가 들어가 있지 않은가?
- `bg-white`, `min-h-screen`으로 관리자 배경 계약을 덮어쓰고 있지 않은가?

## 현재 예외로 허용되는 페이지

- `/admin/messages`
  - 채팅 앱 성격이 강하므로 padding 없는 편집기 앱 패턴 유지
- `/admin/manuals/*`
  - 별도 매뉴얼 네비게이션 구조가 있으므로 일반 페이지보다 예외성이 큼

이 두 페이지도 토큰 상속은 지켜야 한다.
