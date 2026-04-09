# API Keys (/admin/settings/api-keys) — 투어 시나리오

## 페이지 목적
외부 AI 어시스턴트(Claude, Gemini 등)와 자동화 도구(Zapier, Make 등)가 Admin API를 호출할 때 사용하는 인증 키를 관리합니다.

## 시나리오 (5 스텝)

### Step 1: 현재 API Key 상태 확인
- **title**: API Key 관리 페이지 개요
- **text**: 이 페이지에서 Admin API 인증 키를 생성, 관리, 삭제합니다. 우측의 상태 표시(초록색=활성, 회색=미설정)로 현재 상태를 한눈에 확인하고, 아래 섹션에서 새 키를 생성할 수 있습니다.
- **highlight**: `.max-w-4xl.mx-auto`
- **trigger**: none
- **tips**:
  - 초록색 상태: 활성 키 존재
  - 회색 상태: 키가 설정되지 않음
  - 한 번에 하나의 활성 키만 존재
  - 새 키 생성 시 기존 키는 자동 무효화
- **buttons**: []

### Step 2: API Key 상태 표시 영역
- **title**: 현재 API Key 상태
- **text**: 위쪽 흰색 박스에서 현재 API Key의 상태를 표시합니다. 이미 API Key가 있으면 마스킹된 키(예: cos_abc...xyz)와 "삭제" 버튼이 표시되고, 없으면 "API Key가 설정되지 않았습니다" 메시지가 나타납니다.
- **highlight**: `.bg-white.rounded-2xl.shadow-sm.border`
- **trigger**: none
- **tips**:
  - 마스킹된 키: 보안상 처음과 끝만 표시
  - "삭제" 버튼: 현재 키를 무효화 (조회 불가능)
  - 삭제 후 새 키 생성 필요
  - 삭제 전 확인 대화창 표시
- **buttons**:
  - `#keyDisplay / 현재 키 표시 / 마스킹된 API Key와 삭제 버튼`
  - `#noKeyMessage / 미설정 메시지 / API Key가 없음을 안내`

### Step 3: 새 API Key 생성
- **title**: 새 API Key 생성
- **text**: "새 API Key 생성" 또는 "API Key 재발급" 파란색 버튼을 클릭하면 새 키가 생성됩니다. 새 키는 한 번만 표시되므로, 안전한 곳에 저장하거나 복사해둬야 합니다. 기존 키가 있으면 자동 무효화됩니다.
- **highlight**: `#generateBtn`
- **trigger**: click
- **tips**:
  - 클릭 시 확인 대화창 표시
  - "기존 키는 무효화됨" 경고 표시
  - 생성 후 초록색 박스에 한 번만 표시
  - 새로고침하면 다시 볼 수 없음
  - 반드시 미리 복사 또는 저장할 것
- **buttons**:
  - `#generateBtn / 새 API Key 생성 / 새 키 생성 (기존 키 무효화)`

### Step 4: 생성된 API Key 복사 및 저장
- **title**: 새 API Key 복사
- **text**: 새 API Key가 생성되면 초록색 박스에 전체 키가 표시됩니다. 우측의 "복사" 버튼을 클릭하면 클립보드에 복사되므로, 환경변수, .env 파일, 비밀 관리 도구(1Password, HashiCorp Vault 등)에 안전하게 저장하세요.
- **highlight**: `#newKeyDisplay`
- **trigger**: click
- **tips**:
  - 한 번만 전체 키 표시
  - 새로고침 후 조회 불가능
  - 복사 버튼으로 쉽게 클립보드 복사
  - Git이나 공개 채널에 노출 금지
  - 환경변수나 비밀 관리 도구에 저장
- **buttons**:
  - `#copyBtn / 복사 / API Key 클립보드 복사`

### Step 5: API 사용 가이드 및 보안
- **title**: API 사용 방법 및 보안 주의사항
- **text**: 아래 섹션에서 API 사용 방법을 확인할 수 있습니다. Claude/Gemini 등 AI에게 API Key를 전달하거나, Zapier/Make 같은 자동화 도구에서 API를 호출할 수 있습니다. 보안 주의사항을 꼭 읽고, 키 유출 시 즉시 새 키를 생성하고 기존 키를 삭제하세요.
- **highlight**: `.space-y-6`
- **trigger**: none
- **tips**:
  - AI 어시스턴트: "API Key는 cos_xxxx야" 형식으로 전달
  - 자동화 도구: HTTP 헤더에 "X-Admin-API-Key: <key>" 추가
  - 사용 가능 엔드포인트: /api/admin/clinic-info, /api/admin/staff 등
  - 전체 API 문서: HQ 가이드 참고
  - 보안: 비밀번호처럼 취급, Git 업로드 금지, 유출 시 즉시 삭제
- **buttons**: []

### Bonus: API 호출 예시
- **title**: API 호출 방법
- **text**: 
  - **AI 어시스턴트**: "병원 전화번호를 02-1234-5678로 변경해줘. API Key는 cos_xxxx야"
  - **cURL 예시**: `curl -X GET https://your-site.com/api/admin/clinic-info -H "X-Admin-API-Key: cos_your_api_key"`
  - **Zapier/Make**: Webhook 또는 HTTP 모듈에서 X-Admin-API-Key 헤더 추가
- **highlight**: `.bg-gradient-to-br`
- **trigger**: none
- **tips**:
  - 각 엔드포인트의 메서드(GET/POST/PATCH) 확인
  - Request body는 JSON 형식
  - 응답도 JSON으로 반환됨
  - 인증 실패: 401 Unauthorized
  - 권한 부족: 403 Forbidden
- **buttons**: []
