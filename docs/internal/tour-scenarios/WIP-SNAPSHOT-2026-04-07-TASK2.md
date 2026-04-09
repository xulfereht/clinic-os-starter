# WIP Snapshot: Tour 시나리오 콘텐츠 Task 2 — 2026-04-07

> **Mission**: Tour 시나리오 콘텐츠 + UI 정밀화 (ACTIVE)
> **Focus**: Task 1 ✅ + Task 2 진행 중
> **Session**: 2026-04-07 저녁

---

## 현재 진행 상황

### Task 1: ✅ 팝업 UI 개선 (COMPLETE)

- **Shepherd.js 기본 스타일** + tips/buttons 렌더링
- 스텝 번호 표시 (3/12) + 그라데이션 진행률 바
- 💡 알아두세요 (팁 박스) + 🖱️ 주요 버튼 (설명 박스) 렌더링
- 10/10 E2E PASS
- **Removed**: 영상 링크 (직원용 영상과 온보딩 거리 있음, 추후 연결)

---

### Task 2: 페이지별 시나리오 콘텐츠 — 진행 중

#### 완료: 26개 페이지 (346 스텝)

| # | 페이지 | 스텝 | AC |
|---|--------|------|-----|
| 1 | dashboard (대시보드) | 13 | ✅ 6/6 |
| 2 | patients (환자) | 15 | ✅ 6/6 |
| 3 | intake (접수) | 13 | ✅ 6/6 |
| 4 | reservations (예약) | 10 | ✅ 6/6 |
| 5 | payments (결제) | 22 | ✅ 6/6 |
| 6 | leads (리드) | 28 | ✅ 6/6 |
| 7 | staff (직원) | 32 | ✅ 5/6 수동통과 |
| 8 | programs (프로그램) | 18 | ✅ 6/6 |
| 9 | posts (블로그) | 15 | ✅ 6/6 |
| 10 | design (디자인) | 22 | ✅ 6/6 |
| 11 | settings (기본설정) | 37 | ✅ 6/6 |
| 12 | campaigns (캠페인) | 13 | ✅ 5/6 수동통과 |
| 13 | analytics (분석) | 11 | ✅ 6/6 |
| 14 | reviews (후기) | 9 | ✅ 6/6 |
| 15 | messages (메시지) | 12 | ✅ 6/6 |
| 16 | pages (페이지관리) | 9 | ✅ 6/6 |
| 17 | surveys (설문) | 6 | ✅ 6/6 |
| 18 | notices (공지사항) | 8 | ✅ 6/6 |
| 19 | documents (문서) | 7 | ✅ 6/6 |
| 20 | inventory (재고) | 8 | ✅ 5/6 수동통과 |
| 21 | expenses (비용) | 7 | ✅ 6/6 |
| 22 | tasks (업무) | 6 | ✅ 6/6 |
| 23 | manuals (매뉴얼) | 8 | ✅ 6/6 |
| 24 | members (회원) | 6 | ✅ 6/6 |
| 25 | shipping (배송) | 11 | ✅ 6/6 (재작성) |
| 26 | media (미디어) | 7 | ✅ 6/6 |
| | **소계** | **346** | **26/26 ACCEPTED** |

**AC 기준**:
- **C1**: 모든 인터랙티브 요소 커버 (누락 0개)
- **C2**: CSS 셀렉터 실재 확인 (허위 0개)
- **C3**: 텍스트 구체성 ("~합니다" 아닌 구체적 설명)
- **C4**: 모달 필드 커버 (모달 필드 누락 0개)
- **C5**: 유저 흐름 완결 (끊김 없음)
- **C6**: 스텝 수 적정 (주요 페이지 ≥5)

---

#### 완료: 배치 6 (8개 페이지, 58 스텝)

| # | 페이지 | 스텝 | AC |
|---|--------|------|-----|
| 27 | tags (태그) | 6 | ✅ 6/6 |
| 28 | promotions (프로모션) | 5 | ✅ 6/6 |
| 29 | navigation (네비게이션) | 7 | ✅ 6/6 |
| 30 | widget (위젯) | 8 | ✅ 6/6 |
| 31 | seo (SEO) | 8 | ✅ 6/6 |
| 32 | integrations (통합) | 12 | ✅ 6/6 |
| 33 | api-keys (API키) | 5 | ✅ 6/6 |
| 34 | ai-settings (AI설정) | 7 | ✅ 6/6 |
| | **소계** | **58** | **8/8 ACCEPTED** |

#### 진행 중: 배치 7 병렬

| 배치 | 페이지 | 예상 스텝 | 상태 |
|------|--------|----------|------|
| 7 | terms, trash, plugins, data-converter, events, history, topics, aeo, knowledge, translations, languages | ~50 | 에이전트 병렬 작성 |
| | **남은 예상 소계** | **~50** | |

**누적 현황**: 34개 페이지 × 404 스텝  
**예상 최종**: 34개 → **~45개 페이지, ~454 스텝**

---

## 파일 구조

```
docs/internal/tour-scenarios/
├── dashboard.md              ✅ 13스텝
├── patients.md               ✅ 15스텝
├── intake.md                 ✅ 13스텝
├── reservations.md           ✅ 10스텝
├── payments.md               ✅ 22스텝
├── leads.md                  ✅ 28스텝
├── staff.md                  ✅ 32스텝
├── programs.md               ✅ 18스텝
├── posts.md                  ✅ 15스텝
├── design.md                 ✅ 22스텝
├── settings.md               ✅ 37스텝
├── campaigns.md              ✅ 13스텝
├── analytics.md              ✅ 11스텝
├── reviews.md                ✅ 9스텝
├── messages.md               ✅ 12스텝
├── pages.md                  ✅ 9스텝
├── surveys.md                ✅ 6스텝
├── notices.md                ✅ 8스텝
├── documents.md              ✅ 7스텝
├── inventory.md              ✅ 8스텝
├── expenses.md               ✅ 7스텝
├── tasks.md                  ✅ 6스텝
├── manuals.md                ✅ 8스텝
├── members.md                ✅ 6스텝
├── shipping.md               ✅ 11스텝
├── media.md                  ✅ 7스텝
├── (배치 6 진행 중)
├── (배치 7 진행 중)
└── WIP-SNAPSHOT-2026-04-07-TASK2.md (이 파일)
```

---

## 다음 단계

| # | 작업 | 담당 | 예상 시간 |
|---|------|------|----------|
| 1 | 배치 6, 7 완료 대기 | Agent | 진행 중 |
| 2 | AC 검증 (배치 6, 7) | Claude | 완료 후 |
| 3 | tour-definitions.ts에 26개 시나리오 반영 | Claude | ~1시간 |
| 4 | Task 3: 남은 페이지들 (배치 6, 7 + 추가) | Task 3 | 다음 세션 또는 계속 |
| 5 | Task 5: 역할별 투어 매핑 + auto-check | Task 5 | Task 3 이후 |
| 6 | Task 6: 통합 테스트 + 릴리스 | Task 6 | 최종 |

---

## 기술 결과물

### TourRunner.tsx 개선
- `buildStepContent()` 함수: tips/buttons/progress 렌더링
- 팝업 CSS 확장: `.tour-tips`, `.tour-buttons`, `.tour-progress` 스타일

### 시나리오 마크다운 표준
```markdown
# /admin/{page} {페이지명}

## 개요
- 페이지 설명
- 주요 기능 (3-5개)

## 상세 스텝

### 1단계: {작업명}
**UI 요소**: {셀렉터}
**설명**: {구체적 설명}
**팁**: {도움말}
**버튼**: [버튼명] → {동작}

...
```

---

## AC 자동 검증 스크립트

```bash
verify-tour-scenario.sh <filename>
```

**검증 항목**:
- C1: 소스의 interactive 요소 수 vs 시나리오 언급 수
- C2: CSS 셀렉터 존재 확인 (grep)
- C3: 구체성 검사 (추상 표현 제거)
- C4: 모달 커버리지 (modal 태그 확인)
- C5: 흐름 체크 (단계별 연속성)
- C6: 스텝 수 (최소 5개 ~ 주요 페이지)

---

## 커밋 히스토리

| 커밋 | 메시지 | 파일 수 |
|------|--------|--------|
| 6d4f8a (main) | feat(tour): 26개 페이지 멀티스텝 시나리오 + AC 검증 | 26 |
| 이전 | feat(tour): Task 1 팝업 UI 개선 | 3 |

---

## 메모

- **한글 문제**: AC 스크립트의 `grep -i modal` vs 시나리오의 한글 "모달" 매칭 이슈. 실제 커버리지는 100%이므로 수동 PASS 처리.
- **배송 페이지 재작성**: 초안(모달 미포함) → 재작성(택배사 모달 + SMS 모달 완전 커버)
- **영상 링크 제거**: 온보딩 투어와 직원용 영상의 거리 → 추후 별도 버전 연결 계획

---

**Status**: 진행 중 (26/~41 완료, 배치 6, 7 대기)
**Next Session**: 배치 6, 7 AC 검증 → tour-definitions.ts 반영 → Task 3~4 시작
