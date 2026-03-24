# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI 기반 영어 학습 서비스 & 실험 랩(AI Lab). Monorepo 구조로 모바일 앱, 어드민 대시보드, FastAPI 백엔드로 구성된 통합 플랫폼.

## Monorepo 구조

```
apps/
├── mobile/    # React Native + Expo SDK 54 (iOS/Android 학습 앱)
├── admin/     # Next.js 16 App Router (콘텐츠 관리 & AI Lab 대시보드)
└── server/    # FastAPI + SQLAlchemy 2.0 async (Python 백엔드)
packages/
├── ui/                  # 공유 React UI 컴포넌트
├── eslint-config/       # 공유 ESLint 설정 (base, react-internal, next)
└── typescript-config/   # 공유 TypeScript 설정 (base, react-library, nextjs)
```

## Prerequisites

- Node.js v20+, pnpm v8+
- Python 3.11+, Poetry
- Docker (PostgreSQL/Redis 컨테이너용)
- FFmpeg (`brew install ffmpeg` — 오디오 처리)

## Build & Run Commands

```bash
# 의존성 설치
pnpm install                        # 프론트엔드 (Node.js)
cd apps/server && poetry install    # 백엔드 (Python)

# 로컬 개발 — 원커맨드 (Docker + DB 마이그레이션 + Server + Admin 자동 실행)
sh scripts/start-local-dev.sh

# 또는 Turborepo로 전체 프론트엔드 실행
pnpm dev

# 개별 실행
pnpm start                  # Mobile (Expo 개발 서버)
pnpm start:admin            # Admin (Next.js, http://localhost:3000)
pnpm start:admin:https      # Admin HTTPS 모드
# Server는 apps/server/ 에서:
poetry run uvicorn app.main:app --reload   # http://localhost:8000

# 빌드 & 검증
pnpm build                  # 전체 빌드
pnpm lint                   # 전체 린트
pnpm check-types            # TypeScript 타입 체크
pnpm format                 # Prettier 포맷팅 (TS/TSX/MD)

# Mobile 플랫폼 빌드
pnpm ios                    # iOS 빌드
pnpm android                # Android 빌드
```

## 배포 환경

| 항목 | 상세 |
|------|------|
| 클라우드 | GCP (Google Cloud Platform) |
| 컴퓨팅 | Cloud Run (서버리스 컨테이너) |
| 리전 | us-central1 |
| 프로젝트 ID | gen-lang-client-0737324328 |
| 컨테이너 레지스트리 | gcr.io |
| DB | Cloud SQL PostgreSQL / 로컬은 Docker |
| 예상 비용 | $12-15/월 (free tier 활용) |

### 배포 URL
- Server: `https://study-english-server-963239184273.us-central1.run.app`
- Admin: `https://study-english-admin-963239184273.us-central1.run.app`
- API Docs: Server URL + `/docs`

### 배포 스크립트 (`scripts/`)

| 스크립트 | 용도 |
|----------|------|
| `deploy-gcp.sh` | 전체 배포 (Server → Admin 순차 실행) |
| `deploy-server.sh` | Server만 Cloud Run 배포 (Docker build → deploy, 3600s timeout, session affinity) |
| `deploy-admin.sh` | Admin만 Cloud Run 배포 (cloudbuild.yaml 사용, API URL 빌드타임 주입) |
| `server-up.sh` | 서비스 공개 (ingress=all, allUsers invoker 권한) |
| `server-down.sh` | 서비스 비공개 (ingress=internal) |
| `start-local-dev.sh` | 로컬 개발환경 원커맨드 실행 (Docker + 마이그레이션 + Server:8000 + Admin:3000) |

### 재배포

```bash
# 전체 재배포
sh scripts/deploy-gcp.sh

# 개별 재배포
sh scripts/deploy-server.sh    # Server만
sh scripts/deploy-admin.sh     # Admin만

# 서비스 공개/비공개 전환
sh scripts/server-up.sh        # 외부 접근 허용
sh scripts/server-down.sh      # 내부 전용으로 전환
```

## FSD 아키텍처 (Mobile & Admin 공통)

프론트엔드 양쪽 모두 **Feature-Sliced Design** 아키텍처를 엄격히 준수. 레이어 의존성은 **단방향(상→하)**만 허용:

```
app → pages → widgets → features → entities → shared
```

- `app/` — 라우팅 전용 (`export default` 필수)
- `pages/` — 전체 화면 컴포넌트
- `widgets/` — 독립 UI 블록 (여러 features/entities 조합)
- `features/` — 사용자 상호작용 로직
- `entities/` — 비즈니스 도메인 모델
- `shared/` — 공통 컴포넌트, 훅, 유틸리티, 테마

**Export 규칙**: `app/` 폴더만 `export default`, 나머지는 모두 `export const` (tree-shaking).

**모듈 구조** (새 FSD 모듈 생성 시):
```
[layer]/[module-name]/        # 모듈명은 kebab-case
├── model/                    # 로직, 상태, 타입
│   ├── types.ts
│   └── use[Name].ts
├── ui/                       # UI 컴포넌트
│   └── [Name].tsx            # 컴포넌트명은 PascalCase
└── index.ts                  # Barrel export (반드시 레이어 최상위 index.ts에도 추가)
```

**공통 컨벤션**:
- 모든 함수는 화살표 함수
- Import는 `@/` alias 사용 (상대 경로는 같은 모듈의 barrel export에서만)
- Import 순서: React/RN → 외부 라이브러리 → @/ 내부 모듈 (FSD 레이어 순) → 상대 경로
- 스타일 값 하드코딩 금지 — 테마 토큰 사용

## Tech Stack

| 영역 | 기술 |
|------|------|
| Mobile | React Native 0.81, Expo SDK 54, NativeWind, Zustand, TanStack Query |
| Admin | Next.js 16, Tailwind CSS v4, shadcn/ui, Zustand, TanStack Query |
| Backend | FastAPI, SQLAlchemy 2.0 async, PostgreSQL 15, Redis 7, Alembic |
| AI | LangChain, LangGraph, Google GenAI (Gemini), Google Cloud (Speech/TTS/Translate/Storage) |
| Forms | React Hook Form + Zod (프론트엔드 공통) |
| Monorepo | pnpm workspaces, Turborepo |

## 참고 문서

### docs/
| 경로 | 내용 |
|------|------|
| `docs/plan/architecture.md` | 전체 시스템 아키텍처 설계 |
| `docs/plan/data-schema.md` | DB 스키마 설계 (ER 다이어그램 + 테이블 정의) |
| `docs/plan/service-overview.md` | 서비스 기획 (3가지 학습 모드, 타겟 사용자, 비즈니스 모델) |
| `docs/plan/my-turn-conversation-spec.md` | My Turn 대화 프로토콜 스펙 |
| `docs/develop/dev-environment-setup.md` | macOS (Apple Silicon) 개발환경 셋업 가이드 |
| `docs/develop/server-guide.md` | 서버 개발 퀵 레퍼런스 |
| `docs/develop/library-setup-guide.md` | npm/Python 패키지 설치 가이드 |
| `docs/develop/development-workflow.md` | Expo 앱 실행 가이드 (시뮬레이터/실기기) |
| `docs/develop/ai-agent-lab-api.md` | AI Agent Lab API 스펙 (파이프라인, 실험, 멀티모달) |
| `docs/guide/deployment-gcp.md` | GCP 배포 상세 가이드 (Cloud SQL + Cloud Run) |
| `docs/guide/google-*-guide.md` | Google Cloud API 통합 가이드 (STT/TTS/Translation) |
| `docs/guide/access-control.md` | 권한 관리 가이드 |

### .agent/ (AI Agent 리소스)
| 경로 | 내용 |
|------|------|
| `.agent/workflows/mobile-development.md` | 모바일 개발 5단계 사고 프레임워크 (FSD 규칙 상세) |
| `.agent/skills/scaffold_fsd_module/SKILL.md` | FSD 모듈 스캐폴딩 가이드 (템플릿 포함) |
| `.agent/skills/tech_research/SKILL.md` | 기술 리서치 방법론 (4단계 프로세스 + 7가지 평가 메트릭) |

### .gemini/rules/ (Gemini 에이전트 규칙)
| 경로 | 내용 |
|------|------|
| `.gemini/rules/common/tech-stack.md` | 기술 스택 상세 + 비용 최적화 전략 |
| `.gemini/rules/common/code-convention.md` | 공통 코드 컨벤션 |
| `.gemini/rules/common/features/` | 핵심 학습 기능 스펙 (Scenario Queue, Simulation, Listening) |
| `.gemini/rules/admin/` | Admin 개발 프로세스 + 스타일 테마 시스템 |
| `.gemini/rules/mobile/` | Mobile 개발 프로세스 + 스타일 테마 시스템 |
| `.gemini/rules/server/` | Server 개발 프로세스 + AI 통합 가이드 + 코드 컨벤션 + 라이브러리 가이드 |
