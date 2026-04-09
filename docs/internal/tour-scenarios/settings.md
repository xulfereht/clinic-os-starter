# 병원 설정 (/admin/settings) — 투어 시나리오

## 페이지 목적
한의원의 기본 정보(이름, 연락처, 주소), 브랜딩(로고, 파비콘), 운영 설정(진료 시간, 기능 토글), 다국어 정보(영문/일본어/중국어), AI 설정(지역 정보) 등을 탭 형식으로 관리합니다. 모든 설정은 한 폼에서 저장됩니다.

---

## 시나리오 (35 스텝)

### Step 1: 페이지 입장 및 목적 이해
- **title**: 병원 설정 페이지 소개
- **text**: 이 페이지는 한의원의 모든 기본 정보와 운영 설정을 관리합니다. 탭 형식으로 6개 섹션이 있습니다: 기본 정보, 연락처, 브랜딩, 운영, 다국어, AI 설정. 모든 정보는 하나의 폼으로 통합되어 있으며, 하단의 "설정 저장하기"를 클릭하면 전체가 한번에 저장됩니다.
- **highlight**: `.max-w-5xl.mx-auto`
- **trigger**: confirm
- **tips**:
  - 한의원의 정보 중추(Source of Truth)입니다
  - 여기서 설정한 정보는 홈페이지 전반에 반영됩니다
  - 정기적으로 정보를 업데이트하세요

### Step 2: 하단 설정 카드 네비게이션
- **title**: 추가 설정 페이지 바로가기
- **text**: 메인 폼 위에는 2x4 그리드의 카드들이 있습니다. 각 카드는 다른 설정 페이지로의 링크입니다: 연동 설정, AI 설정, SEO/마케팅, 디자인 설정, 메뉴 관리, 보안 설정, API Key 관리, 외관 설정. 복잡한 설정은 별도 페이지에서 관리합니다.
- **highlight**: `.grid.grid-cols-2.md\:grid-cols-4.gap-4.mb-8`
- **trigger**: confirm
- **tips**:
  - 각 카드는 아이콘, 제목, 간단한 설명을 보여줍니다
  - 호버 시 테두리와 그림자가 변해 클릭 가능함을 나타냅니다
  - 링크를 클릭하면 별도 페이지로 이동합니다

### Step 3: 성공/오류 알림
- **title**: 저장 결과 메시지
- **text**: 폼 위에 성공 또는 오류 메시지가 표시될 수 있습니다. "설정이 저장되었습니다"(초록색) 또는 "오류 발생: ..."(빨강색). URL 파라미터 `?success=true` 또는 `?error=...`로 확인합니다.
- **highlight**: `.bg-green-50.border.border-green-200`, `.bg-red-50.border.border-red-200`
- **trigger**: confirm
- **tips**:
  - 메시지는 자동으로 사라지지 않으므로 읽은 후 페이지를 새로고침하거나 다른 탭으로 이동하세요
  - 오류 메시지에 구체적인 내용이 있으면 따라 수정하세요

### Step 4: 탭 네비게이션 구조
- **title**: 6개 탭으로 나뉜 설정 영역
- **text**: 폼 상단에 6개 탭이 있습니다. 각 탭 이름 앞에 이모지가 있습니다: 📋 기본 정보, 📞 연락처, 🎨 브랜딩, ⏰ 운영, 🌐 다국어, 🤖 AI 설정. 탭을 클릭하면 해당 섹션의 입력 필드들이 표시됩니다.
- **highlight**: `nav#settingsTabs`
- **trigger**: confirm
- **tips**:
  - 첫 로드 시 기본 정보 탭이 열려 있습니다
  - 모든 입력 필드는 하나의 폼 안에 있으므로, 여러 탭을 수정하고 마지막에 한번에 저장할 수 있습니다
  - 탭을 클릭해도 입력한 데이터는 유지됩니다

### Step 5: 탭 버튼 클릭 및 선택 표시
- **title**: 탭 전환 및 활성 탭 표시
- **text**: 탭 버튼을 클릭하면 파란색 밑줄이 그려지고, 해당 탭의 내용이 표시됩니다. 선택되지 않은 탭은 회색 텍스트로 표시됩니다.
- **highlight**: `.tab-btn`
- **trigger**: click
- **buttons**:
  - selector: `.tab-btn`
  - label: "탭 버튼"
  - desc: "다른 설정 섹션으로 전환합니다"
- **tips**:
  - 탭 전환은 즉시 이루어집니다
  - 장시간 같은 탭에 머물러 있으면, 페이지를 떠났을 때 데이터가 유지되는지 확인하세요

### Step 6: Tab 1 — 기본 정보 소개
- **title**: 기본 정보 탭 입장
- **text**: "기본 정보" 탭에는 한의원의 이름, 대표자명, 사업자등록번호, 한줄 소개, 사이트 URL, 계좌 정보를 입력하는 필드들이 있습니다. 이 정보는 홈페이지 푸터, 문서, 메시지 템플릿 등에 사용됩니다.
- **highlight**: `#tab-basic`
- **trigger**: confirm
- **tips**:
  - 병원명과 한줄 소개는 홈페이지에서 가장 눈에 띄는 정보입니다
  - 사업자등록번호는 공식 문서 작성에 사용됩니다

### Step 7: 병원명 입력
- **title**: 한의원 이름 설정
- **text**: "병원명" 필수 입력 필드에 한의원의 공식 이름을 입력합니다 (예: "백록담 한의원"). 이 이름은 웹사이트 전체에서 사용됩니다.
- **highlight**: `input[name="name"]`
- **trigger**: input
- **buttons**:
  - selector: `input[name="name"]`
  - label: "병원명"
  - desc: "한의원의 공식 이름 (필수)"
- **tips**:
  - 정확한 상호명을 입력하세요
  - 로고 이미지가 없으면 이 텍스트가 로고처럼 표시됩니다
  - 약 50자 이내가 적당합니다

### Step 8: 대표자명 입력
- **title**: 원장 또는 대표의 이름
- **text**: "대표자명" 입력 필드에 한의원을 대표하는 의료진의 이름을 입력합니다 (예: "홍길동"). 선택 사항입니다.
- **highlight**: `input[name="representativeName"]`
- **trigger**: input
- **buttons**:
  - selector: `input[name="representativeName"]`
  - label: "대표자명"
  - desc: "원장 또는 대표자의 이름 (선택)"
- **tips**:
  - 공식 문서나 폐업 신고 시 필요합니다
  - 한글만 입력하세요

### Step 9: 사업자등록번호 입력
- **title**: 사업 등록 번호
- **text**: "사업자등록번호" 입력 필드에 사업자등록증의 번호를 입력합니다 (예: "123-45-67890"). 선택 사항입니다.
- **highlight**: `input[name="businessLicenseNumber"]`
- **trigger**: input
- **buttons**:
  - selector: `input[name="businessLicenseNumber"]`
  - label: "사업자등록번호"
  - desc: "사업 등록 번호 (선택)"
- **tips**:
  - 정확한 번호를 입력하세요
  - 나중에 공식 문서 작성이나 기관 제출 시 필요할 수 있습니다

### Step 10: 한줄 소개 입력
- **title**: 한의원 소개 문구
- **text**: "한줄 소개" 입력 필드에 한의원을 간단히 설명하는 한 줄을 입력합니다 (예: "현대인의 스트레스와 질환을 근본적으로 치료합니다"). 홈페이지의 메타 설명(meta description)으로 사용됩니다.
- **highlight**: `input[name="description"]`
- **trigger**: input
- **buttons**:
  - selector: `input[name="description"]`
  - label: "한줄 소개"
  - desc: "한의원을 간단히 설명하는 문구"
- **tips**:
  - SEO와 웹사이트 미리보기에서 사용됩니다
  - 약 150자 이내로 작성하세요

### Step 11: 사이트 URL 입력
- **title**: 웹사이트 도메인 주소
- **text**: "사이트 URL" 입력 필드에 한의원 웹사이트의 완전한 URL을 입력합니다 (예: "https://baekrokdam-clinic.com"). 이 주소는 문자 발송 시 설문 링크에 사용됩니다.
- **highlight**: `input[name="siteUrl"]`
- **trigger**: input
- **buttons**:
  - selector: `input[name="siteUrl"]`
  - label: "사이트 URL"
  - desc: "웹사이트 도메인 주소 (https:// 포함)"
- **tips**:
  - https:// 또는 http://로 시작해야 합니다
  - 예: https://your-domain.com
  - 트래일링 슬래시(/) 없이 입력하세요

### Step 12: 계좌 정보 입력
- **title**: 은행 계좌 정보
- **text**: "계좌 정보" 입력 필드에 환불이나 결제 시 사용할 은행 정보를 입력합니다 (예: "기업은행 123-456-7890 홍길동"). 메시지 템플릿의 {bank_info} 변수에 들어갈 전체 문구입니다.
- **highlight**: `input[name="bankInfo"]`
- **trigger**: input
- **buttons**:
  - selector: `input[name="bankInfo"]`
  - label: "계좌 정보"
  - desc: "환불/결제 시 사용할 은행 계좌 정보 (선택)"
- **tips**:
  - 형식: "은행명 계좌번호 예금주명"
  - 예: "기업은행 123-456-7890 홍길동"
  - 문자 템플릿에서 참조되므로 정확하게 입력하세요

### Step 13: Tab 2 — 연락처 탭
- **title**: 연락처 및 위치 정보
- **text**: "연락처" 탭에는 전화번호, 주소, 네이버 지도 URL, 지도 검색 키워드를 입력합니다. 이 정보는 홈페이지의 "오시는 길" 섹션과 지도 위젯에 사용됩니다.
- **highlight**: `#tab-contact`
- **trigger**: confirm
- **tips**:
  - 모든 필드를 정확히 입력해야 지도가 제대로 표시됩니다
  - 정기적으로 업데이트하세요

### Step 14: 전화번호 입력
- **title**: 상담 및 예약 전화번호
- **text**: "전화번호" 입력 필드에 환자들이 전화할 수 있는 번호를 입력합니다 (예: "02-1234-5678" 또는 "031-1234-5678"). 형식은 자유입니다.
- **highlight**: `input[name="phone"]`
- **trigger**: input
- **buttons**:
  - selector: `input[name="phone"]`
  - label: "전화번호"
  - desc: "환자 상담 및 예약 전화 (형식 자유)"
- **tips**:
  - 예: 02-1234-5678, 031-1234-5678, 010-1234-5678
  - 하이픈(-) 또는 공백 포함 가능
  - 홈페이지 헤더와 푸터에 표시되므로 정확한지 확인하세요

### Step 15: 주소 입력
- **title**: 한의원의 오프라인 위치
- **text**: "주소" 입력 필드에 한의원의 정확한 주소를 입력합니다 (예: "서울시 강남구 테헤란로 123 삼성빌딩 5층"). 지도 검색과 안내에 사용됩니다.
- **highlight**: `input[name="address"]`
- **trigger**: input
- **buttons**:
  - selector: `input[name="address"]`
  - label: "주소"
  - desc: "한의원의 정확한 도로명 주소"
- **tips**:
  - 도로명 주소 형식: 시/도 + 구/군 + 도로명 + 건물번호 + 층수
  - 예: 서울시 강남구 테헤란로 123 5층
  - 정확한 주소가 중요합니다 (지도 표시, 배송 등에 사용)

### Step 16: 네이버 지도 URL 입력
- **title**: 지도 링크
- **text**: "네이버 지도 URL" 입력 필드에 홈페이지의 "오시는 길" 섹션에서 클릭 시 이동할 네이버 지도 링크를 입력합니다 (예: "https://naver.me/..."). naver.me 단축 링크를 사용합니다.
- **highlight**: `input[name="mapUrl"]`
- **trigger**: input
- **buttons**:
  - selector: `input[name="mapUrl"]`
  - label: "네이버 지도 URL"
  - desc: "클릭 시 이동할 지도 링크 (naver.me 형식)"
- **tips**:
  - 네이버 지도에서 원하는 위치를 검색한 후 "공유" → "단축 URL 복사"로 얻습니다
  - 예: https://naver.me/xYaBcD1
  - 정기적으로 업데이트하세요

### Step 17: 네이버 지도 검색 키워드 입력
- **title**: 지도 위젯 검색어
- **text**: "네이버 지도 검색 키워드" 입력 필드에 홈페이지의 지도 위젯에서 자동 검색될 상호명을 입력합니다 (예: "Baekrokdam Clinic Seoul"). 정확한 상호명이나 영문명을 입력해야 지도에 제대로 표시됩니다.
- **highlight**: `input[name="mapSearchKeyword"]`
- **trigger**: input
- **buttons**:
  - selector: `input[name="mapSearchKeyword"]`
  - label: "네이버 지도 검색 키워드"
  - desc: "지도 위젯에서 검색될 정확한 상호명/지점명"
- **tips**:
  - 예: "백록담한의원", "Baekrokdam Clinic"
  - 정확할수록 지도 검색이 잘 됩니다
  - 여러 지점이 있으면 지점명을 포함하세요

### Step 18: Tab 3 — 브랜딩 탭
- **title**: 로고 및 파비콘
- **text**: "브랜딩" 탭에는 로고 이미지와 파비콘(브라우저 탭 아이콘)을 업로드합니다. 이미지 업로드는 파일 선택 또는 드래그 앤 드롭으로 가능합니다.
- **highlight**: `#tab-branding`
- **trigger**: confirm
- **tips**:
  - 로고는 홈페이지 헤더와 모바일 메뉴에 표시됩니다
  - 파비콘은 브라우저 탭에 표시됩니다

### Step 19: 로고 이미지 업로드
- **title**: 한의원 로고 이미지
- **text**: "로고 이미지" 입력 필드에 로고 파일을 업로드합니다. 지원 형식: PNG, JPG, WebP 등. 비워두면 텍스트 로고(병원명)가 자동으로 표시됩니다.
- **highlight**: `input[name="logoUrl"]`
- **trigger**: click
- **buttons**:
  - selector: `input[name="logoUrl"]`
  - label: "로고 이미지"
  - desc: "한의원 로고를 선택하거나 드래그하여 업로드합니다"
- **tips**:
  - 권장 크기: 가로 200-300px, 세로 50-100px (정사각형도 가능)
  - 배경 투명(PNG) 파일이 좋습니다
  - 너무 큰 파일(5MB 이상)은 업로드 성능에 영향을 줄 수 있습니다

### Step 20: 파비콘 업로드
- **title**: 브라우저 탭 아이콘
- **text**: "파비콘" 입력 필드에 브라우저 탭에 표시될 아이콘을 업로드합니다. 정사각형 형식(512x512px 권장)의 PNG 또는 ICO 파일을 사용합니다.
- **highlight**: `input[name="faviconUrl"]`
- **trigger**: click
- **buttons**:
  - selector: `input[name="faviconUrl"]`
  - label: "파비콘"
  - desc: "브라우저 탭에 표시될 아이콘을 선택합니다"
- **tips**:
  - 정사각형 이미지를 권장합니다
  - 예: 로고의 정사각형 버전
  - 작은 크기이므로 단순한 디자인이 좋습니다

### Step 21: Tab 4 — 운영 탭 (진료 시간)
- **title**: 진료 시간 설정
- **text**: "운영" 탭의 첫 번째 섹션은 진료 시간입니다. 4개 행으로 자유롭게 시간을 입력할 수 있습니다 (예: 1행=평일, 2행=토요일, 3행=점심시간, 4행=휴진일). 빈 행은 표시되지 않습니다.
- **highlight**: `#tab-operation`
- **trigger**: confirm
- **tips**:
  - 각 행은 라벨(왼쪽 입력)과 시간(오른쪽 입력)으로 구성됩니다
  - 예: "평일" | "09:00-18:00"
  - 빈 행이 있으면 자동으로 생략됩니다

### Step 22: 진료 시간 행 입력 (1행)
- **title**: 첫 번째 진료 시간 행
- **text**: 첫 번째 행의 왼쪽 입력(라벨, 예: "평일")과 오른쪽 입력(시간, 예: "09:00-18:00")을 채웁니다. 모두 선택 사항입니다.
- **highlight**: `input[name="hours_row1_label"]`, `input[name="hours_row1_value"]`
- **trigger**: input
- **buttons**:
  - selector: `input[name="hours_row1_label"]`
  - label: "1행 라벨"
  - desc: "진료 시간의 첫 번째 라벨 (예: 평일)"
  - selector: `input[name="hours_row1_value"]`
  - label: "1행 시간"
  - desc: "첫 번째 시간 (예: 09:00-18:00)"
- **tips**:
  - 라벨: 진료일 또는 시간 구분 (평일, 토요일, 점심시간 등)
  - 시간: 시작-종료 형식 (예: 09:00-18:00)

### Step 23: 진료 시간 행 입력 (2-4행)
- **title**: 나머지 진료 시간 행
- **text**: 같은 방식으로 2행(토요일), 3행(점심시간), 4행(필요시)을 입력합니다. 예:
  - 2행: "토요일" | "09:00-13:00"
  - 3행: "점심시간" | "12:00-13:00"
  - 4행: (비움, 미표시)
- **highlight**: `input[name="hours_row2_label"]`, `input[name="hours_row3_label"]`, `input[name="hours_row4_label"]`
- **trigger**: input
- **buttons**:
  - selector: `input[name="hours_row2_label"]`
  - label: "2행 (토요일 등)"
  - desc: "두 번째 시간대 라벨과 값"
  - selector: `input[name="hours_row3_label"]`
  - label: "3행 (점심시간 등)"
  - desc: "세 번째 시간대 라벨과 값"
  - selector: `input[name="hours_row4_label"]`
  - label: "4행 (추가)"
  - desc: "네 번째 시간대 라벨과 값"
- **tips**:
  - 빈 행은 자동으로 생략되므로 필요한 행만 입력하세요

### Step 24: 진료 시간 추가 안내
- **title**: 추가 안내 사항
- **text**: "추가 안내 (각 줄이 * 로 표시됩니다)" 텍스트 영역에 진료 시간 외 추가 정보를 입력합니다 (예: "점심시간 없이 진료", "일요일/공휴일 휴진"). 각 줄이 별도로 표시됩니다.
- **highlight**: `textarea[name="hours_notes"]`
- **trigger**: input
- **buttons**:
  - selector: `textarea[name="hours_notes"]`
  - label: "추가 안내"
  - desc: "진료 시간 외 추가 정보 (각 줄이 * 로 표시)"
- **tips**:
  - 여러 줄로 입력 가능합니다
  - 예: "점심시간 없이 진료\n일요일/공휴일 휴진"
  - 각 줄이 홈페이지에서 별도로 표시됩니다

### Step 25: 운영 탭 — 기능 설정 소개
- **title**: 기능 토글 섹션
- **text**: "기능 설정" 섹션에는 5개의 토글 스위치가 있습니다: 비대면 진료, 다국어, 예약, 문의/접수, AEO 스마트 추천. 각 스위치를 ON/OFF 하여 해당 기능의 활성화 여부를 결정합니다.
- **highlight**: `.bg-slate-50.p-6.rounded-xl`
- **trigger**: confirm
- **tips**:
  - 토글은 체크박스 형식입니다
  - ON(선택) = 기능 활성화, OFF(미선택) = 기능 비활성화
  - 각 기능의 설명을 읽고 신중하게 선택하세요

### Step 26: 비대면 진료 기능 토글
- **title**: 비대면 진료 활성화/비활성화
- **text**: "비대면 진료 기능" 토글을 ON하면 홈페이지에 비대면 진료 관련 메뉴와 기능이 활성화됩니다. OFF하면 숨겨집니다.
- **highlight**: `input[name="feature_remote_consultation"]`
- **trigger**: click
- **buttons**:
  - selector: `input[name="feature_remote_consultation"]`
  - label: "비대면 진료 기능"
  - desc: "ON = 활성화, OFF = 비활성화"
- **tips**:
  - ON 상태에서 환자가 비대면 진료를 신청할 수 있습니다
  - 비대면 서비스를 제공하지 않으면 OFF 상태로 두세요

### Step 27: 다국어 기능 토글
- **title**: 영문/일본어/중국어 지원
- **text**: "다국어 기능" 토글을 ON하면 웹사이트 푸터에 언어 변경 버튼이 나타나고, 관리자는 콘텐츠를 다국어로 번역할 수 있습니다. OFF하면 한국어만 표시됩니다.
- **highlight**: `input[name="feature_multilingual"]`
- **trigger**: click
- **buttons**:
  - selector: `input[name="feature_multilingual"]`
  - label: "다국어 기능"
  - desc: "ON = 영문/일본어/중국어 지원, OFF = 한국어 전용"
- **tips**:
  - ON 상태에서 푸터의 언어 선택 아이콘이 활성화됩니다
  - 다국어 콘텐츠는 "다국어" 탭에서 입력합니다

### Step 28: 예약 기능 토글
- **title**: 온라인 예약 기능
- **text**: "예약 기능" 토글을 ON하면 환자가 온라인으로 진료 예약을 할 수 있습니다. OFF하면 예약 API가 차단되어 예약 기능이 완전히 숨겨집니다.
- **highlight**: `input[name="feature_reservation"]`
- **trigger**: click
- **buttons**:
  - selector: `input[name="feature_reservation"]`
  - label: "예약 기능"
  - desc: "ON = 온라인 예약 활성화, OFF = 예약 기능 차단"
- **tips**:
  - 일반적으로 ON 상태로 두는 것이 좋습니다
  - 예약을 받지 않으면 OFF로 설정하세요

### Step 29: 문의/접수 기능 토글
- **title**: 온라인 문의 및 진료 접수
- **text**: "문의/접수 기능" 토글을 ON하면 홈페이지에 "문의하기" 버튼과 진료 접수 페이지가 활성화됩니다. OFF하면 완전히 숨겨집니다.
- **highlight**: `input[name="feature_inquiry"]`
- **trigger**: click
- **buttons**:
  - selector: `input[name="feature_inquiry"]`
  - label: "문의/접수 기능"
  - desc: "ON = 문의 및 접수 활성화, OFF = 숨김"
- **tips**:
  - 온라인 문의를 받고 싶으면 ON으로 두세요
  - OFF 상태에서 환자가 문의 양식에 접근할 수 없습니다

### Step 30: AEO 스마트 추천 토글 (고급)
- **title**: AI 기반 콘텐츠 추천
- **text**: "AEO 스마트 추천" 토글을 ON하면 블로그 글 하단의 "관련된 다른 글" 섹션이 AI 기반 "함께 보면 좋은 문서"로 바뀝니다. 관련 프로그램, 건강 가이드, 블로그 글을 통합 추천합니다. 사전에 AEO 메타데이터 생성이 필요합니다.
- **highlight**: `input[name="feature_aeo_recommendations"]`
- **trigger**: click
- **buttons**:
  - selector: `input[name="feature_aeo_recommendations"]`
  - label: "AEO 스마트 추천"
  - desc: "ON = AI 기반 추천 활성화, OFF = 단순 카테고리 매칭"
- **tips**:
  - 고급 기능이며, 사전 준비가 필요합니다
  - AEO 메타데이터 생성 후 활성화하세요
  - 메타데이터가 없으면 추천 섹션이 비어 보일 수 있습니다

### Step 31: Tab 5 — 다국어 탭
- **title**: 영문/일본어/중국어 정보
- **text**: "다국어" 탭에는 3개 언어 섹션이 있습니다: EN(English), JA(日本語), ZH(中文/간체). 각 섹션에서 병원명, 대표자명, 주소를 해당 언어로 입력합니다. 다국어 기능이 ON 상태에서만 표시됩니다.
- **highlight**: `#tab-i18n`
- **trigger**: confirm
- **tips**:
  - 각 언어별로 별도 입력이 필요합니다
  - 정확한 번역이 중요합니다

### Step 32: 영문(EN) 정보 입력
- **title**: 영문 병원 정보
- **text**: EN(English) 섹션에서 병원명, 대표자명(선택), 주소를 영문으로 입력합니다. 예: "Baekrokdam Clinic", "Dr. Hong Gildong", "5F, Samsung Building, 123 Teheran-ro, Gangnam-gu, Seoul".
- **highlight**: `input[name="name_en"]`, `input[name="representative_name_en"]`, `input[name="address_en"]`
- **trigger**: input
- **buttons**:
  - selector: `input[name="name_en"]`
  - label: "병원명 (EN)"
  - desc: "한의원의 영문 이름"
  - selector: `input[name="address_en"]`
  - label: "주소 (EN)"
  - desc: "영문 주소"
- **tips**:
  - 병원명은 영문 선택사항입니다
  - 주소는 로마자로 음차하거나 영문 표기를 사용하세요

### Step 33: 일본어(JA) 정보 입력
- **title**: 일본어 병원 정보
- **text**: JA(日本語) 섹션에서 병원명과 주소를 일본어로 입력합니다. 영어와 달리 대표자명은 입력하지 않습니다.
- **highlight**: `input[name="name_ja"]`, `input[name="address_ja"]`
- **trigger**: input
- **buttons**:
  - selector: `input[name="name_ja"]`
  - label: "병원명 (JA)"
  - desc: "한의원의 일본어 이름 (카타카나)"
  - selector: `input[name="address_ja"]`
  - label: "주소 (JA)"
  - desc: "일본어 주소"
- **tips**:
  - 의료 기관명은 보통 카타카나로 표기합니다
  - 주소는 한국 주소를 일본어로 번역하거나 영어 로마자 음차를 사용합니다

### Step 34: 중국어(ZH) 정보 입력
- **title**: 중국어 간체자 병원 정보
- **text**: ZH(中文/简体) 섹션에서 병원명과 주소를 중국어 간체자로 입력합니다. 대표자명은 입력하지 않습니다.
- **highlight**: `input[name="name_zh"]`, `input[name="address_zh"]`
- **trigger**: input
- **buttons**:
  - selector: `input[name="name_zh"]`
  - label: "병원명 (ZH)"
  - desc: "한의원의 중국어 이름"
  - selector: `input[name="address_zh"]`
  - label: "주소 (ZH)"
  - desc: "중국어 주소"
- **tips**:
  - 간체자(簡體字)를 사용합니다 (번체자 아님)
  - 주소는 중국식 주소 표기법으로 번역하거나 영어 로마자를 사용합니다

### Step 35: Tab 6 — AI 설정 탭
- **title**: AI 에이전트 최적화
- **text**: "AI 설정" 탭에는 AI 에이전트(ChatGPT, Perplexity 등)가 병원 정보를 더 잘 이해하도록 돕는 지역 정보를 입력합니다. llms.txt, ai.json, /for-ai 페이지 링크도 있습니다.
- **highlight**: `#tab-ai`
- **trigger**: confirm
- **tips**:
  - 이 설정은 외부 AI 도구가 병원을 더 정확히 인식하도록 돕습니다
  - 지역 정보는 AI 컨텍스트에 포함됩니다

### Step 36: 지역 정보 입력
- **title**: 병원의 지역(도시, 구/군, 동/읍/면) 입력
- **text**: "지역 정보" 섹션에는 3개 필드가 있습니다:
  - **도시 (City)**: 예: "서울"
  - **구/군 (District)**: 예: "강남구"
  - **동/읍/면 (Neighborhood)**: 예: "역삼동"
  
  AI가 병원의 정확한 위치를 파악하도록 도웁니다.
- **highlight**: `input[name="geo_city"]`, `input[name="geo_district"]`, `input[name="geo_neighborhood"]`
- **trigger**: input
- **buttons**:
  - selector: `input[name="geo_city"]`
  - label: "도시"
  - desc: "병원이 위치한 도시 (예: 서울, 부산)"
  - selector: `input[name="geo_district"]`
  - label: "구/군"
  - desc: "구 또는 군 단위 (예: 강남구, 중구)"
  - selector: `input[name="geo_neighborhood"]`
  - label: "동/읍/면"
  - desc: "동, 읍, 면 단위 (예: 역삼동, 논현동)"
- **tips**:
  - 모두 선택 사항입니다
  - 정확한 지역 정보를 입력하면 AI가 관련 검색 결과를 더 잘 제공할 수 있습니다

### Step 37: 하단 저장 버튼 및 계정 설정 링크
- **title**: 설정 저장 및 추가 설정
- **text**: 폼 하단에는 2개 영역이 있습니다:
  1. 우측의 파란 "설정 저장하기" 버튼: 모든 입력 필드를 저장
  2. 보라색 배너: "관리자 계정 설정" 링크 (비밀번호 변경, 최고관리자 관리)
- **highlight**: `button[type="submit"]`, `.bg-gradient-to-br.from-purple-50`
- **trigger**: click
- **buttons**:
  - selector: `button[type="submit"]`
  - label: "설정 저장하기"
  - desc: "모든 변경사항을 데이터베이스에 저장합니다"
  - selector: `a[href="/admin/settings/account"]`
  - label: "관리자 계정 설정"
  - desc: "비밀번호 변경, 관리자 계정 관리"
- **tips**:
  - 여러 탭을 수정한 후 마지막에 한번만 저장하면 됩니다
  - 저장 실패 시 오류 메시지를 확인하고 필드를 수정한 후 다시 시도하세요

---

## 통합 워크플로우 예시

1. **초기 설정**: 기본 정보 → 연락처 → 브랜딩 → 운영 → 다국어(필요시) → AI 설정 → 저장
2. **일부 수정**: 필요한 탭만 열기 → 정보 수정 → 저장
3. **다국어 활성화**: 운영 탭에서 "다국어" 토글 ON → 다국어 탭에서 각 언어 정보 입력 → 저장
4. **기능 토글**: 운영 탭에서 필요한 기능 ON/OFF → 저장

---

## 자주 묻는 상황

| 상황 | 해결 방법 |
|------|---------|
| 저장했는데 홈페이지에 반영 안 됨 | 브라우저 캐시를 지우고 새로고침(Ctrl+Shift+R)하세요 |
| 여러 탭에 입력했는데 일부만 저장됨 | 모든 입력이 하나의 폼에 있으므로, "설정 저장하기"를 한번 클릭하면 전부 저장됩니다 |
| 다국어를 끄고 싶어요 | 운영 탭에서 "다국어 기능" 토글을 OFF로 설정하면 언어 선택 버튼이 사라집니다 |
| 진료 시간을 더 자세히 표시하고 싶어요 | 4행을 모두 사용하거나, "추가 안내" 필드에 구체적 정보를 입력하세요 |
| 로고 업로드 실패 | 파일 크기가 너무 크지 않은지 확인하세요. 권장: 1-2MB 이하, PNG 또는 JPG |
| 파비콘이 브라우저에 안 보여요 | 파비콘은 브라우저 캐시의 영향을 받습니다. 브라우저 캐시를 지운 후 확인하세요 |
