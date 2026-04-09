---
description: 로컬 커스터마이징 Agent-First 워크플로우
category: dev
---

# 로컬 커스터마이징 Agent-First 워크플로우

> 목적: 에이전트가 플러그인 외의 safe workspace를 정확히 골라서 로컬 클라이언트 작업을 진행하도록 돕는 실행 문서

## 0. 먼저 분류

코드 수정 요청이 들어오면 아래를 먼저 판단한다.

1. 기존 퍼블릭 페이지를 병원별로만 바꿔야 하는가
   - `src/pages/_local/**`
2. 병원 전용 helper/adapter가 필요한가
   - `src/lib/local/**`
3. 정적 이미지/로고/OG 자산이 필요한가
   - `public/local/**`
4. 내부 메모/복구 기록/운영 문서가 필요한가
   - `docs/internal/**`
5. 새 기능/새 라우트/새 API가 필요한가
   - 플러그인 또는 survey tool 검토

## 1. 읽을 파일

1. `.agent/runtime-context.json`
2. `.agent/manifests/change-strategy.json`
3. `.agent/manifests/local-workspaces.json`
4. `docs/CUSTOMIZATION_GUIDE.md`
5. 필요하면 `docs/R2_STORAGE_GUIDE.md`

## 2. 페이지 오버라이드

기존 공개 페이지를 병원별로 바꾸는 요청이면 원본과 같은 상대 경로로 `_local` 복사본을 만든다.

예:

```text
src/pages/doctors/index.astro
→ src/pages/_local/doctors/index.astro
```

규칙:

- import 경로는 원본 페이지 위치 기준으로 유지
- locale 경로가 있으면 기본 경로와 같이 확인
- 관리자 값이 반영되는 페이지면 저장 경로와 공용 loader를 먼저 확인

검증:

1. `npm run build`
2. 대상 공개 경로 확인
3. locale 경로가 있으면 같이 확인

## 3. local lib

`src/lib/local/**` 는 병원 전용 유틸, adapter, bridge에만 쓴다.

적합한 예:

- 병원 전용 문구 생성 helper
- 외부 API payload formatter
- `_local` 페이지와 로컬 플러그인이 함께 쓰는 작은 service

부적합한 예:

- 공용 세그먼트/인증/페이지 엔진 버그를 local helper로 숨김
- 코어 loader를 local helper에서 우회 복제

## 4. public/local 자산

코드가 직접 참조하는 정적 파일은 `public/local/**` 에 둔다.

적합한 예:

- `public/local/logo.png`
- `public/local/og-image.jpg`
- `public/local/images/banner.jpg`

주의:

- 관리자 업로드 이미지, 블로그 첨부, 의료진 사진 업로드는 R2 영역이다
- `public/local` 은 Git 추적 대상 정적 파일이다

검증:

1. `npm run build`
2. 빌드 후 dist 루트에서 자산 경로 확인
3. 페이지에서 실제 노출 확인

## 5. docs/internal

`docs/internal/**` 는 에이전트와 운영자용 문서 공간이다.

적합한 예:

- 복구 기록
- 마이그레이션 메모
- 운영 런북
- 병원별 확인사항 체크리스트

부적합한 예:

- 사용자에게 공개될 카피/콘텐츠 저장
- 비밀번호, 토큰, 라이선스 키 원문 보관

## 6. 이 경우는 local workspace가 아님

- 보안/인증/공용 loader 버그
- 관리자 변경이 퍼블릭에 안 반영되는 공용 계약 문제
- 모든 클라이언트가 겪는 플로우 버그

이 경우는 중앙 패치로 분류한다.

## 7. 작업 완료 전 체크

- [ ] local workspace 선택이 요청과 맞는가
- [ ] 공용 버그를 clinic-specific override로 숨기지 않았는가
- [ ] `npm run build` 또는 필요한 검증을 수행했는가
- [ ] 관리자 값과 퍼블릭 반영이 관련되면 실제 렌더 결과를 확인했는가
- [ ] 정적 자산과 R2 업로드를 혼동하지 않았는가
