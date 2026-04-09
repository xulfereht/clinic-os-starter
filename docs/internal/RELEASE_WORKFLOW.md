# Clinic-OS Release Workflow

> 릴리스 구조, 명령어, 검증 기준의 SoT.
> 마지막 업데이트: 2026-03-24

## 릴리스 도구 체계

| 도구 | 용도 | 명령 |
|------|------|------|
| **total-release.js** | **표준 릴리스 경로** (원클릭) | `npm run publish` |
| release-modular.js | 디버깅/dry-run 전용 (deprecated) | `node scripts/release-modular.js` |
| release-verify.js | 릴리스 정합성 검증 | `npm run release:verify` |
| release-pipeline-audit.js | HQ/client 배포 상태 감사 | `npm run release:pipeline:audit` |
| mirror-core.js | core → clinic-os-core 미러 | `npm run core:push` |
| clinic-release.js | 운영 상태/리포트 | `npm run release:ops` |

## 표준 릴리스 플로우

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ 1. Core     │────>│ 2. Mirror    │────>│ 3. Client       │
│ npm run     │     │ (자동)       │     │ core:pull       │
│ publish     │     │              │     │ + deploy        │
└─────────────┘     └──────────────┘     └─────────────────┘
       │                                         │
       └──── npm run release:verify ─────────────┘
```

### Phase 0. 사전 점검

```bash
git status --short                  # 커밋 안 된 변경 없어야 함
npm run release:verify              # 이전 릴리스 정합성 확인
```

확인할 것:
- `.agent/release.lock` 없음
- `release-modular-state.json` 이 IDLE 또는 비어있음
- package.json 버전 = 최신 git tag

### Phase 1. Core 릴리스

```bash
npm run publish                     # patch (기본)
npm run publish -- --minor          # minor
npm run publish -- --major          # major
```

이 명령 하나로 실행되는 것:
1. Preflight (빌드 검증 + 건강 점수)
2. Version bump (package.json + .core/version)
3. Git commit + tag + push
4. Starter kit mirror
5. Starter kit 생성 + Core mirror (병렬)
6. HQ deploy (D1 마이그레이션 + Pages)
7. HQ distribution (R2 업로드 + 채널 등록)

실패 시 자동 롤백:
- package.json/`.core/version` 원복
- 로컬 tag 삭제
- modular state 리셋

### Phase 2. 릴리스 검증

```bash
npm run release:verify              # 최대 9개 항목 체크
```

| 체크 항목 | 설명 |
|-----------|------|
| Tag match | package.json 버전 = 최신 git tag |
| Origin push | tag가 origin에 push됨 |
| Mirror sync | clinic-os-core에 같은 tag |
| latest-stable | 올바른 버전 가리킴 |
| Release lock | 잔재 없음 |
| Modular state | 깨끗함 |
| .core/version | 일치 |
| Starter sync | starter-staging 동기화 |
| HQ version | HQ stable 채널 버전 일치 (네트워크, optional) |

문제 발견 시:
```bash
npm run release:verify:fix          # 자동 수복
```

### Phase 3. 클라이언트 동기화 (백록담)

```bash
cd ~/projects/baekrokdam-clinic

# 코어 업데이트
npm run core:pull                   # stable 채널 (기본)
npm run core:pull -- v1.30.2        # 특정 버전 지정
npm run core:pull -- --auto         # 자동 모드 (확인 스킵)

# 배포
npm run deploy -- --yes --skip-secrets
```

### Phase 4. 최종 확인

```bash
npm run release:pipeline:audit      # 전체 파이프라인 상태
npm run release:ops:report          # 운영 리포트
```

## 장애 복구

### 릴리스 중간에 끊겼을 때

```bash
npm run release:verify:fix          # tag/state 자동 수복
```

### modular state가 꼬였을 때

```bash
node scripts/release-modular.js reset
# 또는
npm run release:verify:fix
```

### core mirror만 실패했을 때

```bash
npm run core:push                   # beta 채널
npm run core:push -- --stable       # stable 채널
```

### 클라이언트 core:pull 실패

```bash
npm run core:rollback               # 이전 상태 복구
npm run core:pull -- --force        # 강제 동기화
```

## 버전 규칙

- **patch**: 버그 수정, 문서, 소규모 기능 (기본)
- **minor**: 새 기능, 마이그레이션 포함 변경
- **major**: 브레이킹 체인지
- patch 9 초과 시 자동 minor 전환 (1.1.9 → 1.2.0)

## 채널 시스템

```
npm run publish                → beta 채널 (latest-beta 태그)
npm run publish -- --stable    → stable 채널 직접 배포
                               → 또는 HQ Admin에서 수동 승격
```

클라이언트는 기본적으로 **stable 채널**에서 pull.
