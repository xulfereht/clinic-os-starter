# Google OAuth 2.0 설정 가이드

Clinic-OS HQ의 Google 로그인 기능을 활성화하기 위한 키 발급 절차입니다.

## 1. 프로젝트 생성
1. [Google Cloud Console](https://console.cloud.google.com/) 접속.
2. 상단 프로젝트 선택창 클릭 → **[새 프로젝트]**.
3. 이름 입력(예: `Clinic-OS-HQ`) 후 **[만들기]**.

## 2. OAuth 동의 화면 구성
1. 좌측 메뉴 **[API 및 서비스]** → **[OAuth 동의 화면]**.
2. **User Type**: `외부(External)` 선택 → **[만들기]**.
3. **앱 정보 입력**:
   - **앱 이름**: `Clinic-OS HQ`
   - **사용자 지원 이메일**: 본인 이메일 선택
   - **개발자 연락처 정보**: 본인 이메일 입력
4. **[저장 후 계속]** → (범위 설정 건너뛰기) → (테스트 사용자 건너뛰기) → **[완료]**.
5. 대시보드로 돌아와서 **[앱 게시]** 버튼 클릭 (프로덕션 환경으로 전환).

## 3. 클라이언트 ID 발급 (중요)
1. 좌측 메뉴 **[사용자 인증 정보]** → **[+ 사용자 인증 정보 만들기]** → **[OAuth 클라이언트 ID]**.
2. **애플리케이션 유형**: `웹 애플리케이션`.
3. **이름**: `HQ Web Client`.
4. **승인된 리디렉션 URI** 항목에 **[URI 추가]**를 누르고 아래 주소 입력:
   - `https://clinic-os-hq.pages.dev/auth/google/callback`
   - (로컬 개발용): `http://localhost:8787/auth/google/callback` (선택사항)
5. **[만들기]** 클릭.

## 4. 키 확인 및 등록
팝업창에 나온 **클라이언트 ID**와 **클라이언트 보안 비밀(Secret)**을 복사해두세요.

### Cloudflare Pages에 등록하기
터미널에서 아래 명령어를 실행하여 비밀 키를 등록합니다.

```bash
# Client ID 등록
npx wrangler pages secret put GOOGLE_CLIENT_ID --project-name clinic-os-hq
# (복사한 Client ID 입력)

# Client Secret 등록
npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name clinic-os-hq
# (복사한 Client Secret 입력)
```

등록 후에는 별도의 재배포 없이 즉시 로그인이 작동합니다.
