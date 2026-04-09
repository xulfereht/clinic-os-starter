# AEO 대시보드 (/admin/aeo) — 투어 시나리오

## 페이지 목적
AI 검색 엔진 최적화(AEO) 현황을 모니터링하고, 스키마 검증, 봇 트래픽 분석, 콘텐츠 품질 리포트를 확인하는 페이지

## 시나리오 (6 스텝)

### Step 1: AEO 대시보드 진입
- **title**: AEO 대시보드 개요
- **text**: 이 페이지는 AI 검색 최적화 상태를 종합적으로 모니터링하는 대시보드입니다. 상단에는 페이지 제목과 설명이 있으며, 아래로 여러 탭과 섹션들이 배치되어 있습니다. 탭은 'Overview(개요)', 'Content(콘텐츠)', 'Traffic(트래픽)' 세 가지로 구성되어 있으며, 탭을 클릭하여 다양한 분석 정보를 확인할 수 있습니다.
- **highlight**: `.max-w-7xl.mx-auto`
- **trigger**: confirm
- **tips**:
  - 각 탭은 독립적으로 데이터를 로드함 (성능 최적화)
  - Overview 탭이 기본으로 표시됨
  - 탭별로 다양한 지표와 차트 표시

### Step 2: 진단 상태 (Diagnostics)
- **title**: 시스템 진단 상태 확인
- **text**: Overview 탭의 상단에는 '진단' 섹션이 있으며, 다음 항목들의 상태를 실시간으로 확인할 수 있습니다: 1)Schema(JSON-LD 스키마 유효성), 2)Manifest(AI 검색 매니페스트), 3)Entities(엔티티 완전성), 4)Indexability(검색 색인 가능성). 각 항목은 OK/Warning/Error 상태를 표시하며, 문제가 있으면 상세 메시지가 표시됩니다.
- **highlight**: `[role="region"]:has-text("Diagnostics")`
- **trigger**: confirm
- **tips**:
  - OK: 정상 작동
  - Warning: 주의 필요, 자동으로 해결 가능
  - Error: 수정 필수
  - 각 진단 항목을 클릭하면 상세 정보 표시

### Step 3: 성능 지표 (Performance Benchmarks)
- **title**: AEO 성능 벤치마크 확인
- **text**: Overview 탭의 중단에는 성능 벤치마크 섹션이 있습니다. 이 섹션에는 다음과 같은 지표들이 프로그레스 바와 함께 표시됩니다: Condition 90%, Slug 100%, Cluster 80%. 각 지표는 목표 수치에 대한 달성도를 표시하며, 달성도에 따라 초록색(성공), 노란색(경고), 빨간색(위험)으로 색분화됩니다.
- **highlight**: `.grid.gap-4`
- **trigger**: confirm
- **tips**:
  - Condition: 콘텐츠 조건 충족도
  - Slug: URL Slug 최적화도
  - Cluster: FAQ 클러스터 구성도
  - 각 지표별로 개선 방안 제시됨

### Step 4: 탭 전환 - Traffic 분석
- **title**: 봇 트래픽 분석 탭
- **text**: '🚦 Traffic' 탭을 클릭하면 AI 검색 봇의 트래픽 데이터가 표시됩니다. 이 탭에는 다음 섹션들이 포함됩니다: 1)Bot Traffic Trends(일별 봇 트래픽 추이), 2)Bot Family Distribution(봇 유형별 분포), 3)Verification Status(봇 검증 상태). 차트와 통계로 검색 엔진 봇의 방문 패턴을 분석할 수 있습니다.
- **highlight**: `.modal-tab-btn[data-tab="traffic"]`
- **trigger**: click
- **tips**:
  - 트래픽 데이터는 최근 30일 기준
  - Bot Family: Google, Bing, Claude, Perplexity 등 구분
  - 검증된 봇만 신뢰할 수 있는 데이터

### Step 5: 탭 전환 - Content 분석
- **title**: 콘텐츠 품질 분석 탭
- **text**: '📄 Content' 탭을 클릭하면 콘텐츠 품질 관련 지표들이 표시됩니다. 이 탭에는 다음 섹션들이 포함됩니다: 1)Content Readiness(콘텐츠 준비 상태), 2)Topic Pillar Coverage(토픽 커버리지), 3)FAQ Cluster Quality(FAQ 품질). 각 섹션은 시각적 차트와 함께 상세 통계를 제공합니다.
- **highlight**: `.modal-tab-btn[data-tab="content"]`
- **trigger**: click
- **tips**:
  - 콘텐츠 준비 상태: Draft/Published/Optimized 비율
  - 토픽 커버리지: 필수 토픽 작성 비율
  - FAQ 품질: 각 토픽별 FAQ 충분성

### Step 6: 주요 액션 및 개선 사항
- **title**: AEO 개선 작업 항목
- **text**: 대시보드의 여러 섹션에는 현재 문제점과 개선 방안이 제시됩니다. 예: 1)Missing Entities - 추가 필요한 엔티티 목록, 2)Unoptimized Topics - 최적화가 필요한 토픽, 3)FAQ Gaps - FAQ가 부족한 영역. 각 항목에는 직접 수정 링크가 제공되어 빠르게 개선 작업을 수행할 수 있습니다.
- **highlight**: `[class*="bg-red"], [class*="bg-amber"], [class*="bg-emerald"]`
- **trigger**: confirm
- **tips**:
  - 각 문제 항목은 우선순위별로 색분화됨 (빨강=긴급, 노랑=경고, 초록=완료)
  - 직접 편집 링크 제공으로 빠른 수정 가능
  - 개선 후 대시보드는 자동으로 업데이트됨
