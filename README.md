# Study English with AI (Antigravity Project)

> **AI 기반 영어 학습 서비스 & 실험 랩 (AI Lab)**
> 
> 최신 Generative AI 기술(Gemini, GPT)을 활용하여 개인화된 영어 학습 경험을 제공하고, 다양한 AI 실험을 수행할 수 있는 통합 플랫폼입니다.

---

## 📚 1. Project Overview

이 프로젝트는 **Monorepo** 구조로 설계되었으며, 효율적인 개발과 배포를 위해 `pnpm workspaces`와 `Turborepo`를 사용합니다.

### 🏛 System Architecture
전체 시스템은 **Client Layer**, **Server Layer**, **Data Layer**, **External Services**로 구성됩니다.

- **Client Layer**: React Native (Mobile), Next.js (Admin)
- **Server Layer**: FastAPI (REST API, WebSocket), AI Service (LangChain)
- **Data Layer**: PostgreSQL (Main DB), Redis (Cache), File Storage
- **External Services**: OpenAI, Google Gemini, OAuth Providers (Kakao/Naver/Google)

---

## 📂 2. Project Structure (Monorepo)

```bash
study-english/
├── apps/
│   ├── mobile/              # 📱 iOS/Android App (React Native + Expo)
│   ├── admin/               # 🖥 Admin Dashboard (Next.js)
│   └── server/              # ⚡ Backend API (FastAPI)
├── packages/
│   ├── ui/                  # 🎨 Shared UI Components (Mobile/Admin 공용)
│   ├── eslint-config/       # 🛠 Shared ESLint Configuration
│   └── typescript-config/   # 📘 Shared TypeScript Configuration
├── .agent/                  # 🤖 AI Agent Resources
└── docs/                    # 📄 Project Documentation
```

---

## 🛠 3. Tech Stack & Features by App

### 📱 Apps: Mobile (`apps/mobile`)
학습자가 영어를 학습하는 메인 모바일 애플리케이션입니다.

- **Framework**: **React Native** (Expo SDK 50+)
- **Architecture**: **FSD (Feature-Sliced Design)**
  - `app/` (Routing), `pages/`, `widgets/`, `features/`, `entities/`, `shared/` 계층 구조
- **Language**: TypeScript
- **Styling**: **NativeWind** (Tailwind CSS for RN)
- **State Management**: Zustand (Global), TanStack Query (Server)
- **Navigation**: Expo Router (File-based routing)
- **UI Components**: React Native Reusables (shadcn/ui port)

### 🖥 Apps: Admin (`apps/admin`)
학습 콘텐츠 관리 및 AI 실험(AI Lab)을 위한 웹 대시보드입니다.

- **Framework**: **Next.js 14+** (App Router)
- **Architecture**: **FSD (Feature-Sliced Design)** (Mobile과 동일 구조)
- **Styling**: Tailwind CSS, **shadcn/ui**
- **State Management**: Zustand, TanStack Query
- **Features**:
  - **AI Lab**: AI 파이프라인 설계, 에이전트 관리, 실험 실행 및 로그 분석
  - **Content Management**: 레슨, 시나리오, 테마 관리
  - **User Management**: 사용자 학습 현황 모니터링

### ⚡ Apps: Server (`apps/server`)
핵심 비즈니스 로직과 AI 파이프라인을 처리하는 백엔드 서버입니다.

- **Language**: Python 3.11+
- **Framework**: **FastAPI**
- **Architecture**: **Layered Architecture** (Router -> Service -> Repository/Model)
- **Database**: PostgreSQL (AsyncPG), Redis
- **ORM**: SQLAlchemy 2.0+ (Async)
- **AI Stack**:
  - **LangChain / LangGraph**: AI 에이전트 및 워크플로우 관리
  - **Google GenAI (Gemini)** / **OpenAI (GPT-4)**: LLM 통합
- **Tools**: Poetry (Dependency), Alembic (Migration), Pytest

---

## 🚀 4. Getting Started

### Prerequisites
- **Node.js**: v20+
- **pnpm**: v8+
- **Python**: 3.11+ (Poetry 설치 필수)
- **Docker**: DB/Redis 컨테이너 실행용
- **FFmpeg**: 오디오 처리를 위한 필수 도구 (`brew install ffmpeg`)

### Installation & Setup

1. **Repository Clone & Install Dependencies**
   ```bash
   git clone <repo-url>
   cd study-english
   
   # Frontend (Node.js) 의존성 설치
   pnpm install
   
   # Backend (Python) 의존성 설치
   cd apps/server
   poetry install
   ```

2. **Environment Variables**
   각 앱의 `.env` 파일을 생성하고 설정합니다. (각 폴더의 `.env.example` 참조)
   - `apps/server/.env`: DB, Redis, API Keys (OpenAI, Gemini)
   - `apps/mobile/.env`: API URL
   - `apps/admin/.env.local`: API URL

3. **Database Setup (Docker)**
   ```bash
   cd apps/server
   docker-compose up -d  # Postgres, Redis 실행
   poetry run alembic upgrade head  # DB 마이그레이션 적용
   ```

### Running the Project

**TurboRepo를 이용한 전체 실행** (권장)
```bash
# 루트 디렉토리에서
pnpm dev
```

**개별 실행**
- **Server**: `cd apps/server && poetry run uvicorn app.main:app --reload`
- **Admin**: `cd apps/admin && pnpm dev`
- **Mobile**: `cd apps/mobile && pnpm start`

---

## 📏 5. Development Conventions

### 🌐 Common (Client - Mobile/Admin)
**FSD (Feature-Sliced Design) 아키텍처**를 엄격히 준수합니다.

1. **레이어 의존성 규칙**: 상위 레이어만 하위 레이어를 import 할 수 있습니다.
   - `app` → `pages` → `widgets` → `features` → `entities` → `shared`
2. **Export 규칙**:
   - `app/` (라우트) 폴더: `export default` 사용 (Framework 요구사항)
   - 그 외 모든 폴더: **Named Export (`export const`)** 사용 (Tree-shaking 최적화)
3. **Import 규칙**:
   - 내부 모듈은 반드시 `@/` Alias 사용 (`@/features/chat`)
   - 상대 경로(`../../`) 사용 지양 (같은 기능 폴더 내에서만 허용)
4. **스타일링**:
   - Tailwind CSS (Mobile은 NativeWind) 클래스 사용
   - 색상/간격 등은 하드코딩 금지 (테마 변수 사용)

### 🐍 Server (Python/FastAPI)
1. **Type Hints**: 모든 함수에 Type Hint 및 Return Type 명시 필수
2. **Dependency Injection**: FastAPI `Depends`를 적극 활용하여 결합도 낮춤
3. **Pydantic Schemas**: 모든 요청/응답은 Pydantic 모델로 정의 및 검증
4. **Async/Await**: DB I/O 등 블로킹 작업은 반드시 비동기로 처리
5. **Docstrings**: Google Style Docstring 작성 권장

---

## 🧪 6. AI Lab Features

Admin 페이지에서 제공하는 **AI 실험실(AI Lab)**은 다음과 같은 강력한 기능을 제공합니다.

- **Pipeline Builder**: 여러 AI 페르소나(Agent)를 연결하여 복잡한 대화/처리 로직 설계
- **Multimodal Support**: 텍스트뿐만 아니라 **이미지, 오디오** 입력을 처리하고 분석 가능
- **Interactive Testing**: 채팅 인터페이스를 통해 실시간으로 파이프라인 테스트 및 디버깅
- **Detailed Logs**:
  - 단계별(Step-by-step) 실행 결과 확인
  - **Token Usage**: 입력/출력 토큰 및 총 토큰 사용량 상세 모니터링
  - **Cost Estimation**: 모델별 가격 정책에 따른 예상 비용 계산
- **Data Transfer Modes**:
  - **Mode A**: 이전 단계의 최종 결과만 전달
  - **Mode B**: 전체 누적 대화 기록(Context) 전달

---

## 📝 License

This project is private property of Antigravity.
Unauthorized copying or distribution is strictly prohibited.
