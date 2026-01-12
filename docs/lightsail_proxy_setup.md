# AWS Lightsail SMS 프록시 서버 설정 가이드

> **목적**: Cloudflare Pages/Workers에서 알리고(Aligo) SMS API로 안정적으로 요청을 보내기 위한 프록시 서버 설정
>
> **필요한 이유**: Cloudflare Workers는 동적 IP를 사용하므로 알리고의 IP 화이트리스트에 등록할 수 없습니다. 고정 IP를 가진 프록시 서버를 경유하면 이 문제를 해결할 수 있습니다.

---

## 사전 준비물

- AWS Lightsail 계정
- 도메인 (예: `baekrokdam.com`) 및 DNS 관리 접근 권한
- 알리고 API 계정

---

## Step 1: Lightsail 인스턴스 생성

1. [AWS Lightsail 콘솔](https://lightsail.aws.amazon.com/)에 로그인
2. **Create instance** 클릭
3. 설정:
   - **Region**: 서울 (ap-northeast-2) 권장
   - **Platform**: Linux/Unix
   - **OS**: Ubuntu 22.04 LTS
   - **Plan**: 가장 저렴한 플랜 ($3.50/월) 충분
   - **⚠️ 중요**: Networking에서 **Dual-stack** 선택 (IPv4 + IPv6)
4. 인스턴스 이름 입력 후 **Create instance**

---

## Step 2: Static IP 및 방화벽 설정

### Static IP 할당
1. 인스턴스 클릭 → **Networking** 탭
2. **Create static IP** → 인스턴스에 연결

### 방화벽 열기
**IPv4 Firewall**에 아래 규칙 추가:
| Application | Protocol | Port |
|-------------|----------|------|
| SSH         | TCP      | 22   |
| HTTP        | TCP      | 80   |
| HTTPS       | TCP      | 443  |

---

## Step 3: 도메인 DNS 설정 (GoDaddy 예시)

1. DNS 관리 페이지 접속
2. **A 레코드** 추가:
   - **이름**: `sms` (또는 원하는 서브도메인)
   - **값**: Lightsail Static IP (예: `43.200.51.252`)
   - **TTL**: 600
3. 저장 후 1~5분 대기

**확인 방법**: `ping sms.yourdomain.com` → Static IP가 나오면 성공

---

## Step 4: Nginx 설치 및 설정

Lightsail 인스턴스에 SSH 접속 후:

```bash
# 패키지 업데이트 및 Nginx 설치
sudo apt update && sudo apt install nginx -y

# Nginx 설정 파일 생성
sudo nano /etc/nginx/conf.d/aligo-proxy.conf
```

아래 내용 붙여넣기 (`server_name`을 본인 도메인으로 수정):

```nginx
server {
    listen 80;
    server_name sms.yourdomain.com;

    location /aligo/ {
        # 알림톡 API (kakaoapi.aligo.in)와 일반 문자 API (apis.aligo.in) 자동 분기
        if ($request_uri ~* "/akv10/") {
            proxy_pass https://kakaoapi.aligo.in/;
            proxy_set_header Host kakaoapi.aligo.in;
        }

        rewrite ^/aligo/(.*) /$1 break;
        proxy_pass https://apis.aligo.in/;
        proxy_set_header Host apis.aligo.in;
        proxy_set_header User-Agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
        proxy_ssl_server_name on;
    }
}
```

저장 후 (`Ctrl+X` → `Y` → `Enter`) Nginx 재시작:

```bash
sudo nginx -t && sudo systemctl restart nginx
```

---

## Step 5: SSL 인증서 설치 (Certbot)

```bash
# Certbot 설치
sudo apt install certbot python3-certbot-nginx -y

# SSL 인증서 발급 및 자동 설정
sudo certbot --nginx -d sms.yourdomain.com
```

- 이메일 입력, 약관 동의(Y), 뉴스레터(N) 응답
- 서비스 재시작 질문이 나오면 기본값으로 OK

**확인 방법**:
```bash
curl https://sms.yourdomain.com/aligo/remain/
```
→ `{"result_code":-101,"message":"API 키가 입력되지 않았습니다."}` 가 나오면 성공!

---

## Step 6: 알리고 IP 화이트리스트 등록

1. [알리고 관리자 페이지](https://smartsms.aligo.in/) 로그인
2. **환경설정** → **접속보안설정** (또는 IP 설정)
3. Lightsail Static IP 등록 (예: `43.200.51.252`)

---

## Step 7: 앱 설정

### 관리자 페이지에서 설정 (권장)
1. 관리자 페이지 → **통합 설정** → **Aligo SMS**
2. API Key, User ID, Sender 입력
3. **Proxy URL**: `https://sms.yourdomain.com/aligo/`
4. 저장

### 또는 환경변수로 설정
```
ALIGO_API_KEY=your-api-key
ALIGO_USER_ID=your-user-id
ALIGO_SENDER=02-000-0000
ALIGO_BASE_URL=https://sms.yourdomain.com/aligo/
```

---

## 💡 공유 프록시 활용 전략 (Shared Proxy)

하나의 프록시 서버를 구축하여 **여러 클라이언트(한의원)가 공동으로 사용**할 수 있습니다.

- **작동 원리**: 프록시는 단순 전달자 역할만 하며, 실제 인증(API Key, User ID)은 클라이언트의 요청 데이터에 포함되어 있습니다.
- **클라이언트 설정**: 
    1. 각 클라이언트의 알리고 관리자 페이지에 **프록시 서버의 고정 IP**를 등록합니다.
    2. 모든 클라이언트의 앱 설정(통합 설정)에서 **동일한 Proxy URL**을 입력합니다.
- **장점**: 모든 클라이언트에게 개별 서버 구축을 요구하지 않아도 되며, 관리 포인트가 일원화됩니다.

---

## 트러블슈팅

### `sudo: nginx: command not found`
→ Nginx가 설치되지 않음
```bash
sudo apt update && sudo apt install nginx -y
```

### 사이트에 연결할 수 없음 (Connection refused)
1. Nginx 실행 확인: `sudo systemctl status nginx`
2. Lightsail 방화벽에 80, 443 포트 열려있는지 확인

### Error 521 (Web server is down)
→ SSL이 제대로 설정되지 않음
```bash
sudo certbot --nginx -d sms.yourdomain.com
sudo systemctl restart nginx
```

### Error 1003 (Direct IP access not allowed)
→ HTTPS + 도메인 대신 HTTP + IP로 접속 시도 중
→ 반드시 `https://sms.yourdomain.com/aligo/` 형식 사용

### 인증오류입니다.-IP
→ 알리고에 Lightsail Static IP가 등록되지 않음
→ 알리고 관리자 페이지에서 IP 화이트리스트 등록

---

## 완료 체크리스트

- [ ] Lightsail 인스턴스 생성 (Dual-stack)
- [ ] Static IP 할당
- [ ] 방화벽 80, 443 포트 열기
- [ ] 도메인 A 레코드 설정
- [ ] Nginx 설치 및 프록시 설정
- [ ] Certbot SSL 인증서 설치
- [ ] 알리고에 Static IP 등록
- [ ] 앱 Proxy URL 설정
- [ ] 테스트 성공 확인
