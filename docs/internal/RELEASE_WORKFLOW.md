# Clinic-OS Release Workflow

이 문서는 릴리스 구조 설명용 요약본입니다.  
실제 운영 순서와 검증 기준은 아래 체크리스트를 SoT로 사용합니다.

- [RELEASE_PIPELINE_CHECKLIST.md](/Users/amu/projects/clinic-os/docs/internal/RELEASE_PIPELINE_CHECKLIST.md)
- [clinic-release.md](/Users/amu/projects/clinic-os/.claude/commands/clinic-release.md)
- [2026-03-08-release-hardening-audit.md](/Users/amu/projects/clinic-os/docs/internal/audits/2026-03-08-release-hardening-audit.md)

## 현재 구조

릴리스는 아래 체인으로 닫혀야 합니다.

1. `master`
2. `HQ deploy`
3. `starter artifact / starter-files publish`
4. `client update-starter`
5. `client core sync`
6. `client build`
7. `client deploy`
8. `stable promote`

## 핵심 원칙

- HQ 배포가 starter publish보다 먼저여야 합니다.
- `starter`와 `core`는 같이 봐야 합니다.
- client 배포 검증은 단순 `200 OK`가 아니라 실제 Production deployment source까지 확인해야 합니다.
- 릴리스 완료 기준은 `npm run release:pipeline:audit -- --json` 전체 `PASS`입니다.

## 표준 명령

```bash
# HQ 최신 코드 배포
npm run deploy --prefix hq

# starter artifact + HQ beta 등록
node scripts/publish-release.js

# 운영 요약/리포트
npm run release:ops
npm run release:ops:report

# client starter bootstrap
node scripts/update-starter.js

# client starter + core 묶음 업데이트
node scripts/update-starter-core.js --beta

# client 배포 preflight
node scripts/deploy-guard.js --non-interactive

# client 실제 배포
node scripts/deploy-guard.js --non-interactive --yes

# 최종 검증
npm run release:pipeline:audit -- --json
```
