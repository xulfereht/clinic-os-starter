# 터미널 꾸미기 가이드 (Windows Terminal + WSL)

> 개발 생산성을 높이고 시각적으로 아름다운 터미널 환경을 설정합니다.

---

## 목표

- 깨진 문자(`?`, `□`) 해결
- Git 상태, Node.js 버전 등이 표시되는 모던한 프롬프트바 적용
- Gemini CLI 사용 시 더 나은 가독성

**완성 예시:**
```
░▒▓  user  ~/clinic-os   main  ⬆1   v20.11.0  14:30
➜
```

---

## 1단계: Nerd Font 설치 (Windows 작업)

터미널의 특수문자(아이콘, 화살표 등)를 표시하려면 **Nerd Font**가 필요합니다.

### 다운로드

1. [Caskaydia Cove Nerd Font](https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/CascadiaCode.zip) 다운로드
2. 압축 해제
3. `CaskaydiaCoveNerdFont-Regular.ttf` 더블 클릭 → **설치**

> 다른 폰트를 원하면 [Nerd Fonts](https://www.nerdfonts.com/font-downloads)에서 선택

---

## 2단계: Windows Terminal 설정 (Windows 작업)

설치한 폰트를 Windows Terminal에 적용합니다.

1. Windows Terminal 실행
2. `Ctrl` + `,` → 설정 열기
3. 왼쪽 메뉴에서 **Ubuntu** (또는 **WSL**) 선택
4. **모양 (Appearance)** 탭 클릭
5. **글꼴 (Font face)**: `CaskaydiaCove Nerd Font` 선택
6. **저장**

---

## 3단계: Starship 설치 (WSL 작업)

[Starship](https://starship.rs/)은 빠르고 커스터마이징 가능한 프롬프트 테마 엔진입니다.

```bash
# Starship 설치
curl -sS https://starship.rs/install.sh | sh -s -- -y

# .bashrc에 초기화 스크립트 추가
if ! grep -q "starship init bash" ~/.bashrc; then
    echo 'eval "$(starship init bash)"' >> ~/.bashrc
fi
```

---

## 4단계: 테마 적용 (WSL 작업)

Powerline 스타일의 상태바 설정을 적용합니다.

```bash
# 설정 디렉토리 생성
mkdir -p ~/.config

# 설정 파일 생성
cat << 'EOF' > ~/.config/starship.toml
format = """
[░▒▓](fg:status_bg)\
[ ](fg:primary_bg)\
$os\
$username\
[](bg:secondary_bg fg:primary_bg)\
$directory\
[](fg:secondary_bg bg:tertiary_bg)\
$git_branch\
$git_status\
[](fg:tertiary_bg bg:quaternary_bg)\
$nodejs\
$rust\
$python\
[](fg:quaternary_bg bg:p_footer)\
$time\
[ ](fg:p_footer)\
$line_break\
$character"""

palette = "custom"

[palettes.custom]
primary_bg = "#33658A"
secondary_bg = "#86BBD8"
tertiary_bg = "#F6AE2D"
quaternary_bg = "#F26419"
p_footer = "#2F4858"
status_bg = "#E63946"

[os]
disabled = false
style = "bg:primary_bg fg:white"

[os.symbols]
Ubuntu = " "
Linux = " "
Windows = " "

[username]
show_always = true
style_user = "bg:primary_bg fg:white"
style_root = "bg:primary_bg fg:white"
format = '[$user]($style)'

[directory]
style = "bg:secondary_bg fg:black"
format = "[ $path ]($style)"
truncation_length = 3
truncation_symbol = "…/"

[git_branch]
symbol = " "
style = "bg:tertiary_bg fg:black"
format = '[[ $symbol$branch ]($style)]($style)'

[git_status]
style = "bg:tertiary_bg fg:black"
format = '[[($all_status$ahead_behind )]($style)]($style)'

[nodejs]
symbol = " "
style = "bg:quaternary_bg fg:black"
format = '[[ $symbol($version) ]($style)]($style)'

[rust]
symbol = " "
style = "bg:quaternary_bg fg:black"
format = '[[ $symbol($version) ]($style)]($style)'

[python]
symbol = " "
style = "bg:quaternary_bg fg:black"
format = '[[ $symbol($version) ]($style)]($style)'

[time]
disabled = false
time_format = "%R"
style = "bg:p_footer fg:white"
format = '[[  $time ]($style)]($style)'

[status]
disabled = false
format = '[ $symbol ](bg:status_bg fg:white)'

[character]
success_symbol = "[➜](bold green)"
error_symbol = "[➜](bold red)"

[line_break]
disabled = false
EOF
```

---

## 5단계: 적용 확인

```bash
source ~/.bashrc
```

터미널이 새로운 스타일로 변경됩니다!

---

## 자동 설치 스크립트 (원클릭)

위 3~4단계를 한 번에 실행하는 스크립트:

```bash
# Starship + 테마 원클릭 설치
curl -sS https://starship.rs/install.sh | sh -s -- -y && \
grep -q "starship init bash" ~/.bashrc || echo 'eval "$(starship init bash)"' >> ~/.bashrc && \
mkdir -p ~/.config && \
curl -sS https://raw.githubusercontent.com/xulfereht/clinic-os-core/main/docs/starship.toml -o ~/.config/starship.toml && \
source ~/.bashrc
```

> 위 스크립트는 Gemini CLI에서 "터미널 꾸며줘"라고 요청하면 실행할 수 있습니다.

---

## 트러블슈팅

### 아이콘이 깨져 보임 (□, ?)

→ Nerd Font가 제대로 적용되지 않음
1. Windows Terminal 설정에서 폰트 확인
2. `CaskaydiaCove Nerd Font` 또는 `CaskaydiaCove NF` 선택

### 색상이 안 나옴

→ Windows Terminal 버전 확인 (최신 버전 권장)

```powershell
# PowerShell에서 업데이트
winget upgrade Microsoft.WindowsTerminal
```

### Starship이 적용 안 됨

```bash
# .bashrc에 추가됐는지 확인
cat ~/.bashrc | grep starship

# 없으면 수동 추가
echo 'eval "$(starship init bash)"' >> ~/.bashrc
source ~/.bashrc
```

---

## 커스터마이징

### 색상 변경

`~/.config/starship.toml`의 `[palettes.custom]` 섹션 수정:

```toml
[palettes.custom]
primary_bg = "#1E3A5F"      # 메인 배경색 변경
secondary_bg = "#4A90A4"    # 디렉토리 배경색
tertiary_bg = "#F5B041"     # Git 배경색
quaternary_bg = "#E74C3C"   # Node.js 배경색
p_footer = "#2C3E50"        # 시간 배경색
```

### 표시 항목 변경

```toml
# 시간 숨기기
[time]
disabled = true

# Python 버전 표시 안함
[python]
disabled = true
```

---

## 다음 단계

- [Gemini CLI 설치](./GEMINI_CLI_SETUP.md) - AI 어시스턴트 설정
- [Windows 가이드](./WINDOWS_GUIDE.md) - WSL 기본 설정

---

> 최종 업데이트: 2026-01-21
