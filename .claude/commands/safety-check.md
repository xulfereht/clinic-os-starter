보호 규칙 동기화 상태를 점검합니다.

## SOT (Single Source of Truth)

`.docking/protection-manifest.yaml`

## 절차

1. `.docking/protection-manifest.yaml` (SOT)을 읽으세요.

2. 각 소비자 파일에서 실제 경로를 추출하세요:
   - `.docking/engine/fetch.js`: CORE_PATHS, LOCAL_PREFIXES, PROTECTED_EXACT, PROTECTED_PREFIXES, SPECIAL_MERGE_FILES
   - `.claude/rules/clinic-os-safety.md`: HARD 규칙 경로 목록
   - `.claude/settings.json`: deny/allow 규칙
   - `GEMINI.md`: 금지 규칙 + 파일 보호 테이블

3. SOT와 각 소비자를 비교하여 불일치를 보고하세요:

### 비교 매트릭스

| 비교 항목 | SOT 키 | 소비자 |
|-----------|--------|--------|
| 코어 경로 | `core_paths` | fetch.js fallback CORE_PATHS |
| 코어 경로 | `core_paths` | safety.md HARD 규칙 |
| 코어 경로 | `core_paths` | settings.json deny |
| 코어 경로 | `core_paths` | GEMINI.md 금지 규칙 |
| 보호 파일 | `protected_exact` | fetch.js fallback PROTECTED_EXACT |
| 보호 파일 | `protected_exact` | safety.md 보호 설정 |
| 로컬 경로 | `local_prefixes` | fetch.js fallback LOCAL_PREFIXES |
| 로컬 경로 | `local_prefixes` | safety.md local/ 규칙 |
| 로컬 경로 | `local_prefixes` | settings.json allow |

4. 자동 생성 파일 상태 확인:
   - `scripts/generate-protection-docs.js` 실행하면 safety.md와 settings.json이 매니페스트에서 재생성됨
   - 수동 편집 흔적이 있으면 경고

## 출력

한국어로 동기화 리포트를 출력하세요:
- 일치/불일치 항목 수
- 불일치 세부사항 (어디에 무엇이 빠져있는지)
- 수정 제안: 매니페스트가 SOT이므로 소비자를 수정하거나 `node scripts/generate-protection-docs.js` 실행 제안

모든 소스가 일치하면: "모든 보호 규칙이 매니페스트(SOT)와 동기화되어 있습니다." 출력
