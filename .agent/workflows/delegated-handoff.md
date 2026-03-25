---
description: 위임 셋업 완료 프로젝트를 클라이언트가 인수할 때 사용하는 워크플로우
---

# 위임 인수 워크플로우 (Delegated Handoff)

위임 셋업으로 완성된 프로젝트를 클라이언트가 자기 환경에서 인수받는 플로우입니다.

---

## 판별 조건

다음 **모두 해당**이면 이 워크플로우 진입:
- `.agent/delegated-setup.json` 존재
- `handoff_status`가 `ready_to_claim` 또는 `claimed`

---

## 인수 절차

### cos-handoff.sh로 다운로드한 경우 (권장)

cos-handoff.sh가 자동으로 npm install + wrangler login + handoff:claim까지 완료합니다.
고객이 `claude`를 실행하면 이 워크플로우에 진입합니다.

```
에이전트: "바로한의원 위임 셋업이 완료된 프로젝트입니다.
          몇 가지 인수 절차를 안내해 드리겠습니다."
```

### handoff_status가 ready_to_claim인 경우

cos-handoff.sh에서 claim이 실패한 경우:

```
에이전트: "프로젝트 인수가 아직 완료되지 않았습니다.
          다음을 실행해주세요:
          1. npx wrangler login (본인 Cloudflare 계정)
          2. npm run handoff:claim"
```

---

## 인수 후 즉시 할 일 (에이전트가 안내)

### 1. 관리자 비밀번호 변경

```
에이전트: "보안을 위해 관리자 비밀번호를 변경하겠습니다.
          현재 임시 비밀번호가 설정되어 있습니다.
          새 비밀번호를 입력해주세요:"
→ wrangler.toml의 ADMIN_PASSWORD 업데이트
→ 재배포 (npm run build && npm run deploy)
```

### 2. 사이트 동작 확인

```
에이전트: → npm run dev 실행
        → "로컬에서 사이트가 정상 동작합니다. 브라우저에서 확인해보세요."
        → npm run health 실행
        → 건강 점수 표시
```

### 3. 커스텀 도메인 연결

```
에이전트: "사이트에 도메인을 연결하시겠습니까?
          현재 https://{project}.pages.dev 로 접근 가능합니다.

          1. 이미 도메인이 있다 → 연결 안내
          2. 새로 구매하고 싶다 → 구매 + 연결 안내
          3. 나중에 하겠다 → 건너뛰기"

[진행 시]
→ docs/CUSTOM_DOMAIN_GUIDE.md 참고하여 안내
→ 도메인 연결 후:
  1. site_settings.site_url 변경
  2. 빌드 + 배포
  3. Google Search Console 인증 안내
  4. 네이버 서치어드바이저 인증 안내
  5. sitemap.xml 제출 안내
```

### 4. SEO 기본 설정

```
에이전트: "검색엔진 최적화를 위한 기본 설정을 안내합니다.
          /admin/settings/seo 페이지에서 설정할 수 있습니다."

→ 메타 타이틀 패턴 확인/수정
→ 메타 설명 확인
→ Google Analytics ID (있으면)
→ 네이버 웹마스터 인증 메타 태그
```

### 5. AEO (AI Engine Optimization) 설정

```
에이전트: "AI 검색엔진(ChatGPT, Gemini 등)에서 병원이 잘 노출되도록
          AEO 토픽을 설정하시겠습니까?"

→ /admin/aeo 에서 토픽 생성 안내
→ 프로그램별 주요 질환/시술 키워드로 토픽 자동 제안
→ 블로그 콘텐츠와 토픽 연결
```

---

## 핸드오프 후 체크리스트 (onboarding-state.json에 저장됨)

에이전트는 `post_handoff_checklist`를 읽어서 완료되지 않은 항목을 안내합니다:

### 즉시 (immediate)
- [ ] 관리자 비밀번호 변경
- [ ] wrangler.toml ADMIN_PASSWORD 업데이트
- [ ] npm run dev 정상 동작 확인

### 도메인 (domain)
- [ ] 커스텀 도메인 구매/연결
- [ ] site_url 변경
- [ ] Google/Naver 사이트 인증
- [ ] sitemap.xml 제출
- [ ] 재배포

### SEO/AEO (seo_aeo)
- [ ] 메타 타이틀 패턴 설정
- [ ] Google Analytics ID 설정
- [ ] AEO 토픽 생성
- [ ] 네이버 플레이스 URL 연동 확인

### 선택 (optional)
- [ ] 약관 페이지 생성
- [ ] SMS 알림 설정
- [ ] 다국어 설정
- [ ] 리뷰 관리

---

## 주의사항

- `handoff:claim` 실행 전에 반드시 `npx wrangler login` 완료
- 인수 후 `.env`의 CF API Token은 자동 제거됨
- 문제 발생 시: `npm run health:fix` 또는 서포트 에이전트 활용 (`./scripts/cos-ask`)
- 도메인 가이드: `docs/CUSTOM_DOMAIN_GUIDE.md`

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `scripts/handoff-claim.js` | 인수 스크립트 |
| `.agent/delegated-setup.json` | 위임 상태 추적 |
| `.agent/onboarding-state.json` | 온보딩 상태 (post_handoff_checklist 포함) |
| `.agent/workflows/delegated-setup.md` | 중앙 위임 셋업 워크플로우 |
| `.agent/workflows/softgate.md` | 소프트게이트 워크플로우 |
| `docs/CUSTOM_DOMAIN_GUIDE.md` | 커스텀 도메인 연결 가이드 |
