# 🎨 스타일/테마 개발 규칙

> **⚠️ 필수 규칙**: 모든 스타일 관련 코드는 반드시 이 문서의 규칙을 따라야 합니다.

---

## 핵심 원칙

```
1. 모든 스타일 토큰은 theme 파일에 정의
2. 컴포넌트에서 하드코딩된 스타일 값 사용 금지
3. theme 파일만 수정하면 전체 앱 디자인 변경 가능
```

---

## 테마 파일 구조

```
src/
├── theme/
│   ├── index.ts          # 메인 테마 export
│   ├── colors.ts         # 컬러 팔레트
│   ├── typography.ts     # 폰트, 사이즈
│   ├── spacing.ts        # 간격, 여백
│   ├── assets.ts         # 로고, 이미지
│   └── components.ts     # 컴포넌트별 스타일 프리셋
```

---

## 테마 토큰 정의

### 1. 컬러 (colors.ts)

```typescript
export const colors = {
  // 브랜드 컬러
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',
  
  secondary: '#22D3EE',
  secondaryLight: '#67E8F9',
  secondaryDark: '#06B6D4',
  
  // 시맨틱 컬러
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // 배경
  background: '#FFFFFF',
  backgroundSecondary: '#F9FAFB',
  backgroundTertiary: '#F3F4F6',
  
  // 텍스트
  text: '#1F2937',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',
  
  // 보더
  border: '#E5E7EB',
  borderFocus: '#6366F1',
  
  // 오버레이
  overlay: 'rgba(0, 0, 0, 0.5)',
  
  // SSO 브랜드 컬러 (고정)
  kakao: '#FEE500',
  naver: '#03C75A',
  google: '#FFFFFF',
  apple: '#000000',
};
```

### 2. 타이포그래피 (typography.ts)

```typescript
export const fonts = {
  // 폰트 패밀리
  family: {
    regular: 'Pretendard-Regular',
    medium: 'Pretendard-Medium',
    semibold: 'Pretendard-SemiBold',
    bold: 'Pretendard-Bold',
  },
  
  // 폰트 사이즈
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  
  // 라인 하이트
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  // 텍스트 프리셋
  presets: {
    h1: { fontSize: 30, fontFamily: 'Pretendard-Bold', lineHeight: 1.2 },
    h2: { fontSize: 24, fontFamily: 'Pretendard-Bold', lineHeight: 1.3 },
    h3: { fontSize: 20, fontFamily: 'Pretendard-SemiBold', lineHeight: 1.4 },
    body: { fontSize: 16, fontFamily: 'Pretendard-Regular', lineHeight: 1.5 },
    bodySmall: { fontSize: 14, fontFamily: 'Pretendard-Regular', lineHeight: 1.5 },
    caption: { fontSize: 12, fontFamily: 'Pretendard-Regular', lineHeight: 1.4 },
    button: { fontSize: 16, fontFamily: 'Pretendard-SemiBold', lineHeight: 1 },
  },
};
```

### 3. 간격 (spacing.ts)

```typescript
export const spacing = {
  // 기본 단위: 4px
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  
  // 시맨틱
  screenPadding: 16,
  cardPadding: 16,
  buttonPadding: 12,
  inputPadding: 12,
  sectionGap: 24,
  itemGap: 12,
};

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};
```

### 4. 에셋 (assets.ts)

```typescript
export const assets = {
  // 로고
  logo: require('@/assets/images/logo.png'),
  logoLight: require('@/assets/images/logo-light.png'),
  logoDark: require('@/assets/images/logo-dark.png'),
  
  // 스플래시
  splash: require('@/assets/images/splash.png'),
  
  // 아이콘 (커스텀)
  icons: {
    mic: require('@/assets/icons/mic.png'),
    speaker: require('@/assets/icons/speaker.png'),
  },
  
  // SSO 로고 (고정)
  sso: {
    kakao: require('@/assets/sso/kakao.png'),
    naver: require('@/assets/sso/naver.png'),
    google: require('@/assets/sso/google.png'),
    apple: require('@/assets/sso/apple.png'),
  },
};
```

### 5. 컴포넌트 프리셋 (components.ts)

```typescript
import { colors, spacing, borderRadius, fonts } from './index';

export const components = {
  // 버튼 스타일
  button: {
    primary: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.buttonPadding,
      paddingHorizontal: spacing[6],
      borderRadius: borderRadius.lg,
    },
    secondary: {
      backgroundColor: colors.backgroundSecondary,
      paddingVertical: spacing.buttonPadding,
      paddingHorizontal: spacing[6],
      borderRadius: borderRadius.lg,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.buttonPadding,
      paddingHorizontal: spacing[6],
      borderRadius: borderRadius.lg,
    },
  },
  
  // 입력 필드 스타일
  input: {
    default: {
      height: 48,
      paddingHorizontal: spacing.inputPadding,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      fontSize: fonts.size.md,
    },
  },
  
  // 카드 스타일
  card: {
    default: {
      backgroundColor: colors.background,
      padding: spacing.cardPadding,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
  },
};
```

### 6. 메인 Export (index.ts)

```typescript
export { colors } from './colors';
export { fonts } from './typography';
export { spacing, borderRadius, shadow } from './spacing';
export { assets } from './assets';
export { components } from './components';

// 통합 테마 객체
export const theme = {
  colors: require('./colors').colors,
  fonts: require('./typography').fonts,
  spacing: require('./spacing').spacing,
  borderRadius: require('./spacing').borderRadius,
  shadow: require('./spacing').shadow,
  assets: require('./assets').assets,
  components: require('./components').components,
};
```

---

## 사용 규칙

### ✅ 올바른 사용

```tsx
import { colors, fonts, spacing } from '@/theme';

const styles = StyleSheet.create({
  container: {
    padding: spacing.screenPadding,
    backgroundColor: colors.background,
  },
  title: {
    ...fonts.presets.h1,
    color: colors.text,
  },
});
```

### ❌ 잘못된 사용 (금지)

```tsx
// 하드코딩된 값 사용 금지!
const styles = StyleSheet.create({
  container: {
    padding: 16,              // ❌ spacing.screenPadding 사용
    backgroundColor: '#fff',   // ❌ colors.background 사용
  },
  title: {
    fontSize: 30,             // ❌ fonts.size['3xl'] 사용
    color: '#1F2937',         // ❌ colors.text 사용
  },
});
```

---

## NativeWind 사용 시 규칙

NativeWind(Tailwind) 사용 시에도 테마와 동기화해야 합니다.

### tailwind.config.js 설정

```javascript
const { colors, spacing, borderRadius, fonts } = require('./src/theme');

module.exports = {
  theme: {
    extend: {
      colors: colors,
      spacing: spacing,
      borderRadius: borderRadius,
      fontFamily: fonts.family,
      fontSize: fonts.size,
    },
  },
};
```

---

## 테마 변경 시나리오

### 브랜딩 변경 시

```typescript
// colors.ts 만 수정하면 전체 앱 컬러 변경
export const colors = {
  primary: '#FF6B6B',  // 기존: '#6366F1' → 새로운 브랜드 컬러
  // ...
};
```

### 폰트 변경 시

```typescript
// typography.ts 만 수정
export const fonts = {
  family: {
    regular: 'NotoSans-Regular',  // 기존: 'Pretendard-Regular'
    // ...
  },
};
```

---

## 체크리스트

코드 리뷰 시 확인 사항:

- [ ] 하드코딩된 색상 값이 없는가?
- [ ] 하드코딩된 폰트 사이즈가 없는가?
- [ ] 하드코딩된 간격(padding/margin)이 없는가?
- [ ] 새로운 스타일 값이 필요하면 theme에 먼저 추가했는가?
- [ ] 이미지/로고는 assets.ts에 등록되어 있는가?

---

## 다크 모드 대응 (향후)

MVP 이후 다크 모드 지원 시:

```typescript
export const lightColors = { /* ... */ };
export const darkColors = { /* ... */ };

// useColorScheme 훅으로 전환
```
