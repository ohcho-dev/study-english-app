# 💻 [개발 환경 세팅 보고서] MacBook (Apple Silicon)

| **문서 정보** | **내용** |
| --- | --- |
| **작성 일자** | 2026. 01. 31 |
| **대상 장비** | MacBook Air M2 (Apple Silicon) |
| **OS** | macOS Sequoia (or latest) |
| **목표** | 통합 기술 표준(React Native Expo + Python + Monorepo) 구동 환경 구축 |

---

## 1. 버전 표준 가이드 (Target Versions)

설치 전, 우리가 목표로 하는 도구들의 **최신 안정 버전(2026.01 기준)**입니다. 설치 후 이 버전들이 맞는지 확인해야 합니다.

| **구분** | **도구** | **목표 버전 (Target)** | **비고** |
| --- | --- | --- | --- |
| **Runtime** | **Node.js** | **v24.x (Active LTS)** | 실무용 안정 버전 |
| **Pkg Manager** | **pnpm** | **v10.x** | 모노레포용 패키지 매니저 |
| **Language** | **Python** | **v3.13.x** | FastAPI 최적화 버전 |
| **Dep Manager** | **Poetry** | **v2.x** | Python 의존성 관리 |
| **Linter** | **Ruff** | **v0.14+** | Python 통합 린터 |
| **Build Tool** | **Turborepo** | **v2.8+** | 모노레포 빌드 도구 |
| **Mobile** | **Watchman** | **v2026.01+** | RN 파일 감지 필수 |
| **Mobile** | **Java (JDK)** | **v17 (LTS)** | Android 빌드 호환성 최적 |
| **Mobile** | **EAS CLI** | **v13.x+** | Expo 클라우드 빌드/배포 |

---

## 2. 패키지 매니저: Homebrew (기반 공사)

모든 설치의 기초가 되는 도구입니다.

### ✅ 설치 및 업데이트

터미널(Terminal)을 열고 아래 명령어를 순서대로 실행하세요.

```bash
# 1. Homebrew 설치 여부 확인
brew --version

# [Case A: 미설치 시] 설치 스크립트 실행
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
# M2 환경 변수 설정 (설치 후 터미널에 뜨는 안내 메시지 참조 필수)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
source ~/.zshrc

# [Case B: 설치된 경우] 최신 정보로 업데이트
brew update && brew upgrade
```

---

## 3. 프론트엔드 환경 (Node.js & pnpm)

`nvm`으로 Node 버전을 관리하고, `pnpm`을 메인 패키지 매니저로 사용합니다.

### ✅ 설치 및 업데이트

```bash
# 1. nvm (Node Version Manager) 설치/업데이트
brew install nvm

# 2. 환경 변수 설정 (최초 1회 필수)
mkdir -p ~/.nvm
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"' >> ~/.zshrc
source ~/.zshrc

# 3. Node.js (LTS v24.x) 설치 및 적용
nvm install --lts
nvm use --lts
nvm alias default 'lts/*'

# 4. pnpm (v10.x) 설치/업데이트
# Node.js에 내장된 Corepack을 사용하여 설치하는 것을 권장합니다.
corepack enable
corepack prepare pnpm@latest --activate
```

---

## 4. 백엔드 환경 (Python & Poetry)

시스템 Python을 건드리지 않기 위해 `pyenv`를 사용합니다.

### ✅ 설치 및 업데이트

```bash
# 1. pyenv 및 빌드 의존성 설치/업데이트
brew install pyenv xz
brew upgrade pyenv

# 2. 환경 변수 설정 (최초 1회 필수)
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshrc
echo '[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.zshrc
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
source ~/.zshrc

# 3. Python v3.13.x 설치 및 전역 설정
pyenv install 3.13.2
pyenv global 3.13.2

# 4. Poetry (v2.x) 설치/업데이트
# (공식 인스톨러 사용 권장)
curl -sSL https://install.python-poetry.org | python3 -
# 환경 변수 추가
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
# 기존 사용자 업데이트
poetry self update

# 5. Ruff (Linter) 설치
pip install ruff
```

---

## 5. 모바일 인프라 (Watchman & JDK & EAS)

React Native 실행을 위한 필수 도구들입니다.

### ✅ 설치 및 업데이트

```bash
# 1. Watchman (파일 감지) 설치/업데이트
brew install watchman
brew upgrade watchman

# 2. Java (JDK 17) 설치
# Android 빌드에는 최신 Java 25보다 호환성이 좋은 JDK 17을 사용합니다.
brew install --cask zulu@17

# 3. EAS CLI (Expo 빌드/배포 필수)
pnpm add -g eas-cli

# 4. [선택] CocoaPods (Bare Workflow 사용 시만)
# Expo Managed Workflow에서는 EAS가 클라우드에서 빌드하므로 필수 아님
# 로컬 iOS 빌드가 필요한 경우에만 설치
# sudo gem install cocoapods
# sudo gem install ffi
```

- **Xcode:** Mac App Store에서 **업데이트** 버튼을 눌러 최신 버전(v26.2+)으로 유지해주세요. 설치 후 터미널에서 `xcode-select --install`을 한 번 실행해야 합니다.

---

## 6. 모노레포 도구 (Turborepo)

### ✅ 설치 및 업데이트

```bash
# 전역 설치 (최신 v2.8+ 설치됨)
pnpm add -g turbo
```

---

## 🛠️ 최종 검증 체크리스트 (Verification)

모든 설치가 끝났다면, 터미널을 완전히 종료했다가 다시 켜고 아래 명령어를 복사해서 붙여넣으세요.

결과가 목표 버전과 비슷하게 나오면 성공입니다.

```bash
echo "=== Frontend Environment ==="
node -v          # Expected: v24.x.x
pnpm -v          # Expected: v10.x.x
turbo --version  # Expected: v2.8.x

echo "=== Backend Environment ==="
python --version # Expected: v3.13.x
poetry --version # Expected: v2.x.x
ruff --version   # Expected: v0.14.x

echo "=== Mobile Infrastructure ==="
watchman --version
java -version    # Expected: 17.0.x
eas --version    # Expected: eas-cli/13.x.x
```

---

## 📝 참고: Expo 프로젝트 시작하기

환경 세팅이 완료되면 아래 명령어로 프로젝트를 시작할 수 있습니다.

```bash
# 모노레포 생성
npx create-turbo@latest my-app

# Expo 앱 생성 (apps/mobile 폴더 내)
npx create-expo-app@latest apps/mobile --template tabs

# EAS 프로젝트 연결
cd apps/mobile
eas init
```

---

## ✅ 체크리스트 요약

| 단계 | 도구 | 설치 완료 |
| --- | --- | --- |
| 1 | Homebrew | ☐ |
| 2 | nvm + Node.js | ☐ |
| 3 | pnpm | ☐ |
| 4 | pyenv + Python | ☐ |
| 5 | Poetry | ☐ |
| 6 | Ruff | ☐ |
| 7 | Watchman | ☐ |
| 8 | Java JDK 17 | ☐ |
| 9 | EAS CLI | ☐ |
| 10 | Turborepo | ☐ |
| 11 | Xcode | ☐ |

이제 **"통합 기술 표준"**에 완벽하게 부합하는 개발 환경이 갖춰졌습니다!
