# 시스템 아키텍처 설계서

| 항목 | 내용 |
|------|------|
| **작성일** | 2026-02-01 |
| **상태** | Draft |
| **관련 문서** | [service-overview.md](./service-overview.md), [data-schema.md](./data-schema.md) |

---

## 1. 개요

AI 영어 회화 서비스의 전체 시스템 아키텍처를 정의합니다.

### 1.1 핵심 결정 사항

| 결정 | 선택 | 이유 |
|------|------|------|
| 백엔드 프레임워크 | **FastAPI** | AI 스트리밍, 비동기 최적화, 현대적 |
| 데이터베이스 | **PostgreSQL** | 안정성, JSON 지원, 확장성 |
| 인증 | **JWT + OAuth** | 카카오/네이버/구글 SSO |
| 관리자 앱 | **Next.js** | 모바일과 동일한 React 생태계 |
| AI 프레임워크 | **LangChain/LangGraph** | Python 생태계 최적 |

---

## 2. 시스템 구성도

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           클라이언트 레이어                              │
│  ┌───────────────┐                              ┌───────────────┐       │
│  │   모바일 앱    │                              │   관리자 앱    │       │
│  │ React Native  │                              │   Next.js     │       │
│  │  (iOS/Android) │                              │    (Web)      │       │
│  └───────┬───────┘                              └───────┬───────┘       │
└──────────┼──────────────────────────────────────────────┼───────────────┘
           │                                              │
           │              HTTPS (REST + WebSocket)        │
           │                                              │
┌──────────▼──────────────────────────────────────────────▼───────────────┐
│                           백엔드 서버 레이어                             │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Python FastAPI Server                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │
│  │  │  Auth API   │  │  CRUD API   │  │   AI API    │             │   │
│  │  │ /api/auth/* │  │ /api/v1/*   │  │ /api/ai/*   │             │   │
│  │  └─────────────┘  └─────────────┘  └──────┬──────┘             │   │
│  │                                           │                     │   │
│  │  ┌────────────────────────────────────────▼──────────────────┐ │   │
│  │  │                    AI Service Layer                       │ │   │
│  │  │  ┌───────────┐  ┌───────────┐  ┌───────────┐             │ │   │
│  │  │  │ LangChain │  │ LangGraph │  │  Agents   │             │ │   │
│  │  │  └───────────┘  └───────────┘  └───────────┘             │ │   │
│  │  └───────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                           데이터 레이어                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │   PostgreSQL    │  │     Redis       │  │   File Storage  │        │
│  │   (Primary DB)  │  │    (Cache)      │  │   (S3/MinIO)    │        │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                           외부 서비스                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   OpenAI    │  │   Google    │  │   Kakao     │  │   Naver     │   │
│  │   (GPT-4)   │  │   (OAuth)   │  │   (OAuth)   │  │   (OAuth)   │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 프로젝트 구조

```
study-english/
├── apps/
│   ├── mobile/              # 모바일 앱 (React Native + Expo)
│   │   ├── app/             # Expo Router 라우트
│   │   ├── features/        # FSD: 기능 단위 모듈
│   │   ├── entities/        # FSD: 엔티티 모듈
│   │   ├── shared/          # FSD: 공유 유틸/컴포넌트
│   │   └── ...
│   │
│   ├── admin/               # 관리자 웹 (Next.js)
│   │   ├── app/             # Next.js App Router
│   │   ├── components/      # UI 컴포넌트
│   │   └── ...
│   │
│   └── server/              # 백엔드 서버 (FastAPI)
│       ├── app/
│       │   ├── api/         # API 라우트
│       │   │   ├── v1/      # 버전별 API
│       │   │   ├── auth/    # 인증 API
│       │   │   └── ai/      # AI 관련 API
│       │   ├── core/        # 핵심 설정
│       │   │   ├── config.py
│       │   │   ├── security.py
│       │   │   └── database.py
│       │   ├── models/      # SQLAlchemy 모델
│       │   ├── schemas/     # Pydantic 스키마
│       │   ├── services/    # 비즈니스 로직
│       │   │   ├── ai/      # AI 서비스
│       │   │   └── ...
│       │   └── main.py      # FastAPI 앱 진입점
│       ├── migrations/      # Alembic 마이그레이션
│       ├── tests/           # 테스트
│       ├── Dockerfile
│       ├── pyproject.toml   # Poetry 의존성
│       └── README.md
│
├── packages/
│   ├── eslint-config/       # 공유 ESLint 설정
│   ├── typescript-config/   # 공유 TypeScript 설정
│   └── ui/                  # 공유 UI 컴포넌트 (선택)
│
└── docs/
    └── plan/
        ├── service-overview.md
        ├── architecture.md      # 이 문서
        ├── data-schema.md
        └── api-spec.md
```

---

## 4. 기술 스택 상세

### 4.1 백엔드 서버 (apps/server)

| 카테고리 | 기술 | 버전 | 용도 |
|----------|------|------|------|
| 프레임워크 | FastAPI | 0.109+ | REST API, WebSocket |
| ORM | SQLAlchemy | 2.0+ | 데이터베이스 모델링 |
| 마이그레이션 | Alembic | 1.13+ | DB 스키마 버전 관리 |
| 인증 | python-jose | 3.3+ | JWT 토큰 |
| OAuth | authlib | 1.3+ | 소셜 로그인 |
| AI | LangChain | 0.1+ | AI 에이전트, 체인 |
| AI | LangGraph | 0.0.50+ | 복잡한 에이전트 워크플로우 |
| 검증 | Pydantic | 2.0+ | 요청/응답 스키마 |
| 비동기 | uvicorn | 0.27+ | ASGI 서버 |
| 캐시 | redis | 5.0+ | 세션, 캐싱 |

### 4.2 관리자 앱 (apps/admin)

| 카테고리 | 기술 | 버전 | 용도 |
|----------|------|------|------|
| 프레임워크 | Next.js | 15+ | React 프레임워크 |
| UI | shadcn/ui | - | 컴포넌트 라이브러리 |
| 스타일 | Tailwind CSS | 3.4+ | 스타일링 |
| 상태관리 | Zustand | 4+ | 전역 상태 |
| API 클라이언트 | React Query | 5+ | 서버 상태 관리 |

### 4.3 인프라

| 카테고리 | 기술 | 용도 |
|----------|------|------|
| 컨테이너 | Docker + Docker Compose | 로컬 개발 환경 |
| 배포 (서버) | Railway / Render | FastAPI 서버 |
| 배포 (관리자) | Vercel | Next.js 앱 |
| 데이터베이스 | Neon / Railway PostgreSQL | 관리형 PostgreSQL |
| 캐시 | Upstash Redis | 관리형 Redis |

---

## 5. API 구조

### 5.1 API 엔드포인트 개요

| 경로 | 메서드 | 설명 |
|------|--------|------|
| **인증** | | |
| `/api/auth/login` | POST | 소셜 로그인 |
| `/api/auth/refresh` | POST | 토큰 갱신 |
| `/api/auth/me` | GET | 현재 사용자 정보 |
| **사용자** | | |
| `/api/v1/users/me` | GET/PATCH | 내 정보 조회/수정 |
| `/api/v1/users/me/progress` | GET | 학습 진도 |
| **테마** | | |
| `/api/v1/themes/active` | GET | 활성 테마 조회 |
| `/api/v1/themes` | GET/POST | 테마 목록/생성 (관리자) |
| **콘텐츠** | | |
| `/api/v1/lessons` | GET | 레슨 목록 |
| `/api/v1/lessons/{id}` | GET | 레슨 상세 |
| **AI** | | |
| `/api/ai/chat` | POST | AI 대화 (스트리밍) |
| `/api/ai/feedback` | POST | 발음/문법 피드백 |

---

## 6. 보안

### 6.1 인증 흐름

```
1. 사용자 → 소셜 로그인 (카카오/네이버/구글)
2. OAuth Provider → Authorization Code
3. 서버 → Access Token 요청
4. 서버 → JWT 발급 (access_token + refresh_token)
5. 클라이언트 → JWT로 API 요청
```

### 6.2 권한 레벨

| 레벨 | 설명 | 접근 범위 |
|------|------|----------|
| `guest` | 미인증 | 공개 API만 |
| `user` | 일반 사용자 | 본인 데이터 |
| `admin` | 관리자 | 모든 데이터 + 관리 기능 |

---

## 7. 배포 전략

### 7.1 개발 환경

```bash
# Docker Compose로 로컬 환경 구성
docker-compose up -d

# 포함 서비스:
# - PostgreSQL (5432)
# - Redis (6379)
# - FastAPI (8000)
# - Next.js Admin (3000)
```

### 7.2 프로덕션 배포

| 서비스 | 플랫폼 | 도메인 (예시) |
|--------|--------|--------------|
| FastAPI | Railway | api.studyenglish.app |
| Admin | Vercel | admin.studyenglish.app |
| Mobile | EAS Build | 앱스토어 배포 |
| DB | Neon | - |

---

## 8. 다음 단계

1. [ ] 데이터 스키마 설계 (`data-schema.md`)
2. [ ] API 상세 명세 (`api-spec.md`)
3. [ ] `apps/server` 프로젝트 초기화
4. [ ] Docker 환경 구성
5. [ ] 기본 인증 API 구현
