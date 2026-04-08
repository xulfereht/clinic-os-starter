# 메신저 (/admin/messages) — 투어 시나리오

## 페이지 목적
팀 채팅(공지, 전체 채널), 고객 상담(고객 문의 및 상담 기록)을 통합 관리하고, 팀원/고객과 실시간 메시지 주고받기.

## 시나리오 (12 스텝)

### Step 1: 좌측 사이드바 개요
- **title**: 채팅 목록 네비게이션
- **text**: 페이지 좌측의 "채팅 목록" 사이드바는 팀 채팅(공지/전체)과 고객 상담을 분류하여 표시합니다. 상단의 연결 상태 표시(초록/회색 점)로 실시간 연결 여부를 확인할 수 있습니다. 모바일에서는 햄버거 메뉴로 토글 가능합니다.
- **highlight**: `#sidebar`
- **trigger**: —— (read-only, but contextual)
- **tips**:
  - 연결 상태: 초록 = 온라인, 회색 = 오프라인
  - 좌측 영역 너비 320px (w-80)
  - 모바일에서 절대 위치 지정, 데스크톱에서 상대 위치

### Step 2: 채널 검색 (Channel Search)
- **title**: 대화방/사람 빠르게 찾기
- **text**: 사이드바 상단의 "이름, 대화방 검색" 입력 필드에 텍스트를 입력하면 채널명 또는 사람 이름으로 목록을 실시간 필터링합니다. 우측 X 아이콘을 클릭하면 검색어 초기화됩니다.
- **highlight**: `#channel-search-input`, `#search-clear-btn`
- **trigger**: input / click
- **tips**:
  - 실시간 필터링 (JavaScript 이벤트)
  - 검색 중에는 "메시지 검색 결과" 섹션이 절대 위치로 표시
  - 검색 결과 클릭 시 해당 채널/사람으로 이동

### Step 3: 팀 / 고객 상담 탭
- **title**: 채팅 유형 전환
- **text**: 사이드바 검색 아래 두 개의 탭:
  - **팀 채팅**: 공지/전체 채널 및 대화 목록 표시 (기본값)
  - **고객 상담**: 진행 중/종료된 고객 문의 채팅 표시
  - 클릭하면 탭이 전환되고 하단의 채널 목록도 변경됩니다.
- **highlight**: `#tab-team`, `#tab-customer`
- **trigger**: click (onclick="switchTab('team'/'customer')")
- **tips**:
  - 활성 탭은 파란색 border-b-2 + 파란색 텍스트
  - 비활성 탭은 회색 텍스트
  - 탭 전환 시 이전 선택한 채널도 복원됨 (상태 유지)

### Step 4: 공개 채널 목록 (Public Channels)
- **title**: 팀 전체 공지 및 토론 채널
- **text**: 팀 채팅 탭에서 "공지/전체" 섹션 아래 공개 채널들이 나열됩니다(예: #공지사항, #마케팅, #기술지원 등). 각 채널명을 클릭하면 해당 채널 채팅 기록이 우측에 로드됩니다.
- **highlight**: `#public-channels-list`
- **trigger**: click (channel item)
- **tips**:
  - 채널 이름 앞에 # 기호 표시
  - 마지막 메시지 미리보기와 시간 표시 가능
  - 읽지 않은 메시지 수가 배지로 표시될 수 있음

### Step 5: 대화 목록 (DM List) — 신규 대화방 생성
- **title**: 팀원 간 직접 대화(DM) 목록 및 새 대화 시작
- **text**: "대화 목록" 섹션에서 기존 DM 목록이 표시됩니다. 우측의 "+" 아이콘(openGroupModal())을 클릭하면 새로운 대화방 생성 모달이 열려, 특정 팀원들을 선택하여 그룹 채팅을 시작할 수 있습니다.
- **highlight**: `#dm-list`, `button[onclick="openGroupModal()"]`, `#dm-count`
- **trigger**: click (DM item or new group button)
- **tips**:
  - DM 개수는 우측 배지에 표시 (#dm-count)
  - 각 DM 항목 클릭 시 채팅창 열림
  - 새 대화방 모달에서 팀원 다중선택 가능

### Step 6: 직원 목록 (Staff List) — 토글 가능
- **title**: 직원 목록 조회 및 DM 시작
- **text**: 사이드바 하단의 "👥 직원 목록" 버튼을 클릭하면 목록이 펼쳐집니다. 직원 수가 배지로 표시되고, 각 직원명을 클릭하면 해당 직원과의 DM이 열립니다. 다시 클릭하면 목록이 접힙니다.
- **highlight**: `#staff-list-container`, `#staff-toggle-icon`, `button[onclick="toggleStaffList()"]`, `#staff-count`
- **trigger**: click (toggle button or staff item)
- **tips**:
  - 초기 max-height: 250px (overflow 숨김)
  - 토글 시 height 애니메이션 (transition-all duration-300)
  - 목록이 펼쳐지면 체브론 아이콘이 위쪽을 가리킴

### Step 7: 고객 상담 탭 — 진행 중 / 종료 상담
- **title**: 고객 문의 채팅 관리
- **text**: "고객 상담" 탭으로 전환하면:
  - **진행 중인 상담**: 아직 해결되지 않은 활성 문의
  - **종료된 상담**: 이미 종료/해결된 문의 (토글로 접기/펴기 가능)
  - 각 상담을 클릭하면 고객과의 메시지 기록이 우측에 표시됩니다.
- **highlight**: `#customer-active-list`, `#customer-closed-list`, `button[onclick="toggleClosedList()"]`, `#closed-icon`
- **trigger**: click
- **tips**:
  - 진행 중 상담은 항상 펼쳐진 상태
  - 종료된 상담은 기본 숨김 (초기 collapse)
  - 각 상담 항목 클릭 시 메시지 로드

### Step 8: 채팅 영역 — 헤더
- **title**: 현재 채팅 대상 정보
- **text**: 우측 채팅 영역 상단의 헤더는:
  - 좌측: 채널/사람 아바타 + 이름 + 멤버 정보 (클릭 시 채팅 상세 정보 팝업)
  - 우측: (추가 기능, 예: 채팅 설정, 종료 등)
  - 헤더는 sticky로 스크롤 시에도 상단 고정
- **highlight**: `#chat-header`, `#header-avatar`, `#header-title`, `#header-desc`
- **trigger**: click (header info button)
- **tips**:
  - 아바타 이미지가 로드되지 않으면 스켈레톤 애니메이션 표시
  - 멤버 정보 링크는 파란색 (#3b82f6) + hover underline
  - 모바일에서 sticky positioning 우선순위 z-50

### Step 9: 메시지 버블 — 송수신
- **title**: 메시지 표시 및 표현
- **text**: 채팅 영역 중앙에 메시지들이 시간순으로 표시됩니다:
  - **송신 메시지**: 우측 정렬, 파란색 배경 그라데이션, 백색 텍스트, 우측 아래 꼬리 표시
  - **수신 메시지**: 좌측 정렬, 흰색 배경 + 회색 테두리, 검정 텍스트, 좌측 아래 꼬리 표시
  - 메시지명/시간 표시 가능
  - fade-in 애니메이션으로 부드럽게 나타남
- **highlight**: `.msg-bubble`, `.msg-sent`, `.msg-received`
- **trigger**: —— (read-only)
- **tips**:
  - CSS 클립 패스로 꼬리 모양 구현 (clip-path: polygon)
  - 최대 너비 75% (max-width: 75%)
  - 마지막 메시지까지 자동 스크롤

### Step 10: 메시지 입력 및 전송
- **title**: 새로운 메시지 작성 및 발송
- **text**: 채팅 영역 하단에 메시지 입력 필드가 있습니다:
  - 텍스트 입력창 (multiline textarea 또는 input)
  - "전송" 버튼 (또는 Enter 단축키)
  - 메시지 입력 후 버튼 클릭 또는 Ctrl+Enter(또는 Cmd+Enter) 단축키로 발송
  - 전송 후 입력 필드가 자동 초기화되고 메시지가 버블로 나타남
- **highlight**: `#message-input`, `button[onclick*="send"]` 또는 유사 셀렉터
- **trigger**: click (send button) / keydown (Ctrl+Enter)
- **tips**:
  - 빈 메시지 전송 방지 (입력 필드 검증)
  - 메시지 발송 중에는 버튼 비활성화
  - 이모지, 줄바꿈 지원

### Step 11: 그룹 생성 모달 (Group Modal)
- **title**: 새로운 대화방(그룹 채팅) 만들기
- **text**: "새 대화방 만들기" 버튼을 클릭하면 모달이 열립니다:
  - 대화방 이름 입력
  - 팀원 다중선택 (체크박스 목록)
  - "생성" 버튼으로 새 그룹 채팅 시작
  - 모달 닫기 (X 또는 취소 버튼)
- **highlight**: `#group-modal` (가정, 실제 셀렉터 필요)
- **trigger**: click (openGroupModal())
- **tips**:
  - 모달 배경 클릭 시 닫힘
  - 팀원 선택은 최소 1명 이상 필요
  - 생성 후 자동으로 새 그룹 채팅 창으로 이동

### Step 12: 연결 상태 표시 (Connection Status)
- **title**: 실시간 서버 연결 상태
- **text**: 사이드바 헤더 우측의 작은 원형 점이 연결 상태를 나타냅니다:
  - **초록색(#10b981)**: 온라인, 실시간 메시지 동기화 활성
  - **회색(#d1d5db)**: 오프라인, 메시지 수신 불가 (자동 재연결 시도)
  - 호버 시 "연결 상태" 툴팁 표시
- **highlight**: `#connection-status`
- **trigger**: —— (자동 업데이트, JavaScript)
- **tips**:
  - WebSocket 또는 Server-Sent Events(SSE) 기반
  - 자동 재연결 로직 (지수 백오프)
  - 오프라인 상태에서도 메시지 작성 가능 (오프라인 큐)

### Buttons Reference

#### 사이드바 액션
| 버튼 | 셀렉터 | 설명 |
|------|--------|------|
| 검색 초기화 | `#search-clear-btn` | 검색어 삭제 및 목록 복원 |
| 팀 채팅 탭 | `#tab-team` | 공개/DM 채널 목록으로 전환 |
| 고객 상담 탭 | `#tab-customer` | 고객 문의 목록으로 전환 |
| 새 대화방 | `button[onclick="openGroupModal()"]` | 그룹 채팅 생성 모달 열기 |
| 직원 목록 토글 | `button[onclick="toggleStaffList()"]` | 직원 목록 펼치기/접기 |
| 종료된 상담 토글 | `button[onclick="toggleClosedList()"]` | 종료된 상담 목록 펼치기/접기 |

#### 채팅 영역 액션
| 버튼 | 셀렉터 | 설명 |
|------|--------|------|
| 채팅 정보 | `div[onclick="showChannelInfo()"]` | 채널/사람 상세 정보 팝업 |
| 메시지 전송 | `button[onclick*="send"]` (예상) | 메시지 발송 |

#### 클릭 가능 항목
| 항목 | 셀렉터 | 동작 |
|------|--------|------|
| 공개 채널 | `#public-channels-list` > item | 채널 선택 및 메시지 로드 |
| DM (기존) | `#dm-list` > item | DM 채팅 창 열기 |
| 직원 | `#staff-list` > item | 해당 직원과 DM 시작/열기 |
| 고객 상담 | `#customer-active-list` / `#customer-closed-list` > item | 고객 채팅 창 열기 |

### 메시지 유형
| 유형 | 색상 | 배치 | 예시 |
|------|------|------|------|
| 송신 (Sent) | 파란 그라데이션 (#3b82f6→#2563eb) | 우측 정렬 | 내가 보낸 메시지 |
| 수신 (Received) | 흰색 테두리 | 좌측 정렬 | 상대방이 보낸 메시지 |
| 시스템 (System) | 회색 배경 (가정) | 중앙 정렬 | "참여자 추가됨" 등 |

### 메시지 입력 팁
| 단축키 | 동작 |
|--------|------|
| Enter | 메시지 전송 |
| Ctrl+Enter / Cmd+Enter | (선택적) 메시지 전송 |
| Shift+Enter | (가정) 줄바꿈 |

### 모바일 반응형
| 화면 크기 | 동작 |
|-----------|------|
| < 768px (md) | 사이드바 절대 위치 (숨김), 토글 가능 |
| ≥ 768px | 사이드바 상대 위치, 항상 표시 |

### 아바타 표시
| 요소 | 형식 | 폴백 |
|------|------|------|
| 채널 아바타 | 이미지 파일 또는 | 스켈레톤 애니메이션 |
| 사람 아바타 | 이미지 파일 또는 | 첫 글자 이니셜 |
