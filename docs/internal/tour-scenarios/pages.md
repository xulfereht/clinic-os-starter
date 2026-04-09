# 페이지 관리 (/admin/pages) — 투어 시나리오

## 페이지 목적
웹사이트의 일반 페이지(메인, 소개 등)를 관리하고, 새 페이지를 생성하며, 생성자별 페이지 추적(AI 생성 vs 사용자 작성)을 수행합니다.

## 시나리오 (6 스텝)

### Step 1: 페이지 목록 헤더
- **title**: 페이지 관리 개요
- **text**: 페이지 최상단에 "페이지 관리"라는 제목과 "웹사이트의 일반 페이지(메인, 소개 등)를 관리합니다"라는 설명이 있습니다. 우측에는 "+ 새 페이지 만들기" 파란색 버튼이 있어 새 페이지 생성을 시작할 수 있습니다.
- **highlight**: `h1`, `p.text-slate-500`, `#btn-create-page`
- **trigger**: —— (read-only for header, clickable for button)
- **tips**:
  - 헤더는 flex로 배치된 좌측 텍스트 + 우측 버튼
  - 페이지 관리 가이드 링크가 포함될 수 있음 (선택)
  - 모바일에서 버튼이 줄바꿈될 수 있음

### Step 2: 페이지 테이블 (Page List Table)
- **title**: 기존 페이지 목록 조회
- **text**: 페이지 목록이 테이블 형태로 표시됩니다. 각 행은:
  - **페이지명**: 페이지 제목 + 설명 (짧은 요약, 회색)
  - **슬러그 (URL)**: 페이지 경로 (monospace font, 예: `/about`)
  - **생성자**: 생성 방식 (🤖 AI, 👤 User, 👨‍💻 Admin)
  - **상태**: "공개" (초록) 또는 "비공개" (회색)
  - **수정일**: YYYY-MM-DD 형식 타임스탬프
  - **관리**: 연필 아이콘 (수정 링크)
- **highlight**: `table.w-full`, `thead`, `tbody`
- **trigger**: —— (read-only, but action icons clickable)
- **tips**:
  - 테이블은 마우스 호버 시 배경 색상 변함 (.hover:bg-slate-50)
  - 페이지 생성 후 자동 정렬 (updated_at DESC)
  - 빈 페이지 상태: "등록된 페이지가 없습니다." 메시지

### Step 3: 생성자 배지 (Creator Badge)
- **title**: 페이지 생성 출처 식별
- **text**: "생성자" 컬럼의 배지는 페이지 생성 방식을 표시합니다:
  - **🤖 AI**: AI가 자동으로 생성한 페이지 (보라색 배경)
  - **👤 User**: 사용자가 직접 작성한 페이지 (회색 배경)
  - **👨‍💻 Admin**: 관리자가 생성/설정한 페이지 (파란색 배경, 기본값)
  - 이를 통해 페이지의 출처를 한눈에 파악할 수 있습니다.
- **highlight**: `td[set:html=getCreatorBadge(...)]`
- **trigger**: —— (read-only)
- **tips**:
  - created_by 필드 값에 따라 배지 이미지 + 색상 결정
  - HTML 렌더링 (set:html 사용)
  - 필터링 기능은 현재 미지원 (향후 추가 가능)

### Step 4: 페이지 상태 배지 (Status Badge)
- **title**: 페이지 공개 상태
- **text**: "상태" 컬럼의 배지는 페이지의 공개 여부를 표시합니다:
  - **공개** (초록색, #10b981): 웹사이트 방문자가 볼 수 있음
  - **비공개** (회색, #718096): 초안 또는 숨김 상태, 관리자만 접근 가능
  - 상태 변경은 페이지 상세 편집 페이지에서 가능합니다.
- **highlight**: `.inline-flex.items-center.px-2.5.py-0.5.rounded-full` (status badge)
- **trigger**: —— (read-only, state change via detail page)
- **tips**:
  - is_published 필드값으로 결정 (true → 공개, false → 비공개)
  - 조건부 Tailwind 클래스: `${page.is_published ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`
  - 배지는 읽기 전용이며, 목록 페이지에서 수정 불가

### Step 5: 페이지 수정 링크 (Edit Action)
- **title**: 페이지 상세 조회 및 편집
- **text**: 각 페이지 행 우측의 연필 아이콘(✏️)을 클릭하면 `/admin/pages/{page.id}` 상세 페이지로 이동합니다. 여기서 페이지 제목, 슬러그, 설명, 콘텐츠, 공개 상태 등을 수정할 수 있습니다.
- **highlight**: `a[href="/admin/pages/{id}"]` (연필 아이콘)
- **trigger**: click
- **tips**:
  - href: `/admin/pages/${page.id}`
  - 아이콘은 SVG (pencil/edit 모양)
  - 호버 시 색상 변함 (.hover:text-blue-600)
  - 상세 페이지에서 저장 후 목록으로 돌아옴

### Step 6: 새 페이지 만들기 버튼 및 모달
- **title**: 새 페이지 생성
- **text**: 헤더의 "+ 새 페이지 만들기" 버튼을 클릭하면 모달이 열립니다:
  - **페이지 제목** (필수): 예: "메인 페이지", "회사 소개"
  - **슬러그 (URL 경로)** (필수): 영문 소문자/숫자/하이픈(-) 만 가능 (예: `home`, `about-us`)
  - **설명** (옵션): 메타 태그 및 SEO 설명 (최대 160자 권장)
  - 우측 하단의 "만들기" 버튼으로 새 페이지 생성
  - "취소" 버튼으로 모달 종료
- **highlight**: `#create-modal`, `#create-form`, `input[name="title"]`, `input[name="slug"]`, `textarea[name="description"]`
- **trigger**: click (open/submit)
- **tips**:
  - 모달은 fixed position, 배경은 검정 반투명 (bg-black/50)
  - 모달 콘텐츠: 스케일 애니메이션 (scale-95 → scale-100)
  - 슬러그 입력 필드: "/" 접두사 자동 추가 (레이아웃)
  - pattern="[a-z0-9-]+" 유효성 검사
  - 제목 입력 후 슬러그가 자동 생성될 수 있음 (선택)

### Step 7: 모달 내 입력 필드 (Create Form)
- **title**: 새 페이지 정보 입력
- **text**: 모달 안의 폼 필드들:
  - **페이지 제목**: 필수, 텍스트 입력 (focus-ring-2 focus-ring-blue-500)
  - **슬러그**: 필수, "/" + 입력 필드 (좌측에 "/" 라벨)
    - 한글 불가, 영문 소문자/숫자/하이픈만 허용
    - 예: `home`, `news-board`, `gallery-2025`
  - **설명**: 선택, 텍스트에어리어 (rows="3")
    - 메타 태그(OG, 검색 엔진)에 사용됨
    - 최대 160~200자 권장
- **highlight**: `#create-form`, input/textarea elements
- **trigger**: input / focus / blur
- **tips**:
  - 모든 입력 필드는 focus 시 blue-500 ring 표시
  - 텍스트에어리어는 기본 3줄 높이
  - 입력 완료 후 "만들기" 버튼 클릭

### Step 8: 모달 액션 버튼 (Modal Actions)
- **title**: 모달 제출 및 취소
- **text**: 모달 하단에 두 개의 버튼:
  - **취소**: 회색 배경, 모달 종료 (작성 내용 버림)
  - **만들기**: 파란색 배경, 폼 제출 및 새 페이지 생성 (form="create-form")
  - "만들기" 클릭 시 `/api/admin/pages/create` 엔드포인트로 POST 요청 전송
  - 성공 시 새 페이지 상세 페이지로 자동 이동 (window.location.href)
  - 실패 시 토스트 에러 메시지 표시
- **highlight**: `#btn-cancel`, `button[type="submit"]`
- **trigger**: click
- **tips**:
  - "만들기" 버튼은 폼 제출 버튼 (type="submit", form="create-form")
  - 실패 시 window.showToast('메시지', 'error') 호출
  - 성공 응답: { success: true, id: page_id }
  - 에러 응답: { success: false, error: '오류 메시지' }

### Step 9: 빈 상태 (Empty State)
- **title**: 페이지가 없을 때의 안내
- **text**: 페이지 목록이 비어있을 때 테이블 중앙에:
  - 이모지 아이콘 (또는 일러스트)
  - "등록된 페이지가 없습니다." 메시지
  - "+ 새 페이지 만들기" 버튼 (목록 우상단과 동일)
  - 이를 통해 사용자가 첫 페이지를 쉽게 생성할 수 있습니다.
- **highlight**: `tr[colspan="6"]` > empty state div
- **trigger**: —— (자동 표시)
- **tips**:
  - colspan="6"으로 전체 테이블 너비 차지
  - 세로 중앙 정렬 (py-12 text-center)
  - 첫 방문 사용자에게 명확한 CTA 제공

### Buttons Reference

#### 상단 액션
| 버튼 | 셀렉터 | 설명 |
|------|--------|------|
| 새 페이지 만들기 | `#btn-create-page` | 새 페이지 생성 모달 열기 |

#### 모달 (Create Modal)
| 버튼 | 셀렉터 | 설명 |
|------|--------|------|
| 취소 | `#btn-cancel` | 모달 종료 (폼 리셋) |
| 만들기 | `button[type="submit"][form="create-form"]` | 새 페이지 저장 |
| 닫기 (X) | modal X button (미 명시) | 모달 종료 (배경 클릭도 가능) |

#### 테이블 액션
| 액션 | 셀렉터 | 설명 |
|------|--------|------|
| 페이지 수정 | `a[href="/admin/pages/{id}"]` (연필 아이콘) | 페이지 상세/편집 페이지로 이동 |

### 페이지 상태 코드
| 필드 | 값 | 설명 |
|------|-----|------|
| is_published | true | 공개 상태 (웹 방문자 접근 가능) |
| is_published | false | 비공개 상태 (관리자만 접근) |

### 생성자 코드 (created_by)
| 코드 | 배지 이모지 | 배경색 | 설명 |
|------|-----------|--------|------|
| ai | 🤖 | 보라색 (#a855f7) | AI 자동 생성 페이지 |
| user | 👤 | 회색 (#718096) | 사용자 작성 페이지 |
| admin | 👨‍💻 | 파란색 (#3b82f6) | 관리자 설정 페이지 |
| (empty) | 👨‍💻 | 파란색 | 기본값 (admin) |

### 슬러그 유효성 규칙
| 규칙 | 허용 | 불허 |
|------|------|------|
| 문자 | 영문 소문자 a-z | 영문 대문자, 한글 |
| 숫자 | 0-9 | (숫자는 OK) |
| 특수문자 | 하이픈 (-) | 스페이스, 언더스코어, 특수문자 |
| 예시 | `home`, `about-us`, `news-2025` | `Home`, `about_us`, `about us` |

### 폼 유효성 검사 (Create Form)
| 필드 | 필수 | 타입 | 제약 | 메시지 |
|------|------|------|------|--------|
| title | ✅ | text | — | 필수 입력 |
| slug | ✅ | text | pattern="[a-z0-9-]+" | 영문 소문자, 숫자, 하이픈만 가능 |
| description | ❌ | textarea | 최대 ~200자 | — |

### 페이지 생성 성공 흐름
```
1. "+ 새 페이지 만들기" 클릭
2. 모달 열기 (fixed overlay)
3. title, slug, description 입력
4. "만들기" 클릭 → POST /api/admin/pages/create
5. 요청 성공 (200 OK, { success: true, id: N })
   → window.location.href = `/admin/pages/${N}`
   → 페이지 상세 편집 페이지로 이동
6. 요청 실패 (400/500)
   → showToast('페이지 생성 실패: ...', 'error')
   → 모달 유지, 폼 유지
```

### 페이지 수정 흐름
```
1. 목록에서 연필 아이콘 클릭
2. `/admin/pages/{id}` 상세 페이지로 이동
3. 제목, 슬러그, 설명, 콘텐츠, 상태 수정
4. 저장 버튼 클릭
5. 수정 완료 후 목록으로 돌아옴 (또는 상세 페이지 유지)
```

### 데이터 포맷
| 필드 | 형식 | 예시 |
|------|------|------|
| updated_at | Unix timestamp | 1704067200 (2024-01-01) |
| formatDate | JavaScript | toLocaleDateString() |
| 표시 형식 | YYYY-MM-DD | 2024-01-01 |
