---
description: npm run setup 이후 병원 개별화 셋업을 에이전트가 안내하는 워크플로우
---

# 온보딩 워크플로우

이 워크플로우는 `npm run setup` 완료 후, 병원의 개별 정보와 콘텐츠를 세팅하는 전 과정을 안내합니다.
에이전트가 주도하고, 사람에게는 필요한 정보만 요청합니다.

---

## 사전 조건

- `npm run setup` 완료 (cf-login 단계 포함)
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

1. Tier 1: 배포 필수
   - 관리자 보안, 병원 정보, 연락처, 진료시간, 최소 브랜딩, 약관

2. Tier 2: 핵심 콘텐츠
   - 네이버 콘텐츠 임포트 (선택), 의료진, 진료 프로그램, 홈페이지, 메뉴, 위치/OG

3. Tier 3: 환자 서비스
   - 접수, 예약, 블로그, 공지, 샘플 데이터 정리

4. Tier 4: 마케팅/확장
   - SEO, SMS, 다국어, 이벤트 폼, 설문도구

5. Tier 5: 운영 고도화/커스터마이징
   - 커스텀 페이지, 플러그인, 스킨, 스타일 오버라이드

추천 순서는 Tier 1 → Tier 2입니다.
원하시면 추천 순서대로 진행하거나, 원하는 항목부터 바로 시작할 수 있습니다."
```

브리핑 후에는 아래 중 하나를 제안합니다.

- 추천 순서대로 진행
- 특정 Tier부터 진행
- 특정 기능만 먼저 진행
- 커스터마이징 항목(플러그인/스킨/스타일)부터 검토

### 1. 현황 파악

에이전트가 먼저 상태를 읽고 요약합니다:

```
"온보딩 현황을 확인합니다...

📊 전체 진행률: 7/48 완료 (14%)
🏷️ 현재 단계: Tier 1 (배포 필수) — 3/7 완료

✅ 완료: 관리자 계정 보안, 병원 기본 정보, 병원 연락처
⏳ 남은 항목:
  - 진료 시간
  - 최소 브랜딩 (로고/파비콘/컬러)
  - 약관 및 정책 문서
  - ADMIN_PASSWORD 환경변수

계속 진행할까요?"
```

아직 시작 브리핑을 하지 않았다면, 현황 요약 전에 브리핑부터 먼저 수행합니다.

### 2. 티어별 안내

```
Tier 1 완료 → "1차 배포가 가능합니다. 지금 배포할까요, Tier 2도 먼저 채울까요?"
Tier 2 완료 → "환자가 봤을 때 운영 중인 병원으로 보입니다. 배포 후 Tier 3을 진행할까요?"
Tier 3 완료 → "환자 접수가 가능합니다. Tier 4는 운영이 안정된 후 하나씩 해도 됩니다."
Tier 4~5    → "필요한 기능만 선택적으로 세팅하면 됩니다. 뭐부터 할까요?"
```

사용자가 처음부터 특정 항목을 지정하면 추천 순서를 강제하지 않습니다.

예:

- "병원 정보만 먼저"
- "홈페이지부터"
- "스킨 먼저 보고 싶어요"
- "플러그인 계획도 같이 잡아줘"

### 3. 기능 실행 패턴

각 기능을 실행할 때 에이전트가 따르는 패턴:

```
[1] registry에서 해당 기능의 스펙 읽기
    - depends_on 확인 → 선행 기능 미완료 시 먼저 안내
    - doc_ref 확인 → 상세 가이드가 있으면 참조
    - human_inputs 확인 → 사람에게 물어볼 항목 파악

[2] 사람에게 필요한 정보 요청
    - required 항목만 먼저 물어보기
    - 예시(example)가 있으면 함께 제시
    - 선택(required: false) 항목은 "지금 설정할까요, 나중에 할까요?" 물어보기

[3] 설정 반영
    - admin_path가 있으면: "관리자 페이지에서 직접 입력" 안내
    - DB 직접 수정이 가능하면: 에이전트가 API/DB로 반영
    - file_paths가 있으면: 파일 생성/수정

[4] 확인
    - 설정이 반영됐는지 확인 (페이지 접속, DB 조회 등)
    - state 업데이트

[5] 다음 항목으로
    - 같은 tier 내에서 다음 pending 항목으로 이동
    - tier 내 모든 항목 완료 시 배포 제안
```

---

## Tier 1: 배포 필수

> 목표: 사이트가 정상 작동하고 법적 요건을 충족하는 상태

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

### admin-password-env — 환경변수

```
에이전트: "wrangler.toml의 ADMIN_PASSWORD도 보안값으로 변경해야 합니다.
          Phase 1에서 설정한 비밀번호와 동일하게 맞출까요?"

사람:     "응"

에이전트: → wrangler.toml [vars] 섹션 업데이트
        → state 업데이트: admin-password-env = done
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

## Tier 2: 핵심 콘텐츠

> 목표: 환자가 봤을 때 실제 운영 중인 병원처럼 보이는 상태

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
에이전트: "진료 프로그램을 등록합니다.
          주요 진료 과목을 알려주세요.
          예) 한방 다이어트, 교통사고 치료, 추나요법..."

사람:     [프로그램 목록 제공]

에이전트: → 각 프로그램별: 제목, 설명, 담당 의료진 매칭
        → /admin/programs에서 등록
        → "상세 내용은 나중에 추가해도 됩니다. 일단 제목과 간단 설명만 넣을까요?"
        → state 업데이트: program-management = done
```

### homepage-setup — 홈페이지 구성

```
에이전트: "홈페이지를 구성합니다.
          등록된 의료진과 프로그램을 기반으로 기본 구성을 만들어드릴까요?
          아니면 직접 커스터마이징 하시겠습니까?"

사람:     "기본 구성으로"

에이전트: → SectionRenderer 기반 기본 홈페이지 생성
        → 히어로 배너 문구 확인: "메인 타이틀로 뭘 쓸까요?"
        → CTA 버튼 설정: "예약하기 → 어디로 연결할까요? (전화/카카오/외부URL)"
        → state 업데이트: homepage-setup = done
```

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

## Tier 3: 환자 서비스

> 목표: 환자가 온라인으로 접수하고 예약할 수 있는 상태

에이전트가 다음 항목을 순서대로 안내:

1. **intake-setup** — 접수 폼 활성화 + 필드 구성
2. **reservation-setup** — 예약 시스템 (의료진+프로그램 기반 자동 활성화)
3. **clinic-schedule** — 요일별 상세 운영시간 + 휴무일
4. **blog-management** — 샘플 삭제 + 최소 2~3개 실제 글 작성 (AEO는 권장사항, 없어도 발행 가능)
5. **notice-management** — 개원 안내 등 초기 공지
6. **tag-management** — 환자 분류 태그 커스터마이징
7. **sample-data-cleanup** — 남은 시드 데이터 최종 정리

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

          ✅ 온라인 접수 가능
          ✅ 예약 시스템 활성화
          ✅ 블로그 글 3개 게시
          ✅ 공지사항 등록
          ✅ 샘플 데이터 정리 완료

          이제 환자가 실제로 접수할 수 있습니다.
          Tier 4 (마케팅)는 운영이 안정된 후 하나씩 해도 됩니다.
          어떻게 할까요?

          [A] 운영 시작 — Tier 4는 나중에
          [B] SMS 연동부터 하고 싶어요
          [C] SEO 설정을 하고 싶어요
          [D] 다국어를 설정하고 싶어요
          [E] 전체 목록 보기"
```

---

## Tier 4~5: 선택적 진행

Tier 4 이상은 사용자가 선택한 순서대로 진행합니다.

여기에는 운영 기능뿐 아니라 커스터마이징 트랙도 포함됩니다.

- 커스텀 페이지 제작
- 플러그인 확장 계획
- 스킨 커스터마이징
- 스타일 오버라이드 계획

### 선택 안내 패턴

```
에이전트: "남은 기능 목록입니다. 필요한 것만 골라서 설정하면 됩니다.

          📣 마케팅 & 확장 (Tier 4):
          ○ SMS 연동 (알리고) — 문자 발송 기능
          ○ 메시지 템플릿 — 예약확인/리마인더 등
          ○ 캠페인 관리 — 단체 문자 발송
          ○ 환자 세그먼트 — 타겟 그룹 설정
          ○ 환자 후기 관리
          ○ 토픽/FAQ 관리 — 건강 정보 콘텐츠
          ○ SEO 설정
          ○ 다국어 설정 — 외국인 환자용
          ○ 이벤트 폼 — 프로모션 신청서
          ○ 설문/자가진단 도구
          ○ 콘텐츠 번역

          ⚙️ 운영 고도화 (Tier 5):
          ○ 상품/가격 설정
          ○ 재고 관리
          ○ 지출 관리
          ○ AI 에이전트 설정
          ○ 외부 연동 (Slack 등)
          ○ EMR 데이터 이관
          ○ 채팅 위젯
          ○ 커스텀 페이지 제작
          ○ 플러그인 확장
          ○ 스킨 커스터마이징
          ○ 스타일 오버라이드 계획
          ... (외 10개)

          어떤 것을 설정할까요?"
```

### 의존성 자동 처리

```
사람:     "캠페인 관리를 하고 싶어요"

에이전트: "캠페인 관리를 위해 먼저 설정해야 하는 항목이 있습니다:
          1. SMS 연동 (알리고) — 아직 안 됨
          2. 메시지 템플릿 — 아직 안 됨
          3. 환자 세그먼트 — 아직 안 됨

          SMS 연동부터 시작할까요?"
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

          📊 진행률: 20/48 (42%)
          🏷️ Tier 3 진행 중 — 3/7 완료

          남은 항목:
          - 블로그 글 작성 (최소 2~3개)
          - 공지사항
          - 환자 태그
          - 샘플 데이터 정리

          블로그부터 이어서 할까요?"
```

---

## 이미지 생성 패턴

프로그램 페이지, 히어로 배너, 의료진 프로필, OG 이미지 등에 이미지가 필요할 때.
**Nano Banana 2** (Gemini 3.1 Flash Image) 기반, 레퍼런스 이미지 첨부를 통한 브랜드 일관성 확보.

> **프롬프트 가이드:** `scripts/lib/image-prompt-guide.js`
> **이미지 생성 워크플로우 상세:** `content-bootstrap.md` Phase 3
> **전체 콘텐츠 부트스트랩:** `.agent/workflows/content-bootstrap.md` — 자료수집→이미지→블로그→설정 통합 플로우

### 2단계 생성 원칙

**1단계: 기본 소스 컷 (Brand Asset Library)**
고객의 실사 에셋(플레이스 사진, 인테리어, 약력 카드, 장비 사진 등)을 레퍼런스로 첨부하여
동일한 톤/퀄리티의 정제된 기본 소스 ~5장을 생성합니다:
- 원장 포트레이트 (약력 카드에서 텍스트 제거한 깔끔한 반신)
- 진료실 클린 컷 (실제 인테리어 반영)
- 장비 클린 컷 (실제 장비 반영)
- 한약/제품 컷 (해당 시)

**2단계: 페이지별 이미지**
기본 소스 컷을 레퍼런스로 각 프로그램 페이지의 이미지를 생성합니다.
→ 원장 얼굴 일관, 공간 톤 일관, 장비 정확.

> 고객 에셋이 없으면: 네이버 플레이스 `business_images`와 블로그 사진을 레퍼런스로 활용.
> 그것도 없으면: 레퍼런스 없이 템플릿 기반 생성 (톤 일관성은 떨어지지만 진행 가능).

### 실제 렌더링되는 섹션 (이미지 필요)

| 섹션 | 비율 | 용도 |
|------|------|------|
| **Hero** | 4:5 | 시술/치료 장면 |
| **Mechanism** | 4:3 | 치료 기술/장비 장면 |
| **Solution** | 1:1 | 치료 도구 플랫레이 |
| **DoctorIntro** | 자동 (staff.image) | Step 1의 포트레이트 |

> **렌더링 안 되는 섹션**: Problem(이모지만), FeatureHighlight(미렌더), Process(텍스트만), FAQ, RelatedPosts/Reviews

### 사용법

```bash
# 레퍼런스 이미지 첨부 생성 (권장)
node scripts/generate-image.js \
  --prompt "시술 장면 설명..." \
  --ref <원장_사진> --ref <진료실_사진> \
  --aspect 4:5 --save-path "programs/pain/hero.png"

# 템플릿 기반 생성 (레퍼런스 없이)
node scripts/generate-image.js \
  --template program --name "추나요법" --category pain \
  --save-path "programs/pain/hero.png"

# BYOK(GEMINI_API_KEY) 있으면 직접 호출, 없으면 HQ 프록시 (30회 무료)
```

### 쿼터 관리
- 기본 소스 ~5장 + 프로그램당 3장 × N개 + 재생성 여유 = 30장 쿼터 내 운용
- BYOK 모드(wrangler.toml에 GEMINI_API_KEY)면 무제한
- 쿼터 소진 시: BYOK 가이드 안내 → `/guide/image-generation`
- ⚠️ 온보딩을 이미지 실패로 중단하지 않음 — placeholder로 진행

### 프롬프트 품질 규칙

DO:
- `--ref`로 실사 레퍼런스 첨부 — 인물 1장 + 공간 1~2장 (최대 3장)
- 구조: `[주요 피사체] + [배경/환경] + [조명] + [스타일]`
- 프롬프트 마지막에 "No text, no labels" 명시 (자동 추가됨)
- Hero/Mechanism/Solution이 서로 겹치지 않도록 앵글/내용 차별화
- 프롬프트 길이: 30-75 단어

DON'T:
- 레퍼런스 없이 인물 묘사에 의존 (닮지 않는 결과물)
- 장비를 한 화면에 나열 (작위적) → 자연스러운 배치 또는 사용 장면
- 텍스트/간판/라벨 생성 요청
- 실제 공간에 없는 요소 포함 (전통 한약장이 없는데 넣기 등)
- 같은 프로그램의 Hero와 Mechanism에 동일한 시술 장면

**사용 예시:**

```bash
# 프로그램 히어로 (진료과목 지정 → 골드 스탠다드 사용)
node scripts/generate-image.js --template program --name "소화기 치료" --category digestive --save-path "images/programs/digestive/hero.png"

# 프로그램 히어로 (과목 미지정 → 자동 빌드)
node scripts/generate-image.js --template program --name "추나요법" --save-path "images/programs/chuna/hero.png"

# 블로그 썸네일
node scripts/generate-image.js --template blog --title "봄철 알레르기 관리법" --category skin --save-path "images/blog/allergy.png"

# 히어로 배너 (변형 지정)
node scripts/generate-image.js --template hero --variant zen --save-path "images/hero/main.png"

# 메커니즘 다이어그램
node scripts/generate-image.js --template mechanism --name "피부 치료" --category skin --save-path "images/programs/skin/mechanism.png"

# 같은 프로그램의 이미지들을 같은 seed로 통일 (톤 일관성)
node scripts/generate-image.js --template program --category digestive --seed 42 --save-path "images/programs/digestive/hero.png"
node scripts/generate-image.js --template mechanism --category digestive --seed 42 --save-path "images/programs/digestive/mechanism.png"
node scripts/generate-image.js --template solution --category digestive --seed 42 --save-path "images/programs/digestive/solution.png"

# 스타일 변경 (기본=사진, 대안: inkWash, watercolor, cinematic, flatLay 등)
node scripts/generate-image.js --template hero --style inkWash --save-path "images/hero/main.png"

# 사용 가능한 스타일 목록 보기
node scripts/generate-image.js --list-styles

# 커스텀 프롬프트 (가이드라인 구조 준수)
node scripts/generate-image.js --prompt "Close-up of dried Korean herbs and roots on warm wooden surface. Overhead flat-lay. Soft natural lighting. Editorial food photography. No text." --save-path "images/custom/herbs.png"
```

**스타일 안내 시점:** 온보딩에서 히어로 이미지나 프로그램 이미지 생성 시, 기본 결과를 보여준 후:
```
"기본 스타일로 생성했습니다. 다른 분위기를 원하시면 수묵화, 수채화, 시네마틱 등
다양한 스타일로 변경할 수 있습니다. --list-styles로 전체 목록을 확인하세요."
```

---

## 에이전트 행동 원칙

### DO

- **상태 파일을 항상 먼저 읽기** — 맥락 없이 시작하지 않기
- **한 번에 하나씩** — 여러 기능을 동시에 물어보지 않기
- **예시를 함께 제시** — human_inputs의 example 필드 활용
- **선택권 주기** — required가 아닌 항목은 "나중에" 옵션 제공
- **진행률 보여주기** — 각 기능 완료 시 전체 진행률 업데이트
- **배포 시점 제안** — 티어 완료 시마다 배포 여부 확인
- **doc_ref 참조** — 상세 가이드가 필요하면 docs/ 문서 안내

### DON'T

- 사용자가 아직 입력하지 않은 정보를 추측하지 않기
- Tier 순서를 건너뛰도록 권장하지 않기 (사용자가 원하면 허용)
- 설정이 반영됐는지 확인하지 않고 다음으로 넘어가지 않기
- 한 세션에 너무 많은 항목을 몰아서 진행하지 않기
- 코어 파일을 직접 수정하지 않기 (GEMINI.md 금지 규칙 준수)

---

## 참조 문서

| 용도 | 문서 |
|------|------|
| 병원 정보 상세 | `docs/CLINIC_INFO_SETUP.md` |
| 디자인/브랜딩 | `docs/DESIGN_SYSTEM_GUIDE.md` |
| 홈페이지 커스터마이징 | `docs/CUSTOMIZATION_GUIDE.md` |
| 콘텐츠 관리 (블로그, 프로그램) | `docs/CONTENT_MANAGEMENT_GUIDE.md` |
| 직원 관리 | `docs/STAFF_MANAGEMENT.md` |
| 환자 관리 | `docs/PATIENT_MANAGEMENT.md` |
| 예약 관리 | `docs/RESERVATION_MANAGEMENT.md` |
| 접수 관리 | `docs/INTAKE_MANAGEMENT.md` |
| 메시지/캠페인 | `docs/MESSAGE_CAMPAIGN_GUIDE.md` |
| SEO/마케팅 | `docs/SEO_MARKETING_GUIDE.md` |
| 후기 관리 | `docs/REVIEW_MANAGEMENT.md` |
| AI 기능 | `docs/AI_FEATURE_GUIDE.md` |
| 플러그인 개발 | `docs/PLUGIN_DEVELOPMENT_GUIDE.md` |
| 운영 가이드 | `docs/OPERATIONS_GUIDE.md` |

---

## 명령어

| 트리거 | 동작 |
|--------|------|
| "온보딩" / "셋업" / "설정" | 상태 읽고 이어서 진행 |
| "진행 상황" / "현황" | 진행률 요약만 표시 |
| "Tier N" / "N단계" | 해당 티어로 이동 |
| "배포" / "deploy" | 배포 전 점검 → 배포 실행 |
| "[기능명]" | 특정 기능으로 바로 이동 |
| "전체 목록" | 전체 기능 + 상태 표시 |
| "건너뛰기" | 현재 기능을 skipped로 마킹 |
