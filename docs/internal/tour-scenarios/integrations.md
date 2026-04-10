# Integrations (/admin/settings/integrations) — 투어 시나리오

## 페이지 목적
Slack, SMS(알리고/솔라피), 네이버 톡톡, 카카오톡 채널 등 외부 서비스 연동을 통합 관리합니다.

## 시나리오 (12 스텝)

### Step 1: Slack 연동 활성화
- **title**: Slack 연동 설정
- **text**: "Slack" 카드의 토글을 켜면 새 문의 및 메시지가 Slack 채널로 실시간 알림으로 전달됩니다. Slack 앱에서 먼저 Incoming Webhooks를 설정한 후 URL을 붙여넣으세요.
- **highlight**: `.bg-white.rounded-xl.shadow-sm.border.p-6:first-of-type`
- **trigger**: none
- **tips**:
  - 토글 ON으로 활성화
  - Webhook URL은 필수 입력
  - Slack 앱 관리자 권한 필요
  - 설정 후 "테스트 메시지 보내기"로 연동 확인
- **buttons**:
  - `input[type="checkbox"]#slackEnabled / Slack 활성화 / 토글 ON/OFF`

### Step 2: Slack Webhook URL 입력
- **title**: Slack Webhook URL 설정
- **text**: Slack API 문서에서 발급받은 Webhook URL을 "Webhook URL" 필드에 붙여넣습니다. 형식은 https://hooks.slack.com/services/... 입니다. 선택사항으로 채널명을 메모 용도로 입력할 수 있습니다(실제 채널은 Webhook 설정에서 지정됨).
- **highlight**: `#slackConfig`
- **trigger**: none
- **tips**:
  - Webhook URL: https://hooks.slack.com/services/... 형식
  - 채널명 입력은 선택사항 (메모용)
  - 토큰 유출 주의 (비밀번호처럼 취급)
  - 설정 방법 링크 제공 (api.slack.com/messaging/webhooks)
- **buttons**:
  - `#slackWebhookUrl / Webhook URL / Slack API에서 발급받은 URL`
  - `#slackChannel / 채널명 (선택) / 메모용 채널명`
  - `#testSlackBtn / 테스트 메시지 보내기 / Slack 연동 확인`
  - `#saveSlackBtn / 저장 / Slack 설정 저장`

### Step 3: SMS 서비스 활성화 및 제공자 선택
- **title**: SMS 발송 서비스 연동
- **text**: "SMS 발송" 카드의 토글을 켜면 문자/알림톡 발송 기능을 활성화합니다. 아래 "서비스 선택"에서 알리고 또는 솔라피 중 하나를 선택하세요. 각 서비스는 다양한 설정 방식을 제공합니다.
- **highlight**: `.bg-white.rounded-xl.shadow-sm.border.p-6:nth-of-type(2)`
- **trigger**: none
- **tips**:
  - 알리고: IP 등록 필요, 한국 서비스
  - 솔라피: IP 제한 없음, 글로벌 지원
  - 두 서비스 중 하나만 선택
  - 잔액 확인은 자동으로 표시됨
- **buttons**:
  - `input[type="checkbox"]#aligoEnabled / SMS 활성화 / 토글 ON/OFF`
  - `input[name="smsProvider"] / 서비스 선택 / 알리고 또는 솔라피`

### Step 4: 알리고 설정 - IP 등록 및 API 키
- **title**: 알리고 API 키 및 권한 설정
- **text**: 알리고를 선택하면 "알리고 설정 안내" 박스가 표시됩니다. 상단의 IP 주소(43.200.51.252)를 알리고 관리자 페이지의 "접속보안설정"에 등록해야 연동이 정상 작동합니다. API Key는 알리고 계정에서 발급받아 입력하세요.
- **highlight**: `#aligoFields`
- **trigger**: none
- **tips**:
  - IP 등록: 알리고 관리자 > 접속보안설정
  - API Key: 필수 입력
  - Sender Key: 카카오 알림톡 필수 (아이디/비번 방식과 다름)
  - User ID: 알리고 아이디
  - 발신번호: 알리고에 등록된 번호만 가능
- **buttons**:
  - `#copyProxyIpBtn / IP 복사 / 43.200.51.252 클립보드 복사`
  - `#aligoApiKey / API Key / 알리고에서 발급받은 키`
  - `#aligoSenderKey / Sender Key / 카카오톡 채널 연동 후 발급`
  - `#aligoUserId / User ID / 알리고 아이디`
  - `#aligoSender / 발신번호 / 등록된 발신번호 (예: 02-1234-5678)`

### Step 5: 알리고 설정 - 테스트 및 저장
- **title**: 알리고 설정 테스트 및 저장
- **text**: "설정 테스트" 버튼으로 알리고 연동을 검증합니다. 문제가 없으면 "저장" 버튼을 클릭하여 설정을 저장합니다. 아래 "발송 테스트" 섹션에서 실제 문자를 전송하여 동작을 확인할 수 있습니다(건수 차감).
- **highlight**: `.flex.gap-3.pt-4`
- **trigger**: click
- **tips**:
  - 테스트: API 연결 상태만 확인, 문자 비용 없음
  - 발송 테스트: 실제 문자 발송, 건수 차감됨
  - 수신번호: 01012345678 형식 (하이픈 제거)
  - 테스트 메시지 내용 커스터마이징 가능
- **buttons**:
  - `#testAligoBtn / 설정 테스트 / API 연결 상태 확인`
  - `#saveAligoBtn / 저장 / 알리고 설정 저장`
  - `#aligoTestReceiver / 수신번호 / 테스트 메시지 받을 번호`
  - `#aligoTestMessage / 메시지 내용 / 발송할 메시지 입력`
  - `#sendTestMsgBtn / 전송하기 / 실제 문자 발송 (건수 차감)`

### Step 6: 솔라피 설정 (API Key, Secret)
- **title**: 솔라피 API 설정
- **text**: 솔라피를 선택하면 "솔라피 설정 안내" 박스가 표시됩니다. IP 제한이 없어 바로 연결 가능합니다. solapi.com에서 가입한 후 API Key와 API Secret을 입력하세요. 발신번호와 PFId(카카오 프로필, 선택)도 설정할 수 있습니다.
- **highlight**: `#solapiFields`
- **trigger**: none
- **tips**:
  - API Key + Secret: 쌍으로 필수
  - 발신번호: 사전 등록된 번호만 가능
  - PFId: 카카오 알림톡 사용 시만 필요 (선택)
  - IP 제한 없으므로 설정 편함
- **buttons**:
  - `#solapiApiKey / API Key / solapi.com에서 발급`
  - `#solapiApiSecret / API Secret / solapi.com에서 발급`
  - `#solapiSender / 발신번호 / 등록된 번호만 가능`
  - `#solapiPfId / PFId / 카카오 알림톡용 (선택)`

### Step 7: 네이버 톡톡 연동 활성화
- **title**: 네이버 톡톡 연동
- **text**: "네이버 톡톡" 카드의 토글을 켜면 네이버 톡톡으로 들어오는 문의가 메신저에 자동 저장됩니다. 네이버 톡톡 파트너센터에서 발급받은 Authorization Token을 입력하세요.
- **highlight**: `.bg-white.rounded-xl.shadow-sm.border.p-6:nth-of-type(3)`
- **trigger**: none
- **tips**:
  - 파트너센터: partner.talk.naver.com
  - Authorization Token 발급 필수
  - Webhook URL은 자동 생성 (복사해서 파트너센터에 등록)
- **buttons**:
  - `input[type="checkbox"]#naverTalkEnabled / 네이버 톡톡 활성화 / 토글 ON/OFF`

### Step 8: 네이버 톡톡 - Token 및 Webhook URL 설정
- **title**: 네이버 톡톡 Token 및 Webhook
- **text**: "Authorization Token" 필드에 파트너센터에서 발급받은 토큰을 입력합니다. "Webhook URL"은 자동 생성되므로 우측 "복사" 버튼으로 복사한 후 파트너센터의 챗봇 API > Webhook 설정에 등록하세요.
- **highlight**: `#naverTalkConfig`
- **trigger**: click
- **tips**:
  - Token: 파트너센터 > API 인증 > Bearer Token
  - Webhook URL: 자동 생성 (변경 불가)
  - 파트너센터 챗봇 API에 등록 필수
  - 연결 테스트로 설정 확인
- **buttons**:
  - `#naverTalkToken / Authorization Token / 파트너센터에서 발급`
  - `#copyWebhookBtn / 복사 / Webhook URL 클립보드 복사`
  - `#testNaverTalkBtn / 연결 테스트 / 네이버 톡톡 연동 확인`
  - `#saveNaverTalkBtn / 저장 / 네이버 톡톡 설정 저장`

### Step 9: 카카오톡 채널 연동 활성화
- **title**: 카카오톡 채널 연동
- **text**: "카카오톡 채널" 카드의 토글을 켜면 카카오톡 채널로 들어오는 문의가 리드로 자동 저장됩니다. 아래 Webhook URL을 복사하여 카카오 i 오픈빌더의 스킬 서버 설정에 등록하세요.
- **highlight**: `.bg-white.rounded-xl.shadow-sm.border.p-6:nth-of-type(4)`
- **trigger**: none
- **tips**:
  - 카카오톡 채널로 들어온 문의 자동 저장
  - Webhook URL은 자동 생성
  - 카카오 i 오픈빌더에 등록 필수
- **buttons**:
  - `input[type="checkbox"]#kakaoEnabled / 카카오톡 채널 활성화 / 토글 ON/OFF`

### Step 10: 카카오톡 채널 - Webhook URL 등록
- **title**: 카카오 i 오픈빌더 설정
- **text**: "Webhook URL" 필드의 주소를 복사하여 카카오 i 오픈빌더에서 봇을 생성한 후, 폴백 블록 설정에 이 URL을 스킬 서버로 등록합니다. 자세한 설정 방법은 아래 "설정 방법" 섹션을 참고하세요.
- **highlight**: `#kakaoConfig`
- **trigger**: click
- **tips**:
  - Webhook URL: 자동 생성 (변경 불가)
  - 카카오 i 오픈빌더: i.kakao.com
  - 설정 단계: 봇 생성 → 폴백 블록 → Webhook 등록 → 배포 → 채널 연결
  - 연결 테스트로 확인
- **buttons**:
  - `#copyKakaoWebhookBtn / 복사 / Webhook URL 클립보드 복사`
  - `#testKakaoBtn / 연결 테스트 / 카카오톡 채널 연동 확인`
  - `#saveKakaoBtn / 저장 / 카카오톡 채널 설정 저장`

### Step 11: 외부 연동 테스트 및 저장
- **title**: 모든 외부 서비스 테스트
- **text**: 각 서비스별로 "테스트" 또는 "연결 테스트" 버튼을 클릭하여 연동 상태를 확인합니다. 문제가 없으면 "저장" 버튼을 클릭하여 설정을 저장합니다.
- **highlight**: `.flex.gap-3.pt-4`
- **trigger**: click
- **tips**:
  - 각 서비스 독립적으로 테스트 가능
  - 테스트 전에 필수 필드 입력
  - 실패 시 에러 메시지 확인
  - 저장 후 메시지 표시됨
- **buttons**: []

### Step 12: 상태 메시지 확인
- **title**: 연동 결과 확인
- **text**: 테스트 또는 저장 후 각 서비스 카드 아래에 상태 메시지가 표시됩니다. 성공하면 초록색, 실패하면 빨간색으로 표시되며 오류 내용을 확인할 수 있습니다.
- **highlight**: `#statusMessage, #aligoStatusMessage, #naverTalkStatusMessage, #kakaoStatusMessage`
- **trigger**: none
- **tips**:
  - 성공: 초록색 배경 (bg-green-50)
  - 실패: 빨간색 배경 (bg-red-50)
  - 상세 오류 메시지 포함
  - 메시지는 자동 지워짐 또는 재시작 시 초기화
- **buttons**: []
