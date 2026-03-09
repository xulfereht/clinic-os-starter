---
hq_slug: clinic-json-reference
hq_title: "clinic.json 레퍼런스"
hq_category: "09. 시스템 설정"
hq_sort: 6
hq_active: true
---
# clinic.json 레퍼런스

`clinic.json`은 HQ 서버가 스타터킷에 서명하여 포함시키는 설정 파일입니다.
한의원의 라이선스, 기관 정보, 업데이트 채널을 담고 있으며 초기 설치 과정에서 에이전트가 setup을 진행할 때 자동으로 읽혀 Zero-Touch 설정을 가능하게 합니다.

---

## 생성 과정

```
HQ 웹사이트에서 스타터킷 다운로드
         │
         ▼
HQ 서버가 ZIP에 clinic.json 주입
(클라이언트 인증 정보 기반)
         │
         ▼
clinic-os-starter-vX.X.X-signed.zip
├── clinic.json          ← 서명된 설정 파일
├── package.json
├── src/
└── ...
```

> **직접 생성하지 마세요.** 이 파일은 HQ에서 스타터킷 다운로드 시 자동으로 포함됩니다.

---

## 파일 구조

```json
{
  "client_id": "cli_abc123def456",
  "license_key": "cos_live_xxxxxxxxxxxx",
  "contact_name": "김한의",
  "organization": "서울한의원",
  "channel": "stable",
  "version": "1.21.1",
  "generated_at": "2026-02-26T06:00:00.000Z"
}
```

### 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `client_id` | string | HQ에서 발급한 클라이언트 고유 ID |
| `license_key` | string | 라이선스 키 (`cos_live_` 또는 `cos_test_` 접두사) |
| `contact_name` | string | 담당자 이름 (HQ 등록 시 입력) |
| `organization` | string | 한의원/기관명 |
| `channel` | string | 업데이트 채널: `stable` (기본) 또는 `beta` |
| `version` | string | 다운로드한 스타터킷 버전 |
| `generated_at` | string | ISO 8601 생성 시각 |

---

## setup-clinic.js 연동

설치 과정에서 에이전트가 setup을 진행할 때 clinic.json이 있으면 Zero-Touch 모드로 동작합니다:

```
clinic.json 존재?
    │
    YES → organization, license_key, channel 자동 로드
    │     HQ URL 입력 건너뜀
    │     자동 디바이스 등록 시도
    │
    NO  → 수동 입력 모드
          HQ URL, 라이선스 키 직접 입력
```

### Zero-Touch 출력 예시

```
✨ Zero-Touch: [clinic.json] 서명된 파일에서 설정을 불러왔습니다.
✅ 기관명: 서울한의원
✅ 라이선스: cos_live... (매칭됨)
→ HQ 서버: https://clinic-os-hq.pages.dev (자동 설정됨)
```

---

## 보호 규칙

| 규칙 | 설명 |
|------|------|
| **PROTECTED_EXACT** | core:pull 시 절대 덮어쓰지 않음 |
| **수정 금지** | 에이전트가 직접 수정하면 안 됨 |
| **Git 포함 권장** | GitHub에 포함하여 디바이스 마이그레이션 시 재사용 |

`.docking/protection-manifest.yaml`과 `.docking/engine/fetch.js`에서 `PROTECTED_EXACT`로 분류됩니다.

---

## clinic.json이 없는 경우

스타터킷을 HQ가 아닌 경로로 받았거나, 인증 없이 다운로드한 경우 clinic.json이 없습니다.

이 경우 `npm run setup` 에서:
1. HQ 서버 URL 수동 입력
2. 라이선스 키 수동 입력
3. 브라우저 기반 디바이스 등록

> 나중에 HQ에서 스타터킷을 다시 다운로드하면 clinic.json이 포함됩니다.

---

## 관련 파일

| 파일 | 관계 |
|------|------|
| `.docking/config.yaml` | setup 후 디바이스 토큰/HQ URL 저장 |
| `wrangler.toml` | D1/R2 Cloudflare 바인딩 설정 |
| `.agent/clinic-profile.json` | 소프트게이트 Gate 0에서 수집한 한의원 프로파일 (별도) |
| `scripts/setup-clinic.js` | clinic.json을 읽고 처리하는 로직 |
