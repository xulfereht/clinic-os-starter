# 치료 후기 관리 (/admin/reviews) — 투어 시나리오

## 페이지 목적
환자의 치료 사례 및 후기를 관리하고, 카테고리와 담당 의사별로 필터링하여 조회하며, 후기를 수정하거나 삭제합니다.

## 시나리오 (8 스텝)

### Step 1: 검색 입력 (Search)
- **title**: 후기 제목 또는 환자명으로 검색
- **text**: 필터 영역의 첫 번째 "검색" 입력 필드에 텍스트를 입력하면 후기 제목(p.title) 또는 환자명(pt.name)에 포함된 후기들을 필터링합니다. 500ms 디바운스 후 자동으로 폼 제출되어 즉시 결과가 업데이트됩니다.
- **highlight**: `input[name="q"]`
- **trigger**: input (debounced 500ms)
- **tips**:
  - 부분 문자열 검색 (LIKE %keyword%)
  - 예: "무릎", "김환자", "다이어트" 등 입력 가능
  - 검색어 입력 후 반자동으로 폼 제출
  - 기존 카테고리, 의사 필터는 유지됨

### Step 2: 카테고리 필터 (Category Dropdown)
- **title**: 치료 분야별 후기 필터링
- **text**: 두 번째 "카테고리" 드롭다운을 클릭하면 사용 가능한 카테고리 목록이 표시됩니다:
  - 다이어트, 피부질환, 소화기, 통증, 여성질환, 소아청소년, 신경정신, 보약/웰니스, 두면부 등
  - 선택하면 즉시 폼이 제출되어 해당 카테고리 후기만 표시됩니다. "전체" 옵션을 선택하면 필터 해제됩니다.
- **highlight**: `select[name="category"]`
- **trigger**: change (onchange="this.form.submit()")
- **tips**:
  - 각 카테고리는 categoryMap에 정의된 한글명 + 영문 코드로 관리
  - 선택한 카테고리는 URL 쿼리 파라미터(?category=xxx)로 보존
  - 검색어와 함께 사용 가능 (AND 연산)

### Step 3: 담당 의사 필터 (Doctor Dropdown)
- **title**: 원장별 후기 필터링
- **text**: 세 번째 "담당 원장" 드롭다운을 클릭하면 클리닉에 등록된 의사(staff.type='doctor') 목록이 표시됩니다. 원하는 의사를 선택하면 해당 의사가 담당한 후기만 표시됩니다. "전체"를 선택하면 필터 해제됩니다.
- **highlight**: `select[name="doctor"]`
- **trigger**: change (onchange="this.form.submit()")
- **tips**:
  - 의사 목록은 order_index 순서대로 정렬
  - 의사명 뒤에 "원장" 텍스트 자동 추가
  - 검색, 카테고리 필터와 함께 조합 가능

### Step 4: 데스크톱 테이블 뷰 (Desktop View - Table)
- **title**: 후기 목록 조회 (데스크톱 레이아웃)
- **text**: lg 이상 화면에서는 후기가 표 형태로 표시됩니다. 각 행은:
  - **제목 / 환자**: 후기 제목(굵은 글) + 환자명(회색 배지)
  - **카테고리**: 색상 배지 (파란색 배경)
  - **담당 원장**: 의사명
  - **상태**: "공개" (초록) / "비공개" (회색) 상태 배지
  - **작성일**: YYYY-MM-DD 형식 타임스탬프
  - **액션**: 수정 링크
- **highlight**: `table.w-full` (desktop view)
- **trigger**: —— (read-only, but action links clickable)
- **tips**:
  - 마우스 호버 시 행 배경이 회색으로 변함 (.group-hover:bg-slate-50)
  - 제목 클릭 시 후기 상세/수정 페이지로 이동
  - 테이블은 border-collapse 없이 구분선으로 분리

### Step 5: 모바일 카드 뷰 (Mobile View - Card)
- **title**: 후기 목록 조회 (모바일 레이아웃)
- **text**: lg 미만 화면에서는 후기가 카드 형태로 표시됩니다. 각 카드는:
  - 상단: 상태 배지 + 카테고리 배지
  - 중앙: 후기 제목 (클릭 시 상세 페이지로 이동)
  - 하단: 환자명 | 의사명 | 작성일, 그리고 "수정" 버튼
- **highlight**: `.lg:hidden` (mobile card section)
- **trigger**: —— (read-only, but clickable)
- **tips**:
  - 화면 크기 768px 이하에서 자동 전환
  - 카드 간 4px 여백 (space-y-4)
  - 터치 환경에서 더 큰 터치 영역 제공

### Step 6: 페이지네이션 (Pagination)
- **title**: 후기 목록 페이지 이동
- **text**: 테이블 또는 카드 목록 하단에 페이지네이션 컨트롤이 있습니다:
  - 총 후기 건수 표시 (예: "총 24개 중 1 - 15")
  - "← 이전" 버튼 (첫 페이지면 숨김)
  - 현재 페이지 / 전체 페이지 표시 (예: "1 / 2")
  - "다음 →" 버튼 (마지막 페이지면 숨김)
  - 클릭 시 ?page=N 쿼리 파라미터로 이동하며, 기존 검색/카테고리/의사 필터 유지
- **highlight**: `div[class*="pagination"]`, `a[href*="?page"]`
- **trigger**: click
- **tips**:
  - 페이지 크기는 15건 고정 (limit = 15)
  - 총 페이지 수는 Math.ceil(totalCount / 15)로 계산
  - "이전/다음" 링크의 URL에는 ?page=X&q=검색어&category=카테고리&doctor=의사ID 포함

### Step 7: 후기 수정 링크 (Edit Action)
- **title**: 후기 상세 조회 및 수정 페이지로 이동
- **text**: 각 후기 행/카드의 우측 또는 하단의 파란색 "수정" 링크를 클릭하면 `/admin/reviews/{review.id}` 페이지로 이동합니다. 여기서 제목, 카테고리, 담당 의사, 상태(공개/비공개), 내용 등을 수정할 수 있습니다.
- **highlight**: `a[href="/admin/reviews/{id}"]`
- **trigger**: click
- **tips**:
  - 링크 href: `/admin/reviews/${review.id}`
  - 상세 페이지에서 수정 후 저장하면 목록으로 돌아옴
  - 상태 전환(공개↔비공개)도 상세 페이지에서 가능

### Step 8: 새 후기 작성 버튼 (Create New Review)
- **title**: 새로운 치료 후기 등록
- **text**: 페이지 우상단의 파란색 "+ 새 후기 작성" 버튼을 클릭하면 `/admin/reviews/new` 페이지로 이동합니다. 새 후기 작성 폼에서 제목, 환자명(익명 가능), 담당 의사, 카테고리, 내용(마크다운), 사진 등을 입력하고 저장할 수 있습니다.
- **highlight**: `a[href="/admin/reviews/new"]`
- **trigger**: click
- **tips**:
  - 버튼은 PageHeader 컴포넌트의 slot="actions"에 위치
  - 새 후기 페이지에서 작성 완료 후 목록으로 돌아옴
  - 초안(비공개) 상태로 먼저 저장한 후 검토 후 공개 전환 권장

### Step 9: 가이드 링크 (Manual URL)
- **title**: 후기 관리 가이드 문서 열기
- **text**: PageHeader의 "후기 관리 가이드" 링크를 클릭하면 HQ 가이드 페이지(https://clinic-os-hq.pages.dev/guide#review-management)로 새 탭에서 열려 후기 작성 및 관리의 모범 사례를 확인할 수 있습니다.
- **highlight**: `a[href="https://clinic-os-hq.pages.dev/guide#review-management"]`
- **trigger**: click
- **tips**:
  - PageHeader 컴포넌트의 manualUrl 속성
  - HQ 외부 링크이므로 새 탭에서 열림
  - 후기 작성 시 참고할 수 있는 스타일 가이드, 사진 촬영 팁 등 포함

### Buttons Reference

#### 상단 액션
| 버튼 | 셀렉터 | 설명 |
|------|--------|------|
| 새 후기 작성 | `a[href="/admin/reviews/new"]` | 새 후기 작성 페이지로 이동 |
| 후기 관리 가이드 | `a[href="...#review-management"]` | HQ 가이드 외부 링크 (새 탭) |

#### 필터 폼
| 컴포넌트 | 셀렉터 | 설명 |
|----------|---------|------|
| 검색 입력 | `input[name="q"]` | 제목/환자명 검색 (500ms 디바운스) |
| 카테고리 | `select[name="category"]` | 다이어트/피부질환 등으로 필터 (onchange submit) |
| 담당 원장 | `select[name="doctor"]` | 의사별 필터 (onchange submit) |

#### 액션 (데스크톱 테이블)
| 액션 | 셀렉터 | 설명 |
|------|---------|------|
| 제목 클릭 | `a[href="/admin/reviews/{id}"]` | 후기 상세 페이지로 이동 |
| 수정 | `a.hover:text-blue-600` (td 우측) | 후기 상세/수정 페이지로 이동 |

#### 액션 (모바일 카드)
| 액션 | 셀렉터 | 설명 |
|------|---------|------|
| 제목 클릭 | `a[href="/admin/reviews/{id}"]` (h3) | 후기 상세 페이지로 이동 |
| 수정 버튼 | `a[href="/admin/reviews/{id}"]` (하단) | 후기 상세/수정 페이지로 이동 |

#### 페이지네이션
| 요소 | 셀렉터 | 설명 |
|------|---------|------|
| 이전 | `a[href="?page={page-1}..."]` | 이전 페이지로 이동 (page > 1일 때만) |
| 현재 / 전체 | `.bg-blue-600.text-white` | 현재 페이지 번호 표시 (비클릭) |
| 다음 | `a[href="?page={page+1}..."]` | 다음 페이지로 이동 (page < totalPages일 때만) |

### 필터 상태 유지
| URL 파라미터 | 값 | 설명 |
|--------------|-----|------|
| `q` | 검색어 | 검색 필터 (부분 문자열) |
| `category` | diet/skin/digestive 등 | 카테고리 필터 |
| `doctor` | staff_id | 의사 ID 필터 |
| `page` | 1, 2, 3... | 현재 페이지 번호 |

### 후기 상태 표시
| 상태 | 배지 색상 | 의미 |
|------|---------|------|
| 공개 (published) | 초록색 (#10b981) | 웹사이트 공개 중 |
| 비공개 | 회색 (#718096) | 초안 또는 보관 중 |

### 카테고리 매핑 (categoryMap)
| 코드 | 한글명 | 설명 |
|------|--------|------|
| diet | 다이어트 | 체중 감량, 식이 관리 |
| skin | 피부질환 | 여드름, 습진, 알레르기 등 |
| digestive | 소화기 | 위장, 장 건강 |
| pain | 통증 | 허리, 목, 어깨 통증 등 |
| women | 여성질환 | 월경, 갱년기, 불임 등 |
| pediatric | 소아청소년 | 어린이, 청소년 전문 |
| neuro | 신경정신 | 스트레스, 불안, 우울증 |
| wellness | 보약/웰니스 | 예방, 건강 증진 |
| head | 두면부 | 머리, 얼굴 관련 |
