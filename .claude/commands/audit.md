감사 보고서를 자동 생성합니다.

## 절차

1. `docs/audits/` 디렉토리의 기존 감사 이력을 읽어 현재 상태를 파악하세요.
2. `docs/audits/IMPROVEMENT-TRACKER.md`에서 미완료 항목을 확인하세요.

3. 다음 패턴으로 개인정보 잔존 여부를 스캔하세요:
   - `최연승`, `김지혜`, `BRD`, `yeonseung`, `moai` (대소문자 무시)
   - 검색 대상: `src/`, `seeds/`, `public/`, `docs/`
   - 제외: `node_modules/`, `.git/`, `dist/`

4. `.docking/engine/fetch.js`에서 CORE_PATHS, PROTECTED_EXACT, LOCAL_PREFIXES를 추출하고,
   `.claude/rules/clinic-os-safety.md` 및 `GEMINI.md`의 보호 목록과 비교하세요.
   불일치가 있으면 발견사항으로 기록하세요.

5. 새 감사 보고서를 `docs/audits/YYYY-MM-DD-{topic}-audit.md` 형식으로 생성하세요:
   - YAML frontmatter: date, auditor, scope, status
   - 발견사항을 CRITICAL/HIGH/MEDIUM/LOW로 분류
   - 각 항목에 해결 상태 표시

6. `docs/audits/README.md` 인덱스 테이블에 새 보고서 링크를 추가하세요.

7. `docs/audits/IMPROVEMENT-TRACKER.md`를 업데이트하세요:
   - 해결된 항목은 `[x]`로 변경
   - 새로 발견된 항목 추가

## 출력

감사 결과 요약을 한국어로 출력하세요:
- 발견 항목 수 (심각도별)
- 이전 감사 대비 개선/악화 현황
- 다음 조치 권고
