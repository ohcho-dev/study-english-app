# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Admin app.

## Overview

Next.js 16 기반 어드민 대시보드. 콘텐츠 관리, AI Lab 파이프라인 실험, 사용자/권한 관리 기능 제공.

## Commands

```bash
pnpm dev            # 개발 서버 (http://localhost:3000)
pnpm dev:https      # HTTPS 개발 서버
pnpm build          # 프로덕션 빌드
pnpm start          # 프로덕션 서버
pnpm lint           # ESLint
```

## Architecture

### 디렉토리 구조

```
src/
├── app/                      # Next.js App Router (라우팅)
│   ├── layout.tsx            # 루트 레이아웃 (폰트, Providers)
│   ├── providers.tsx         # QueryClient, Theme, Auth 프로바이더
│   ├── globals.css           # Tailwind + 커스텀 스타일
│   ├── login/                # 로그인 페이지
│   └── (dashboard)/          # 대시보드 라우트 그룹
│       ├── ai-lab/           # AI Lab (pipelines, experiment, logs)
│       ├── contents/         # 콘텐츠 관리 (scenarios)
│       ├── conversations/    # 대화 관리 (my-turn, templates, sessions, run0)
│       └── settings/         # 설정 (themes, users, access-control)
├── (fsd)/                    # FSD 레이어
│   ├── shared/               # 공통 (ui, lib, hooks, providers, config)
│   ├── entities/             # 도메인 모델 (variable, scenario, prompt, theme)
│   ├── features/             # 기능 (ai-lab, conversations, variable-table, theme-form, mode-toggle)
│   ├── widgets/              # 위젯 (header, sidebar)
│   └── pages/                # 페이지 컴포넌트 (variables, dashboard, theme)
├── components/ui/            # 추가 UI 컴포넌트
├── hooks/                    # 공통 훅
└── lib/                      # 유틸리티
```

### Path Aliases (tsconfig.json)

```
@/*         → ./src/*
@/shared/*  → ./src/(fsd)/shared/*
@/entities/* → ./src/(fsd)/entities/*
@/features/* → ./src/(fsd)/features/*
@/widgets/* → ./src/(fsd)/widgets/*
@/pages/*   → ./src/(fsd)/pages/*
```

### 라우트 → 페이지 연결 패턴

App Router의 `page.tsx`는 FSD `pages/` 레이어의 컴포넌트를 import해서 렌더링:

```typescript
// src/app/(dashboard)/lab/variables/page.tsx
import { VariablesPage } from '@/pages/variables';
export default function Page() { return <VariablesPage />; }
```

## Key Patterns

### FSD 모듈 구조

```
entities/variable/
├── model/types.ts         # TypeScript 타입 + 상수 (레이블 매핑 등)
├── api/variableApi.ts     # API 호출 함수 (api.get/post/patch)
└── index.ts               # Barrel export

features/variable-table/
├── model/
│   ├── useVariables.ts         # useQuery 훅
│   └── useVariableMutations.ts # useMutation 훅
├── ui/
│   ├── VariableTable.tsx       # 표시 컴포넌트
│   └── VariableDialog.tsx      # 폼 다이얼로그
└── index.ts
```

### API 호출

```typescript
// shared/lib/api.ts — 중앙화된 fetch 래퍼
import { api } from '@/shared/lib/api';

const data = await api.get<ResponseType>('/api/v1/endpoint');
await api.post('/api/v1/endpoint', body);
```

- `API_BASE_URL`: 환경변수 `NEXT_PUBLIC_API_URL` (기본값: `http://localhost:8000`)
- Bearer 토큰 자동 첨부 (localStorage)
- `resolveMediaUrl()`: GCS/로컬 미디어 URL 처리

### 인증

- JWT 기반 (Bearer 토큰, localStorage 저장)
- `AuthProvider`로 앱 전체 감싸기 — `useAuth()` 훅으로 접근
- 역할: `admin` (전체 접근), `tester` (허용된 라우트만)
- 라우트별 접근 제어: `allowed_routes` 배열로 하위 경로 포함 매칭

### 데이터 페칭 & 상태

- **서버 상태**: TanStack React Query (`staleTime: 60s`, `refetchOnWindowFocus: false`)
- **클라이언트 상태**: Zustand (필요시), useState (로컬)
- 각 feature별 커스텀 훅 (useVariables, usePipelines 등)

### UI & 스타일링

- **컴포넌트**: shadcn/ui (Radix UI + Tailwind) — `@/shared/ui`에서 re-export
- **아이콘**: Lucide React
- **차트**: Recharts
- **코드 에디터**: Monaco Editor (AI Lab 설정용)
- **테마**: 다크 모드 기본 (`html className="dark"`), CSS 변수
- **유틸리티**: `cn()` 함수 (clsx + tailwind-merge)
- **폰트**: Geist (next/font)

### shadcn/ui 설정 (components.json)

- Style: new-york
- RSC: true (React Server Components)
- Base color: neutral
- CSS variables 사용
- 컴포넌트 alias가 FSD 경로에 맞게 구성됨

## 환경 변수

```
NEXT_PUBLIC_API_URL=http://localhost:8000   # 백엔드 API URL
```

## 빌드 설정

- **React Compiler**: 활성화 (자동 메모이제이션)
- **Standalone output**: Docker 컨테이너화용
- **ESLint**: Next.js core-web-vitals + TypeScript (flat config)
