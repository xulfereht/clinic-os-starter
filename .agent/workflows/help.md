---
description: 도움이 필요할 때 Antigravity에게 질문하기
category: dev
---

# Clinic-OS 도움 에이전트

비기술자도 쉽게 사용할 수 있도록 안내합니다.

---

## 사용자 맥락 파악

1. 먼저 사용자에게 어떤 도움이 필요한지 물어봅니다:
   - "무엇을 도와드릴까요?"
   - "어떤 문제가 있나요?"

---

## 자주 묻는 질문 (FAQ)

### 🚀 설치/설정 관련

**Q: 처음 시작하려면 어떻게 해야 하나요?**
→ `/setup-clinic` 워크플로우를 실행하거나:
```bash
npm install
npm run setup
npm run fetch
npm run dev
```

**Q: 한의원 이름/정보를 바꾸고 싶어요**
→ `/admin/settings`에서 변경하거나, DB 직접 업데이트:
```bash
# wrangler.toml의 database_name에 맞게 자동 실행
node scripts/db-helper.js exec --command "UPDATE site_settings SET value = '새이름' WHERE key = 'name';"
```

---

### 📦 업데이트 관련

**Q: 새 기능을 받고 싶어요 (앱 업데이트)**
→ HQ에서 최신 앱 패키지를 가져옵니다:
```bash
npm run core:pull
```

**Q: Starter Kit 업데이트가 있다고 해요**
→ Git에서 최신 변경사항을 가져옵니다:
```bash
npm run update:starter
```

**Q: zip 파일로 패키지를 받았어요**
→ 프로젝트 루트에 zip을 놓고:
```bash
npm run upgrade
```

**Q: 현재 버전을 확인하고 싶어요**
→ `.docking/config.yaml` 또는 `package.json` 확인

---

### 📝 콘텐츠 관련

**Q: 홈페이지 내용을 수정하고 싶어요**
→ `src/content/pages/home.ko.md` 파일 수정 또는 `/admin/pages`

**Q: 진료 프로그램을 추가하고 싶어요**
→ `/admin/programs`에서 "새 프로그램 추가"

**Q: 블로그 글을 쓰고 싶어요**
→ `/admin/posts`에서 "글 작성"

---

### 🐛 오류 해결

**Q: "no such table" 오류가 나요**
→ DB 초기화 필요:
```bash
npm run db:init
npm run db:seed
```

**Q: 화면이 안 나와요**
→ 개발 서버 실행 확인:
```bash
npm run dev
```

**Q: 로그인이 안 돼요**
→ 기본 계정: admin@sample-clinic.com / admin123

**Q: npm 명령이 안 돼요**
→ Node.js 설치 확인:
```bash
node --version
```

---

### 🚢 배포 관련

**Q: 사이트를 배포하고 싶어요**
→ 가드레일 포함 배포:
```bash
npm run deploy
```

**Q: 배포가 실패해요**
→ 로컬 테스트 먼저 확인:
```bash
npm run build
npm run preview
```

---

## 명령어 모음

| 명령어 | 용도 |
|--------|------|
| `npm run setup` | 초기 설정 마법사 |
| `npm run dev` | 로컬 개발 서버 |
| `npm run core:pull` | 앱 패키지 업데이트 |
| `npm run update:starter` | Starter Kit 업데이트 |
| `npm run upgrade` | 수동 패키지 적용 |
| `npm run deploy` | 프로덕션 배포 |
| `npm run doctor` | 시스템 건전성 체크 |
| `npm run db:init` | DB 스키마 초기화 |
| `npm run db:seed` | 샘플 데이터 삽입 |

---

## 문제 해결 단계

1. **오류 메시지 확인**: 정확한 오류 내용 파악
2. **환경 진단**: `npm run health` 실행 (건강 점수 0-100)
3. **시스템 체크**: `npm run doctor` 실행 (DB 스키마 검증)
4. **트러블슈팅 가이드**: `.agent/workflows/troubleshooting.md` 참조
5. **워크플로우 실행**: 해당하는 `/워크플로우` 실행
6. **2회 실패 시**: `./scripts/cos-ask "에러 메시지"` (서포트 에이전트)

---

## 긴급 복구

### DB 완전 초기화
```bash
rm -rf .wrangler
npm run db:init
npm run db:seed
```

### 패키지 재설치
```bash
rm -rf node_modules
npm install
```

### 전체 리셋
```bash
rm -rf node_modules .wrangler
npm install
npm run setup
npm run fetch
```

---

## 관련 문서

| 상황 | 다음 문서 |
|------|-----------|
| 상세 트러블슈팅 (11개 시나리오) | `.agent/workflows/troubleshooting.md` |
| 코어 업데이트 절차 | `.agent/workflows/upgrade-version.md` |
| 파일 수정 규칙 | `.claude/rules/clinic-os-safety.md` |
| 전체 문서 인덱스 | `.agent/README.md` |
