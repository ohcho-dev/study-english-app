# 📝 코드 컨벤션 규칙

> **⛔️ CRITICAL AGENT RULE**:
> AI 에이전트는 **절대로** 사용자의 명시적인 승인 없이 `git commit`, `git push` 또는 배포(deploy) 명령을 실행해서는 안 됩니다.
> 모든 변경 사항은 사용자의 확인(Review)을 거친 후에만 커밋할 수 있습니다.

> **⚠️ 필수 규칙**: 모든 코드는 반드시 이 문서의 규칙을 따라야 합니다.

---

## 1. 함수 선언 스타일

### ✅ 화살표 함수 사용 (Arrow Function)

모든 함수 및 컴포넌트는 **화살표 함수**로 작성합니다.

```typescript
// ✅ 올바른 방식
export const MyComponent = () => {
  return <View>...</View>;
};
```

```typescript
// ❌ 잘못된 방식
export default function MyComponent() {
  return <View>...</View>;
}
```

### ✅ Named Export 사용 (export const)

모든 export는 **Named Export**를 사용합니다.

**이유:**
- Tree-shaking 효율 향상 (미사용 코드 번들에서 제거)
- IDE 자동완성 정확도 향상
- 리팩토링 시 자동 추적 가능
- Import 시 이름 일관성 유지

```typescript
// ✅ 올바른 방식: Named Export
export const Button = () => { ... };
export const useChat = () => { ... };
export interface User { ... }
```

### ⚠️ 예외: Expo Router 라우트 파일

`app/` 폴더 내 **라우트 파일**은 Expo Router가 `export default`를 요구합니다.

```typescript
// app/(tabs)/index.tsx - 라우트 파일
const TabOneScreen = () => { ... };

// Expo Router requires default export for route components
export default TabOneScreen;
```

**`export default` 필수 파일:**
- `app/_layout.tsx`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/index.tsx`, `app/(tabs)/two.tsx` 등 모든 스크린 파일
- `app/modal.tsx`
- `app/+not-found.tsx`
- `app/+html.tsx`

---

## 2. Barrel Export 패턴 (index.ts)

### 폴더별 index.ts 활용

폴더 내 여러 모듈을 외부에 노출할 때 **index.ts**를 통해 통합 export합니다.

```
shared/
├── config/
│   └── fonts.ts
├── hooks/
│   └── useAppFonts.ts
├── theme/
│   ├── colors.ts
│   └── index.ts      # 테마 모듈 통합 export
└── index.ts          # shared 레이어 통합 export
```

### 사용 예시

```typescript
// shared/index.ts
export { fonts, fontFamily } from './config/fonts';
export { useAppFonts } from './hooks/useAppFonts';
export { colors, spacing, textPresets } from './theme';
```

```typescript
// 컴포넌트에서 사용
import { colors, textPresets, useAppFonts } from '@/shared';
```

### 장점

- **Import 경로 단순화**: 깊은 경로 대신 `@/shared`로 통일
- **모듈 캡슐화**: 내부 구조 변경 시 index.ts만 수정
- **자동완성 향상**: IDE에서 사용 가능한 모듈 명확히 표시

---

## 3. 타입 정의 규칙 (Type vs Interface)

### ✅ Interface 사용 (객체 구조 정의)

**객체의 구조(Shape)**를 정의할 때는 `interface`를 사용합니다.
- Props, State, Entity 모델
- 확장성(`extends`)과 명확한 에러 메시지 장점

```typescript
// ✅ Props 정의
export interface ButtonProps {
  title: string;
  onPress: () => void;
}

// ✅ Entity 정의
export interface User {
  id: string;
  name: string;
}
```

### ✅ Type Alias 사용 (복잡한 타입)

**유니온, 인터섹션, 유틸리티 타입** 등은 `type`을 사용합니다.
- `interface`로 표현할 수 없는 형태

```typescript
// ✅ 유니온 타입 (상태, 옵션)
export type Status = 'idle' | 'loading' | 'success' | 'error';
export type ButtonVariant = 'primary' | 'secondary';

// ✅ 유틸리티 타입 활용
export type UserInput = Omit<User, 'id'>;
```

---

## 4. 네이밍 규칙

### 파일명

| 타입 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 | PascalCase | `Button.tsx`, `UserProfile.tsx` |
| 훅 | camelCase (use 접두사) | `useAppFonts.ts`, `useAuth.ts` |
| 유틸리티 | camelCase | `formatDate.ts`, `api.ts` |
| 타입/인터페이스 | camelCase (types 접미사) | `user.types.ts` |
| 상수 | camelCase | `colors.ts`, `config.ts` |

### 변수/함수명

| 타입 | 규칙 | 예시 |
|------|------|------|
| 변수 | camelCase | `userName`, `isLoading` |
| 함수 | camelCase | `handleClick`, `formatDate` |
| 컴포넌트 | PascalCase | `const Button = () => {}` |
| 상수 | UPPER_SNAKE_CASE 또는 camelCase | `API_URL` 또는 `apiUrl` |
| 타입/인터페이스 | PascalCase | `interface User {}` |

---

## 4. Import 경로 규칙

### ✅ `@/` alias 사용 (통일)

모든 import는 **`@/` alias**를 사용합니다.

```typescript
// ✅ 올바른 방식
import { colors, spacing } from '@/shared';
import { User } from '@/entities';
import { ChatInput } from '@/features';
```

```typescript
// ❌ 잘못된 방식
import { colors } from '../../../shared/theme/colors';
```

### ⚠️ 예외: Barrel Export 파일 (index.ts)

`index.ts` 파일에서는 **같은 폴더 내 모듈**을 `./` 상대 경로로 import합니다.

```typescript
// shared/theme/index.ts (barrel export)
export { colors } from './colors';        // ✅ 같은 폴더 → ./
export { spacing } from './spacing';      // ✅ 같은 폴더 → ./
```

**이유:** 순환 참조 방지

---

## 5. Import 순서

```typescript
// 1. React/React Native
import React from 'react';
import { View, Text } from 'react-native';

// 2. 외부 라이브러리
import { useQuery } from '@tanstack/react-query';

// 3. 내부 모듈 (@/ alias) - FSD 레이어 순서
import { colors, textPresets } from '@/shared';
import { User } from '@/entities';
import { ChatInput } from '@/features';
import { HomePage } from '@/pages';

// 4. 상대 경로 (같은 기능 내, 최소화)
import { localHelper } from './helpers';
```

---

## 6. 스타일 정의 규칙

### ✅ StyleSheet는 컴포넌트와 같은 파일에

스타일 파일을 분리하지 않고, **컴포넌트 파일 내에 StyleSheet를 정의**합니다.

```typescript
// ✅ 올바른 방식: 같은 파일에 정의
// Button.tsx
export const Button = () => { ... };

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    padding: spacing[4],
  },
});
```

```typescript
// ❌ 잘못된 방식: 별도 파일로 분리
// Button.tsx + Button.styles.ts (X)
```

### 스타일 값은 반드시 테마에서 가져오기

```typescript
// ✅ 올바른 방식
import { colors, spacing, borderRadius } from '@/shared';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,    // 테마 사용
    padding: spacing[4],                // 테마 사용
    borderRadius: borderRadius.lg,      // 테마 사용
  },
});
```

```typescript
// ❌ 잘못된 방식: 하드코딩
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#6366F1',  // 하드코딩 금지
    padding: 16,                 // 하드코딩 금지
  },
});
```

---

## 6. 컴포넌트 구조

```typescript
// 1. Import
import { ... } from 'react-native';
import { colors } from '@/shared';

// 2. 타입 정의
interface Props {
  title: string;
  onPress: () => void;
}

// 3. 컴포넌트
export const Button = ({ title, onPress }: Props) => {
  // 3-1. Hooks
  const [isPressed, setIsPressed] = useState(false);

  // 3-2. Handlers
  const handlePress = () => {
    setIsPressed(true);
    onPress();
  };

  // 3-3. Render
  return (
    <TouchableOpacity onPress={handlePress}>
      <Text>{title}</Text>
    </TouchableOpacity>
  );
};

// 4. Styles
const styles = StyleSheet.create({
  container: { ... },
});
```

---

## 7. 체크리스트

코드 리뷰 시 확인 사항:

- [ ] 함수는 화살표 함수로 작성했는가?
- [ ] `export const` 사용했는가? (app/ 라우트 파일만 `export default`)
- [ ] 폴더마다 `index.ts`로 통합 export 했는가?
- [ ] Import 경로가 `@/` alias를 사용하는가? (barrel export만 예외)
- [ ] Import 순서가 올바른가? (React → 외부 → @/ alias → 상대경로)
- [ ] 네이밍 규칙을 따랐는가?
- [ ] StyleSheet는 컴포넌트와 같은 파일에 있는가?
- [ ] 스타일 값은 `@/shared`에서 가져왔는가? (하드코딩 금지)

