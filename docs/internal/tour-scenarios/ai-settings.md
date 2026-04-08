# AI Settings (/admin/settings/ai) — 투어 시나리오

## 페이지 목적
이미지 생성(DALL-E, Gemini, 등)과 텍스트 생성 AI 서비스의 API 키를 관리하고, 각 기능별로 어떤 AI 모델을 사용할지 라우팅을 설정합니다.

## 시나리오 (7 스텝)

### Step 1: AI 제공자(Provider) 목록 확인
- **title**: AI 서비스 제공자 관리
- **text**: 페이지 상단에 5개의 AI 제공자(OpenAI, Google Gemini, Anthropic Claude, DeepSeek, Google Translate)가 카드로 표시됩니다. 각 카드에서 API Key, 활성화 여부, 모델을 설정할 수 있습니다.
- **highlight**: `.space-y-6`
- **trigger**: none
- **tips**:
  - 각 카드는 독립적으로 관리됨
  - 우측 토글: 사용/미사용 제어
  - API Key: 저장 후 마스킹된 형태로 표시 (보안)
  - 모델: 제공자별 기본값 또는 커스텀 지정
  - 완전히 활성화 후 저장해야 기능 사용 가능
- **buttons**: []

### Step 2: OpenAI 설정 (DALL-E, GPT 모델)
- **title**: OpenAI API 설정
- **text**: OpenAI 카드에서 "사용" 토글을 켜고 API Key를 입력합니다. "Model" 드롭다운에서 dall-e-3(이미지), gpt-4o(텍스트) 등을 선택하거나, 커스텀 모델명을 입력할 수 있습니다. 입력 후 우측 "저장" 버튼으로 저장합니다.
- **highlight**: `[data-provider="openai"]`
- **trigger**: none
- **tips**:
  - API Key: platform.openai.com에서 발급
  - 주요 모델: dall-e-3(이미지), gpt-4o(최신), gpt-4-turbo(고성능)
  - 커스텀 모델: "직접 입력" 선택 후 텍스트 입력
  - 저장 후 마스킹된 형태로만 표시 (재입력 필요 시 비움)
  - 가격 정책: 사용량 기반 (토큰 단위)
- **buttons**:
  - `.toggle-active / 사용 토글 / OpenAI 활성화/비활성화`
  - `.input-api-key / API Key 입력 / sk-로 시작하는 OpenAI API Key`
  - `.select-model / 모델 선택 / DALL-E 또는 GPT 모델`
  - `.input-model-custom / 커스텀 모델 입력 / 직접 입력 선택 시 표시`
  - `.btn-save / 저장 / OpenAI 설정 저장`

### Step 3: Google Gemini 설정 (이미지, 텍스트)
- **title**: Google Gemini API 설정
- **text**: Gemini 카드에서 토글을 켜고 API Key를 입력합니다. "Model"에서 imagen-3.0(이미지), gemini-1.5-pro(텍스트) 등을 선택합니다. Google Cloud Console에서 발급받은 API Key를 사용합니다.
- **highlight**: `[data-provider="gemini"]`
- **trigger**: none
- **tips**:
  - API Key: console.cloud.google.com (Google Cloud 프로젝트)
  - 이미지: imagen-3.0-generate-001
  - 텍스트: gemini-1.5-pro, gemini-1.5-flash
  - 비용: Google Cloud 크레딧 기반
  - Vision: gemini-pro-vision (이미지 분석)
- **buttons**:
  - `.toggle-active / 사용 토글 / Gemini 활성화/비활성화`
  - `.input-api-key / API Key / Google Cloud API Key`
  - `.select-model / 모델 선택 / Imagen 또는 Gemini 모델`
  - `.btn-save / 저장 / Gemini 설정 저장`

### Step 4: Anthropic Claude 설정 (텍스트)
- **title**: Anthropic Claude API 설정
- **text**: Claude 카드에서 토글을 켜고 API Key를 입력합니다. "Model"에서 claude-3-5-sonnet(최신, 권장), claude-3-opus(고성능) 등을 선택합니다. console.anthropic.com에서 API Key를 발급받으세요.
- **highlight**: `[data-provider="claude"]`
- **trigger**: none
- **tips**:
  - API Key: console.anthropic.com
  - 주요 모델: claude-3-5-sonnet-20240620(최신), claude-3-opus(성능), claude-3-haiku(속도)
  - 사용 사례: 고품질 텍스트 생성, 분석
  - 가격: 토큰 기반 (입력/출력 구분)
  - 한국어 지원 우수
- **buttons**:
  - `.toggle-active / 사용 토글 / Claude 활성화/비활성화`
  - `.input-api-key / API Key / sk-ant-로 시작하는 Anthropic API Key`
  - `.select-model / 모델 선택 / Claude 3.5 또는 Claude 3 모델`
  - `.btn-save / 저장 / Claude 설정 저장`

### Step 5: DeepSeek 및 Google Translate 설정
- **title**: DeepSeek 및 번역 서비스 설정
- **text**: 마찬가지로 DeepSeek(deepseek-chat, deepseek-coder) 및 Google Translate API를 설정합니다. 각각 토글, API Key, 모델 선택, 저장 버튼이 동일하게 제공됩니다.
- **highlight**: `[data-provider="deepseek"], [data-provider="google_translate"]`
- **trigger**: none
- **tips**:
  - DeepSeek: 중국 서비스, 저비용, 고성능
  - Google Translate: 다국어 번역, NMT 모델 권장
  - 설정 방식: 모두 동일 (API Key + 모델 선택)
  - 필요한 서비스만 활성화
- **buttons**:
  - 각 제공자별 토글, API Key 입력, 모델 선택, 저장 버튼

### Step 6: 기능별 AI 라우팅 설정 (Feature Routing)
- **title**: AI 기능별 모델 라우팅
- **text**: 페이지 하단의 "기능별 AI 모델 연결" 섹션에서 각 기능(예: CRM 세그먼트 빌더, 다국어 번역기)이 어떤 AI 제공자를 사용할지 지정합니다. 각 기능별로 드롭다운에서 제공자를 선택하고 "저장" 버튼을 클릭합니다.
- **highlight**: `.feature-routing-container`
- **trigger**: click
- **tips**:
  - 각 기능은 특정 제공자만 지원 (필터링됨)
  - 예: 세그먼트 빌더 = OpenAI/Gemini 만 가능
  - 예: 번역기 = Google Translate/OpenAI/Gemini
  - 자동 선택(빈칸): 활성화된 제공자 중 하나 자동 선택
  - 하나의 기능 = 하나의 제공자만 선택
- **buttons**:
  - `.select-routing / 제공자 선택 / 해당 기능이 사용할 AI 제공자`
  - `.btn-save-routing / 저장 / 기능별 라우팅 설정 저장`

### Step 7: 저장 및 상태 확인
- **title**: AI 설정 저장 및 완료
- **text**: 모든 API Key 입력과 라우팅 설정을 완료한 후 각 "저장" 버튼을 클릭하면 토스트 메시지("설정이 저장되었습니다")가 표시됩니다. API Key는 보안상 저장 후 마스킹되어 표시되므로, 변경할 필요가 없으면 입력 필드를 비워두세요.
- **highlight**: `.btn-save, .btn-save-routing`
- **trigger**: click
- **tips**:
  - 저장 중: 버튼에 "저장 중..." 표시
  - 저장 완료: 토스트 메시지 + 페이지 상태 업데이트
  - 에러: 에러 토스트 메시지 표시 (예: 유효하지 않은 키)
  - 부분 저장 가능: 하나의 제공자만 저장 가능
  - 저장 후 API Key 입력칸은 비워짐 (재입력 필수)
- **buttons**: []

### 보안 주의사항
- **title**: AI API Key 보안 주의
- **text**: API Key는 비밀번호만큼 중요합니다. Git 저장소나 공개 채널에 노출하지 마세요. 환경변수나 비밀 관리 도구를 사용하여 안전하게 관리하세요. 유출이 의심되면 즉시 해당 제공자에서 새 키를 발급받고 기존 키를 비활성화하세요.
- **highlight**: `[type="password"]`
- **trigger**: none
- **tips**:
  - 저장소에 API Key 커밋 금지
  - 환경변수 또는 .env (로컬만) 사용
  - 팀 공유 시 암호화된 채널 사용
  - 정기적인 키 로테이션 권장
  - 의심 활동 감시 (제공자 대시보드)
- **buttons**: []
