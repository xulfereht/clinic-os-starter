# EC2 Nginx Proxy Setup for Aligo SMS

This guide explains how to set up your EC2 instance as a reverse proxy for the Aligo SMS API. This helps stabilize the API connection by providing a static source IP and avoiding potential IP-based blocks or rate limits sometimes encountered with Cloudflare Workers.

## Prerequisites

1.  **EC2 Instance**: An active EC2 instance (Ubuntu/Debian recommended, but Amazon Linux works too).
2.  **SSH Access**: You can SSH into your instance.
3.  **Ports**: Ensure **Port 80 (HTTP)** and **Port 443 (HTTPS)** are open in your EC2 Security Group.
4.  *(Optional)* **Domain**: A domain or subdomain pointing to your EC2 IP (e.g., `sms-proxy.your-domain.com`).

## Step 1: Install Nginx

Connect to your EC2 instance and run:

```bash
sudo apt update
sudo apt install nginx -y
# For Amazon Linux: sudo yum install nginx -y
```

Start and enable Nginx:

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Step 2: Configure Proxy

Create a new configuration file for your proxy.

```bash
sudo nano /etc/nginx/sites-available/aligo-proxy
```

Paste the following configuration.
*Note: If you don't have a domain yet, you can use `default` config or just listen on IP, but HTTPS is highly recommended for security.*

```nginx
server {
    listen 80;
    server_name your-domain-or-ip;  # Replace with your domain or Public IP

    location / {
        return 200 'OK';
        add_header Content-Type text/plain;
    }

    # Proxy endpoint for sending SMS
    location /aligo/ {
        # ... (same as above) ...
        rewrite ^/aligo/(.*) /$1 break;
        proxy_pass https://apis.aligo.in/;
        # ...
    }
}
```

## Scenario: Existing Flask Server

If you are already running a Flask server on this EC2 instance:

### Case A: You are NOT using Nginx yet (Flask running on port 5000, etc.)
You can install Nginx as described above. It will listen on Port 80.
1. Your Flask app continues running on its port (e.g., 5000).
2. Nginx handles the SMS proxy on Port 80.
3. *(Optional)* You can also configure Nginx to forward normal traffic to your Flask app:
   ```nginx
   location / {
       proxy_pass http://127.0.0.1:5000; # Assuming Flask is on port 5000
       # ... standard proxy headers ...
   }
   ```

### Case B: You are ALREADY using Nginx for Flask
DO NOT create a new config file that conflicts on Port 80. Instead, **edit your existing configuration**.
1. Open your existing config (usually in `/etc/nginx/sites-available/`).
2. Add the `/aligo/` location block **inside your existing `server` block**.

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Your existing Flask configuration
    location / {
        include proxy_params;
        proxy_pass http://unix:/your/flask/socket.sock; # or http://127.0.0.1:5000
    }

    # ---> ADD THIS BLOCK <---
    location /aligo/ {
        # 알림톡 API (kakaoapi.aligo.in)와 일반 문자 API (apis.aligo.in) 자동 분기
        if ($request_uri ~* "/akv10/") {
            proxy_pass https://kakaoapi.aligo.in/;
            proxy_set_header Host kakaoapi.aligo.in;
        }

        rewrite ^/aligo/(.*) /$1 break;
        proxy_pass https://apis.aligo.in/;
        
        proxy_set_header Host apis.aligo.in;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_ssl_server_name on;
    }
}
```
3. Save and reload Nginx: `sudo systemctl reload nginx`

---

## 💡 공유 프록시 활용 전략 (Shared Proxy)

하나의 프록시 서버를 구축하여 **여러 클라이언트(한의원)가 공동으로 사용**할 수 있습니다.

- **작동 원리**: 프록시는 단순 전달자 역할만 하며, 실제 인증(API Key, User ID)은 클라이언트의 요청 데이터에 포함되어 있습니다.
- **클라이언트 설정**: 
    1. 각 클라이언트의 알리고 관리자 페이지에 **프록시 서버의 고정 IP**를 등록합니다.
    2. 모든 클라이언트의 앱 설정(통합 설정)에서 **동일한 Proxy URL**을 입력합니다.
- **장점**: 모든 클라이언트에게 개별 서버 구축을 요구하지 않아도 되며, 관리 포인트가 일원화됩니다.

---

## Step 3: SSL Setup (Highly Recommended)

If you are using a domain, use Certbot to get a free SSL certificate.

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

Certbot will automatically update your Nginx config to use HTTPS.

## Step 4: Configure Cloudflare Application

Update your Cloudflare Worker / Astro configuration.

1.  Go to **Cloudflare Dashboard** -> **Pages** -> **Settings** -> **Environment Variables**.
2.  Add or Edit `ALIGO_BASE_URL`.
3.  Value: `https://your-domain.com/aligo/` (or `http://your-ip/aligo/` if testing without SSL).

## Verification

You can test the proxy from your local machine:

```bash
# Check if proxy is reachable
curl https://your-domain.com/aligo/send/
```

If you get a response from Aligo (likely an error saying missing parameters), the proxy is working!
