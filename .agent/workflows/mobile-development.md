---
description: 모바일 앱 기능 구현 시 따라야 하는 사고 프레임워크
---

# 모바일 앱 개발 사고 프레임워크

> **⚠️ 중요**: 모든 모바일 앱 기능 구현 시 이 프레임워크를 반드시 따릅니다.

---

## Phase 1: 요청 분석 및 기획

### 1.1 사용자 요청 이해

- 사용자가 요청한 기능의 **핵심 목적**은 무엇인가?
- 이 기능이 **어떤 화면**에서 동작하는가?
- **사용자 플로우**는 어떻게 되는가? (시작 → 중간 → 완료)
- 필요한 **입력/출력 데이터**는 무엇인가?

### 1.2 기존 코드 확인

- 이미 구현된 **유사한 기능**이 있는가? (`@/features` 확인)
- 재사용 가능한 **컴포넌트**가 있는가? (`@/shared/ui` 확인)
- 관련된 **엔티티**가 이미 정의되어 있는가? (`@/entities` 확인)
- 필요한 **유틸리티/훅**이 있는가? (`@/shared/hooks` 확인)

### 1.3 구현 범위 정의

- **새로 만들어야 할 것**: 파일 목록 정리
- **수정해야 할 것**: 기존 파일 목록 정리
- **재사용할 것**: import할 모듈 목록 정리

---

## Phase 2: FSD 레이어 분석

### 2.1 레이어 결정 기준

각 코드가 어느 레이어에 속하는지 판단합니다:

| 레이어 | 질문 | 예시 |
|--------|------|------|
| **shared** | 여러 기능에서 공통으로 사용되는가? | Button, Input, colors, spacing |
| **entities** | 비즈니스 도메인 모델인가? | User, Session, Message |
| **features** | 특정 사용자 상호작용 로직인가? | ChatInput, RecordButton |
| **widgets** | 여러 entities/features를 조합한 독립 UI인가? | Header, Sidebar |
| **pages** | 하나의 완전한 화면인가? | HomePage, SimulationPage |
| **app** | 라우팅/네비게이션 관련인가? | _layout.tsx, index.tsx |

### 2.2 의존성 방향 확인

FSD의 핵심 규칙: **상위 레이어만 하위 레이어를 import할 수 있음**

```
app → pages → widgets → features → entities → shared
```

- ❌ `shared`에서 `entities` import 금지
- ❌ `entities`에서 `features` import 금지
- ✅ `features`에서 `entities`, `shared` import 가능
- ✅ `pages`에서 모든 하위 레이어 import 가능

### 2.3 폴더 구조 결정

새 기능/엔티티 추가 시 폴더 구조:

```
[layer]/[feature-name]/
├── model/                # 비즈니스 로직, 상태, 타입
│   ├── types.ts         # TypeScript 타입/인터페이스
│   ├── use[Name].ts     # 커스텀 훅
│   └── store.ts         # 상태 관리 (필요시)
├── ui/                   # UI 컴포넌트
│   ├── [Name].tsx       # 메인 컴포넌트
│   └── [Name]Item.tsx   # 서브 컴포넌트
├── api/                  # API 통신 (필요시)
│   └── [name]Api.ts
├── lib/                  # 유틸리티 함수 (필요시)
│   └── helpers.ts
└── index.ts              # Barrel export
```

---

## Phase 3: 파일 생성 및 코드 작성

### 3.1 app/ 와 pages/ 관계

**Expo Router 구조:**
- `app/` = 라우팅만 담당 (Expo Router 요구사항)
- `pages/` = 화면 구성 로직 (FSD 레이어)

```
app/(tabs)/index.tsx      ← 라우팅 (export default 필수)
       └── imports
pages/home/ui/HomePage.tsx  ← 화면 구성 (export const 사용)
       └── imports
features/, entities/, widgets/, shared/
```

**예시:**

```typescript
// app/(tabs)/index.tsx - 라우팅 파일
import { HomePage } from '@/pages/home';

const HomeRoute = () => {
  return <HomePage />;
};

// Expo Router requires default export
export default HomeRoute;
```

```typescript
// pages/home/ui/HomePage.tsx - 화면 구성
import { ChatInput } from '@/features/chat';
import { UserProfile } from '@/entities/user';
import { colors, spacing } from '@/shared';

export const HomePage = () => {
  return (
    <View>
      <UserProfile />
      <ChatInput />
    </View>
  );
};
```

### 3.2 Export 규칙

| 위치 | Export 방식 | 이유 |
|------|------------|------|
| `app/` 폴더 | `export default` | Expo Router 요구사항 |
| 그 외 모든 폴더 | `export const` | Tree-shaking 효율 |

```typescript
// ✅ app/ 폴더 (라우트 파일)
const HomeRoute = () => { ... };
export default HomeRoute;

// ✅ pages/, features/, entities/, widgets/, shared/
export const HomePage = () => { ... };
export const useChat = () => { ... };
export interface User { ... }
```

### 3.3 파일명 네이밍

- 컴포넌트: `PascalCase.tsx` (예: `ChatBubble.tsx`)
- 훅: `use[Name].ts` (예: `useRecorder.ts`)
- 타입: `types.ts` 또는 `[name].types.ts`
- 유틸리티: `camelCase.ts` (예: `formatDate.ts`)

### 3.4 코드 작성 규칙

**함수 선언:**
```typescript
// ✅ 항상 화살표 함수 사용
export const MyComponent = () => {
  return <View>...</View>;
};
```

**Import 경로 규칙:**
- 모든 import는 `@/` alias 사용
- 예외: barrel export (index.ts)에서는 `./` 상대 경로 사용

```typescript
// ✅ 일반 파일
import { colors, spacing } from '@/shared';
import { User } from '@/entities';

// ✅ barrel export (index.ts)만 예외
export { colors } from './colors';  // 같은 폴더 → ./
```

**Import 순서:**
```typescript
// 1. React/React Native
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// 2. 외부 라이브러리
import { useQuery } from '@tanstack/react-query';

// 3. 내부 모듈 (@/ alias) - FSD 레이어 순서
import { colors, spacing } from '@/shared';
import { User } from '@/entities';
import { ChatInput } from '@/features';
import { HomePage } from '@/pages';

// 4. 상대 경로 (최소화, 같은 기능 내만)
import { localHelper } from './lib/helpers';
```

**컴포넌트 구조:**
```typescript
// 1. Import

// 2. 타입 정의
// - 객체 구조/Props는 'interface' 사용
// - 유니온/복잡한 타입은 'type' 사용
interface Props {
  title: string;
  variant?: 'primary' | 'secondary'; // 간단한 유니온은 인라인 가능
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

// 4. Styles (같은 파일에 정의)
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,  // 테마에서 가져오기
    padding: spacing[4],                  // 테마에서 가져오기
  },
});

// 5. Export (파일 맨 아래)
export default Button;
```

### 3.3 스타일 규칙

- **하드코딩 금지**: 모든 색상, 간격, 폰트는 `@/shared`에서 import
- **StyleSheet 위치**: 컴포넌트와 같은 파일에 정의
- **스타일 파일 분리 금지**: `Button.styles.ts` 형태로 분리하지 않음

```typescript
// ✅ 올바른 방식
import { colors, spacing, borderRadius } from '@/shared';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
  },
});

// ❌ 잘못된 방식
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#6366F1',  // 하드코딩 금지
    padding: 16,                 // 하드코딩 금지
  },
});
```

---

## Phase 4: Barrel Export 업데이트

### 4.1 새 파일 생성 후 필수 작업

새 컴포넌트/훅/타입 추가 시 **반드시** barrel export 업데이트:

1. **기능 폴더의 index.ts** 업데이트
   ```typescript
   // features/chat/index.ts
   export { ChatInput } from './ui/ChatInput';
   export { useChat } from './model/useChat';
   export type { Message } from './model/types';
   ```

2. **레이어 최상위 index.ts** 업데이트
   ```typescript
   // features/index.ts
   export { ChatInput, useChat, type Message } from './chat';
   ```

3. **shared/index.ts** 업데이트 (shared에 추가한 경우)
   ```typescript
   // shared/index.ts에 새 export 추가
   export { NewComponent } from './ui';
   ```

### 4.2 Barrel Export 체크

- [ ] 기능 폴더에 `index.ts` 존재하는가?
- [ ] 모든 public API가 `index.ts`에서 export되는가?
- [ ] 상위 레이어 `index.ts`에도 추가했는가?

---

## Phase 5: 검증

### 5.1 TypeScript 컴파일 확인

```bash
pnpm exec tsc --noEmit
```

- 에러가 있으면 수정 후 다시 확인
- 모든 import 경로가 올바른지 확인

### 5.2 코드 컨벤션 체크리스트

- [ ] 모든 함수는 화살표 함수로 작성했는가?
- [ ] `export default`는 파일 맨 아래에 있는가?
- [ ] Import 순서가 올바른가?
- [ ] 네이밍 규칙을 따랐는가?
- [ ] StyleSheet는 컴포넌트와 같은 파일에 있는가?
- [ ] 스타일 값은 `@/shared`에서 가져왔는가? (하드코딩 없음)
- [ ] FSD 레이어 의존성 방향이 올바른가?
- [ ] Barrel export가 업데이트되었는가?

### 5.3 기능 동작 확인

- [ ] 앱이 정상적으로 빌드되는가?
- [ ] 해당 기능이 의도대로 동작하는가?
- [ ] 다크 모드에서도 정상 동작하는가? (해당 시)

---

## 빠른 참조

### Path Aliases

```typescript
import { ... } from '@/shared';     // 공유 모듈
import { ... } from '@/entities';   // 비즈니스 모델
import { ... } from '@/features';   // 기능 로직
import { ... } from '@/widgets';    // 조합 위젯
import { ... } from '@/pages';      // 페이지
```

### FSD 레이어 순서

```
shared → entities → features → widgets → pages → app
(하위)                                          (상위)
```

### 주요 shared 모듈

```typescript
// UI 컴포넌트
import { Text, View } from '@/shared';

// 테마
import { colors, spacing, textPresets, borderRadius } from '@/shared';

// 훅
import { useColorScheme, useAppFonts } from '@/shared';
```
