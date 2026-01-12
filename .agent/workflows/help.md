---
description: 도움이 필요할 때 Antigravity에게 질문하기
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

### 🔧 설치/설정 관련

**Q: 처음 시작하려면 어떻게 해야 하나요?**
→ `/setup-clinic` 워크플로우를 실행하세요.

**Q: 한의원 이름/정보를 바꾸고 싶어요**
→ `/admin/settings`에서 변경하거나, DB 직접 업데이트:
```bash
npx wrangler d1 execute clinic-os-dev --local --command "UPDATE site_settings SET value = '새이름' WHERE key = 'name';"
```

---

### 📝 콘텐츠 관련

**Q: 홈페이지 내용을 수정하고 싶어요**
→ 현재는 `src/pages/index.astro` 파일 직접 수정 필요

**Q: 진료 프로그램을 추가하고 싶어요**
→ `/admin/programs`에서 "새 프로그램 추가"

**Q: 블로그 글을 쓰고 싶어요**
→ `/admin/posts`에서 "글 작성"

---

### 🐛 오류 해결

**Q: "no such table" 오류가 나요**
→ DB 초기화 필요:
```bash
npx wrangler d1 execute clinic-os-dev --local --file migrations/0001_initial_schema.sql
```

**Q: 화면이 안 나와요**
→ 개발 서버 실행 확인:
```bash
npm run dev
```

**Q: 로그인이 안 돼요**
→ 기본 계정: admin@sample-clinic.com / admin123

---

### 📦 업데이트 관련

**Q: 새 기능을 받았는데 어떻게 적용하나요?**
→ `.zip` 파일을 프로젝트 폴더에 넣고 `/unpack-docking` 실행

**Q: 적용된 업데이트 목록을 보고 싶어요**
→ `.docking/.applied` 파일 확인

---

## 문제 해결 단계

1. **오류 메시지 확인**: 정확한 오류 내용 파악
2. **로그 확인**: 터미널 출력 확인
3. **GEMINI.md 참조**: 프로젝트 가이드 확인
4. **워크플로우 실행**: 해당하는 `/워크플로우` 실행

---

## 긴급 복구

### DB 완전 초기화
```bash
rm -rf .wrangler
npx wrangler d1 execute clinic-os-dev --local --file migrations/0001_initial_schema.sql
npx wrangler d1 execute clinic-os-dev --local --file seeds/sample_clinic.sql
```

### 패키지 재설치
```bash
rm -rf node_modules
npm install
```
