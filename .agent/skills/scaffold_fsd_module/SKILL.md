---
name: Scaffold FSD Module
description: Features, Entities, Widgets, Pages 등 FSD 모듈을 새로 생성할 때 사용하는 스킬
---

# Scaffold FSD Module

새로운 기능을 구현하거나 모듈을 추가하라는 요청을 받았을 때, 이 스킬의 지침을 따릅니다.
이 스킬은 **일관된 FSD 폴더 구조**와 **코드 컨벤션(Named Export, Arrow Function)** 을 준수하는 파일을 생성하도록 돕습니다.

## 1. 판단 및 준비

1. **Layer 결정**: 요청 내용이 어느 레이어에 해당하는지 판단합니다.
   - `shared`: 공통 사용 컴포넌트/훅 (예: Button, useInput)
   - `entities`: 비즈니스 데이터 (예: 사용자, 세션, 상품)
   - `features`: 사용자 상호작용 (예: 채팅, 음성녹음, 결제)
   - `widgets`: 독립된 UI 블록 (예: 헤더, GNB)
   - `pages`: 전체 화면 (예: 홈, 설정화면)

2. **Module Name 결정**: `kebab-case`를 사용합니다. (예: `audio-recorder`, `user-profile`)

3. **Component Name 결정**: `PascalCase`를 사용합니다. (예: `AudioRecorder`, `UserProfile`)

## 2. 폴더 구조 생성

다음 구조로 폴더와 파일을 생성해야 합니다. (`apps/mobile/[layer]/[module-name]/` 위치)

```
[layer]/[module-name]/
├── model/                # 로직, 상태, 타입
│   ├── types.ts          # 타입 정의
│   └── use[Name].ts      # 메인 훅
├── ui/                   # UI 컴포넌트
│   └── [Name].tsx        # 메인 컴포넌트
└── index.ts              # Barrel Export
```

> **Note**: 단순한 경우 `model/`이나 `ui/` 중 하나만 존재할 수도 있으나, 확장성을 위해 기본 구조를 유지하는 것을 권장합니다.

## 3. 파일 템플릿 작성

각 파일 생성 시 아래 템플릿을 사용하여 작성합니다.

### 3.1 `model/types.ts`

```typescript
export interface [Name]State {
  // 상태 정의
}

export interface [Name]Props {
  // Props 정의
}
```

### 3.2 `model/use[Name].ts`

```typescript
import { useState } from 'react';

export const use[Name] = () => {
  const [state, setState] = useState(null);

  return {
    state,
  };
};
```

### 3.3 `ui/[Name].tsx`

- **규칙**: Named Export (`export const`), 화살표 함수, `@/shared` 스타일 사용, 같은 파일 내 StyleSheet

```typescript
import { StyleSheet, TouchableOpacity } from 'react-native';

import { Text, View, colors, spacing, borderRadius } from '@/shared';
import { use[Name] } from '../model/use[Name]';

export const [Name] = () => {
  const { state } = use[Name]();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>[Name] Component</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing[4],
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  text: {
    color: colors.text,
  },
});
```

### 3.4 `index.ts` (Module Barrel)

- **규칙**: 같은 폴더(`ui`, `model`) 내 import는 `./` 상대 경로 사용

```typescript
export { [Name] } from './ui/[Name]';
export { use[Name] } from './model/use[Name]';
export type { [Name]Props } from './model/types';
```

## 4. Layer Index 업데이트

마지막으로 해당 레이어의 최상위 `index.ts`를 찾아 새 모듈을 추가합니다.
(`apps/mobile/[layer]/index.ts`)

```typescript
// features/index.ts 예시
export { [Name], use[Name] } from './[module-name]';
```

---

## 예시 시나리오: "프로필 카드 만들어줘"

1. **판단**: `entities` 레이어, 모듈명 `user-profile`
2. **생성**:
   - `apps/mobile/entities/user-profile/ui/UserProfile.tsx`
   - `apps/mobile/entities/user-profile/model/types.ts`
   - `apps/mobile/entities/user-profile/index.ts`
3. **업데이트**: `apps/mobile/entities/index.ts`
