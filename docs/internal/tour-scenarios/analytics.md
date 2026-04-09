# 성과 분석 (/admin/analytics) — 투어 시나리오

## 페이지 목적
고객 여정(채널 유입 → 예약 → 내원 → 결제) 전환율과 직원별 진료/결제 성과, 실제 내원 경로를 시각화하고 분석합니다.

## 시나리오 (11 스텝)

### Step 1: 날짜 범위 빠른 선택 (Date Presets)
- **title**: 분석 기간 일괄 설정
- **text**: 페이지 우상단의 "1개월", "90일", "6개월", "12개월", "전체" 버튼 중 하나를 클릭하면 그에 해당하는 날짜 범위가 자동으로 설정됩니다. 예를 들어 "1개월"을 누르면 지난 1개월간의 데이터가 로드됩니다.
- **highlight**: `#datePresets` (5개 버튼)
- **trigger**: click
- **tips**:
  - 기본값은 "1개월" (선택 상태: 검정 배경)
  - 클릭 시 시작일/종료일 입력 필드도 자동 업데이트
  - 다른 버튼을 누르면 기존 버튼의 선택 상태 해제 (CSS 클래스 토글)

### Step 2: 날짜 범위 수동 설정 (Date Picker)
- **title**: 커스텀 분석 기간 지정
- **text**: 우상단 흰색 박스 내 "시작일(startDate)", "종료일(endDate)" 두 개의 날짜 피커 입력 필드가 있습니다. 각각 클릭하면 날짜 선택 팝업이 나타나고, 원하는 날짜를 선택할 수 있습니다. 입력 형식은 YYYY-MM-DD입니다.
- **highlight**: `#startDate`, `#endDate`
- **trigger**: click
- **tips**:
  - React DatePicker 컴포넌트 사용 (client:idle)
  - 시작일은 종료일보다 이전이어야 함
  - 수동 입력 후 "조회" 버튼을 눌러 데이터 리로드

### Step 3: 조회 버튼 — 데이터 새로고침
- **title**: 선택한 기간의 분석 데이터 로드
- **text**: 날짜 범위를 설정한 후 우상단의 검정색 "조회" 버튼을 클릭하면 /api/analytics/journey 엔드포인트에서 새로운 데이터를 가져와 모든 차트, 메트릭, 통계를 업데이트합니다. 로딩 중에는 차트 영역에 애니메이션 스켈레톤이 표시됩니다.
- **highlight**: `#refreshBtn`
- **trigger**: click
- **tips**:
  - 날짜 변경 시 반드시 "조회"를 눌러야 새 데이터 로드
  - 빠른 선택 버튼도 자동으로 "조회" 트리거
  - 로딩 중 클릭 방지를 위해 버튼이 비활성화될 수 있음

### Step 4: 상담 유형 토글 (Consult Type Toggle)
- **title**: 전체 vs 내원초진 vs 비대면초진 분석
- **text**: 메트릭 카드 위쪽의 "전체", "내원 초진", "비대면 초진" 버튼 토글이 있습니다. 이를 클릭하면 해당 타입의 상담만 필터링하여 분석합니다:
  - **전체**: 모든 상담 (기본값)
  - **내원 초진**: 실제 내원한 초진 환자만
  - **비대면 초진**: 원격 상담 초진 환자만 (활성화 시에만 표시)
- **highlight**: `#consultTypeToggle` (3개 버튼)
- **trigger**: click
- **tips**:
  - "비대면 초진" 버튼은 clinic 설정 remoteConsultation이 true일 때만 표시
  - 선택 상태는 CSS 클래스로 시각화 (bg-slate-900 vs bg-slate-100)
  - 토글 후 메트릭, 차트, 직원별 성과가 모두 업데이트됨

### Step 5: 메트릭 카드 (4대 지표)
- **title**: 핵심 KPI 개요 (4장)
- **text**: 선택한 기간의 주요 지표 4가지가 카드 형태로 표시됩니다:
  - **총 문의 (New Inquiries)**: 신규 환자 유입 문의 건수 (클릭 시 상세 리스트 확인 가능)
  - **예약 확정 (Reservations)**: 예약 완료 건수 및 전환율(%)
  - **내원 (Visits)**: 실제 내원 인원 (비대면은 — 표시)
  - **결제 (Payments)**: 최종 결제 완료 건수 및 금액 (클릭 시 세부 정보 확인 가능)
- **highlight**: `#metrics-container` (4개 카드)
- **trigger**: click (clickable cards)
- **tips**:
  - 각 카드에는 주요 수치 + 부가 설명이 표시
  - 결제 카드 하단에는 "리드 미매칭 초진", "재진 결제" 소분류 표시
  - 클릭 가능한 카드는 호버 시 border/shadow 변함

### Step 6: 퍼널 전환 차트 (Funnel)
- **title**: 문의 → 예약 → 내원 → 결제 단계별 전환율 시각화
- **text**: 첫 번째 섹션 "퍼널 전환 분석 (Funnel)"은 ApexCharts 깔대기 차트로 고객 여정의 각 단계에서 얼마나 많은 수가 다음 단계로 진행했는지 보여줍니다. 우측에 단계별 전환율(%)도 표시됩니다.
- **highlight**: `#funnel-chart`
- **trigger**: —— (read-only, but clickable for drilldown)
- **tips**:
  - 문의(Inquiry) → 예약(Reservation) → 내원(Visit) → 결제(Payment) 순서
  - 차트 데이터는 상담 유형 토글과 함께 업데이트
  - 각 세그먼트 클릭 시 상세 모달 열기 가능

### Step 7: 퍼널 인사이트 (Funnel Insights)
- **title**: 전환율 개선 권고사항
- **text**: 퍼널 차트 하단의 "퍼널 인사이트" 섹션에는 병목 구간이나 개선 필요 영역에 대한 텍스트 인사이트가 표시됩니다(예: "예약 확정율이 XX%로 낮음" 등).
- **highlight**: `#funnel-insights`
- **trigger**: —— (read-only)
- **tips**:
  - JavaScript에서 동적으로 생성됨 (renderFunnelInsights 함수)
  - 상담 유형별로 인사이트 내용이 달라짐

### Step 8: 환자 구분별 매출 차트 (Patient Type Pie)
- **title**: 신규 vs 재진 매출 비중 도넛형 차트
- **text**: 좌측 "환자 구분별 (Patient Type)" 도넛형 차트는 총 매출이 신규 환자(초진)와 재진 환자에 의해 어떻게 분배되는지 보여줍니다. 범례는 하단에 표시되고, 각 섹터 클릭 시 상세 고객 리스트 모달 열기 가능합니다.
- **highlight**: `#patient-type-pie-chart`
- **trigger**: click (segment selection)
- **tips**:
  - 신규: 초록색 (#10b981), 재진: 인디고색 (#6366f1)
  - 도넛 중앙에 총합 금액 표시
  - 데이터 포인트 클릭 시 openChannelDrilldown() 실행

### Step 9: 태그별 매출 차트 (Tag Revenue Pie)
- **title**: 상품/서비스 카테고리별 매출 비중
- **text**: 우측 "태그별 매출 (Revenue by Tag)" 차트는 클리닉 내 각 상품/서비스 태그(예: 다이어트, 피부질환, 한약 등)별 매출 기여도를 보여줍니다. 상위 6개 태그별 매출 + 기타(Others) + 태그 없음으로 구분됩니다.
- **highlight**: `#consult-type-pie-chart`
- **trigger**: click (segment selection)
- **tips**:
  - 태그 없음은 항상 마지막에 회색으로 표시
  - 6개 초과 태그는 "기타 (Others)"로 병합
  - 범례 클릭으로 특정 태그 상세 보기 가능

### Step 10: 진료 성과 그리드 (Medical Performance) + 결제 담당자별 성과 + 실제 내원 경로
- **title**: 직원별 상세 성과 분석 (좌:진료, 중:결제, 우:유입 경로)
- **text**: 하단 3열 그리드:
  - **진료 성과 상세**: 담당 의사별 상담 유형(비대면, 내원초진, 재진) 건수
  - **결제 담당자별 성과**: 결제 담당 직원별 결제 건수, 총 매출, 건당 평균 금액 (클릭 시 상세 모달)
  - **실제 내원 경로**: 환자들이 실제 내원할 때 등록한 first_source (유입 채널)별 방문자 수와 매출 (클릭 시 상세 모달)
- **highlight**: `#medical-perf-grid`, `#consultant-stats`, `#verified-source-stats`
- **trigger**: click (row selection for modal)
- **tips**:
  - 각 그리드 행은 card 형태로 스타일됨
  - 스크롤 가능 (max-height: 384px, overflow-y-auto)
  - 결제 담당자/유입 경로 클릭 시 상세 고객 리스트 모달 열림

### Step 11: 상세 모달 (Detail Modal) — 페이지네이션
- **title**: 집계 데이터 상세 고객 리스트 및 페이지네이션
- **text**: 메트릭 카드, 성과 그리드의 요소를 클릭하면 "상세 내역" 모달이 열립니다. 모달 내 테이블에는 해당 필터에 맞는 고객 리스트가 표시되고, 하단의 "이전/다음" 버튼으로 페이지를 이동할 수 있습니다. 페이지 정보(예: 1 / 5)도 표시됩니다.
- **highlight**: `#detailModal`, `#detailTableBody`, `#prevPageBtn`, `#nextPageBtn`, `#pageIndicator`
- **trigger**: click
- **tips**:
  - 페이지 크기는 50건 (limit: 50)
  - detailState 전역 변수로 모달 상태 추적
  - 총 건수도 모달 좌측에 표시 (#detailTotalCount)

### Buttons Reference

#### 상단 액션
| 버튼 | 셀렉터 | 설명 |
|------|--------|------|
| 웹사이트 분석 | `a[href="/admin/analytics/web"]` | 웹사이트 GA 분석 페이지로 이동 |
| 1개월 | `#datePresets [data-preset="1m"]` | 지난 1개월 데이터 로드 |
| 90일 | `#datePresets [data-preset="90d"]` | 지난 90일 데이터 로드 |
| 6개월 | `#datePresets [data-preset="6m"]` | 지난 6개월 데이터 로드 |
| 12개월 | `#datePresets [data-preset="12m"]` | 지난 12개월 데이터 로드 |
| 전체 | `#datePresets [data-preset="all"]` | 전체 기간 데이터 로드 |
| 조회 | `#refreshBtn` | 수동 데이터 새로고침 |

#### 상담 유형 토글
| 버튼 | 셀렉터 | 설명 |
|------|--------|------|
| 전체 | `#consultTypeToggle [data-consult-type="all"]` | 모든 상담 분석 |
| 내원 초진 | `#consultTypeToggle [data-consult-type="visit"]` | 내원한 초진 환자만 분석 |
| 비대면 초진 | `#consultTypeToggle [data-consult-type="remote"]` | 비대면 상담 환자만 분석 (조건부) |

#### 메트릭 카드 (클릭 가능)
| 카드 | 셀렉터 | 모달 타입 |
|------|---------|---------|
| 총 문의 | metrics[0] | openDetailModal('inquiries', '총 문의') |
| 예약 확정 | metrics[1] | openDetailModal('reservations', '예약 확정') |
| 내원 | metrics[2] | openDetailModal('visits', '내원') (비대면 제외) |
| 결제 | metrics[3] | openDetailModal('payments', '결제') |
| 리드 미매칭 초진 | sub-metric in 결제 | openDetailModal('payments_orphan', '리드 미매칭 초진') |
| 재진 결제 | sub-metric in 결제 | openChannelDrilldown('returning', 'patient_type', '재진') |

#### 차트 상호작용
| 요소 | 트리거 | 동작 |
|------|--------|------|
| 퍼널 세그먼트 | click | 해당 단계 고객 상세 리스트 모달 |
| Patient Type 도넛 | click | openChannelDrilldown(key, 'patient_type', label) |
| Tag Revenue 도넛 | click | openChannelDrilldown(key, 'tag', label) 또는 기타/No Tag 처리 |

#### 그리드 행 (클릭 가능)
| 그리드 | 클릭 시 동작 | 모달 정보 |
|--------|-----------|---------|
| 진료 성과 | 이름 클릭 | 의사별 상담 상세 (필요 시) |
| 결제 담당자 | 행 클릭 | openDetailModal('staff_payment', '이름', staff_id) |
| 실제 내원 경로 | 행 클릭 | openDetailModal('source', '채널명') |

#### 상세 모달 (Detail Modal)
| 버튼 | 셀렉터 | 설명 |
|------|--------|------|
| 이전 | `#prevPageBtn` | 이전 페이지 (첫 페이지면 비활성) |
| 다음 | `#nextPageBtn` | 다음 페이지 (마지막 페이지면 비활성) |
| 닫기 | onclick in header | 모달 종료 |

### 차트 범례 및 색상 코드
| 요소 | 색상 | 의미 |
|------|------|------|
| 신규 환자 | #10b981 (초록) | Patient Type 도넛에서 신규 환자 매출 |
| 재진 환자 | #6366f1 (인디고) | Patient Type 도넛에서 재진 환자 매출 |
| 태그 #1-6 | 순환 색상 | Tag Revenue 상위 6개 태그 |
| 기타 태그 | #64748b (회색) | 6위 이외 태그 병합 |
| 태그 없음 | #94a3b8 (라이트 회색) | 태그 미지정 매출 |
