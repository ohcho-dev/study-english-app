# 📝 코드 컨벤션 규칙

> **⚠️ 필수 규칙**: 모든 코드는 반드시 이 문서의 규칙을 따라야 합니다.

---

## 1. 함수 선언 스타일

### ✅ 화살표 함수 사용 (Arrow Function)

모든 함수 및 컴포넌트는 **화살표 함수**로 작성합니다.

```typescript
// ✅ 올바른 방식
const MyComponent = () => {
  return <View>...</View>;
};

export default MyComponent;
```

```typescript
// ❌ 잘못된 방식
export default function MyComponent() {
  return <View>...</View>;
}
```

### Export 규칙

- `export default`는 **파일 맨 아래**에 위치
- 한 파일에서 여러 함수 export 시 named export 사용

```typescript
// 컴포넌트 파일
const Button = () => { ... };

export default Button;
```

```typescript
// 유틸리티 파일
export const formatDate = () => { ... };
export const parseDate = () => { ... };
```

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

## 3. 네이밍 규칙

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

## 4. Import 순서

```typescript
// 1. React/React Native
import React from 'react';
import { View, Text } from 'react-native';

// 2. 외부 라이브러리
import { useQuery } from '@tanstack/react-query';

// 3. 내부 모듈 (@/ alias)
import { colors, textPresets } from '@/shared';
import { Button } from '@/components';

// 4. 상대 경로
import { localHelper } from './helpers';
```

---

## 5. 스타일 정의 규칙

### ✅ StyleSheet는 컴포넌트와 같은 파일에

스타일 파일을 분리하지 않고, **컴포넌트 파일 내에 StyleSheet를 정의**합니다.

```typescript
// ✅ 올바른 방식: 같은 파일에 정의
// Button.tsx
const Button = () => { ... };

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    padding: spacing[4],
  },
});

export default Button;
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
const Button = ({ title, onPress }: Props) => {
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

// 5. Export
export default Button;
```

---

## 7. 체크리스트

코드 리뷰 시 확인 사항:

- [ ] 함수는 화살표 함수로 작성했는가?
- [ ] `export default`는 파일 맨 아래에 있는가?
- [ ] 폴더마다 `index.ts`로 통합 export 했는가?
- [ ] Import 순서가 올바른가?
- [ ] 네이밍 규칙을 따랐는가?
- [ ] StyleSheet는 컴포넌트와 같은 파일에 있는가?
- [ ] 스타일 값은 `shared/theme`에서 가져왔는가? (하드코딩 금지)
