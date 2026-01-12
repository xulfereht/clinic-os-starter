---
description: 새 버전의 기본 소스를 기존 시스템과 병합합니다
---

# Clinic-OS 버전 업그레이드 에이전트

새 버전의 기본 소스코드를 기존에 운영 중인 시스템과 안전하게 병합합니다.

---

## 개념 이해

```
[기존 시스템 v1.0]     [새 버전 v1.1]
 - 기본 기능          - 기본 기능 (개선)
 - 내 커스터마이징     - 새 기능 추가
        \                 /
         \               /
          ▼             ▼
        [병합 후 v1.1]
         - 새 기능
         - 내 커스터마이징 유지
```

---

## Phase 1: 백업 생성

// turbo
1. Git 상태 확인
```bash
git status
```

2. 현재 상태 커밋 (저장)
```bash
git add -A && git commit -m "Backup before upgrade to v1.1"
```

3. 백업 브랜치 생성
```bash
git branch backup-before-upgrade
```

---

## Phase 2: 새 소스 다운로드 확인

4. 사용자에게 확인:
   - "새 버전 소스 파일(zip)이 어디에 있나요?"
   - 또는 "새 버전 다운로드 링크를 알려주세요"

5. 새 소스 압축 해제 위치 확인:
   - 임시 폴더에 압축 해제
   - 예: `~/Downloads/clinic-os-v1.1/`

---

## Phase 3: 변경사항 분석

6. 새 버전의 주요 변경사항 확인:
   - CHANGELOG.md 읽기
   - package.json 버전 비교
   - 새로운 파일 목록

7. 사용자에게 변경 내용 요약 설명:
   - 새 기능 목록
   - 수정된 파일 목록
   - 예상 충돌 파일

---

## Phase 4: 병합 실행

8. 커스터마이징 파일 목록 확인:
   - 사용자가 직접 수정한 파일들
   - 로고, 색상, 설정 등

9. 안전한 파일 복사 (새 기능):
   - 새 컴포넌트
   - 새 페이지
   - 새 API

10. 충돌 파일 수동 병합:
    - 양쪽 변경사항 비교
    - 사용자 확인 후 적용

---

## Phase 5: 의존성 업데이트

// turbo
11. 새 패키지 설치
```bash
npm install
```

---

## Phase 6: DB 마이그레이션

12. 새 버전에 DB 변경이 있는지 확인:
    - migrations/ 폴더 확인
    - 새 마이그레이션 파일 실행

```bash
npx wrangler d1 execute clinic-os-dev --local --file migrations/[NEW_MIGRATION].sql
```

---

## Phase 7: 테스트

// turbo
13. 로컬 서버 실행
```bash
npm run dev
```

14. 주요 기능 테스트:
    - [ ] 홈페이지 로드
    - [ ] 관리자 로그인
    - [ ] 기존 커스터마이징 유지 확인
    - [ ] 새 기능 작동 확인

---

## Phase 8: 완료 처리

15. 업그레이드 커밋
```bash
git add -A && git commit -m "Upgrade to v1.1"
```

16. 사용자에게 완료 보고:
    - 업그레이드 내용 요약
    - 새 기능 사용법 안내
    - 배포 여부 확인

---

## 롤백 (문제 발생 시)

```bash
git checkout backup-before-upgrade
git checkout -b main
```

---

## 주의사항

- 업그레이드 전 **반드시 백업**
- 프로덕션 배포 전 **로컬 테스트 필수**
- 충돌 발생 시 **사용자에게 설명 후 결정**
