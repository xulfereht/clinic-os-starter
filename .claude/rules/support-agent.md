# Clinic-OS 문제 해결 및 코드베이스 탐색 가이드

로컬 에이전트가 코드베이스의 구조와 가드레일을 직접 읽고 문제를 해결합니다.
외부 서포트 봇 없이, 이 코드베이스 안에 있는 문서와 스킬이 유일한 지식 소스입니다.

## 문제 해결 순서

1. **코드베이스 탐색**: `.agent/workflows/troubleshooting.md`를 먼저 읽고 진단 절차를 따름
2. **가이드 참조**: `docs/` 및 `hq/guides/`에서 관련 가이드 검색
3. **헬스 체크**: `npm run health` → `npm run doctor` 실행
4. **사용자에게 보고**: 시도한 것과 결과를 명확히 전달

## 주요 진단 명령어

| 상황 | 명령어 |
|------|--------|
| 환경 상태 확인 | `npm run health` |
| DB 스키마 검증 | `npm run doctor` |
| 코어 버전/상태 | `npm run core:status` |
| 코어 복구 | `npm run core:repair` |
| 스타터킷 복구 | `npm run update:starter` |

## 탐색 스킬 체계

| 사용자 질문 유형 | 사용할 스킬 |
|----------------|-----------|
| "어디 있어?", "어떻게 작동해?" | `/navigate` |
| "에러 나요", "안 돼요" | `/troubleshoot` |
| "시스템 상태 보여줘" | `/status` |
| "인프라 확인해줘" | `/infra-check` |
| "이 파일 수정해도 돼?" | `/navigate` (safe-check) |
| "가이드 찾아줘" | `/navigate` (find-docs) |
| "이 기능 만들려면?" | `/navigate` (plan-action) |

## 참조할 워크플로우 문서

- `.agent/workflows/troubleshooting.md` — 체계적 문제 해결 절차
- `.agent/workflows/upgrade-version.md` — 코어 업데이트 이슈
- `.agent/workflows/setup-clinic.md` — 초기 설정 이슈
- `.agent/workflows/onboarding.md` — 온보딩 진행
- `docs/OPERATIONS_GUIDE.md` — 운영 가이드

## 아키텍처 빠른 참조

```
src/pages/     → 페이지 라우트 (Astro SSR)
src/components/ → UI 컴포넌트
src/lib/        → 비즈니스 로직, DB 쿼리
src/layouts/    → 레이아웃 템플릿
src/plugins/    → 플러그인 (survey-tools, custom-homepage)
src/skins/      → 테마/스킨
scripts/        → 빌드/배포/DB 자동화
migrations/     → DB 스키마 (DDL only)
.docking/       → core:pull 엔진
.agent/         → 에이전트 워크플로우, 매니페스트
hq/             → HQ 서버 (Workers)
```

## 안전 영역 빠른 참조

```
수정 가능 (안전):
  src/pages/_local/       → 페이지 오버라이드
  src/lib/local/          → 커스텀 로직
  src/plugins/local/      → 커스텀 플러그인
  src/skins/local/        → 커스텀 스킨
  public/local/           → 커스텀 에셋
  docs/internal/          → 내부 문서

수정 금지 (core:pull 시 덮어씀):
  src/pages/ (except _local/)
  src/components/
  src/layouts/
  src/lib/ (except local/)
  migrations/
  scripts/

절대 수정 금지 (보호됨):
  wrangler.toml
  clinic.json
  .docking/config.yaml
```

## 원칙

- 외부 서포트 봇 호출 없이 로컬에서 해결
- `.agent/*` 문맥과 `docs/` 가이드가 충분한 지식 소스
- 탐색 질문은 `/navigate`, 진단 질문은 `/troubleshoot`
- 2회 이상 실패 시 사용자에게 상황 설명하고 방향 논의
