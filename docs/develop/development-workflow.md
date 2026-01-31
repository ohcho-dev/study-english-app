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

### iOS 시뮬레이터
```bash
pnpm ios
```
- Xcode 설치 필요
- 첫 실행 시 빌드 시간 3-5분
- **실시간 디버깅 ✅**

### Android 에뮬레이터
```bash
pnpm android
```
- Android Studio 설치 + 에뮬레이터 먼저 실행 필요
- 첫 실행 시 빌드 시간 3-5분
- **실시간 디버깅 ✅**

---

## 2. 실제 폰에서 실행

### Android 기기

```bash
# 1. Development Build 생성 (최초 1회)
cd apps/mobile
eas build --profile development --platform android

# 2. QR 스캔하여 폰에 설치

# 3. 개발 서버 실행 (루트에서)
pnpm start

# 4. 폰에서 앱 열기 → 자동 연결
```
- **실시간 디버깅 ✅** (같은 WiFi 필요)

### iOS 기기

```bash
# ⚠️ Apple Developer 계정 필요 ($99/년)

cd apps/mobile
eas build --profile development --platform ios
```
- Apple Developer 가입 전까지 **시뮬레이터 사용**

---

## 📋 명령어 요약

| 명령어 | 설명 | 실행 위치 |
|--------|------|----------|
| `pnpm ios` | iOS 시뮬레이터 | 루트 |
| `pnpm android` | Android 에뮬레이터 | 루트 |
| `pnpm start` | 개발 서버 (실기기용) | 루트 |

---

## ⚠️ 다시 빌드가 필요한 경우

| 상황 | 재빌드? |
|------|---------|
| JS/TS 코드 수정 | ❌ Hot Reload |
| 네이티브 패키지 추가 | ✅ |
| app.json 수정 | ✅ |
