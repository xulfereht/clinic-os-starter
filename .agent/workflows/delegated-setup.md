---
description: 중앙 에이전트용 위임 셋업 워크플로우
---

# 위임 셋업 워크플로우 (Delegated Setup)

이 워크플로우는 **마스터 레포에서 중앙 에이전트**가 위임 클라이언트를 셋업할 때 사용합니다.

---

## 전제 조건

- 마스터 레포에서 실행 중
- 고객이 HQ `/delegated`에서 인테이크를 제출하여 `handoff_status: intake_received` 상태
- `DELEGATED_OPERATOR_TOKEN` 환경변수 설정됨 (아래 토큰 관리 섹션 참조)
- **고객의 Cloudflare API Token**이 인테이크에 포함됨 (필수)
  - 고객이 CF 계정을 미리 생성하고 API Token을 만들어야 함
  - 📖 [Cloudflare 셋업 가이드](https://clinic-os-hq.pages.dev/guide/cloudflare-setup) (`docs/CLOUDFLARE_SETUP_GUIDE.md`) 참조
  - 필요 권한: Pages(Edit), D1(Edit), R2(Edit), Account Settings(Read)
  - 또는 `CLOUDFLARE_ACCOUNT_ID` 환경변수를 함께 전달하면 Account Settings Read 불필요

---

## DELEGATED_OPERATOR_TOKEN 관리

HQ API 인증용 토큰. 위임 셋업 관련 API(`/api/v1/delegated-setup/*`)를 호출할 때 사용.

### 최초 생성

```bash
# 1. 토큰 생성 (32바이트 hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. HQ 시크릿에 등록
cd hq && echo "<생성된 토큰>" | npx wrangler pages secret put DELEGATED_OPERATOR_TOKEN --project-name clinic-os-hq

# 3. HQ 재배포 (시크릿 반영)
npx wrangler pages deploy dist --project-name clinic-os-hq

# 4. 로컬 환경변수 설정 (현재 세션)
export DELEGATED_OPERATOR_TOKEN=<생성된 토큰>
```

### 보관

- 마스터 레포의 `.env`에 `DELEGATED_OPERATOR_TOKEN=...` 추가 (git에 커밋하지 않음)
- 또는 `--token=<토큰>` 인자로 직접 전달

### 로테이션

토큰 유출 시 위 과정을 반복하여 새 토큰으로 교체. HQ 재배포 필수.

---

## Demo Mode (라이브 시연용)

데모 모드는 웨비나/워크샵에서 라이브 시연 시 사용합니다.
HQ 인테이크 없이 operator의 CF 계정으로 즉시 프로젝트를 생성합니다.

### Demo 전체 플로우

```
PRE-DEMO: delegated-init --demo-mode → setup:step --demo-mode → deploy
LIVE:     스킬 파이프라인 시연 (extract → setup → write → deploy)
POST:     delegated-package → cos-handoff.sh → handoff:claim (demo transfer)
```

### Pre-Demo (D-1)

```bash
# 1. Demo 프로젝트 생성 (CLOUDFLARE_API_TOKEN 환경변수 필요)
export CLOUDFLARE_API_TOKEN=<operator-cf-token>
node scripts/delegated-init.js --demo-mode --clinic-name="Demo Clinic"

# 2. 프로젝트로 이동 + 의존성 설치
cd ../delegated-clients/demo-<id>/
npm install

# 3. 셋업 (--demo-mode: device-register 스킵)
npm run setup:step -- --demo-mode --next
# → 완료될 때까지 반복

# 4. 빌드 + 배포
npm run build && npm run deploy
```

**Demo Mode 차이점:**
- `device-register` 자동 스킵 (license_key 없음)
- `core-pull`에서 HQ git-url 조회 스킵 (기본 URL 사용)
- clinic.json에 `setup_mode: "demo"` 표시
- delegated-setup.json에 `demo_mode: true` 표시

### Post-Demo (핸드오프)

```bash
# 1. 프로젝트 패키징
node scripts/delegated-package.js --dir=../delegated-clients/<slug>

# 2. 위너가 다운로드 + handoff:claim 실행
# handoff-claim.js가 demo_mode를 감지하여:
#   - setup-progress의 cf-login, device-register를 pending으로 리셋
#   - wrangler.toml database_id를 placeholder로 리셋
#   - operator CF token 제거
# 3. 위너가 자기 계정으로 CF 리소스 재생성
npm run setup:step -- --step=cf-login      # D1/R2/Pages 생성 (위너 계정)
npm run setup:step -- --step=device-register # HQ 디바이스 등록
npm run build && npm run deploy             # 위너 계정으로 배포
```

> **Note:** 데모에서 생성된 콘텐츠(블로그, 이미지, 설정)는 파일시스템에 보존됩니다.
> DB 데이터(시드)는 새 D1에 마이그레이션+시드가 다시 실행됩니다.

---

## 워크플로우 단계 (Normal)

### Phase 1: 초기화

```bash
# 1. 위임 클라이언트 디렉토리 생성
node scripts/delegated-init.js --client-id=<CLIENT_ID>

# 결과: ../delegated-clients/{영문slug}/ 디렉토리 생성 (name_en 기반)
# - clinic.json, .agent/clinic-profile.json, .env (CF Token), delegated-setup.json
# - HQ handoff_status → setup_in_progress
```

### Phase 2: 셋업 실행

```bash
# 2. 위임 클라이언트 디렉토리로 이동
cd ../delegated-clients/{영문slug}/

# 3. 의존성 설치
npm install

# 4. 단계별 셋업 (CLOUDFLARE_API_TOKEN이 .env에 있으므로 wrangler login 불필요)
npm run setup:step -- --next
# → 완료될 때까지 반복
```

> **중요:** CF API Token이 .env에 설정되어 있으므로 wrangler login 없이 배포 가능
>
> **CF Token 트러블슈팅:**
> - wrangler `/memberships` 에러 → `CLOUDFLARE_ACCOUNT_ID` 환경변수 설정 필요 (setup-step이 자동 감지하지만, 실패 시 수동 설정)
> - D1/R2 생성 실패 → 고객 토큰에 해당 권한이 없음. CF 가이드의 권한 목록 확인 후 고객에게 수정 요청
> - 마이그레이션/시드는 CF Token 모드에서 로컬+리모트 D1 모두 자동 적용됨

### Phase 3: 온보딩

인테이크 데이터(.agent/clinic-profile.json)를 기반으로 온보딩 진행:

1. `.agent/onboarding-registry.json` 읽기
2. Tier 1 (필수) → Tier 2 (핵심) 항목 우선 실행
3. 인테이크 데이터에서 자동 설정 가능한 항목은 에이전트가 직접 처리
4. 사람 입력이 필요한 항목은 기본값 또는 skip

### Phase 3.5: 콘텐츠 부트스트랩

> **통합 가이드:** `.agent/workflows/content-bootstrap.md` — 전체 플로우를 에이전트가 처음부터 끝까지 실행할 수 있는 수준으로 문서화.

온보딩 완료 후, 사이트가 빈 상태로 배포되지 않도록 콘텐츠를 미리 채웁니다.

#### 3.5.1 샘플 데이터 시딩 (리모트 DB)

```bash
# 공지사항, FAQ, 후기 샘플 데이터를 리모트 DB에 적용
# seeds/는 setup:step에서 로컬에만 적용되므로, 리모트에는 별도 실행 필요
npx wrangler d1 execute <DB_NAME> --remote --file=seeds/sample_notices.sql
npx wrangler d1 execute <DB_NAME> --remote --file=seeds/sample_faqs.sql
npx wrangler d1 execute <DB_NAME> --remote --file=seeds/dummy_reviews.sql
```

> **참고:** 시드 파일이 멱등(INSERT OR IGNORE)이므로 중복 실행해도 안전합니다.

#### 3.5.2 블로그 콘텐츠 임포트

블로그 임포트는 **2단계**로 분리됩니다. 각 단계가 독립적이며, 소스 플랫폼(네이버/티스토리 등)에 따라 1단계만 다릅니다.

**Stage 1: 원본 추출 (소스 플랫폼별)**

소스 블로그에서 원본 HTML을 가져와 DB에 저장합니다.

```bash
# 네이버 블로그 추출
node scripts/extract-naver.js \
  --blog-id=<BLOG_ID> \
  --place-url="<PLACE_URL>" \
  --site-url=<SITE_URL> \
  --api-key=<API_KEY>
# → 블로그 글이 posts 테이블에 원본 HTML 상태로 임포트됨
# → 플레이스 정보가 site_settings에 반영됨
```

> 이 단계에서 저장되는 content는 원본 HTML 그대로입니다. 아직 가독성 정리가 안 된 상태.

**Stage 2: 콘텐츠 클리닝 (공통)**

원본 HTML을 깔끔한 마크다운으로 변환합니다. 이 단계는 소스 플랫폼과 무관하게 동일합니다.

클리닝 대상:
- HTML 태그 제거 → 마크다운 변환 (bold, blockquote, images)
- 빈 줄/zero-width space 과다 → 정리
- 네이버 지도 임베드 → 제거
- 플레이스 푸터 (체크인, MY플레이스, 주소 블록) → 제거
- 프로필 썸네일, 카테고리 링크 → 제거
- SE 에디터 주석 → 제거

> 클리닝은 반드시 Stage 1 완료 후, 전체 글 대상으로 일괄 실행합니다.
> 1개 글로 먼저 테스트하여 결과를 브라우저에서 확인한 뒤 전체 적용하세요.

**클리닝 주의사항 (클라이언트별 차이):**
- 네이버 블로그: SE 에디터 HTML 구조 (`<div><div><p><span>` 중첩), `​` (zero-width space) 줄바꿈
- 티스토리: `<figure>` + `<figcaption>` 구조, `data-origin-*` 속성
- 워드프레스: `wp-block-*` 클래스, shortcode `[gallery]` 등
- 각 소스에 맞는 클리닝 패턴을 추가해야 할 수 있음. 먼저 샘플 1개를 테스트하세요.

**Stage 3: 이미지 R2 전환 (선택)**

클리닝 완료 후, 외부 CDN(pstatic.net 등) 이미지를 R2로 이전합니다:

```bash
# image-pipeline.js 사용
# content 내 pstatic.net URL → R2 다운로드 → URL 치환
```

> R2 무료 10GB 내에서 운용. 이미지 수가 많으면 배치 처리 (CONCURRENCY=5, DELAY=1s).
> 핫링크 차단 리스크가 있으므로 권장하지만, 당장 급하지는 않음.

#### 3.5.3 프로그램 자동 생성

추출된 콘텐츠 + 클리닉 프로파일을 기반으로 프로그램 페이지를 생성합니다:

1. `.agent/clinic-profile.json`에서 진료 과목/특화 분야 확인
2. 네이버 콘텐츠 분석 결과에서 주요 시술/프로그램 키워드 추출
3. 관리자 API (`/admin/api/programs`)를 통해 프로그램 등록
4. 최소 3~5개 프로그램이 생성되도록 보장

```bash
# 프로그램이 0개인지 확인
npx wrangler d1 execute <DB_NAME> --remote \
  --command "SELECT COUNT(*) FROM programs WHERE deleted_at IS NULL"

# 0개이면 프로파일 기반으로 프로그램 생성 (관리자 API 활용)
```

#### 3.5.4 이미지 생성 (Nano Banana 2)

프로그램 페이지와 의료진 프로필에 필요한 이미지를 생성합니다.
나노바나나 2 (Gemini 3.1 Flash Image) API를 사용하며, 클라이언트당 30장 쿼터(HQ 프록시) 또는 BYOK 무제한.

**Step 1: 원본 에셋 수집 + 톤앤매너 분석**

고객이 제공한 실사 에셋(플레이스 사진, 인테리어, 장비, 리플렛 등)을 분석하여 스타일 카드를 작성합니다:
- 공간: 벽 색상, 바닥, 조명, 가구, 포인트 소재
- 인물: 원장 외모, 유니폼, 나이대
- 브랜드: 주요 컬러, 로고 스타일, 무드
- 금지 요소: 실제 공간에 없는 것, 텍스트 생성 등

> 고객 에셋이 없으면 네이버 플레이스 사진(`business_images`)과 블로그 사진을 레퍼런스로 활용합니다.

**Step 2: 기본 소스 컷 생성 (Brand Asset Library)**

실사 레퍼런스를 첨부하여 **동일한 톤/퀄리티**의 정제된 기본 소스를 생성합니다:

```bash
GEN="node $MASTER_REPO/scripts/generate-image.js"

# 원장 포트레이트 (텍스트 없는 깔끔한 반신 사진)
$GEN --prompt "Studio portrait of Korean doctor matching reference..." \
  --ref <원장_약력사진> --aspect 3:4 --save-path base/doctor-portrait.png

# 진료실 (실제 인테리어 톤 반영)
$GEN --prompt "Modern clinic treatment room matching reference..." \
  --ref <인테리어사진1> --ref <인테리어사진2> --aspect 16:9 --save-path base/clinic-room.png

# 장비 클린 컷 (실제 장비 반영)
$GEN --prompt "Medical equipment matching reference..." \
  --ref <장비사진> --aspect 4:3 --save-path base/equipment.png

# 한약/제품 (해당 시)
$GEN --prompt "Herbal medicine product matching reference..." \
  --ref <제품사진> --aspect 1:1 --save-path base/herbal-products.png
```

> **핵심**: 기본 소스 컷들은 모든 페이지 이미지의 레퍼런스로 재사용됩니다. 원장 얼굴과 공간 톤이 일관되어야 합니다.

**Step 3: 페이지별 이미지 생성**

기본 소스 컷을 레퍼런스로, 각 프로그램 페이지의 이미지를 생성합니다.

실제 렌더링되는 섹션만 이미지가 필요합니다:

| 섹션 | 비율 | 내용 | 비고 |
|------|------|------|------|
| **Hero** | 4:5 | 해당 프로그램의 시술/치료 장면 | 원장 포트레이트 + 진료실 레퍼런스 |
| **Mechanism** | 4:3 | 치료 기술/장비 사용 장면 | 장비 + 진료실 레퍼런스 |
| **Solution** | 1:1 | 치료 도구/수단 플랫레이 | 자연스러운 배치, 나열 금지 |
| **DoctorIntro** | 자동 | DB `staff.image`에서 자동 조회 | Step 2의 포트레이트 사용 |

> **렌더링 안 되는 섹션** (이미지 넣어도 무시됨): Problem, FeatureHighlight, Process, FAQ

```bash
# 프로그램별 3장씩 생성 (Hero + Mechanism + Solution)
for PROG in pain-clinic spine-disc-clinic tmj-treatment womens-health sports-injury telemedicine-herbal; do
  $GEN --prompt "<Hero 프롬프트>" \
    --ref base/doctor-portrait.png --ref base/clinic-room.png \
    --aspect 4:5 --save-path "programs/$PROG/hero.png"

  $GEN --prompt "<Mechanism 프롬프트>" \
    --ref base/equipment.png --ref base/clinic-room.png \
    --aspect 4:3 --save-path "programs/$PROG/mechanism.png"

  $GEN --prompt "<Solution 프롬프트>" \
    --ref base/clinic-room.png \
    --aspect 1:1 --save-path "programs/$PROG/solution.png"
done
```

**Step 4: 배치 + DB 업데이트**

```bash
# 생성된 이미지를 core/public/images/에 복사
cp public/local/programs/*/hero.png core/public/images/programs/*/hero.png
cp public/local/programs/*/mechanism.png core/public/images/programs/*/mechanism.jpg
cp public/local/programs/*/solution.png core/public/images/programs/*/solution.jpg

# 의료진 프로필
cp public/local/base/doctor-*-portrait.png core/public/images/staff/

# DB: staff.image 업데이트
wrangler d1 execute <DB> --remote --command="UPDATE staff SET image='/images/staff/<id>.jpg' WHERE id='<id>'"

# DB: sections JSON에 image 필드 추가 (Solution, Mechanism)
# python 스크립트 또는 SQL 파일로 일괄 업데이트
```

**프롬프트 설계 원칙:**
- 공통 접미사: `Do not include any text, words, letters, numbers, signage, labels, captions, watermarks, or logos in the image.`
- Hero: 시술 장면, 원장 레퍼런스 필수, 프로그램별 차별화
- Mechanism: 기술/장비 포커스, Hero와 앵글/분위기 차별화
- Solution: 치료 도구 플랫레이 또는 제품 컷, 장비 나열이 아닌 자연스러운 배치
- 같은 프로그램 내 3장이 겹치지 않도록 주의

**Step 5: 블로그 실사 사진으로 교체 (권장)**

나노바나나 이미지보다 블로그에 사용된 프로 촬영 실사가 있으면 교체합니다:

```
1. 블로그에서 초음파/시술/장비/진료 관련 포스트 검색
2. R2 이미지 다운로드 → 내용 확인 (원장 상담, 시술, 장비 실사)
3. core/public/homepage/optimized/에 의미있는 파일명으로 저장
4. DB programs.sections JSON의 image 경로 업데이트
5. asset-metadata.json에 메타데이터 기록
```

**이미지 원칙:**
- 실사 > 나노바나나 (얼굴이 다른 사람이면 안 됨)
- 디자인 카드(텍스트 오버레이 이미지) 사용 금지
- 같은 프로그램 내 동일 사진 중복 최소화
- Hero에는 원장 얼굴이 보이는 좋은 컷 사용

> 상세: `content-bootstrap.md` Phase 5c (프로그램 섹션 구조) + Phase 6b (실사 추출)

**쿼터 관리:**
- 기본 소스 ~5장 + 프로그램당 3장 × 6개 = ~23장 (쿼터 30장 내)
- 재생성(퀄리티 불만족) 여유분 ~7장
- BYOK 모드(`GEMINI_API_KEY`)면 무제한

#### 3.5.5 온보딩 상태 업데이트

콘텐츠 부트스트랩 완료 후 관련 온보딩 항목을 완료 처리:
- `blog-management` → partial (샘플 공지/후기 시딩 완료)
- `program-management` → partial (프로그램 초안 자동 생성 완료, 검수 필요)
- `naver-content-import` → done (네이버 추출 실행한 경우)
- `branding-minimal` → done (로고, 파비콘, 프로필 이미지 생성 완료)

### Phase 4: 배포

```bash
# 5. 빌드 + 배포
npm run build
npm run deploy

# 6. 정상 동작 확인
npm run health
```

### Phase 5: 코드 정리 + GitHub Push

위임 디렉토리의 코드를 고객이 받아서 바로 사용할 수 있는 상태로 정리합니다.

**5.1 핸드오프 패키징 + HQ 업로드**

위임 디렉토리를 ZIP으로 패키징하여 HQ R2에 업로드합니다.
고객은 cos-handoff.sh 한 줄 명령으로 다운로드합니다 (스타터킷과 동일한 UX).

```bash
# 마스터 레포에서 실행 (또는 위임 디렉토리에서)
node scripts/delegated-package.js --dir=../delegated-clients/{slug}

# 결과:
# - ZIP이 HQ R2에 업로드됨 (handoff/{clientId}/v{timestamp}.zip)
# - handoff_status → setup_complete
# - 고객에게 전달할 명령어 출력:
#   curl -fsSL https://clinic-os-hq.pages.dev/cos-handoff.sh | bash
```

> ZIP에서 자동 제외: node_modules, .git, .env, dist, .wrangler, public/local/base

**5.2 고객에게 안내**

고객에게 전달할 것은 **한 가지**뿐입니다:
- HQ `/download` 페이지에 핸드오프 카드가 자동 표시됨
- 또는 직접 명령어 안내: `curl -fsSL https://clinic-os-hq.pages.dev/cos-handoff.sh | bash`

> 시크릿(CF Token 등)은 ZIP에 포함되지 않음. 고객이 cos-handoff.sh 실행 시 자동으로 `wrangler login` 진행.
> GitHub 연동은 소프트게이트(Gate 1)에서 고객이 선택적으로 진행.

### Phase 6: 핸드오프 (고객 인수)

고객이 한 줄 명령으로 프로젝트를 받고, Claude Code가 나머지를 안내합니다.

**6.1 고객 실행**
```bash
# 터미널에서 한 줄 실행 — 이게 전부입니다
curl -fsSL https://clinic-os-hq.pages.dev/cos-handoff.sh | bash
```

cos-handoff.sh가 자동으로:
1. HQ 인증 (device auth — 브라우저 코드 입력)
2. ZIP 다운로드 + 압축 해제
3. `npm install`
4. `npx wrangler login` (고객 CF 계정 인증)
5. `npm run handoff:claim` (디바이스 등록 + 상태 변경)

**6.2 고객이 Claude Code 실행**
```bash
cd clinic-os
claude
```

에이전트가 `.agent/delegated-setup.json`에서 `handoff_status: claimed` 감지 → delegated-handoff 워크플로우 진입:
- 관리자 비밀번호 변경 안내
- `npm run dev` 동작 확인
- 남은 온보딩 항목 (도메인 연결 등) 이어서 진행
- 소프트게이트 (GitHub, 백업 등) 선택적 진행

> 상세: `.agent/workflows/delegated-handoff.md`

---

## 상태 전이

```
intake_received → setup_in_progress → setup_complete → packaged → claimed
     (HQ 접수)       (에이전트 작업)     (배포 완료)    (ZIP 생성)  (고객 인수)
```

> `claimed`은 `handoff-claim.js`가 설정하는 최종 상태입니다.
> 이후 first-contact.md가 일반 판별 플로우 → 온보딩(Phase C)으로 진입합니다.

---

## 체크리스트

- [ ] delegated-init.js 성공
- [ ] npm install 성공
- [ ] setup:step 모든 단계 완료
- [ ] 온보딩 Tier 1 완료
- [ ] 샘플 데이터(공지/FAQ/후기) 리모트 DB에 시딩
- [ ] 프로그램 최소 3개 이상 등록
- [ ] 네이버 콘텐츠 추출 (해당 시)
- [ ] npm run build 성공
- [ ] npm run deploy 성공
- [ ] npm run health 통과
- [ ] GitHub push 완료
- [ ] HQ handoff_status → setup_complete
- [ ] 고객에게 인수 안내 발송

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `scripts/delegated-init.js` | 디렉토리 초기화 |
| `scripts/handoff-claim.js` | 고객 인수 스크립트 |
| `.agent/delegated-setup.json` | 위임 상태 추적 |
| `.agent/clinic-profile.json` | 인테이크 기반 프로파일 |
| `.agent/workflows/delegated-handoff.md` | 고객 인수 워크플로우 |

### 기획 산출물 경로 (스킬 간 공유)

| 산출물 | 경로 | 생성 | 소비 |
|--------|------|------|------|
| 클리닉 프로파일 | `.agent/clinic-profile.json` | Gate 0, `/extract-content` | `/setup-clinic-info`, `/onboarding` |
| 스타일 카드 | `.agent/style-card.yaml` | `/analyze-content` | `/write-blog`, `/write-copy`, `/setup-skin`, `/setup-homepage` |
| 엣지 프로파일 | `.agent/edge-profile.yaml` | `/discover-edge` | `/write-copy`, `/write-blog`, `/plan-content` |
| 사이트 플랜 | `.agent/site-plan.yaml` | `/plan-content` | `/setup-homepage`, `/setup-programs` |
| 에셋 메타데이터 | `public/local/homepage/asset-metadata.json` | content-bootstrap 6d | 에이전트 참조 |
| 에셋 이미지 | `public/local/homepage/` | `/curate-images`, `/enhance-portrait` | `/setup-homepage` |

> 모든 `.agent/*.yaml` 파일은 local (core:pull 보호). `public/local/`도 보호됨.
