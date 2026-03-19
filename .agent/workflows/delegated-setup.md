---
description: 중앙 에이전트용 위임 셋업 워크플로우
---

# 위임 셋업 워크플로우 (Delegated Setup)

이 워크플로우는 **마스터 레포에서 중앙 에이전트**가 위임 클라이언트를 셋업할 때 사용합니다.

---

## 전제 조건

- 마스터 레포에서 실행 중
- 고객이 HQ `/delegated`에서 인테이크를 제출하여 `handoff_status: intake_received` 상태
- `DELEGATED_OPERATOR_TOKEN` 환경변수 설정됨
- **고객의 Cloudflare API Token**이 인테이크에 포함됨 (필수)
  - 고객이 CF 계정을 미리 생성하고 API Token을 만들어야 함
  - 📖 [Cloudflare 셋업 가이드](https://clinic-os-hq.pages.dev/guide/cloudflare-setup) (`docs/CLOUDFLARE_SETUP_GUIDE.md`) 참조
  - 필요 권한: Pages(Edit), D1(Edit), R2(Edit)

---

## 워크플로우 단계

### Phase 1: 초기화

```bash
# 1. 위임 클라이언트 디렉토리 생성
node scripts/delegated-init.js --client-id=<CLIENT_ID>

# 결과: ../delegated-clients/{병원명}/ 디렉토리 생성
# - clinic.json, .agent/clinic-profile.json, .env (CF Token), delegated-setup.json
# - HQ handoff_status → setup_in_progress
```

### Phase 2: 셋업 실행

```bash
# 2. 위임 클라이언트 디렉토리로 이동
cd ../delegated-clients/{병원명}/

# 3. 의존성 설치
npm install

# 4. 단계별 셋업 (CLOUDFLARE_API_TOKEN이 .env에 있으므로 wrangler login 불필요)
npm run setup:step -- --next
# → 완료될 때까지 반복
```

> **중요:** CF API Token이 .env에 설정되어 있으므로 wrangler login 없이 배포 가능

### Phase 3: 온보딩

인테이크 데이터(.agent/clinic-profile.json)를 기반으로 온보딩 진행:

1. `.agent/onboarding-registry.json` 읽기
2. Tier 1 (필수) → Tier 2 (핵심) 항목 우선 실행
3. 인테이크 데이터에서 자동 설정 가능한 항목은 에이전트가 직접 처리
4. 사람 입력이 필요한 항목은 기본값 또는 skip

### Phase 4: 배포

```bash
# 5. 빌드 + 배포
npm run build
npm run deploy

# 6. 정상 동작 확인
npm run health
```

### Phase 5: GitHub Push + 핸드오프 준비

```bash
# 7. GitHub 리포 생성 + push (선택)
git remote add origin <GITHUB_URL>
git push -u origin main

# 8. delegated-setup.json 상태 업데이트
# .agent/delegated-setup.json → handoff_status: "setup_complete"

# 9. HQ 상태 업데이트
# POST /api/v1/delegated-setup/{id}/status → { status: "setup_complete" }
```

### Phase 6: 고객 안내

고객에게 전달할 정보:
- GitHub 레포 URL (clone 명령어)
- `npx wrangler login` 실행 안내
- `npm run handoff:claim` 실행 안내

---

## 상태 전이

```
intake_received → setup_in_progress → setup_complete → handed_off
     (HQ 접수)       (에이전트 작업)     (배포 완료)      (고객 인수)
```

---

## 체크리스트

- [ ] delegated-init.js 성공
- [ ] npm install 성공
- [ ] setup:step 모든 단계 완료
- [ ] 온보딩 Tier 1 완료
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
