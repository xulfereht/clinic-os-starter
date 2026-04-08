# 캠페인 관리 (/admin/campaigns) — 투어 시나리오

## 페이지 목적
메시지 발송 캠페인(일회성, 정기 반복, 자동화)을 생성·관리하고 발송 현황을 추적합니다.

## 시나리오 (13 스텝)

### Step 1: 탭 전환 — 진행 중/완료
- **title**: 캠페인 상태 필터링
- **text**: 페이지 상단의 "진행 중 캠페인"과 "완료 / 종료 내역" 두 탭이 있습니다. 클릭하면 활성 캠페인(초안, 예약, 발송 중) 또는 종료된 캠페인(완료, 실패)을 필터링해 봅니다.
- **highlight**: `.border-b-2.border-blue-600` (active tab)
- **trigger**: click
- **tips**:
  - "진행 중"은 아직 대기 중이거나 진행 중인 캠페인
  - "완료/종료"는 이미 발송을 마친 캠페인 이력
  - URL 파라미터로도 ?tab=active 또는 ?tab=history로 직접 이동 가능

### Step 2: 새 캠페인 생성 버튼
- **title**: 캠페인 생성 모달 열기
- **text**: 우상단의 "새 캠페인" 파란색 버튼을 클릭하면 모달이 열립니다. 이 모달에서 캠페인 이름, 타겟 세그먼트, 메시지 템플릿, 발송 유형(일회성/정기/자동화) 등을 설정합니다.
- **highlight**: `#createCampaignBtn`
- **trigger**: click
- **tips**:
  - 모달은 최대 너비 5xl, 높이 85vh로 좌측 폼 + 우측 미리보기 패널로 구성
  - 캠페인 생성이 복잡하므로 각 필드를 차근차근 진행
  - 취소 버튼이나 배경 클릭으로 모달 종료 가능

### Step 3: 캠페인 이름 입력
- **title**: 캠페인 이름 지정
- **text**: 모달 좌측 "캠페인 이름" 텍스트 필드에 캠페인의 이름을 입력합니다. 예: "1월 정기 검진 안내", "정월 보약 프로모션" 등. 최대 길이는 제한 없으나 간결하고 명확한 이름이 권장됩니다.
- **highlight**: `input[name="name"]`
- **trigger**: input
- **tips**:
  - 필수 필드 (required)
  - 실제 발송할 때 이 이름이 내부 기록에 사용됨
  - 환자가 보는 메시지 내용은 템플릿에서 설정

### Step 4: 타겟 세그먼트 선택
- **title**: 발송 대상 고객군 선택
- **text**: "타겟 세그먼트 (Who)" 드롭다운을 열면 보유하고 있는 고객 세그먼트 목록(예: 신규 환자, 특정 질환 그룹 등)이 보입니다. 선택하면 아래에 "대상자: X명"과 같은 미리보기가 표시되고, 대상이 많으면 경고(⚠️) 표시가 나타납니다.
- **highlight**: `select[name="segment_id"]`
- **trigger**: click
- **tips**:
  - "전체 고객" 옵션은 필터 없이 모든 환자를 대상으로 함
  - 세그먼트 카운트가 자동으로 계산되며, 대상자가 1,000명 이상이면 경고 메시지 표시
  - 잘못된 대상에게 대량 발송되는 것을 방지하기 위한 안전장치

### Step 5: 메시지 템플릿 선택
- **title**: 발송할 메시지 내용 선택
- **text**: "메시지 템플릿 (What)" 드롭다운을 클릭합니다. 상단에는 카테고리 필터(📂 전체, 📅 예약, 📢 마케팅 등)가 있어 템플릿을 쉽게 찾을 수 있습니다. 원하는 템플릿을 선택하면 우측 미리보기 패널에 실제 메시지 내용이 표시됩니다.
- **highlight**: `select[name="template_id"]`
- **trigger**: click
- **tips**:
  - 템플릿은 채널별(알림톡, SMS/LMS)로 옵션그룹(optgroup)으로 분류됨
  - 우측 "메시지 미리보기" 패널에서 실제 환자에게 보이는 모습을 확인 가능
  - 빨간색 배경 텍스트는 환자별 맞춤 정보(이름, 예약시간 등)로 자동 교체됨

### Step 6: 발송 유형 선택 — 라디오 버튼
- **title**: 캠페인 유형 결정 (1회성/정기반복/자동화)
- **text**: "발송 유형" 섹션에서 3가지 라디오 버튼 중 하나를 선택합니다:
  - **1회성 발송**: 즉시 또는 예약된 시간에 한 번만 발송
  - **정기 반복**: 매일/매주/매월/매시간/분 단위로 반복 발송
  - **자동화 (Trigger)**: 특정 이벤트(상담 완료, 예약 생성 등) 발생 시 자동 발송
- **highlight**: `input[name="type"]` (all 3 radio buttons)
- **trigger**: click
- **tips**:
  - 각 유형마다 아래 config 섹션이 다르게 표시됨 (toggleTypeConfig() 실행)
  - 라디오 선택 시 배경색도 변함 (파란/보라/주황)
  - 선택 후 해당 설정 섹션에서 세부 옵션 구성

### Step 7: 1회성 발송 — 예약 설정 (ONE_TIME)
- **title**: 일회성 캠페인 스케줄 설정
- **text**: "1회성 발송"을 선택하면 `#config_ONE_TIME` 섹션이 표시됩니다. "예약 발송 설정" 체크박스를 체크하면 날짜/시간 입력 필드가 나타나고, 여기에 `datetime-local` 형식으로 발송 시간을 지정합니다. 체크 해제 시 즉시 발송됩니다.
- **highlight**: `#config_ONE_TIME`, `#is_scheduled`, `input[name="scheduled_at_local"]`
- **trigger**: click/input
- **tips**:
  - datetime-local 형식: YYYY-MM-DDTHH:MM (예: 2025-01-15T10:30)
  - 서버는 이 로컬 시간을 UTC로 변환 처리
  - 예약 없이 제출하면 즉시 발송됨

### Step 8: 정기 반복 설송 — 반복 단위 선택 (RECURRING)
- **title**: 정기 반복 주기 설정
- **text**: "정기 반복"을 선택하면 `#config_RECURRING` 섹션(보라 배경)이 표시됩니다. "반복 단위" 드롭다운에서:
  - **매일 (Daily)**: 매일 지정된 시간에 발송
  - **매주 (Weekly)**: 요일별 선택 후 지정 시간에 발송
  - **매월 (Monthly)**: 매월 특정 일(1~31)의 지정 시간에 발송
  - **매시간 (Hourly)**: 매 시간 정각에서 N분 후에 발송
  - **분 단위 (Minutely)**: N분 간격으로 반복 발송
- **highlight**: `select[name="recurrence_freq"]`, `#config_RECURRING`
- **trigger**: click
- **tips**:
  - 각 주기별로 다른 옵션 입력 필드가 표시됨 (.freq-opt로 hidden/show)
  - Weekly는 체크박스로 요일 다중선택 가능
  - next_run_at 필드가 자동 계산되어 다음 실행 예정 시간 표시

### Step 9: 정기 반복 — 주간 반복 설정 (WEEKLY 옵션)
- **title**: 요일 및 시간 선택
- **text**: "매주"를 선택하면 요일 선택 버튼들(월/화/수/목/금/토/일)이 나타납니다. 발송할 요일을 체크하고(다중 선택 가능), 아래 "실행 시간" 필드에 시간을 입력합니다(예: 09:00). 선택한 요일마다 지정된 시간에 발송됩니다.
- **highlight**: `#opt_WEEKLY`, `input[name="weekly_days"]`, `input[name="weekly_time"]`
- **trigger**: click
- **tips**:
  - 요일 체크박스는 peer-checked를 이용해 선택 상태 시각화
  - 일요일은 빨간색으로 구분
  - 최소 1개 요일은 선택해야 발송 가능

### Step 10: 자동화 트리거 설정 (TRIGGER)
- **title**: 이벤트 기반 자동 발송 조건 설정
- **text**: "자동화 (Trigger)"를 선택하면 `#config_TRIGGER` 섹션(주황 배경)이 표시됩니다. 드롭다운에서 트리거 이벤트를 선택합니다:
  - **상담 완료 시**: 환자와의 상담이 종료되면 발송
  - **예약 생성 시**: 새로운 예약이 생성되면 발송
  - **예약 취소 시**: 기존 예약이 취소되면 발송
  - **수납 완료 시**: 결제 완료 후 발송
- **highlight**: `select[name="trigger_event"]`, `#config_TRIGGER`
- **trigger**: click
- **tips**:
  - 각 이벤트마다 자동으로 조건을 인식해 발송 (수동 개입 없음)
  - 동시에 여러 트리거를 등록할 수 없음 (1개만 선택)
  - 발송 날짜/시간은 이벤트 발생 시점에 결정됨

### Step 11: 모달 우측 메시지 미리보기
- **title**: 발송될 메시지 실시간 확인
- **text**: 모달 우측 "메시지 미리보기" 패널에서 선택한 템플릿의 내용이 휴대폰 모양 미리보기로 표시됩니다. 노란색 배경 텍스트는 고객별 맞춤 정보(이름, 예약시간 등)로 자동 변경됨을 명시합니다. 다른 템플릿을 선택하면 미리보기도 실시간으로 업데이트됩니다.
- **highlight**: `#templatePreview`, `#previewBubble`, `#previewContent`
- **trigger**: —— (read-only)
- **tips**:
  - SMS/LMS와 알림톡은 미리보기 유형이 다를 수 있음 (#previewType 표시)
  - 클리닉 프로필(이름, 시간 등)도 미리보기에 포함
  - 한 번 더 확인 후 "캠페인 생성" 버튼 클릭

### Step 12: 캠페인 생성 버튼
- **title**: 모든 설정 완료 후 캠페인 저장
- **text**: 모달 하단 우측의 파란색 "캠페인 생성" 버튼을 클릭하면 폼 데이터가 서버로 전송됩니다. 성공 시 캠페인 목록으로 돌아가고, 새로 생성된 캠페인이 목록 상단에 표시됩니다. 실패 시 토스트 에러 메시지가 표시됩니다.
- **highlight**: `#submitCreateBtn`
- **trigger**: click (submit)
- **tips**:
  - 캠페인 이름, 템플릿은 필수
  - 발송 유형별로 필수 필드가 다름 (설정 섹션 확인)
  - 모달 닫기 버튼으로 작성 중인 내용을 버릴 수 있음

### Step 13: 캠페인 목록 — 액션 버튼 (Row Actions)
- **title**: 생성된 캠페인 관리 (수정/발송/삭제/이력)
- **text**: 캠페인 목록의 각 행 우측 "액션" 컬럼에서:
  - **초안 상태**: 🚀 발송, ✎ 수정, 🗑 삭제 버튼 표시
  - **예약/활성화/정지 중**: 📜 이력, 수정, 삭제, ⏸ 중지/▶ 재개 버튼 표시
  - **발송 중**: ⏹ 강제 중지 버튼 표시
  - **완료된 캠페인**: 📜 이력만 표시 가능
- **highlight**: `.send-now-btn`, `.edit-btn`, `.delete-btn`, `.history-btn`, `.update-status-btn`
- **trigger**: click
- **tips**:
  - 각 캠페인의 상태(status)에 따라 표시되는 액션 버튼이 다름
  - 발송 현황에는 대상자(대상) / 성공(성공) 수가 표시됨
  - 반복 캠페인은 마지막 실행 시간(last_run_at)과 함께 다음 예약(next_run_at) 표시

### Buttons Reference

#### 상단 액션
| 버튼 | 셀렉터 | 설명 |
|------|--------|------|
| 새 캠페인 | `#createCampaignBtn` | 캠페인 생성 모달 열기 |
| 템플릿 관리 | `a[href="/admin/campaigns/templates"]` | 메시지 템플릿 관리 페이지로 이동 |

#### 모달 내 버튼
| 버튼 | 셀렉터 | 설명 |
|------|--------|------|
| 알리고 동기화 | `#syncTemplatesBtn` | 알리고 API와 템플릿 동기화 |
| 캠페인 생성 | `#submitCreateBtn` | 폼 제출 및 캠페인 저장 |
| 취소 | `#cancelCreateBtn` | 모달 종료 (작성 내용 버림) |
| 닫기 | `#closeCreateBtn` | 모달 종료 (X 버튼) |

#### 목록 행 액션
| 버튼 | 클래스 | 설명 | 상태 조건 |
|------|---------|------|---------|
| 🚀 발송 | `.send-now-btn` | 즉시 발송 (예약 시간 무시) | draft & ONE_TIME |
| ✎ 수정 | `.edit-btn` | 캠페인 설정 수정 | draft, scheduled, active, paused, failed, sending |
| 🗑 삭제 | `.delete-btn` | 캠페인 삭제 (복구 불가) | draft, scheduled, failed, completed, sending, active, paused |
| 📜 이력 | `.history-btn` | 캠페인 실행 이력 모달 열기 | 모든 상태 |
| ⏸ 중지 | `.update-status-btn[data-status="paused"]` | 정기 캠페인 일시 중지 | active, scheduled (RECURRING) |
| ▶ 재개 | `.update-status-btn[data-status="active"]` | 정기 캠페인 재개 | paused (RECURRING) |
| ⏹ 강제 중지 | `.update-status-btn[data-status="failed"]` | 발송 중인 캠페인 강제 중단 | sending, manual_sending |
