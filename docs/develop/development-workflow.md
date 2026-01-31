# 🚀 앱 실행 가이드

---

## 0. 프로젝트 설치 (최초 1회)

```bash
# 1. 저장소 클론
git clone https://github.com/[username]/study-english.git
cd study-english

# 2. 의존성 설치
pnpm install
```

---

## 1. 시뮬레이터에서 실행

### 방법 1: 직접 실행
```bash
pnpm ios       # iOS 시뮬레이터 빌드 + 실행
pnpm android   # Android 에뮬레이터 빌드 + 실행
```

### 방법 2: 개발 서버 먼저 실행 (권장)
```bash
pnpm start
```

터미널에 메뉴가 표시됩니다:
```
› Press a │ Android 에뮬레이터 열기
› Press i │ iOS 시뮬레이터 열기
› Press w │ 웹 브라우저 열기
› Press j │ 디버거 열기
› Press r │ 앱 새로고침
› Press m │ 개발 메뉴 열기
› Press o │ 코드 에디터 열기
› Press ? │ 모든 명령어 보기
```

> ⚠️ 첫 실행 시 빌드에 3-5분 소요

---

## 2. 실제 폰에서 실행

### Android 기기

**Step 1: Development Build 생성 (최초 1회)**
```bash
cd apps/mobile
eas build --profile development --platform android
```

**Step 2: 폰에 앱 설치**
- 빌드 완료 시 **QR 코드** 표시됨
- 폰 카메라로 QR 스캔 → 다운로드 → 설치
- 또는 빌드 링크에서 APK 다운로드 후 설치

**Step 3: 개발 서버 연결**
```bash
# 루트 폴더에서
pnpm start
```
- 터미널에 QR 코드 표시됨
- 폰에서 설치한 앱 실행 → **Scan QR Code** → 터미널 QR 스캔
- 또는 터미널에 표시된 IP 주소 직접 입력 (예: `http://192.168.x.x:8081`)

> ⚠️ 폰과 맥북이 **같은 WiFi**에 연결되어 있어야 함!

---

### iOS 기기

**Step 1: Apple Developer 가입**
- [developer.apple.com/programs](https://developer.apple.com/programs/)
- 연간 $99 (약 13만원)
- ⚠️ 가입 전까지는 **시뮬레이터 사용**

**Step 2: Development Build 생성 (최초 1회)**
```bash
cd apps/mobile
eas build --profile development --platform ios
```

**Step 3: 폰에 앱 설치**
- 빌드 완료 시 **QR 코드** 표시됨
- 폰 카메라로 QR 스캔 → TestFlight 또는 직접 설치

**Step 4: 개발 서버 연결**
```bash
pnpm start
```
- Android와 동일하게 QR 스캔 또는 IP 입력

---

## 📋 명령어 요약

| 명령어 | 설명 |
|--------|------|
| `pnpm start` | 개발 서버 실행 (단축키로 시뮬레이터/에뮬레이터 제어) |
| `pnpm ios` | iOS 시뮬레이터 빌드 + 실행 |
| `pnpm android` | Android 에뮬레이터 빌드 + 실행 |

---

## ⌨️ 개발 서버 단축키

| 단축키 | 기능 |
|--------|------|
| `a` | Android 에뮬레이터 열기 |
| `i` | iOS 시뮬레이터 열기 |
| `w` | 웹 브라우저 열기 |
| `r` | 앱 새로고침 |
| `m` | 개발 메뉴 열기 |
| `j` | JS 디버거 열기 |
| `o` | 에디터에서 프로젝트 열기 |
| `?` | 모든 명령어 보기 |

---

## ⚠️ 다시 빌드가 필요한 경우

| 상황 | 재빌드? |
|------|---------|
| JS/TS 코드 수정 | ❌ Hot Reload |
| 스타일 수정 | ❌ Hot Reload |
| 새 패키지 설치 (일반) | ❌ |
| 새 패키지 설치 (네이티브) | ✅ |
| app.json 수정 | ✅ |
| 네이티브 코드 수정 | ✅ |

---

## ❓ FAQ

### Q: 빌드를 다시 하면 기존 앱에서 실시간 디버깅이 안 되나요?

**아니요, 계속 됩니다!**

| 상황 | 결과 |
|------|------|
| 새 빌드 설치 | 기존 앱 업데이트 (덮어쓰기) |
| `pnpm start` 실행 | 개발 서버 시작 |
| 폰에서 앱 열기 | 자동 연결 → **실시간 디버깅 ✅** |

### Q: 언제 다시 연결해야 하나요?

| 상황 | 조치 |
|------|------|
| 새 빌드 설치 후 | 앱 열면 자동 연결 |
| 개발 서버 재시작 후 | 앱에서 Reload 또는 QR 다시 스캔 |
| WiFi 바뀌었을 때 | QR 다시 스캔 (IP 변경됨) |
