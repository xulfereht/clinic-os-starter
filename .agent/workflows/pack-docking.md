---
description: 현재 작업 내용을 도킹 패키지(.zip)로 패키징합니다
---

# Docking Package 패키징 워크플로우

이 워크플로우는 개발된 기능/수정사항을 배포 가능한 도킹 패키지로 만듭니다.

## 사전 조건
- 패키징할 기능이 완성되어 있어야 합니다
- 변경된 파일 목록을 알고 있어야 합니다

## 패키징 단계

### Step 1: 패키지 정보 수집
사용자에게 다음 정보를 요청합니다:
1. **패키지 ID**: `DP-XXX` 형식 (예: `DP-001`)
2. **패키지 이름**: 영문 slug (예: `alimtalk-proxy`)
3. **요약 설명**: 한 문장으로 변경 내용 설명
4. **변경 파일 목록**: 추가/수정/삭제된 파일들

### Step 2: 패키지 폴더 생성
```bash
mkdir -p .docking/[DP-ID]-[NAME]/files
mkdir -p .docking/[DP-ID]-[NAME]/migrations
mkdir -p .docking/[DP-ID]-[NAME]/patches
```

### Step 3: manifest.yaml 생성
다음 템플릿으로 `manifest.yaml` 생성:
```yaml
id: [DP-ID]
name: [NAME]
version: 1.0.0
created: [TODAY]
author: Clinic-OS Team

requires:
  base: ">=1.0.0"
  packages: []

summary: |
  [SUMMARY]

files:
  - action: create|modify|delete
    path: [TARGET_PATH]
    source: files/[FILE_PATH]

migrations: []

env_vars: []

verification:
  - [VERIFICATION_STEP]
```

### Step 4: 파일 복사
변경된 파일들을 `files/` 폴더로 복사합니다:
```bash
cp [SOURCE_PATH] .docking/[DP-ID]-[NAME]/files/[TARGET_PATH]
```

### Step 5: instructions.md 작성
Antigravity가 읽을 수 있는 단계별 적용 지침을 작성합니다.

### Step 6: 압축
```bash
cd .docking
zip -r [DP-ID]-[NAME].zip [DP-ID]-[NAME]/
mv [DP-ID]-[NAME].zip ../
```

### Step 7: 검증
압축 파일 내용 확인:
```bash
unzip -l [DP-ID]-[NAME].zip
```

## 완료 후
- 프로젝트 루트에 `[DP-ID]-[NAME].zip` 파일 생성됨
- 이 파일을 클라이언트에게 배포
- 클라이언트는 `/unpack-docking` 워크플로우로 적용
