# 📦 필수 라이브러리 설치 가이드

---

## 개요

프로젝트 기획(`rules/`, `docs/plan/`)을 기반으로 필요한 라이브러리를 정리했습니다.

---

## 0. UI 컴포넌트 (React Native Reusables 패턴)

> ⚠️ **중요**: UI 스타일링은 **NativeWind + CSS 변수** 방식을 사용합니다.

### 핵심 패턴
- **CSS 변수 기반 테마**: `global.css`에서 `:root` / `.dark:root`로 정의
- **shadcn/ui 스타일 클래스**: `bg-background`, `text-foreground`, `bg-card` 등
- **다크/라이트 모드**: `_layout.tsx`에서 `dark` 클래스 토글로 자동 전환

### 설정 파일
| 파일 | 역할 |
|------|------|
| `global.css` | CSS 변수 정의 (light/dark) |
| `tailwind.config.js` | `hsl(var(--color))` 참조 |
| `lib/constants.ts` | 테마 상수 + 네비게이션 테마 |
| `lib/useColorScheme.ts` | 현재 테마 모드 반환 |

### 사용 예시
```tsx
// 클래스명으로 스타일링 (테마 자동 적용)
<View className="bg-background">
  <Text className="text-foreground">Hello</Text>
  <TouchableOpacity className="bg-primary">
    <Text className="text-primary-foreground">Button</Text>
  </TouchableOpacity>
</View>
```

### 테마 변경
```typescript
// lib/constants.ts
export const APP_THEME: ThemeMode = 'dark';  // 'dark' | 'light' | 'system'
```

---

## 1. UI/스타일링
```

---

## 2. 상태 관리

### TanStack Query (React Query)
- **용도**: 서버 데이터 캐싱, API 호출 관리
- **설치**:
```bash
cd apps/mobile
pnpm add @tanstack/react-query
```

### Zustand
- **용도**: 로컬 상태 관리 (Listening Mode 등)
- **설치**:
```bash
cd apps/mobile
pnpm add zustand
```

### react-hook-form + zod (폼 검증)
- **용도**: 폼 상태 관리 + 스키마 기반 검증 (웹과 동일하게 사용)
- **설치**:
```bash
cd apps/mobile
pnpm add react-hook-form zod @hookform/resolvers
```
- **사용 예시**:
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const { control, handleSubmit } = useForm({
  resolver: zodResolver(schema),
});
```

---

## 3. 미디어 (오디오/비디오)

### expo-av
- **용도**: 음성 녹음/재생
- **설치**:
```bash
cd apps/mobile
pnpm add expo-av
```

### react-native-video
- **용도**: 배경 루프 영상 재생 (시뮬레이션 배경)
- **설치**:
```bash
cd apps/mobile
pnpm add react-native-video
```
> ⚠️ 네이티브 모듈 → 설치 후 **재빌드 필요** (`eas build`)

---

## 4. 채팅 UI

### react-native-gifted-chat
- **용도**: 채팅 인터페이스 (AI 대화)
- **설치**:
```bash
cd apps/mobile
pnpm add react-native-gifted-chat
```

---

## 5. Bottom Sheet (모달/선택 UI)

### @gorhom/bottom-sheet
- **용도**: 드롭다운, 날짜선택, 설정모달 등 (아래에서 올라오는 UI)
- **장점**: 성능 최고, 제스처 지원, iOS/Android 네이티브 느낌
- **설치**:
```bash
cd apps/mobile
pnpm add @gorhom/bottom-sheet
```
- **사용 예시**:
```typescript
import BottomSheet from '@gorhom/bottom-sheet';

<BottomSheet snapPoints={['25%', '50%']}>
  <View>
    <Text>옵션 1</Text>
    <Text>옵션 2</Text>
  </View>
</BottomSheet>
```
> Dropdown, DatePicker 대신 Bottom Sheet로 구현하면 더 모던한 UX

---

## 5. 파일 시스템/캐싱

### expo-file-system
- **용도**: TTS 오디오 파일 로컬 캐싱
- **설치**:
```bash
cd apps/mobile
pnpm add expo-file-system
```

---

## 6. 인증/데이터베이스

### Supabase
- **용도**: Auth (소셜 로그인) + PostgreSQL DB
- **설치**:
```bash
cd apps/mobile
pnpm add @supabase/supabase-js
```

### expo-auth-session (소셜 로그인)
- **용도**: OAuth 인증 플로우
- **설치**:
```bash
cd apps/mobile
pnpm add expo-auth-session expo-crypto expo-web-browser
```

---

## 7. 내비게이션/라우팅

### expo-router (이미 설치됨)
- 파일 기반 라우팅
- 추가 설치 불필요

---

## 8. 유틸리티 라이브러리

### date-fns (날짜/시간)
- **용도**: 날짜 포맷, 계산, 비교
- **장점**: 모듈식 import로 번들 크기 최소화
- **설치**:
```bash
cd apps/mobile
pnpm add date-fns
```
- **사용 예시**:
```typescript
import { format, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';

format(new Date(), 'yyyy년 MM월 dd일', { locale: ko });
```

### lodash-es (유틸리티 함수)
- **용도**: 배열/객체 조작, debounce, throttle 등
- **장점**: ES 모듈 버전으로 트리쉐이킹 지원
- **설치**:
```bash
cd apps/mobile
pnpm add lodash-es
pnpm add -D @types/lodash-es
```

### @react-native-async-storage/async-storage
- **용도**: 로컬 스토리지 (설정, 토큰 저장 등)
- **설치**:
```bash
cd apps/mobile
pnpm add @react-native-async-storage/async-storage
```

### react-native-safe-area-context (이미 설치됨)
- 노치/홈바 영역 처리
- 추가 설치 불필요

---

## 10. 기타 유틸리티

### class-variance-authority (cva)
- **용도**: 버튼 variants 등 컴포넌트 스타일 관리 (shadcn/ui 스타일)
- **설치**:
```bash
cd apps/mobile
pnpm add class-variance-authority clsx tailwind-merge
```

---

## 📋 한 번에 설치하기

```bash
cd apps/mobile

# 필수 패키지
pnpm add nativewind \
  @tanstack/react-query \
  zustand \
  react-hook-form zod @hookform/resolvers \
  expo-av \
  expo-file-system \
  expo-font \
  react-native-video \
  react-native-gifted-chat \
  @gorhom/bottom-sheet \
  @supabase/supabase-js \
  expo-auth-session expo-crypto \
  class-variance-authority clsx tailwind-merge \
  lucide-react-native react-native-svg \
  date-fns \
  lodash-es \
  @react-native-async-storage/async-storage

# Dev 의존성
pnpm add -D tailwindcss@3.3.2 @types/lodash-es
```

---

## ⚠️ 설치 후 필요한 작업

| 패키지 | 추가 작업 |
|--------|----------|
| **NativeWind** | `tailwind.config.js`, `babel.config.js` 설정 |
| **react-native-video** | 재빌드 필요 (`eas build` 또는 `pnpm ios`) |
| **expo-auth-session** | app.json에 scheme 설정 |
| **Fonts** | `useFonts` 훅으로 로드 |

---

## 📊 설치 우선순위

| 우선순위 | 패키지 | 이유 |
|---------|--------|------|
| **1순위** | NativeWind, TanStack Query | 기본 스타일링 + 데이터 |
| **2순위** | expo-av, expo-file-system | 오디오 기능 |
| **3순위** | Supabase, expo-auth-session | 로그인 기능 |
| **4순위** | react-native-video, gifted-chat | 콘텐츠 기능 |
