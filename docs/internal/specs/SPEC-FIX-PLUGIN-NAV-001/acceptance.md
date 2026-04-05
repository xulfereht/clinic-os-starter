---
id: SPEC-FIX-PLUGIN-NAV-001
document: acceptance
version: 1.0.0
created: 2026-02-11
updated: 2026-02-11
---

# SPEC-FIX-PLUGIN-NAV-001: 수락 기준

## 1. REQ-001: 스토어 상세 링크 수정 [CRITICAL]

### Scenario 1.1: 스토어에서 플러그인 상세 페이지로 이동

```gherkin
Given 사용자가 /admin/plugins/store 페이지에 있다
And 설치 가능한 플러그인 목록이 표시되어 있다
When 사용자가 플러그인 카드를 클릭한다
Then 브라우저는 /admin/hub/{pluginId} 경로로 이동한다
And 해당 플러그인의 상세 정보/문서가 표시된다
```

### Scenario 1.2: 스토어 상세 링크가 유효한 경로를 가리킨다

```gherkin
Given 스토어 페이지의 HTML이 렌더링되었다
When 모든 플러그인 카드의 href 속성을 검사한다
Then 어떤 링크도 /admin/plugins/store/ 하위 경로를 포함하지 않는다
And 모든 상세 링크는 /admin/hub/{pluginId} 패턴을 따른다
```

### Scenario 1.3: 존재하지 않는 플러그인 ID로 접근

```gherkin
Given 사용자가 /admin/hub/non-existent-plugin-id 경로에 접근한다
When 해당 pluginId에 대한 플러그인 데이터가 없다
Then 시스템은 적절한 에러 메시지 또는 404 페이지를 표시한다
And 사용자가 /admin/plugins로 돌아갈 수 있는 링크를 제공한다
```

---

## 2. REQ-002: 스토어 뒤로가기 내비게이션 [HIGH]

### Scenario 2.1: 뒤로가기 링크 존재 확인

```gherkin
Given 사용자가 /admin/plugins/store 페이지에 있다
When 페이지 상단 영역을 확인한다
Then /admin/plugins로 이동하는 뒤로가기 링크 또는 브레드크럼이 표시된다
And 해당 링크에 적절한 텍스트 레이블이 있다
```

### Scenario 2.2: 뒤로가기 링크 클릭 시 이동

```gherkin
Given 사용자가 /admin/plugins/store 페이지에 있다
When 뒤로가기 링크를 클릭한다
Then 브라우저는 /admin/plugins 페이지로 이동한다
And 플러그인 관리 대시보드가 정상적으로 표시된다
```

---

## 3. REQ-003: 허브 뒤로가기 링크 수정 [HIGH]

### Scenario 3.1: 허브에서 플러그인 관리로 이동

```gherkin
Given 사용자가 /admin/hub/{pluginId} 페이지에 있다
And "기능 허브" 뒤로가기 링크가 표시되어 있다
When 사용자가 해당 뒤로가기 링크를 클릭한다
Then 브라우저는 /admin/plugins 페이지로 이동한다
And /admin/hub 경로로 이동하지 않는다
```

### Scenario 3.2: 뒤로가기 링크 href 검증

```gherkin
Given 허브 상세 페이지의 HTML이 렌더링되었다
When 뒤로가기 링크의 href 속성을 검사한다
Then href 값은 /admin/plugins 이다
And /admin/hub (경로 파라미터 없이)를 가리키지 않는다
```

---

## 4. REQ-004: 리뷰 페이지 API 엔드포인트 [MEDIUM]

### Scenario 4.1: 플러그인 승인 요청 성공

```gherkin
Given 관리자가 /admin/plugins/review 페이지에 있다
And 리뷰 대기 중인 플러그인이 있다
When 관리자가 플러그인을 "승인" 처리한다
Then API 요청이 유효한 엔드포인트로 전송된다
And 성공 응답을 받으면 플러그인 상태가 "승인됨"으로 변경된다
And 적절한 성공 피드백이 사용자에게 표시된다
```

### Scenario 4.2: API 엔드포인트 오류 처리

```gherkin
Given 관리자가 플러그인 리뷰 작업을 수행한다
When API 요청이 실패한다 (네트워크 오류 또는 서버 오류)
Then 사용자에게 에러 메시지가 표시된다
And 페이지 데이터가 손상되지 않는다
And 사용자가 재시도할 수 있는 옵션이 제공된다
```

---

## 5. REQ-005: 개발자 제출 링크 수정 [MEDIUM]

### Scenario 5.1: 개발자 제출 버튼 클릭

```gherkin
Given 개발자가 /admin/plugins/developer 페이지에 있다
When "플러그인 제출" 버튼을 클릭한다
Then 시스템은 유효한 제출 페이지 또는 폼으로 이동/표시한다
And 404 에러가 발생하지 않는다
```

### Scenario 5.2: 제출 페이지 접근 가능 확인

```gherkin
Given 개발자 포털 페이지의 HTML이 렌더링되었다
When 제출 관련 링크의 href를 검사한다
Then /admin/plugins/developer/submit 경로를 참조하지 않는다
And 유효한 대상 경로(HQ URL 또는 인라인 폼 트리거)를 가리킨다
```

---

## 6. REQ-006: 레거시 run 경로 리다이렉트 [LOW]

### Scenario 6.1: run 경로 접근 시 리다이렉트

```gherkin
Given 사용자가 /admin/plugins/run/{pluginId} 경로에 접근한다
When 페이지가 로드된다
Then 시스템은 301 리다이렉트로 /admin/hub/{pluginId}로 전환한다
And 플레이스홀더 텍스트가 표시되지 않는다
```

### Scenario 6.2: run 경로 path 파라미터 보존

```gherkin
Given 사용자가 /admin/plugins/run/my-plugin/docs/getting-started 경로에 접근한다
When 리다이렉트가 실행된다
Then 시스템은 /admin/hub/my-plugin/docs/getting-started로 리다이렉트한다
And path 정보가 올바르게 보존된다
```

---

## 7. REQ-007: 스토어 설치 후 내비게이션 흐름 [HIGH]

### Scenario 7.1: 설치 성공 후 허브 링크 표시

```gherkin
Given 사용자가 스토어에서 플러그인 설치를 시작했다
When 설치가 성공적으로 완료된다
Then "허브에서 보기" 또는 동등한 링크/버튼이 표시된다
And 해당 링크는 /admin/hub/{pluginId}를 가리킨다
```

### Scenario 7.2: 설치 실패 시 링크 미표시

```gherkin
Given 사용자가 스토어에서 플러그인 설치를 시작했다
When 설치가 실패한다
Then "허브에서 보기" 링크가 표시되지 않는다
And 에러 메시지와 재시도 옵션이 표시된다
```

### Scenario 7.3: 이미 설치된 플러그인 처리

```gherkin
Given 사용자가 스토어에서 이미 설치된 플러그인을 보고 있다
When 플러그인 카드/상세를 확인한다
Then "허브에서 보기" 링크가 바로 표시된다
And "설치" 버튼 대신 "설치됨" 상태가 표시된다
```

---

## 8. REQ-008: 내비게이션 일관성 [UBIQUITOUS]

### Scenario 8.1: 전체 플러그인 페이지 링크 유효성

```gherkin
Given 모든 플러그인 관련 페이지가 빌드되었다
When 각 페이지의 모든 내부 링크 href를 수집한다
Then 모든 href가 실제 존재하는 Astro 라우트에 매핑된다
And 어떤 링크도 404 응답을 반환하지 않는다
```

### Scenario 8.2: Astro 빌드 성공

```gherkin
Given 모든 내비게이션 수정이 완료되었다
When astro build 또는 npm run build를 실행한다
Then 빌드가 에러 없이 완료된다
And 경고 중 라우트 관련 경고가 없다
```

---

## 9. 엣지 케이스 시나리오

### Edge Case 9.1: 비활성화된 플러그인

```gherkin
Given 플러그인이 설치되어 있지만 비활성화 상태이다
When 사용자가 해당 플러그인의 허브 상세 페이지에 접근한다
Then 플러그인 정보는 표시되지만 "비활성화됨" 상태가 명확히 표시된다
And 내비게이션 링크는 정상적으로 동작한다
```

### Edge Case 9.2: 삭제된 플러그인의 허브 페이지

```gherkin
Given 플러그인이 시스템에서 완전히 제거되었다
When 사용자가 해당 플러그인의 이전 허브 URL에 접근한다
Then 적절한 "플러그인을 찾을 수 없습니다" 메시지가 표시된다
And /admin/plugins 또는 /admin/plugins/store로 이동하는 링크가 제공된다
```

### Edge Case 9.3: 권한 없는 사용자

```gherkin
Given 리뷰 권한이 없는 일반 사용자가 있다
When /admin/plugins/review 페이지에 접근을 시도한다
Then 적절한 권한 부족 메시지 또는 리다이렉트가 발생한다
And API 엔드포인트도 권한 검증을 수행한다
```

---

## 10. 품질 게이트 기준

### Definition of Done

- [ ] 모든 CRITICAL/HIGH 이슈 (REQ-001 ~ REQ-003, REQ-007) 수정 완료
- [ ] 수정된 모든 링크가 유효한 경로를 가리킴
- [ ] Astro 빌드가 에러 없이 성공
- [ ] 각 수정된 페이지에서 수동 내비게이션 테스트 통과
- [ ] MEDIUM 이슈 (REQ-004, REQ-005) 수정 또는 대안 제시 완료
- [ ] 접근성(a11y) 검증 완료 (링크에 적절한 레이블)
- [ ] 코드 리뷰 완료

### 검증 방법

1. **수동 테스트**: 각 시나리오의 Given/When/Then 단계를 브라우저에서 직접 수행
2. **빌드 테스트**: `npm run build` 성공 확인
3. **링크 검증**: 개발 서버에서 모든 플러그인 페이지 링크의 HTTP 상태 코드 확인
4. **접근성 테스트**: 키보드 내비게이션으로 모든 수정된 링크 접근 가능 여부 확인

### 추적성 태그

- [SPEC-FIX-PLUGIN-NAV-001:ACC:S1.1-S1.3] -> REQ-001 검증
- [SPEC-FIX-PLUGIN-NAV-001:ACC:S2.1-S2.2] -> REQ-002 검증
- [SPEC-FIX-PLUGIN-NAV-001:ACC:S3.1-S3.2] -> REQ-003 검증
- [SPEC-FIX-PLUGIN-NAV-001:ACC:S4.1-S4.2] -> REQ-004 검증
- [SPEC-FIX-PLUGIN-NAV-001:ACC:S5.1-S5.2] -> REQ-005 검증
- [SPEC-FIX-PLUGIN-NAV-001:ACC:S6.1-S6.2] -> REQ-006 검증
- [SPEC-FIX-PLUGIN-NAV-001:ACC:S7.1-S7.3] -> REQ-007 검증
- [SPEC-FIX-PLUGIN-NAV-001:ACC:S8.1-S8.2] -> REQ-008 검증
- [SPEC-FIX-PLUGIN-NAV-001:ACC:E9.1-E9.3] -> 엣지 케이스 검증
