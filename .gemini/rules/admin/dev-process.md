# Admin 앱 개발 사고 프레임워크

> **⚠️ 중요**: 모든 Admin 기능 구현 시 이 프레임워크를 반드시 따릅니다.
> **적용 범위:** `apps/admin` (Next.js 관리자 웹)

---

## 핵심 원칙

> **모바일 앱(`apps/mobile`)과 동일한 패턴 사용**
> - FSD (Feature-Sliced Design) 아키텍처
> - Named Export (`export const`)
> - 화살표 함수 선언
> - `@/` alias 기반 import

---

## Phase 1: 요청 분석 및 기획

### 1.1 사용자 요청 이해

- 이 기능의 **핵심 목적**은 무엇인가?
- **어떤 화면**에서 동작하는가?
- 필요한 **입력/출력 데이터**는 무엇인가?

### 1.2 기존 코드 확인

- 이미 구현된 **유사한 기능**이 있는가? (`@/features` 확인)
- 재사용 가능한 **컴포넌트**가 있는가? (`@/shared/ui` 확인)
- 관련된 **엔티티**가 이미 정의되어 있는가? (`@/entities` 확인)
- 필요한 **유틸리티/훅**이 있는가? (`@/shared/hooks` 확인)

---

## Phase 2: FSD 레이어 분석

### 2.1 레이어 결정 기준

| 레이어 | 질문 | 예시 |
|--------|------|------|
| **shared** | 여러 기능에서 공통으로 사용되는가? | Button, Input, Table, colors |
| **entities** | 비즈니스 도메인 모델인가? | User, Experiment, Scenario |
| **features** | 특정 사용자 상호작용 로직인가? | ExperimentEditor, PromptTester |
| **widgets** | 여러 entities/features를 조합한 독립 UI인가? | Sidebar, Header, DataTable |
| **pages** | 하나의 완전한 화면인가? | DashboardPage, ExperimentsPage |
| **app** | 라우팅/프로바이더 관련인가? | layout.tsx, providers.tsx |

### 2.2 의존성 방향 확인

FSD의 핵심 규칙: **상위 레이어만 하위 레이어를 import할 수 있음**

```
app → pages → widgets → features → entities → shared
```

- ❌ `shared`에서 `entities` import 금지
- ❌ `entities`에서 `features` import 금지
- ✅ `features`에서 `entities`, `shared` import 가능
- ✅ `pages`에서 모든 하위 레이어 import 가능

### 2.3 폴더 구조

```
apps/admin/
├── app/                        # Next.js App Router (라우팅만)
│   ├── (auth)/                 # 인증 라우트 그룹
│   │   └── login/
│   │       └── page.tsx        # export default (Next.js 요구사항)
│   ├── (dashboard)/            # 대시보드 라우트 그룹
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── experiments/
│   │   │   └── page.tsx
│   │   └── scenarios/
│   │       └── page.tsx
│   ├── layout.tsx              # 루트 레이아웃
│   └── providers.tsx           # 전역 프로바이더
│
├── pages/                      # FSD 페이지 레이어 (실제 화면 구성)
│   ├── dashboard/
│   │   ├── ui/
│   │   │   └── DashboardPage.tsx
│   │   └── index.ts
│   ├── experiments/
│   │   ├── ui/
│   │   │   ├── ExperimentsPage.tsx
│   │   │   └── ExperimentDetailPage.tsx
│   │   └── index.ts
│   └── index.ts
│
├── widgets/                    # 조합 위젯
│   ├── sidebar/
│   │   ├── ui/
│   │   │   └── Sidebar.tsx
│   │   └── index.ts
│   ├── header/
│   └── index.ts
│
├── features/                   # 기능 로직
│   ├── experiment-editor/
│   │   ├── model/
│   │   │   ├── types.ts
│   │   │   └── useExperimentEditor.ts
│   │   ├── ui/
│   │   │   └── ExperimentEditor.tsx
│   │   └── index.ts
│   ├── prompt-tester/
│   ├── scenario-editor/
│   └── index.ts
│
├── entities/                   # 비즈니스 모델
│   ├── experiment/
│   │   ├── model/
│   │   │   └── types.ts
│   │   ├── api/
│   │   │   └── experimentApi.ts
│   │   └── index.ts
│   ├── scenario/
│   ├── user/
│   └── index.ts
│
├── shared/                     # 공유 모듈
│   ├── ui/                     # shadcn/ui 컴포넌트
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── table.tsx
│   │   └── index.ts
│   ├── lib/                    # 유틸리티
│   │   ├── api.ts
│   │   ├── utils.ts
│   │   └── cn.ts
│   ├── hooks/
│   │   └── useAuth.ts
│   ├── config/
│   │   └── constants.ts
│   └── index.ts
│
└── tailwind.config.ts
```

---

## Phase 3: 코드 작성 규칙

### 3.1 app/ 와 pages/ 관계 (Next.js + FSD)

**Next.js App Router 구조:**
- `app/` = 라우팅만 담당 (Next.js 요구사항)
- `pages/` = 화면 구성 로직 (FSD 레이어)

```typescript
// app/(dashboard)/experiments/page.tsx - 라우팅 파일
import { ExperimentsPage } from '@/pages/experiments';

const ExperimentsRoute = () => {
  return <ExperimentsPage />;
};

// Next.js App Router requires default export
export default ExperimentsRoute;
```

```typescript
// pages/experiments/ui/ExperimentsPage.tsx - 화면 구성
import { ExperimentTable } from '@/features/experiment-table';
import { Sidebar } from '@/widgets/sidebar';
import { Button } from '@/shared/ui';

export const ExperimentsPage = () => {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6">
        <ExperimentTable />
      </main>
    </div>
  );
};
```

### 3.2 Export 규칙

| 위치 | Export 방식 | 이유 |
|------|------------|------|
| `app/` 폴더 | `export default` | Next.js 요구사항 |
| 그 외 모든 폴더 | `export const` | Tree-shaking 효율 |

```typescript
// ✅ app/ 폴더 (라우트 파일)
const DashboardRoute = () => { ... };
export default DashboardRoute;

// ✅ pages/, features/, entities/, widgets/, shared/
export const DashboardPage = () => { ... };
export const useExperiment = () => { ... };
export interface Experiment { ... }
```

### 3.3 파일명 네이밍

- 컴포넌트: `PascalCase.tsx` (예: `ExperimentEditor.tsx`)
- 훅: `use[Name].ts` (예: `useExperiment.ts`)
- 타입: `types.ts` 또는 `[name].types.ts`
- 유틸리티: `camelCase.ts` (예: `formatDate.ts`)
- API: `[name]Api.ts` (예: `experimentApi.ts`)

### 3.4 코드 작성 규칙

**함수 선언:**
```typescript
// ✅ 항상 화살표 함수 사용
export const ExperimentCard = ({ title, status }: Props) => {
  return <Card>...</Card>;
};

// ❌ function 선언 금지
export function ExperimentCard() { ... }
```

**Import 순서:**
```typescript
// 1. React
import { useState, useEffect } from 'react';

// 2. Next.js
import { useRouter } from 'next/navigation';

// 3. 외부 라이브러리
import { useQuery } from '@tanstack/react-query';

// 4. 내부 모듈 (@/ alias) - FSD 레이어 순서
import { Button, Input } from '@/shared/ui';
import { Experiment } from '@/entities/experiment';
import { ExperimentEditor } from '@/features/experiment-editor';
import { Sidebar } from '@/widgets/sidebar';

// 5. 상대 경로 (최소화, 같은 기능 내만)
import { localHelper } from './lib/helpers';
```

**컴포넌트 구조:**
```typescript
// 1. Import

// 2. 타입 정의
interface Props {
  title: string;
  onSave: () => void;
}

// 3. 컴포넌트
export const ExperimentEditor = ({ title, onSave }: Props) => {
  // 3-1. Hooks
  const [isEditing, setIsEditing] = useState(false);
  const { data } = useQuery({ ... });

  // 3-2. Handlers
  const handleSave = () => {
    onSave();
    setIsEditing(false);
  };

  // 3-3. Render
  return (
    <div className="p-4">
      <h1>{title}</h1>
      <Button onClick={handleSave}>저장</Button>
    </div>
  );
};
```

### 3.5 스타일 규칙

**Tailwind CSS 사용:**
```typescript
// ✅ className에 Tailwind 클래스 사용
<div className="flex items-center gap-4 p-6 bg-background">
  <Button className="bg-primary text-primary-foreground">
    저장
  </Button>
</div>

// ✅ cn() 유틸리티로 조건부 클래스
import { cn } from '@/shared/lib/cn';

<div className={cn(
  "p-4 rounded-lg",
  isActive && "bg-primary",
  isDisabled && "opacity-50"
)}>
```

**테마 변수 사용:**
```css
/* globals.css - CSS 변수 정의 */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 24.6 95% 53.1%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

---

## Phase 4: Barrel Export 업데이트

### 4.1 새 파일 생성 후 필수 작업

새 컴포넌트/훅/타입 추가 시 **반드시** barrel export 업데이트:

1. **기능 폴더의 index.ts** 업데이트
   ```typescript
   // features/experiment-editor/index.ts
   export { ExperimentEditor } from './ui/ExperimentEditor';
   export { useExperimentEditor } from './model/useExperimentEditor';
   export type { ExperimentFormData } from './model/types';
   ```

2. **레이어 최상위 index.ts** 업데이트
   ```typescript
   // features/index.ts
   export * from './experiment-editor';
   export * from './prompt-tester';
   ```

---

## Phase 5: 검증

### 5.1 TypeScript 컴파일 확인

```bash
pnpm exec tsc --noEmit
```

### 5.2 코드 컨벤션 체크리스트

- [ ] 모든 함수는 화살표 함수로 작성했는가?
- [ ] `export default`는 `app/` 폴더의 라우트 파일만 사용했는가?
- [ ] Import 순서가 올바른가?
- [ ] 네이밍 규칙을 따랐는가?
- [ ] FSD 레이어 의존성 방향이 올바른가?
- [ ] Barrel export가 업데이트되었는가?
- [ ] 스타일은 Tailwind CSS를 사용했는가?

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
// UI 컴포넌트 (shadcn/ui)
import { Button, Input, Table, Card } from '@/shared/ui';

// 유틸리티
import { cn } from '@/shared/lib/cn';
import { api } from '@/shared/lib/api';

// 훅
import { useAuth } from '@/shared/hooks';
```

### 모바일 앱과의 차이점

| 항목 | Mobile (`apps/mobile`) | Admin (`apps/admin`) |
|------|------------------------|----------------------|
| 프레임워크 | React Native (Expo) | Next.js |
| 라우팅 | expo-router | Next.js App Router |
| 스타일 | NativeWind (className) | Tailwind CSS (className) |
| UI 컴포넌트 | React Native Reusables | shadcn/ui |
| 구조 | FSD | FSD (동일) |
| Export 규칙 | Named Export | Named Export (동일) |
