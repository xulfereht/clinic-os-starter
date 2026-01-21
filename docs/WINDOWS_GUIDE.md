# 🏥 Clinic-OS Windows 가이드: Gemini CLI + WSL 격리 환경

윈도우 사용자를 위한 최적의 개발 및 운영 환경 설정 가이드입니다. 이 가이드는 **WSL(리눅스 서브시스템)**을 사용하여 마치 도커 컨테이너처럼 깔끔하고 강력한 격리 환경을 구축하는 것을 목표로 합니다.

---

## 🚀 1. WSL(Linux) 활성화

윈도우 네이티브 환경에 개발 도구를 직접 설치하면 경로 문제나 권한 오류가 발생하기 쉽습니다. 따라서 별도의 격리된 리눅스 환경(WSL)을 사용합니다.

1. 윈도우 시작 메뉴에서 **Terminal** (또는 PowerShell)을 **관리자 권한**으로 실행합니다.
2. 아래 명령어를 입력하여 WSL을 설치합니다:
   ```powershell
   wsl --install
   ```
3. 설치가 완료되면 **컴퓨터를 다시 시작**해주세요.
4. 재시작 후 자동으로 뜨는 리눅스(Ubuntu) 창에서 사용자 이름과 비밀번호를 설정하시면 리눅스 준비가 완료됩니다.

---

## 🛠️ 2. 격리 환경 내 도구 설치 (WSL 안에서)

이제 윈도우가 아닌, 방금 만든 **리눅스 환경 내부**에 필요한 도구들을 설치합니다. (WSL 터미널에서 실행)

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# 기본 도구 (Node.js, Git) 설치
sudo apt install -y git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 🤖 3. Gemini CLI 설치 (WSL 안에서)

AI 어시스턴트로 Gemini CLI를 사용합니다.

```bash
# Gemini CLI 전역 설치
npm install -g @google/gemini-cli

# 설치 확인
gemini --version
```

처음 실행 시 **Google 계정 로그인**이 필요합니다:
```bash
gemini
# → "Login with Google" 선택 → 브라우저에서 로그인
```

> 자세한 내용: [Gemini CLI 설치 가이드](./GEMINI_CLI_SETUP.md)

---

## 🎨 4. 터미널 꾸미기 (선택)

터미널 가독성을 높이려면 Starship 프롬프트를 설치하세요.

```bash
# Starship 설치
curl -sS https://starship.rs/install.sh | sh -s -- -y
echo 'eval "$(starship init bash)"' >> ~/.bashrc
source ~/.bashrc
```

> 자세한 내용: [터미널 꾸미기 가이드](./TERMINAL_BEAUTIFY.md)

---

## 🏁 5. 프로젝트 시작하기

1. **Windows Terminal**에서 Ubuntu를 실행합니다.
2. 작업 경로는 윈도우 경로(`C:\...`)가 아닌, **WSL 내부 경로**(`~/clinic-os`)에 프로젝트를 두는 것이 성능상 훨씬 유리합니다.
3. **(중요)** 프로젝트 폴더 권한을 현재 사용자로 설정합니다:
   ```bash
   sudo chown -R $USER:$USER ~/clinic-os
   ```
4. 터미널에서 프로젝트로 이동 후 설정을 실행합니다:
   ```bash
   cd ~/clinic-os
   npm run setup
   ```
5. Gemini CLI로 AI 어시스턴트를 시작합니다:
   ```bash
   gemini
   ```
   *Gemini가 GEMINI.md를 읽고 프로젝트 맥락을 파악합니다.*

---

## 💡 왜 이 방식인가요?

*   **시스템 청정 유지**: 윈도우 네이티브 환경을 지저분하게 만들지 않고, 오직 프로젝트를 위한 전용 격리 칸막이(WSL) 안에서만 파일이 관리됩니다. (도커와 유사한 효과)
*   **압도적 성능**: 윈도우의 NTFS보다 리눅스의 Ext4 파일 시스템에서 빌드 및 패키지 설치 속도가 수십 배 빠릅니다.
*   **완벽한 일관성**: 우리가 최종 배포할 Cloudflare 서버 역시 리눅스 기반입니다. 로컬과 서버의 환경을 100% 일치시켜 "내 컴에선 되는데 서버에선 안 되는" 문제를 방지합니다.

---

> [!TIP]
> 윈도우와 WSL 간의 파일 이동은 탐색기 주소창에 `\\wsl$` 를 입력하여 자유롭게 할 수 있습니다.

---

## ❓ 자주 묻는 질문 (FAQ)

### Q. 주력으로 쓸 컴퓨터에 설치해야 하나요?

**네, 자주 사용하는 컴퓨터에 설치하시는 게 좋습니다.**

로컬에서 작업한 내용을 홈페이지로 배포하는 구조이기 때문에, 내 로컬(PC)과 홈페이지가 항상 페어링되어 있는 형태가 편합니다. 여러 PC에 설치하면 PC 간 데이터 동기화 문제가 생길 수 있어요.

---

### Q. 여러 PC에 설치해도 되나요?

**가능은 하지만 권장하지 않습니다.**

- 여러 PC에 설치하면 어느 PC가 "최신 상태"인지 관리해야 함
- 한 PC에서 수정 후 다른 PC에서 작업하면 충돌 가능
- 백업 목적이라면 Git으로 코드를 관리하는 것이 더 안전

> 💡 단, WSL/Ubuntu 설치 자체는 기존 윈도우 시스템과 충돌하지 않습니다. 완전히 격리된 공간입니다.

---

### Q. 진료 중에 청구프로그램 쓰면서 동시에 설치해도 되나요?

**네, 가능합니다.**

- WSL/Ubuntu 설치는 백그라운드에서 진행됨
- 오케이차트 등 기존 프로그램 사용에 영향 없음
- 단, 설치 완료 후 **한 번의 재부팅**이 필요합니다

---

### Q. Windows 10인데 나중에 11로 바꾸면 문제없나요?

**문제없습니다.**

- Windows 10과 11 모두 WSL 2를 지원
- OS 업그레이드해도 WSL 환경은 그대로 유지됨
- Home 버전도 Pro 버전도 모두 가능

---

## 🔧 트러블슈팅

설치 중 문제가 발생하면 아래에서 증상을 찾아보세요.

### WSL 설치 단계

#### "가상 머신 플랫폼" 오류가 뜹니다

→ **Windows 기능을 활성화**해야 합니다.

<details>
<summary>📌 상세 해결 방법</summary>

1. 제어판 → 프로그램 → 프로그램 및 기능
2. 좌측 "Windows 기능 켜기/끄기" 클릭
3. 다음 3가지 항목 체크:
   - ✅ Linux용 Windows 하위 시스템
   - ✅ 가상 머신 플랫폼
   - ✅ Windows 하이퍼바이저 플랫폼
4. 확인 후 재부팅

</details>

---

#### Windows 기능 설정 후에도 같은 오류가 뜹니다

→ **BIOS에서 가상화(VT-x/SVM)를 활성화**해야 합니다.

<details>
<summary>📌 상세 해결 방법</summary>

1. 컴퓨터 재부팅
2. 부팅 시 BIOS 진입 (제조사별로 F2, F10, Del 등)
3. 다음 항목을 찾아 Enable:
   - Intel CPU: `VT-x`, `Intel Virtualization Technology`
   - AMD CPU: `SVM`, `AMD-V`
4. 저장(F10) 후 재부팅

> BIOS 메뉴에서 "Virtualization", "VT", "SVM" 키워드를 찾으세요.

</details>

---

### Ubuntu 설치 단계

#### WSL은 설치됐는데 Ubuntu가 안 보입니다

→ **Ubuntu를 별도로 설치**해야 합니다.

<details>
<summary>📌 상세 해결 방법</summary>

**방법 1: 명령어로 설치**
```powershell
wsl --install -d Ubuntu-22.04
```

**방법 2: Microsoft Store에서 설치**
1. Store에서 "Ubuntu" 검색
2. "Ubuntu" 또는 "Ubuntu 22.04 LTS" 설치

</details>

---

#### 다운로드 속도가 너무 느립니다 (1분에 1% 수준)

→ **네트워크 문제**일 가능성이 높습니다.

- 패키지 용량은 약 380MB로 보통 5-10분 내 완료
- 유선 연결 권장
- 너무 느리면 `Ctrl+C`로 취소 후 Microsoft Store에서 시도

---

#### ISO 파일이 다운로드됩니다 (ubuntu-xx.xx.iso)

→ **잘못된 경로에서 다운로드**한 것입니다.

- 우분투 공식 홈페이지의 ISO는 WSL용이 아님
- **Microsoft Store**에서 다시 받으세요
- 다운받은 ISO 파일은 삭제해도 됩니다

---

### 사용자 계정 단계

#### Ubuntu 설치 후 ID/PW 입력창을 건너뛰었더니 오류가 납니다

→ **반드시 ID/PW를 입력해야** 합니다.

Ubuntu 설치 후 PowerShell에 "Installing, this may take a few minutes..." 메시지가 뜨고, 이후 ID/PW 입력창이 나타납니다. 이 창을 입력하지 않고 닫으면 오류가 발생합니다.

**해결 방법**: WSL과 Ubuntu를 모두 삭제 후 다시 설치하세요.

---

#### 바로 root@xxx:~# 로 들어갑니다

→ 사용자 계정 설정이 건너뛰어진 경우입니다. **새 사용자를 만들어야** 합니다.

<details>
<summary>📌 상세 해결 방법</summary>

```bash
# 1. 새 사용자 생성
adduser 원하는아이디

# 2. sudo 권한 부여
usermod -aG sudo 원하는아이디

# 3. 새 사용자로 전환
su - 원하는아이디
```

</details>

---

#### "ID is not in the sudoers file" 오류

→ 사용자에게 **관리자 권한이 없는** 상태입니다.

<details>
<summary>📌 상세 해결 방법</summary>

```bash
# 1. root로 전환 (exit 입력)
exit

# 2. 권한 부여
usermod -aG sudo 아이디

# 3. 다시 사용자로 전환
su - 아이디
```

</details>

---

#### 비밀번호 입력 시 화면에 아무것도 안 보입니다

→ **정상입니다.** 보안을 위해 입력 문자가 표시되지 않습니다.

그냥 비밀번호를 입력하고 Enter를 누르세요.

---

### 터미널 사용

#### Ctrl+V로 붙여넣기가 안 됩니다

→ Ubuntu 터미널에서는 **마우스 우클릭**으로 붙여넣기합니다.

1. 원하는 텍스트를 복사 (Ctrl+C)
2. Ubuntu 터미널에서 **마우스 우클릭**
3. 자동으로 붙여넣기됨

---

#### 긴 명령어가 중간에 잘립니다

→ **한 줄씩 입력**하세요.

여러 줄을 한 번에 붙여넣으면 일부만 실행될 수 있습니다. `&&`로 연결된 명령어도 분리해서 실행하는 것이 안전합니다.

---

### 개발 서버 실행

#### localhost:4321이 안 열립니다

→ **서버가 실행 중이어야** 합니다.

- Ubuntu 터미널에서 `npm run dev`로 서버를 먼저 띄워야 함
- 서버가 내려가면 localhost 접속 불가
- Gemini CLI에서 "로컬서버 실행해줘"라고 해도 됨

---

#### `npm run dev` 실행 시 "EACCES: permission denied" 에러

→ 프로젝트 폴더의 **파일 권한이 꼬인** 상태입니다.

<details>
<summary>📌 상세 해결 방법</summary>

**원인**: `sudo npm install` 등을 실행하면 파일들이 root 소유가 되어, 일반 사용자로 실행 시 권한 에러가 발생합니다.

**해결 방법**:
```bash
# 1. 프로젝트 폴더 소유권을 현재 사용자로 변경
sudo chown -R $USER:$USER ~/clinic-os

# 2. Astro 캐시 폴더 삭제
rm -rf ~/clinic-os/core/.astro

# 3. 다시 실행
cd ~/clinic-os
npm run dev
```

**예방법**: 앞으로는 `sudo npm ...` 대신 일반 사용자로 npm 명령어를 실행하세요.

</details>

---

#### `sudo npm run dev`로 하면 되는데 그냥 하면 안 됩니다

→ **sudo 없이 실행되도록** 권한을 정리해야 합니다.

`sudo npm run dev`로 실행하면 당장은 되지만, 새로 생성되는 파일들이 계속 root 소유가 되어 문제가 악화됩니다.

위의 "EACCES: permission denied" 해결 방법을 따라 권한을 정리하세요.

---

## ✅ 설치 완료 체크리스트

모든 설치가 끝나면 다음을 확인하세요:

```bash
# 1. WSL 상태 확인 (Ubuntu가 VERSION 2로 표시되어야 함)
wsl -l -v

# 2. 현재 사용자 확인 (root가 아닌 내 아이디가 나와야 함)
whoami

# 3. Node.js 확인
node -v

# 4. npm 확인
npm -v
```

모든 항목이 정상이면 환경 설정 완료! 🎉

---

> 📅 최종 업데이트: 2026-01-21
> 📝 Gemini CLI 기반으로 업데이트, 터미널 꾸미기 가이드 추가 
