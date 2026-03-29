---
description: npm run setup:step 완료 이후 병원 개별화 셋업을 에이전트가 안내하는 워크플로우
---

# 온보딩 워크플로우

이 워크플로우는 `npm run setup:step -- --next` 완료 후, 병원의 개별 정보와 콘텐츠를 세팅하는 전 과정을 안내합니다.
에이전트가 주도하고, 사람에게는 필요한 정보만 요청합니다.

---

## 사전 조건

- `npm run setup:step -- --next` 완료 (17단계 전부 done)
- `npm run dev`로 로컬 서버 실행 중
- `/admin`에 로그인 가능

> Cloudflare 관련 문제 발생 시 [Cloudflare 셋업 가이드](https://clinic-os-hq.pages.dev/guide/cloudflare-setup) 참조

구형 설치본/재설치 마이그레이션 여부가 의심되면 먼저:

```bash
npm run agent:lifecycle -- --json
```

설치가 완료된 것으로 보여도 실제 로컬 DB bootstrap이 덜 끝났을 수 있으므로, 온보딩 시작 전 아래도 함께 확인합니다.

```bash
npm run agent:doctor -- --json
```

판단 기준:

- `/admin` 로그인 가능 + 로컬 DB 스키마/기본 데이터 정상
  - 온보딩 진행
- setup은 끝났지만 DB 연결/마이그레이션/필수 시드가 비정상
  - 온보딩으로 바로 넘기지 말고 `npm run db:migrate`, `npm run db:seed`, `npm run setup:step -- --next` 중 맞는 복구 경로를 먼저 제안
- setup 자체가 미완료
  - 설치 재개를 우선 제안

---

## 상태 관리

### 파일 구조

| 파일 | 역할 | 수정 주체 |
|------|------|-----------|
| `.agent/onboarding-registry.json` | 전체 기능 목록 + 스펙 (코어, 읽기 전용) | core:pull |
| `.agent/onboarding-state.json` | 클라이언트별 진행 상태 | 에이전트 |

### 상태 흐름

```
pending → in_progress → done
                     → skipped (사용자가 "나중에" 선택)
```

### 상태 읽기/쓰기

**시작 시 반드시 수행:**

```
1. .agent/onboarding-state.json 읽기
2. .agent/onboarding-registry.json 읽기
3. state.features에서 pending인 항목 확인
4. 현재 tier와 진행률 계산
```

**각 기능 완료 시:**

```
1. state.features[featureId].status = "done"
2. state.features[featureId].updated_at = ISO timestamp
3. state.last_updated = ISO timestamp
4. .agent/onboarding-state.json 저장
```

---

## 진행 흐름

### 0. 시작 브리핑

에이전트는 첫 feature 질문 전, 전체 셋업 범위를 먼저 짧게 브리핑합니다.

```
"지금부터 병원 셋업 전체를 빠르게 브리핑하겠습니다.

1. Tier 1: 사이트가 실제로 작동함 (핵심부터 차근차근)
   - 관리자 보안, 병원 정보, 연락처, 진료시간, 최소 브랜딩, 약관
   - ETA: 30분~1시간 → 1차 배포 가능

2. Tier 2: 실제 병원처럼 보임
   - 네이버 콘텐츠 임포트 (선택), 의료진, 진료 프로그램, 홈페이지, 메뉴, 위치/OG
   - ETA: 2~4시간 → 2차 배포, 환자가 봐도 운영 중인 병원으로 보임

3. Tier 3: 환자가 실제로 예약 가능
   - 문진표, 알림 채널(SMS/카카오), 접수, 예약, 블로그, 공지, 샘플 정리
   - ETA: 2~4시간 → 3차 배포, 온라인 예약 오픈

4. Tier 4: 성장/마케팅 (운영 안정 후)
   - AEO/SEO, 다국어, 설문도구, 커스텀 스킨, 환자 후기, 캠페인
   - 운영이 안정된 후 하나씩 진행

5. Tier 5: 고급 운영/커스터마이징 (필요시)
   - 데이터 이관, 커스텀 플러그인/검사도구, 고급 연동
   - 필요할 때 선택적으로 진행

추천 순서는 Tier 1 → Tier 2 → Tier 3 순입니다.
원하시면 추천 순서대로 진행하거나, 원하는 항목부터 바로 시작할 수 있습니다."
```

브리핑 후에는 아래 중 하나를 제안합니다.

- 추천 순서대로 진행
- 특정 Tier부터 진행
- 특정 기능만 먼저 진행
- 커스터마이징 항목(플러그인/스킨/검사도구)부터 검토

### 1. 현황 파악

에이전트가 먼저 상태를 읽고 요약합니다:

```
"온보딩 현황을 확인합니다...

📊 전체 진행률: 7/30 완료 (23%)
🏷️ 현재 단계: Tier 1 (배포 필수) — 3/6 완료

✅ 완료: 관리자 계정 보안, 병원 기본 정보, 병원 연락처
⏳ 남은 항목:
  - 진료 시간
  - 최소 브랜딩 (로고/파비콘/컬러)
  - 약관 및 정책 문서

계속 진행할까요?"
```

아직 시작 브리핑을 하지 않았다면, 현황 요약 전에 브리핑부터 먼저 수행합니다.

### 2. 티어별 안내

```
Tier 1 완료 → "1차 배포가 가능합니다. 지금 배포할까요, Tier 2도 먼저 채울까요?"
Tier 2 완료 → "환자가 봤을 때 운영 중인 병원으로 보입니다. 배포 후 Tier 3을 진행할까요?"
Tier 3 완료 → "환자가 실제로 예약할 수 있습니다. Tier 4~5는 운영이 안정된 후 하나씩 해도 됩니다."
Tier 4~5    → "필요한 기능만 선택적으로 세팅하면 됩니다. 뭐부터 할까요?"
```

사용자가 처음부터 특정 항목을 지정하면 추천 순서를 강제하지 않습니다.

예:

- "병원 정보만 먼저"
- "홈페이지부터"
- "스킨 먼저 보고 싶어요"
- "플러그인 계획도 같이 잡아줘"
- "검사도구 만들고 싶어요"

### 3. 기능 실행 패턴

각 기능을 실행할 때 에이전트가 따르는 패턴:

```
[1] registry에서 해당 기능의 스펙 읽기
    - depends_on 확인 → 선행 기능 미완료 시 먼저 안내
    - skill_ref 확인 → 해당 스킬 호출 (/setup-xxx, /dev-xxx 등)
    - human_inputs 확인 → 사람에게 물어볼 항목 파악

[2] 사람에게 필요한 정보 요청
    - required 항목만 먼저 물어보기
    - 예시(example)가 있으면 함께 제시
    - 선택(required: false) 항목은 "지금 설정할까요, 나중에 할까요?" 물어보기

[3] 스킬 실행
    - skill_ref가 있으면 해당 스킬 실행
    - 스킬이 설정을 안내하고 완료까지 도움

[4] 확인
    - 설정이 반영됐는지 확인 (페이지 접속, DB 조회 등)
    - state 업데이트

[5] 다음 항목으로
    - 같은 tier 내에서 다음 pending 항목으로 이동
    - tier 내 모든 항목 완료 시 배포 제안
```

---

## Tier 1: 사이트가 실제로 작동함

> 목표: 사이트가 정상 작동하고 법적 요건을 충족하는 상태
> ETA: 30분~1시간 → 1차 배포 가능

### admin-account — 관리자 계정 보안

```
에이전트: "먼저 보안부터 설정합니다.
          관리자 비밀번호를 변경해주세요. (현재: admin123)
          최소 8자, 영문+숫자+특수문자를 포함해주세요."

사람:     [비밀번호 입력]

에이전트: → /admin/change-password에서 변경
        → "관리자 이메일도 변경할까요? (현재: admin@sample-clinic.com)"

사람:     "info@seoul-clinic.com"

에이전트: → DB 업데이트
        → state 업데이트: admin-account = done
```

### clinic-info — 병원 기본 정보

```
에이전트: "병원 기본 정보를 설정합니다. 다음 정보를 알려주세요:
          1. 병원 이름 (한글): 예) 서울한의원
          2. 병원 이름 (영문): 예) Seoul Korean Medicine Clinic
          3. 병원 한 줄 소개
          4. 대표자 이름
          5. 사업자등록번호: 예) 123-45-67890
          6. 웹사이트 URL: 예) https://my-clinic.com"

사람:     [정보 제공]

에이전트: → 반영 위치:
          1) clinics 테이블: name, description, representative_name, business_license_number
          2) site_settings (i18n 카테고리): name_en (필수! englishName 폴백 방지)
          3) site_settings (seo 카테고리): target_region (주소에서 자동 추출: 예 "강서구 화곡역")
          4) site_settings (general 카테고리): site_url, representative_name, business_license_number
        → ⚠️ name_en 미설정 시 사이트 타이틀에 "Sample Clinic" 표시됨
        → ⚠️ target_region 미설정 시 의료진 페이지 SEO 불완전
        → state 업데이트: clinic-info = done
```

**스킬:** `/setup-clinic-info` (내장 Step 1.5 게이트가 더미 데이터와 빈 프로파일을 자동 감지 — 데모/위임/직접설치 공통)

### clinic-contact — 병원 연락처

```
에이전트: "연락처 정보입니다:
          1. 전화번호 (필수): 예) 02-1234-5678
          2. 주소 (필수): 도로명 주소
          3. 이메일 (선택)
          4. 카카오톡 채널 (선택): 예) @my-clinic
          5. 외부 예약 URL (선택): 네이버 예약 등"

사람:     [정보 제공]

에이전트: → 반영
        → state 업데이트: clinic-contact = done
```

**스킬:** `/setup-clinic-info`

### clinic-hours — 진료 시간

```
에이전트: "진료 시간을 알려주세요:
          1. 평일 진료시간: 예) 09:00 - 18:00
          2. 토요일 (선택): 예) 09:00 - 13:00
          3. 점심시간 (선택): 예) 13:00 - 14:00
          4. 휴진일: 예) 일요일, 공휴일"

사람:     [정보 제공]

에이전트: → 반영
        → state 업데이트: clinic-hours = done
```

**스킬:** `/setup-clinic-info`

### branding-minimal — 최소 브랜딩

```
에이전트: "브랜딩을 설정합니다.

          1. 메인 컬러를 선택해주세요:
             blue / green / teal / indigo / violet / purple / pink / rose
          2. 로고 텍스트 (로고 이미지가 없을 때 표시할 글자): 예) S
          3. 로고 이미지가 있으면 파일 경로를 알려주세요 (없으면 나중에)
          4. 파비콘이 있으면 파일 경로를 알려주세요 (없으면 나중에)"

사람:     "teal, 서, 로고는 나중에"

에이전트: → /admin/design에서 컬러 설정
        → public/local/ 에 파일 배치 (제공 시)
        → state 업데이트: branding-minimal = done
```

### terms-management — 약관 및 정책 문서

```
에이전트: "개인정보처리방침과 이용약관을 설정해야 합니다.
          시드 템플릿이 이미 있습니다. 병원 정보(이름, 대표자, 연락처)만
          실제 값으로 교체하면 됩니다.

          /admin/settings/terms/ 에서 확인하시겠습니까?
          아니면 제가 자동으로 병원 정보를 교체해드릴까요?"

사람:     "자동으로 해줘"

에이전트: → 시드 템플릿에서 {{clinic_name}}, {{representative}} 등을 실제 값으로 치환
        → state 업데이트: terms-management = done
```

### Tier 1 완료 시점

```
에이전트: "🎉 Tier 1 (배포 필수) 완료!

          ✅ 관리자 보안 설정됨
          ✅ 병원 기본 정보 입력됨
          ✅ 진료 시간 설정됨
          ✅ 최소 브랜딩 적용됨
          ✅ 약관/정책 문서 준비됨

          지금 상태로 1차 배포가 가능합니다.
          [A] 지금 배포하고 Tier 2 진행
          [B] Tier 2 (의료진, 프로그램) 먼저 채우고 배포
          [C] 전부 다 채우고 배포

          어떻게 할까요?"
```

---

## Tier 2: 실제 병원처럼 보임

> 목표: 환자가 봤을 때 실제 운영 중인 병원처럼 보이는 상태
> ETA: 2~4시간 → 2차 배포

### naver-content-import — 네이버 콘텐츠 임포트 (선택)

```
에이전트: "혹시 네이버 블로그나 플레이스에 기존 콘텐츠가 있으신가요?
          있으시면 자동으로 가져와서 사이트를 빠르게 채울 수 있습니다.
          없거나 나중에 하시겠다면 건너뛰어도 됩니다.

          1. 네이버 블로그 ID (선택): blog.naver.com/xxx → xxx
          2. 네이버 플레이스 URL (선택): naver.me 링크 또는 place.naver.com URL"

사람:     "블로그는 my_clinic이고, 플레이스는 https://naver.me/xxxxx"
(또는)
사람:     "아직 없어" / "나중에 할게"

[건너뛰기 시]
에이전트: → state 업데이트: naver-content-import = skipped
        → "나중에 /extract-content 로 언제든 실행할 수 있습니다."

[진행 시]
에이전트: → 먼저 dry-run 실행
        → "블로그 글 N개, 이미지 M개, 플레이스 정보(주소/전화/영업시간) 확인됐습니다.
           이 내용으로 임포트할까요?"

사람:     "응"

에이전트: → **Stage 1: 원본 추출**
        → extract-naver.js 실행 (API 모드 또는 로컬)
        → 플레이스 정보로 clinic-info/contact/hours 자동 보강
        → "블로그 글 N개를 원본 HTML 상태로 가져왔습니다."
        → 콘텐츠 분석 결과: "주요 전문 분야: 다이어트, 통증 치료, ..."

        → **Stage 2: 콘텐츠 클리닝** (필수, Stage 1 후 반드시 실행)
        → 1개 글로 클리닝 테스트 → 브라우저에서 렌더링 확인
        → 전체 글 일괄 클리닝 적용
        → 클리닝 대상: HTML→마크다운 변환, 빈 줄 정리, 지도/푸터/프로필 제거
        → 소제목 변환: 줄 전체가 **볼드**인 패턴 → ## 헤딩 (TOC 자동 생성용)

        → **Stage 3: 메타데이터 설정** (필수)
        → doctor_id: 기본 원장 ID로 일괄 설정 (블로그 사이드바에 의료진 표시)
        → category → 프로그램 ID 매핑 (RelatedPosts 연결 + 프로그램 페이지 연동)
          - 제목 키워드로 프로그램 매핑 (통증→pain-clinic, 디스크→spine-disc 등)
          - 매핑 안 되는 글은 주력 프로그램으로 기본 설정
          - 네이버 카테고리(건강정보, 공지사항 등)는 프로그램 ID와 일치하지 않으므로 반드시 변환

        → **Stage 4: 이미지 R2 전환** (권장)
        → 외부 CDN 이미지(pstatic.net 등)를 R2로 다운로드+업로드+URL 치환
        → mblogthumb-phinf → postfiles.pstatic.net?type=w773 변환 후 다운로드
        → /api/files/blog-images/{post_id}/ 경로로 R2 저장
        → 다운로드 실패 이미지는 content에서 참조 제거

        → state 업데이트: naver-content-import = done

⚠️ **Stage 2를 건너뛰면 안 됩니다.** 원본 HTML 그대로 렌더링하면:
   - 빈 줄이 과도하게 많음 (네이버 SE 에디터 특성)
   - 네이버 지도/체크인 버튼이 페이지에 노출됨
   - HTML 태그가 그대로 보일 수 있음

⚠️ **임포트 경로 선택** (에이전트가 고객에게 질문):
   - **경로 A (마크다운)**: HTML→마크다운 변환, TOC 자동생성, 깔끔한 텍스트 (권장)
   - **경로 B (HTML 보존)**: 보일러플레이트만 제거, 원본 스타일 유지 (`content_type='html'`)
   - 경로 B는 고객이 컬러/배경색 등 원본 디자인을 유지하길 원할 때 사용
   - 관리자 에디터에서 마크다운↔HTML 토글로 개별 글 전환 가능

⚠️ **클라이언트별로 블로그 원본 구조가 다릅니다.**
   - 네이버: SE 에디터 HTML, `​` zero-width space, `<span>` 중첩
   - 티스토리: `<figure>` 구조, 다른 보일러플레이트
   - 워드프레스: shortcode, `wp-block-*` 클래스
   - 반드시 1개 글로 클리닝 테스트 후 전체 적용하세요.
```

> **주의**: 플레이스에서 가져온 주소/전화/영업시간이 clinic-info/contact/hours에 이미 입력된 값과 다르면
> 사용자에게 어느 쪽을 쓸지 확인 후 반영합니다.

**스킬:** `/extract-content`

### content-analysis — 콘텐츠 분석 + 포지셔닝 (추출 후 자동)

> 이 단계는 naver-content-import 완료 후 자동으로 진행됩니다.
> 추출된 블로그 데이터를 분석하여 홈페이지와 프로그램 기획의 기반을 만듭니다.

```
에이전트: "가져온 블로그 글을 분석하여 톤앤매너와 전문 분야를 추출하겠습니다.
          혹시 경쟁 한의원 사이트나 기존 홈페이지가 있으면 알려주세요.
          없으면 블로그 데이터만으로 진행합니다."

사람:     "없어" 또는 URL 제공

[레퍼런스 URL 제공 시]
에이전트: → /collect-references 실행 → .agent/references.yaml 생성

[분석 진행]
에이전트: → /analyze-content 실행
        → 키워드 분석: "주요 전문 분야: 교통사고(15건), 추나(12건), 침치료(8건)..."
        → 라이터 페르소나 추출
        → .agent/style-card.yaml 생성
        → .agent/pipeline-context.yaml 초기화

에이전트: → /discover-edge 실행
        → "우리 한의원의 핵심 강점은 무엇이라고 생각하시나요?" (인터뷰)
        → 포지셔닝 매트릭스 생성
        → .agent/edge-profile.yaml 생성

에이전트: → /plan-content 실행 (site 모드)
        → 홈페이지 섹션 구성 + 프로그램 기획 + readiness 체크
        → .agent/site-plan.yaml 생성
        → "다음과 같이 기획했습니다: [요약]. 이대로 진행할까요?"

사람:     "응" 또는 수정 요청

에이전트: → state 업데이트: content-analysis = done
```

**데이터 부족 시:**
- 블로그 글 5건 미만이면 사용자에게 보충 질문 (진료 분야, 원장 경력)
- 레퍼런스 없으면 블로그만으로 진행 (결과가 일반적일 수 있음을 안내)

**산출물:** `style-card.yaml`, `edge-profile.yaml`, `site-plan.yaml`, `pipeline-context.yaml`
**스킬:** `/analyze-content`, `/discover-edge`, `/plan-content`, `/collect-references` (선택)

> **상세:** `.agent/workflows/content-bootstrap.md`

### staff-management — 의료진 등록

```
에이전트: "의료진 정보를 등록합니다.
          몇 명의 의료진을 등록하시겠습니까?"

사람:     "2명"

에이전트: "첫 번째 의료진 정보를 알려주세요:
          1. 이름
          2. 직함: 예) 대표원장
          3. 전문 분야
          4. 약력 (학력, 경력)
          5. 프로필 사진 (파일 경로 또는 나중에)"

          [반복]

에이전트: → /admin/staff에서 등록 또는 DB 반영
        → 노출 순서 확인
        → state 업데이트: staff-management = done
```

### program-management — 진료 프로그램

```
[content-analysis 완료 시 — site-plan.yaml 기반]
에이전트: "분석 결과를 바탕으로 다음 프로그램을 추천합니다:
          1. {프로그램1} — 블로그 {N}건 기반
          2. {프로그램2} — 블로그 {N}건 기반
          ...
          이대로 등록할까요? 추가/수정할 프로그램이 있으면 알려주세요."

사람:     "추가로 xxx도 넣어줘" 또는 "좋아"

에이전트: → /write-copy 실행 (프로그램별 카피 작성)
        → /setup-programs 실행 (site-plan.yaml + blog content_seeds 기반)
        → 블로그 본문에서 Problem/Mechanism/FAQ 섹션 내용 자동 생성
        → state 업데이트: program-management = done

[content-analysis 미완료 시 — 수동 진행]
에이전트: "주요 진료 과목을 알려주세요."
사람:     [프로그램 목록 제공]
에이전트: → 제목 + 간단 설명으로 기본 등록
        → "콘텐츠 분석 후 /setup-programs로 보강할 수 있습니다."
```

**스킬:** `/setup-programs`, `/write-copy`

### homepage-setup — 홈페이지 구성

```
[content-analysis 완료 시 — edge-profile + site-plan 기반]
에이전트: "분석 결과를 바탕으로 홈페이지를 구성합니다.
          프리셋: {editorial/classic}
          히어로: '{hero_direction}'
          포함 섹션: {readiness 기반 섹션 목록}

          이대로 진행할까요?"

사람:     "좋아" 또는 수정 요청

에이전트: → /write-copy 실행 (히어로/브릿지/내러티브 카피)
        → /setup-homepage 실행 (site-plan.yaml readiness 존중)
        → readiness=skip 섹션은 자동 숨김
        → readiness=blocked 섹션은 안내 ("원장 사진이 필요합니다")
        → state 업데이트: homepage-setup = done

[content-analysis 미완료 시 — 기본 구성]
에이전트: → SectionRenderer 기반 기본 홈페이지 생성
        → "메인 타이틀로 뭘 쓸까요?"
        → "콘텐츠 분석 후 /setup-homepage로 보강할 수 있습니다."
```

**스킬:** `/setup-homepage`, `/write-copy`

### navigation-management — 메뉴 구성

```
에이전트: "상단 메뉴를 구성합니다.
          등록된 프로그램과 페이지 기준으로 기본 메뉴를 만들었습니다:

          홈 | 진료안내 ▾ | 의료진 | 오시는 길 | 블로그
                ├ 한방 다이어트
                ├ 교통사고 치료
                └ 추나요법

          이대로 괜찮을까요? 수정할 부분이 있으면 알려주세요."

사람:     "괜찮아" 또는 수정 사항

에이전트: → /admin/settings/navigation에서 반영
        → state 업데이트: navigation-management = done
```

**메뉴 구성 패턴 — 프로그램이 5개 이상인 경우:**

프로그램 수가 많으면 카테고리별로 그룹핑합니다. 예시:

```
병원소개 | 관절 ▾ | 척추 ▾ | 특수 ▾     | 비대면한약 | 칼럼 | 후기
           ├ 어깨    ├ 목      ├ 면역 ▾
           ├ 무릎    ├ 등      │  ├ 비염
           └ 발목    └ 허리    │  └ 성장
                              └ 여성 ▾
                                 ├ 난임
                                 └ 갱년기
```

- 프로그램 → 메뉴 매핑은 `programs` 테이블의 `id`와 `/programs/{id}` 라우팅 기준
- 메뉴 JSON은 `site_settings` (category='config', key='navigation')에 저장
- 메인페이지 클리닉 카드(editorial 프리셋)와 메뉴 구조가 일치해야 함

### og-image — OG 이미지

```
에이전트: "SNS 공유 시 표시될 대표 이미지가 있나요?
          권장 크기: 1200x630px
          없으면 나중에 추가해도 됩니다."

사람:     "나중에"

에이전트: → state 업데이트: og-image = skipped
```

**스킬:** `/setup-og`

### location-page — 오시는 길

```
에이전트: "오시는 길 페이지를 확인합니다.
          입력하신 주소 '서울시 강남구 ...'가 /location 페이지에 반영됩니다.
          교통편 안내를 추가할까요? (지하철, 버스, 주차 등)"

사람:     "2호선 강남역 3번출구 도보 5분"

에이전트: → 반영
        → state 업데이트: location-page = done
```

### Tier 2 완료 시점

```
에이전트: "🎉 Tier 2 (핵심 콘텐츠) 완료!

          사이트 현황:
          ✅ 의료진 2명 등록
          ✅ 진료 프로그램 3개
          ✅ 홈페이지 구성 완료
          ✅ 메뉴 설정 완료
          ✅ 오시는 길 설정

          이 상태면 환자가 봤을 때 충분히 운영 중인 병원으로 보입니다.
          배포할까요?"
```

---

## Tier 3: 환자가 실제로 예약 가능

> 목표: 환자가 온라인으로 접수하고 예약할 수 있는 상태
> ETA: 2~4시간 → 3차 배포, 온라인 예약 오픈

에이전트가 다음 항목을 순서대로 안내:

1. **intake-setup** — 문진표 설정 (/setup-intake)
2. **notifications** — 알림 채널(SMS/카카오) 설정 (/setup-notifications)
3. **reservation-setup** — 예약 시스템 (의료진+프로그램 기반 자동 활성화)
4. **clinic-schedule** — 요일별 상세 운영시간 + 휴무일
5. **blog-management** — 샘플 삭제 + 최소 2~3개 실제 글 작성
6. **notice-management** — 개원 안내 등 초기 공지
7. **tag-management** — 환자 분류 태그 커스터마이징
8. **sample-data-cleanup** — 남은 시드 데이터 최종 정리

### intake-setup — 문진표 설정

```
에이전트: "환자의 첫 방문 시 작성할 문진표를 설정합니다.
          어떤 유형의 문진표가 필요하신가요?

          [A] 기본 한의원 문진 (권장)
          [B] 피부과 특화 문진
          [C] 다이어트 특화 문진
          [D] 통증 클리닉 문진
          [E] 처음부터 직접 구성"

사람:     "기본 한의원 문진으로 할게"

에이전트: → /setup-intake 스킬 실행
        → 기본 문진 템플릿 로드
        → "추가로 넣을 질문이 있나요? (없으면 기본 구성으로 진행)"
        → /intake 페이지 활성화
        → 예약 완료 시 문진 링크 자동 전송 설정
        → state 업데이트: intake-setup = done
```

**스킬:** `/setup-intake`

### notifications — 알림 채널 설정

```
에이전트: "환자에게 예약 확인, 리마인더 문자를 보낼 채널을 설정합니다.
          어떤 채널을 사용하시겠어요?

          [A] SMS (Aligo)
          [B] 카카오 알림톡
          [C] 둘 다 설정"

사람:     "SMS만 일단 설정할게"

에이전트: → /setup-notifications 스킬 실행
        → Aligo API 키 발급 안내
        → 발신번호 사전등록 안내
        → 테스트 발송
        → 기본 템플릿 설정 (예약확인, 리마인더, 치료완료)
        → state 업데이트: notifications = done
```

**스킬:** `/setup-notifications`

### blog-management — 블로그 글 작성

에이전트가 블로그 글 작성을 안내합니다. AEO(Article Enhancement Optimization) 메타데이터는 **권장사항**이며, 없어도 발행은 가능합니다.

```
에이전트: "블로그에 실제 글을 작성합니다.
          샘플 글을 삭제하고, 2~3개의 실제 글을 작성해주세요.

          글 작성 시 참고사항:
          - 제목과 내용만으로도 발행 가능합니다.
          - AEO 메타데이터(요약, 인용, 감수자 등)는 나중에 보완할 수 있습니다.
          - AEO를 완성하면 검색엔진 최적화에 도움이 됩니다."

사람:     [글 작성]

에이전트: → /admin/posts에서 직접 작성하거나 API로 생성
        → state 업데이트: blog-management = done (2개 이상 작성 시)
```

**API로 블로그 글 생성 (AEO 없이 빠른 발행):**

```bash
curl -X POST /api/admin/posts \
  -H "Content-Type: application/json" \
  -d '{
    "type": "blog",
    "title": "한방 다이어트의 효과",
    "content": "<p>본문 내용...</p>",
    "status": "published"
  }'
```

**응답:**

```json
{
  "success": true,
  "id": 123,
  "aeo": {
    "publish_ready": true,
    "normalized_status": "published",
    "errors": ["summary_min_40", "citations_required"],
    "strict": false
  }
}
```

> `errors` 배열에 AEO 권장사항이 표시되지만, 발행은 정상 완료됩니다.

**AEO 완성 후 발행하려면:**

```bash
curl -X POST /api/admin/posts \
  -H "Content-Type: application/json" \
  -d '{
    "type": "blog",
    "title": "한방 다이어트의 효과",
    "content": "<p>본문 내용...</p>",
    "status": "published",
    "strict": true,
    "aeo": {
      "summary": "40자 이상의 요약문...",
      "answer_short": "40자 이상의 답변...",
      "supervisor_id": "doctor-uuid",
      "last_reviewed_at": 1710000000,
      "key_claims": ["핵심 주장 1"],
      "citations": [{"label": "출처", "url": "https://..."}]
    }
  }'
```

자세한 내용은 `docs/internal/AEO_VALIDATION_GUIDE.md`를 참조하세요.

### Tier 3 완료 시점

```
에이전트: "🎉 Tier 3 (환자 서비스) 완료!

          ✅ 문진표 설정 완료
          ✅ 알림 채널 (SMS/카카오) 연동
          ✅ 온라인 접수 가능
          ✅ 예약 시스템 활성화
          ✅ 블로그 글 3개 게시
          ✅ 공지사항 등록
          ✅ 샘플 데이터 정리 완료

          이제 환자가 실제로 예약할 수 있습니다.
          Tier 4 (마케팅)는 운영이 안정된 후 하나씩 해도 됩니다.
          어떻게 할까요?

          [A] 운영 시작 — Tier 4는 나중에
          [B] AEO/SEO 설정부터 하고 싶어요
          [C] 다국어 설정을 하고 싶어요
          [D] 설문도구를 만들고 싶어요
          [E] 전체 목록 보기"
```

---

## Tier 4: 성장/마케팅 (운영 안정 후)

> 목표: 검색 노출, 외국인 환자, 환자 후기 등 마케팅 기능 활성화
> **언제 시작**: 운영이 안정된 후 (보통 개원 1~3개월 후)

### aeo-optimization — AEO/SEO 최적화

```
에이전트: "AI 검색과 검색엔진 최적화를 설정합니다.
          Schema.org 마크업, llms.txt, ai.json 등을 자동 생성합니다.

          지금 설정할까요?"

사람:     "응"

에이전트: → /optimize-aeo 스킬 실행
        → 한의원 특화 Schema (Clinic, Physician, Service) 생성
        → 네이버/카카오 메타 최적화
        → 블로그 AEO 메타데이터 일괄 점검
        → state 업데이트: aeo-optimization = done
```

**스킬:** `/optimize-aeo`

### multilingual — 다국어 설정

```
에이전트: "외국인 환자 대응을 위한 다국어 설정을 합니다.
          어떤 언어를 추가하시겠어요?

          ☑️ English (영어)
          ☐ 日本語 (일본어)
          ☐ 简体中文 (중국어 간체)
          ☐ Tiếng Việt (베트남어)"

사람:     "영어만 일단 추가할게"

에이전트: → /setup-i18n 스킬 실행
        → astro.config.mjs i18n 설정
        → 번역 파일 구조 생성
        → 핵심 페이지 번역 (홈, 소개, 연락처)
        → 언어 선택기 UI 추가
        → hreflang 태그 설정
        → state 업데이트: multilingual = done
```

**스킬:** `/setup-i18n`

### survey-tools — 설문/검사도구

```
에이전트: "환자 자가진단이나 검사도구가 필요하신가요?
          예) 스트레스 체크, 체질 테스트, 통증 자가진단 등"

사람:     "스트레스 체크 도구를 만들고 싶어"

에이전트: → /dev-survey 스킬 실행
        → 코드베이스 내 기존 검사도구 패턴 분석
        → 새 검사도구 구조 설계
        → DB 스키마 설계
        → 구현 단계별 가이드 제공
        → state 업데이트: survey-tools = done
```

**스킬:** `/dev-survey`

### custom-skin — 커스텀 스킨 개발

```
에이전트: "병원만의 고유한 디자인 시스템을 만들고 싶으신가요?
          브랜드 컬러와 타이포그래피로 커스텀 스킨을 개발합니다."

사람:     "모던하고 따뜻한 느낌으로 하고 싶어"

에이전트: → /dev-skin 스킬 실행
        → 브랜드 분석
        → 컬러 팔레트 정의 (Primary, Secondary, Neutral, Semantic)
        → 타이포그래피 시스템 (Heading, Body, Size scale)
        → CSS 변수 생성
        → 스킨 Manifest 생성
        → /setup-homepage 핸드오프 파일 생성
        → "이 스킨으로 홈페이지를 구성하시겠어요?"
        → state 업데이트: custom-skin = done
```

**스킬:** `/dev-skin`

### review-management — 환자 후기 관리

```
에이전트: "환자 후기를 수집하고 관리하는 기능을 설정합니다.
          네이버 플레이스 후기 연동이나 사이트 내 직접 작성 중 선택하세요."

사람:     [선택]

에이전트: → 설정 완료
        → state 업데이트: review-management = done
```

### campaign-sms — 캠페인 관리

```
에이전트: "환자 세그먼트별 문자/알림톡 캠페인을 설정합니다.
          재방문 유도, 생일 축하, 특정 프로그램 홍보 등"

사람:     [설정]

에이전트: → /patient-remind 또는 /campaign-draft 스킬 연동
        → state 업데이트: campaign-sms = done
```

---

## Tier 5: 고급 운영/커스터마이징 (필요시)

> 목표: 데이터 이관, 커스텀 개발, 고급 연동
> **언제 시작**: 필요할 때 선택적으로 진행

### data-import — 기존 데이터 가져오기

```
에이전트: "이전 프로그램에서 환자/예약 데이터를 옮기고 싶으신가요?
          CSV, Excel 파일을 지원합니다."

사람:     "엑셀 파일로 환자 명단이 있어"

에이전트: → /import-data 스킬 실행
        → 파일 형식 분석
        → 필드 매핑 (환자명→name, 전화번호→phone 등)
        → 데이터 검증 (중복, 형식 오류 등)
        → 백업 생성
        → 가져오기 실행
        → 검증
        → state 업데이트: data-import = done
```

**스킬:** `/import-data`

### custom-plugins — 커스텀 플러그인 개발

```
에이전트: "병원에 필요한 특별한 기능이 있으신가요?
          플러그인 형태로 확장 기능을 개발합니다."

사람:     "환자별 메모를 남기는 기능이 필요해"

에이전트: → /dev-plugin 스킬 실행
        → 코드베이스 내 기존 플러그인 패턴 분석
        → 플러그인 구조 설계 (new-route, override, admin-page 등)
        → DB 스키마 설계
        → 구현 단계별 가이드 제공
        → state 업데이트: custom-plugins = done
```

**스킬:** `/dev-plugin`

### survey-tools — 맞춤 검사도구

```
에이전트: "더 복잡한 검사도구가 필요하신가요?
          데이터 추이 그래프, 자동 리포트 생성 등"

사람:     "혈압 추이를 그래프로 보여주는 기능"

에이전트: → /dev-survey 스킬 (고급 모드) 실행
        → Chart.js 시각화 설계
        → 데이터 모델링
        → 구현 가이드
        → state 업데이트: survey-tools = done
```

**스킬:** `/dev-survey`

### 외 연동

- **Slack/Discord 연동** — 알림 채널 확장
- **EMR 데이터 이관** — 기존 전자차트 데이터 연동
- **AI 에이전트 고급 설정** — 커스텀 프롬프트, 워크플로우

---

## 선택적 진행 패턴

Tier 4 이상은 사용자가 선택한 순서대로 진행합니다.

### 선택 안내 패턴

```
에이전트: "남은 기능 목록입니다. 필요한 것만 골라서 설정하면 됩니다.

          📣 마케팅 & 확장 (Tier 4):
          ○ AEO/SEO 최적화 — AI 검색/검색엔진 노출
          ○ 다국어 설정 — 외국인 환자용
          ○ 설문/자가진단 도구 — /dev-survey
          ○ 커스텀 스킨 — 병원만의 디자인 시스템
          ○ 환자 후기 관리
          ○ 캠페인 관리 — 단체 문자 발송

          ⚙️ 고급 운영 (Tier 5):
          ○ 데이터 이관 — 기존 시스템에서 옮기기
          ○ 커스텀 플러그인 — 기능 확장
          ○ 커스텀 검사도구 — 고급 데이터 시각화
          ○ 외부 연동 (Slack 등)
          ...

          어떤 것을 설정할까요?"
```

### 의존성 자동 처리

```
사람:     "캠페인 관리를 하고 싶어요"

에이전트: "캠페인 관리를 위해 먼저 설정해야 하는 항목이 있습니다:
          1. notifications (SMS 연동) — 아직 안 됨
          2. 환자 세그먼트 — 아직 안 됨

          notifications부터 시작할까요?"
```

---

## 배포 워크플로우

티어 완료 후 배포를 선택하면:

```
에이전트: "배포 전 최종 점검을 합니다...

          1. 빌드 테스트"
```

```bash
npm run build
```

```
에이전트: "✅ 빌드 성공

          2. 주요 페이지 확인:
          - / (홈페이지) ✅
          - /doctors ✅
          - /programs ✅
          - /intake ✅
          - /admin ✅

          3. 환경변수 확인:
          - ADMIN_PASSWORD: 변경됨 ✅
          - ALIGO_TESTMODE: Y (테스트 모드) ⚠️ 운영 시 N으로 변경 필요

          배포를 진행할까요?"

사람:     "응"
```

```bash
npm run deploy
```

```
에이전트: "✅ 배포 완료!

          🌐 https://my-clinic.pages.dev

          확인 사항:
          - [ ] 라이브 사이트 홈페이지 확인
          - [ ] 모바일에서 확인
          - [ ] /admin 로그인 테스트

          state.deployment_count를 업데이트합니다."
```

---

## 재개 (Resume) 패턴

사용자가 다음 세션에서 돌아왔을 때:

```
사람:     "온보딩 이어서 하자" 또는 "셋업 계속"

에이전트: → .agent/onboarding-state.json 읽기
        → 진행 상황 요약
        → 마지막 진행 중이던 항목부터 이어서 안내
```

```
에이전트: "지난 세션에서 Tier 2까지 완료하고 배포했습니다.

          📊 진행률: 12/30 (40%)
          🏷️ Tier 3 진행 중 — 3/8 완료

          남은 항목:
          - 알림 채널 설정 (SMS/카카오)
          - 블로그 글 작성 (최소 2~3개)
          - 공지사항
          - 환자 태그
          - 샘플 데이터 정리

          알림 채널부터 이어서 할까요?"
```

---

## 이미지 생성 패턴

프로그램 페이지, 히어로 배너, 의료진 프로필, OG 이미지 등에 이미지가 필요할 때.
**Nano Banana 2** (Gemini 3.1 Flash Image) 기반, 레퍼런스 이미지 첨부를 통한 브랜드 일관성 확보.

> **프롬프트 가이드:** `scripts/lib/image-prompt-guide.js`
> **이미지 생성 워크플로우 상세:** `content-bootstrap.md` Phase 3
> **전체 콘텐츠 부트스트랩:** `.agent/workflows/content-bootstrap.md` — 자료수집→이미지→블로그→설정 통합 플로우

---

## 스킬 연계 흐름

```
┌─────────────────────────────────────────────────────────────────────┐
│  스킬 연계 플로우                                                    │
│                                                                      │
│  /dev-skin ───────────┐                                             │
│    ↓                  │                                             │
│  .agent/handoff-skin.json                                            │
│    ↓                  │                                             │
│  /setup-homepage ─────┼──→ /frontend-code                           │
│    ↓                  │        ↓                                     │
│  홈페이지 완성         │     커스텀 UI 구현                            │
│                       │                                             │
│  /setup-intake ───────┼────────────────┐                            │
│  /setup-notifications─┘                │                            │
│                                         ↓                           │
│  /optimize-aeo ←─────────────────── 3차 배포                         │
│  /setup-i18n                                                        │
│  /dev-survey                                                        │
└─────────────────────────────────────────────────────────────────────┘
```
