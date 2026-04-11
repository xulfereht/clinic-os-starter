---
id: SPEC-PLUGIN-SYSTEM-001
document: acceptance
version: "1.0.0"
status: planned
created: 2026-02-10
updated: 2026-02-10
---

# SPEC-PLUGIN-SYSTEM-001: 수용 기준

---

## AC-001: 로컬 플러그인 탐지 API (REQ-001)

### Scenario 1: 유효한 로컬 플러그인 목록 반환

```gherkin
Given src/plugins/local/ 디렉토리에 manifest.json을 포함한 플러그인 "my-plugin"이 존재할 때
  And 관리자가 admin 세션으로 인증된 상태일 때
When GET /api/plugins/local 요청을 보내면
Then 응답 상태 코드는 200이어야 한다
  And 응답 본문에 "my-plugin"의 manifest 정보가 포함되어야 한다
  And 각 플러그인에 id, name, version, description, files, totalSize 필드가 있어야 한다
```

### Scenario 2: manifest 없는 디렉토리 제외

```gherkin
Given src/plugins/local/ 에 manifest.json이 없는 디렉토리 "broken-plugin"이 존재할 때
When GET /api/plugins/local 요청을 보내면
Then 응답 목록에 "broken-plugin"은 포함되지 않아야 한다
  Or "broken-plugin"이 invalid: true 상태로 표시되어야 한다
```

### Scenario 3: 빈 local 디렉토리

```gherkin
Given src/plugins/local/ 디렉토리에 플러그인이 없을 때
When GET /api/plugins/local 요청을 보내면
Then 응답 상태 코드는 200이어야 한다
  And 응답 본문의 plugins 배열은 빈 배열이어야 한다
```

### Scenario 4: 비인증 접근 차단

```gherkin
Given admin 세션이 없는 상태일 때
When GET /api/plugins/local 요청을 보내면
Then 응답 상태 코드는 401이어야 한다
```

---

## AC-002: 자동 패키징 및 HQ 제출 (REQ-002)

### Scenario 1: 유효한 플러그인 제출 성공

```gherkin
Given src/plugins/local/my-plugin/ 에 유효한 manifest.json과 index.ts가 존재할 때
  And 관리자가 인증된 상태이고 유효한 라이선스 키가 있을 때
When POST /api/plugins/submit 에 { "pluginId": "my-plugin" }을 전송하면
Then 시스템은 manifest 유효성을 검증해야 한다
  And 시스템은 플러그인 파일을 zip으로 패키징해야 한다
  And 시스템은 zip을 base64 인코딩하여 HQ에 전송해야 한다
  And 응답 상태 코드는 200이어야 한다
  And 응답에 submissionId가 포함되어야 한다
```

### Scenario 2: manifest 검증 실패

```gherkin
Given src/plugins/local/bad-plugin/manifest.json에 "name" 필드가 누락되어 있을 때
When POST /api/plugins/submit 에 { "pluginId": "bad-plugin" }을 전송하면
Then 응답 상태 코드는 400이어야 한다
  And 응답에 구체적인 오류 메시지 "Missing required field: name"이 포함되어야 한다
  And HQ에 제출 요청이 전송되지 않아야 한다
```

### Scenario 3: 존재하지 않는 플러그인 제출 시도

```gherkin
Given src/plugins/local/nonexistent/ 디렉토리가 존재하지 않을 때
When POST /api/plugins/submit 에 { "pluginId": "nonexistent" }을 전송하면
Then 응답 상태 코드는 404이어야 한다
  And 응답에 "Plugin not found" 메시지가 포함되어야 한다
```

### Scenario 4: 라이선스 키 없음

```gherkin
Given 유효한 라이선스 키가 등록되지 않은 상태일 때
When POST /api/plugins/submit 에 유효한 pluginId를 전송하면
Then 응답 상태 코드는 401이어야 한다
  And 응답에 라이선스 등록 안내 메시지가 포함되어야 한다
```

---

## AC-003: 설치 상태가 포함된 플러그인 스토어 (REQ-003)

### Scenario 1: 설치 상태 정확한 표시

```gherkin
Given HQ 카탈로그에 플러그인 A(v1.0), B(v2.0), C(v1.0)이 있을 때
  And 로컬에 A(v1.0)이 설치되어 있고, B(v1.0)이 설치되어 있을 때
When 관리자가 스토어 페이지에 접근하면
Then 플러그인 A는 "설치됨" 배지를 표시해야 한다
  And 플러그인 B는 "업데이트 가능" 배지를 표시해야 한다
  And 플러그인 C는 "설치" 버튼을 표시해야 한다
```

### Scenario 2: 플러그인 상세 정보 표시

```gherkin
Given 스토어 페이지에 플러그인 목록이 표시되어 있을 때
When 관리자가 특정 플러그인을 클릭하면
Then 상세 모달 또는 상세 페이지가 표시되어야 한다
  And 설명, 권한 요청 목록, 버전 이력이 포함되어야 한다
  And 현재 설치 상태에 따른 액션 버튼(설치/업데이트/설치됨)이 표시되어야 한다
```

### Scenario 3: HQ 접근 불가 시 graceful 처리

```gherkin
Given HQ API가 응답하지 않을 때
When 관리자가 스토어 페이지에 접근하면
Then 적절한 오류 메시지 "스토어에 연결할 수 없습니다"가 표시되어야 한다
  And 페이지가 크래시하지 않아야 한다
```

---

## AC-004: 번들 다운로드 및 파일 추출 (REQ-004)

### Scenario 1: 성공적인 플러그인 설치

```gherkin
Given HQ에 유효한 플러그인 "analytics-pro" v1.0이 있을 때
  And 관리자가 인증되고 라이선스가 유효할 때
  And 개발 서버(dev mode)에서 실행 중일 때
When POST /api/plugins/install 에 { "pluginId": "analytics-pro" }을 전송하면
Then 시스템은 HQ에서 zip 번들을 다운로드해야 한다
  And SHA-256 체크섬을 검증해야 한다
  And src/plugins/local/analytics-pro/ 디렉토리에 파일을 추출해야 한다
  And installed_plugins 테이블에 메타데이터를 저장해야 한다
  And 상태를 "installed_pending_rebuild"로 설정해야 한다
  And 응답에 { success: true, requiresRebuild: true }가 포함되어야 한다
```

### Scenario 2: 체크섬 불일치

```gherkin
Given 다운로드된 zip의 체크섬이 HQ가 제공한 packageHash와 다를 때
When 설치 프로세스가 체크섬을 검증하면
Then 설치를 중단해야 한다
  And 추출된 파일이 있다면 롤백해야 한다
  And 응답에 "Checksum verification failed" 오류가 포함되어야 한다
```

### Scenario 3: 기존 플러그인 덮어쓰기

```gherkin
Given src/plugins/local/analytics-pro/ 에 기존 v1.0 파일이 있을 때
When 같은 플러그인의 v2.0을 설치하면
Then 시스템은 기존 파일을 백업해야 한다
  And 새 버전의 파일로 교체해야 한다
  And installed_plugins의 버전 정보를 갱신해야 한다
```

### Scenario 4: 경로 순회 방어

```gherkin
Given 다운로드된 zip에 "../../etc/passwd" 같은 악의적 경로가 포함되어 있을 때
When 시스템이 파일을 추출하면
Then 대상 디렉토리 외부의 경로는 무시 또는 거부해야 한다
  And 보안 위반 로그를 기록해야 한다
```

### Scenario 5: 프로덕션 환경에서 설치 시도

```gherkin
Given 프로덕션 환경(import.meta.env.DEV === false)에서 실행 중일 때
When POST /api/plugins/install 에 파일 추출을 요청하면
Then 응답 상태 코드는 403이어야 한다
  And "Plugin file operations are only available in development mode" 메시지를 반환해야 한다
```

---

## AC-005: 설치 후 리빌드 알림 (REQ-005)

### Scenario 1: 리빌드 필요 알림 표시

```gherkin
Given 플러그인이 설치되어 상태가 "installed_pending_rebuild"일 때
When 관리자가 Admin 대시보드 또는 플러그인 관리 페이지에 접근하면
Then "N개의 플러그인이 리빌드를 기다리고 있습니다" 배너가 표시되어야 한다
  And "리빌드 실행" 버튼이 포함되어야 한다
```

### Scenario 2: 리빌드 성공

```gherkin
Given "installed_pending_rebuild" 상태의 플러그인이 있을 때
When 관리자가 "리빌드 실행" 버튼을 클릭하면
Then 시스템은 astro build 프로세스를 시작해야 한다
  And 플러그인 상태를 "building"으로 변경해야 한다
  And 빌드 진행 상태를 폴링으로 확인할 수 있어야 한다
  And 빌드 성공 시 상태를 "active"로 변경해야 한다
  And 리빌드 배너가 사라져야 한다
```

### Scenario 3: 리빌드 실패

```gherkin
Given 리빌드가 진행 중일 때
  And 빌드 오류가 발생한 경우
When 빌드 프로세스가 종료되면
Then 플러그인 상태를 "build_failed"로 변경해야 한다
  And 오류 로그를 Admin UI에 표시해야 한다
  And "재시도" 버튼이 표시되어야 한다
```

### Scenario 4: 리빌드 중 중복 실행 방지

```gherkin
Given 리빌드가 이미 진행 중일 때 (상태: "building")
When 관리자가 다시 "리빌드 실행"을 요청하면
Then 시스템은 "이미 리빌드가 진행 중입니다" 메시지를 반환해야 한다
  And 새로운 빌드 프로세스를 시작하지 않아야 한다
```

---

## AC-006: 플러그인 마이그레이션 시스템 (REQ-006)

### Scenario 1: 마이그레이션 파일 순차 실행

```gherkin
Given src/plugins/local/my-plugin/migrations/ 에 다음 파일이 있을 때:
  - 0001_create_table.sql
  - 0002_add_column.sql
  And 아직 실행된 마이그레이션이 없을 때
When POST /api/plugins/migrate 에 { "pluginId": "my-plugin" }을 전송하면
Then 0001_create_table.sql이 먼저 실행되어야 한다
  And 0002_add_column.sql이 그 다음 실행되어야 한다
  And plugin_migrations_local 테이블에 두 레코드가 생성되어야 한다
  And 응답에 실행된 마이그레이션 목록이 포함되어야 한다
```

### Scenario 2: 이미 실행된 마이그레이션 스킵

```gherkin
Given 0001_create_table.sql이 이미 실행된 상태일 때
When POST /api/plugins/migrate 에 { "pluginId": "my-plugin" }을 전송하면
Then 0001_create_table.sql은 스킵되어야 한다
  And 0002_add_column.sql만 실행되어야 한다
```

### Scenario 3: 마이그레이션 실행 중 오류

```gherkin
Given 0002_add_column.sql에 문법 오류가 있을 때
When 마이그레이션을 실행하면
Then 0001은 성공으로 기록되어야 한다
  And 0002는 "failed" 상태와 에러 메시지로 기록되어야 한다
  And 응답에 실패 정보가 포함되어야 한다
```

### Scenario 4: migrations 디렉토리 없음

```gherkin
Given 플러그인에 migrations/ 디렉토리가 없을 때
When POST /api/plugins/migrate 를 요청하면
Then 응답은 { migrationsFound: 0, executed: 0 }이어야 한다
  And 오류가 발생하지 않아야 한다
```

---

## AC-007: SDK 위반 보고 (REQ-007)

### Scenario 1: 권한 위반 자동 보고

```gherkin
Given 플러그인 "shady-plugin"이 "patients:read" 권한 없이 환자 API에 접근할 때
When SDK가 권한 위반을 감지하면
Then HQ 위반 보고 API에 비동기 보고가 전송되어야 한다
  And 보고에 pluginId, violation type, timestamp가 포함되어야 한다
  And 플러그인의 해당 API 호출은 차단되어야 한다
```

### Scenario 2: 위반 임계값 초과 시 자동 비활성화

```gherkin
Given 플러그인 "shady-plugin"의 위반 횟수가 설정된 임계값(기본 10회)을 초과했을 때
When 새로운 위반이 감지되면
Then 시스템은 해당 플러그인을 자동으로 비활성화해야 한다
  And installed_plugins.status를 "disabled"로 변경해야 한다
  And 관리자에게 비활성화 알림을 표시해야 한다
```

### Scenario 3: HQ 보고 실패 시 기능 유지

```gherkin
Given HQ API가 응답하지 않을 때
When SDK가 위반을 보고하려 하면
Then 위반 보고 실패가 로컬 큐에 저장되어야 한다
  And 플러그인의 정상 기능은 영향받지 않아야 한다 (위반된 API 호출만 차단)
  And 다음 기회에 큐의 보고를 재전송해야 한다
```

### Scenario 4: violations.astro 대시보드 연동

```gherkin
Given 로컬에서 위반 이벤트가 기록되었을 때
When 관리자가 violations.astro 대시보드에 접근하면
Then 로컬 위반 이력이 목록에 표시되어야 한다
  And 각 위반에 플러그인명, 위반 유형, 발생 시각, HQ 보고 상태가 포함되어야 한다
```

---

## 통합 테스트 시나리오

### E2E-001: 전체 설치 플로우

```gherkin
Given HQ에 승인된 플러그인 "clinic-analytics" v1.0이 있을 때
  And 관리자가 인증되고 개발 서버에서 실행 중일 때
When 관리자가 스토어 페이지에서 "clinic-analytics"의 "설치" 버튼을 클릭하면
Then 다운로드 진행 상태가 표시되어야 한다
  And 파일이 src/plugins/local/clinic-analytics/에 추출되어야 한다
  And "리빌드 필요" 알림이 표시되어야 한다
When 관리자가 "리빌드 실행"을 클릭하면
Then 빌드가 시작되고 완료 후 플러그인이 "활성" 상태가 되어야 한다
  And 스토어 페이지에서 "설치됨" 배지로 변경되어야 한다
```

### E2E-002: 전체 제출 플로우

```gherkin
Given AI 에이전트가 src/plugins/local/my-survey/에 플러그인을 개발했을 때
  And manifest.json, index.ts, pages/survey.astro 파일이 있을 때
When 관리자가 플러그인 관리 탭에서 "my-survey"의 "HQ에 제출" 버튼을 클릭하면
Then manifest 유효성 검증이 수행되어야 한다
  And 파일이 zip으로 패키징되어야 한다
  And HQ에 제출이 완료되어야 한다
  And "제출 완료 - 리뷰 대기 중" 상태가 표시되어야 한다
```

### E2E-003: 설치 + 마이그레이션 플로우

```gherkin
Given HQ에 DB 마이그레이션이 포함된 플러그인 "appointment-ext" v1.0이 있을 때
  And migrations/0001_create_appointments_ext.sql 파일이 포함되어 있을 때
When 관리자가 설치를 완료하면
Then "이 플러그인은 데이터베이스 마이그레이션이 필요합니다" 프롬프트가 표시되어야 한다
When 관리자가 "마이그레이션 실행"을 클릭하면
Then SQL이 로컬 D1에 실행되어야 한다
  And 마이그레이션 결과가 표시되어야 한다
  And 리빌드 안내로 이동해야 한다
```

---

## 엣지 케이스 시나리오

### Edge-001: 대용량 플러그인 설치

```gherkin
Given 플러그인 zip 크기가 10MB 이상일 때
When 설치를 시도하면
Then 다운로드 진행 상태가 퍼센트로 표시되어야 한다
  And 타임아웃이 적절히 설정되어야 한다 (최소 60초)
```

### Edge-002: 네트워크 중단 시 설치

```gherkin
Given 플러그인 다운로드 중 네트워크가 끊겼을 때
When 연결이 복구된 후
Then 부분 추출된 파일이 정리되어야 한다
  And 사용자에게 재시도 옵션이 제공되어야 한다
```

### Edge-003: 동일 플러그인 동시 설치 시도

```gherkin
Given 두 개의 Admin 세션에서 동시에 같은 플러그인을 설치할 때
When 두 번째 설치 요청이 도착하면
Then 이미 설치가 진행 중임을 알리고 대기 또는 거부해야 한다
```

### Edge-004: 빌드 중 새 플러그인 설치

```gherkin
Given 리빌드가 진행 중일 때 (상태: building)
When 새 플러그인을 설치하면
Then 파일 추출은 정상 진행되어야 한다
  And 상태는 "installed_pending_rebuild"로 설정되어야 한다
  And 현재 빌드에는 포함되지 않음을 안내해야 한다
  And 현재 빌드 완료 후 재빌드 안내가 표시되어야 한다
```

---

## Quality Gate 기준

### Definition of Done

- [ ] 모든 AC 시나리오가 수동 또는 자동 테스트로 검증됨
- [ ] 새로 생성된 API 엔드포인트에 인증 체크가 포함됨
- [ ] 파일시스템 접근 시 경로 검증이 수행됨
- [ ] 에러 응답이 일관된 형식 `{ error: string }` 을 따름
- [ ] TypeScript 타입 오류 없음 (astro check 통과)
- [ ] 기존 install.ts, toggle.ts, uninstall.ts API 동작이 변경되지 않음 (하위 호환)
- [ ] Admin UI 컴포넌트가 반응형으로 동작함 (모바일/데스크톱)
- [ ] HQ API 호출 실패 시 graceful degradation이 구현됨
