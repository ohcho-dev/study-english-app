# 🔐 접근 제어 시스템 기획서

> **목적**: Admin 앱에 역할 기반 접근 제어를 추가하여, admin은 전체 접근 / 테스터는 허용된 페이지만 접근 가능하게 함.
> **작성일**: 2026-02-21

---

## 1. 요구사항 정리

| 요구사항 | 설명 |
|----------|------|
| **인증** | 비밀번호 기반 로그인 (Basic Auth 수준의 간단한 방식) |
| **역할** | `admin` (전체 접근), `tester` (제한적 접근) |
| **페이지 권한** | admin이 tester에게 공개할 페이지를 설정 가능 |
| **외부 차단** | 로그인하지 않은 사용자는 일체 접근 불가 |
| **비용 방지** | 허가되지 않은 API 호출 차단 |
| **템플릿 공개** | admin이 특정 템플릿만 테스터에게 공개 (My Turn 실행용) |

---

## 2. 아키텍처

### 2.1 인증 흐름

```
[사용자] → https://admin.run.app
    │
    ├─ 쿠키 없음 → /login 페이지로 리다이렉트
    │                  │
    │                  ├─ ID/PW 입력 → Server /api/v1/auth/login 호출
    │                  │                  │
    │                  │                  ├─ 성공 → 쿠키 발급 (role 포함)
    │                  │                  └─ 실패 → 에러 표시
    │                  │
    │                  └─ 로그인 성공 → 대시보드로 이동
    │
    └─ 쿠키 있음 → Next.js Middleware에서 검증
                      │
                      ├─ admin → 모든 페이지 접근 가능
                      └─ tester → 허용된 페이지만 접근 (나머지 → 403)
```

### 2.2 구성 요소

| 레이어 | 구성 요소 | 역할 |
|--------|----------|------|
| **Server** | `accounts` 테이블 | ID/PW/역할 저장 |
| **Server** | `page_permissions` 테이블 | 테스터 공개 페이지 설정 |
| **Server** | `/api/v1/auth/login` | 로그인 API |
| **Server** | `/api/v1/auth/me` | 현재 사용자 정보 |
| **Server** | `/api/v1/admin/permissions` | 페이지 권한 CRUD |
| **Admin** | `middleware.ts` | 인증/권한 검사 (Next.js Middleware) |
| **Admin** | `/login` 페이지 | 로그인 화면 |
| **Admin** | 접근 제어 설정 UI | admin이 테스터 권한 관리 |

---

## 3. 데이터 모델

### 3.1 accounts 테이블

```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,     -- 로그인 ID
    password_hash VARCHAR(255) NOT NULL,       -- bcrypt 해시
    display_name VARCHAR(100),                 -- 표시명
    role VARCHAR(20) NOT NULL DEFAULT 'tester', -- 'admin' | 'tester'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 3.2 page_permissions 테이블

```sql
CREATE TABLE page_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_path VARCHAR(255) NOT NULL,          -- e.g., '/conversations/run0'
    route_name VARCHAR(100) NOT NULL,          -- e.g., 'Latency Lab (Run0)'
    route_group VARCHAR(100),                  -- e.g., '대화 시나리오'
    is_public_to_tester BOOLEAN DEFAULT false, -- 테스터에게 공개 여부
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 3.3 conversation_templates 테이블 변경 (기존 테이블)

```sql
-- 기존 conversation_templates 테이블에 컬럼 추가
ALTER TABLE conversation_templates
    ADD COLUMN is_public_to_tester BOOLEAN DEFAULT false;
```

> 이 컬럼이 `true`인 템플릿만 tester의 My Turn 페이지에 표시됩니다.
> admin은 모든 템플릿을 볼 수 있습니다.

---

### 3.4 초기 데이터

```sql
-- Admin 계정 (비밀번호: 변경 필수)
INSERT INTO accounts (username, password_hash, display_name, role)
VALUES ('admin', '<bcrypt_hash>', 'Admin', 'admin');

-- 페이지 목록 (기본: 모두 비공개)
INSERT INTO page_permissions (route_path, route_name, route_group) VALUES
('/', '대시보드', '홈'),
('/lab/variables', '변수 관리', '🧪 실험실'),
('/lab/prompts', 'AI 프롬프트', '🧪 실험실'),
('/lab/analytics', '분석 대시보드', '🧪 실험실'),
('/ai-lab/pipelines', '파이프라인', '🤖 AI Agent Lab'),
('/ai-lab/experiment', '실험 테스트', '🤖 AI Agent Lab'),
('/ai-lab/logs', '실험 로그', '🤖 AI Agent Lab'),
('/conversations/templates', '템플릿 관리', '🎙️ 대화 시나리오'),
('/conversations/run0', 'Latency Lab (Run0)', '🎙️ 대화 시나리오'),
('/conversations/my-turn', 'My Turn (시나리오)', '🎙️ 대화 시나리오'),
('/conversations/sessions', '세션 기록', '🎙️ 대화 시나리오'),
('/contents/scenarios', '시나리오 관리', '📦 콘텐츠'),
('/settings/themes', '테마 관리', '⚙️ 앱관리'),
('/settings/users', '사용자 관리', '⚙️ 앱관리');
```

---

## 4. API 설계

### 4.1 인증 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/v1/auth/login` | 로그인 → JWT 토큰 반환 |
| `GET` | `/api/v1/auth/me` | 현재 사용자 정보 + 허용 페이지 목록 |
| `POST` | `/api/v1/auth/logout` | 로그아웃 |

### 4.2 계정 관리 API (admin 전용)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/v1/admin/accounts` | 계정 목록 조회 |
| `POST` | `/api/v1/admin/accounts` | 테스터 계정 생성 |
| `DELETE` | `/api/v1/admin/accounts/{id}` | 계정 삭제 |

### 4.3 권한 관리 API (admin 전용)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/v1/admin/permissions` | 페이지 권한 목록 |
| `PUT` | `/api/v1/admin/permissions` | 페이지 공개 여부 일괄 업데이트 |

### 4.4 템플릿 공개 관리 API (admin 전용)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/v1/admin/templates/visibility` | 템플릿별 공개 여부 목록 |
| `PUT` | `/api/v1/admin/templates/visibility` | 템플릿 공개 여부 일괄 업데이트 |

> 기존 템플릿 CRUD API에서 My Turn 목록 조회 시 role에 따라 필터링:
> - admin → 모든 템플릿
> - tester → `is_public_to_tester = true`인 템플릿만

---

## 5. Admin UI 설계

### 5.1 로그인 페이지 (`/login`)

```
┌─────────────────────────────┐
│                             │
│     🔬 Research CMS         │
│                             │
│  ┌────────────────────────┐ │
│  │ Username               │ │
│  └────────────────────────┘ │
│  ┌────────────────────────┐ │
│  │ Password               │ │
│  └────────────────────────┘ │
│                             │
│  [       로그인       ]     │
│                             │
└─────────────────────────────┘
```

### 5.2 접근 제어 설정 페이지 (`/settings/access-control`) — admin 전용

```
┌──────────────────────────────────────────────────┐
│ 접근 제어 설정                                    │
├──────────────────────────────────────────────────┤
│                                                  │
│ 📋 테스터 계정 관리                                │
│ ┌──────────┬──────────┬──────────┬────────────┐  │
│ │ Username │ 표시명    │ 상태     │ 액션        │  │
│ ├──────────┼──────────┼──────────┼────────────┤  │
│ │ tester1  │ 김테스터  │ ✅ 활성  │ [삭제]     │  │
│ │ tester2  │ 이테스터  │ ✅ 활성  │ [삭제]     │  │
│ └──────────┴──────────┴──────────┴────────────┘  │
│ [+ 테스터 추가]                                   │
│                                                  │
│ 🔓 페이지 공개 설정 (테스터에게)                    │
│ ┌──────────────────────────┬──────────┐          │
│ │ 🧪 실험실                            │          │
│ │   ☐ 변수 관리                       │          │
│ │   ☐ AI 프롬프트                     │          │
│ │   ☐ 분석 대시보드                    │          │
│ │ 🎙️ 대화 시나리오                     │          │
│ │   ☑ Latency Lab (Run0)             │          │
│ │   ☑ My Turn (시나리오)              │          │
│ │   ☐ 템플릿 관리                     │          │
│ │   ☑ 세션 기록                       │          │
│ └──────────────────────────┴──────────┘          │
│ [저장]                                           │
│                                                  │
│ 🎙️ 템플릿 공개 설정 (My Turn용)                   │
│ ┌──────────────────────────┬──────────┐          │
│ │ 템플릿 이름               │ 테스터 공개│          │
│ ├──────────────────────────┼──────────┤          │
│ │ Coffee Shop Ordering     │    ☑     │          │
│ │ Airport Check-in         │    ☑     │          │
│ │ Job Interview Practice   │    ☐     │          │
│ │ Doctor's Appointment     │    ☐     │          │
│ └──────────────────────────┴──────────┘          │
│ [저장]                                           │
└──────────────────────────────────────────────────┘
```

### 5.3 사이드바 변화

- **admin 로그인**: 모든 메뉴 표시
- **tester 로그인**: 허용된 메뉴만 표시, 비허용 그룹은 자동 숨김

---

## 6. Next.js Middleware 동작

```typescript
// middleware.ts (프로젝트 루트 src/)
// 모든 요청에서 실행

1. /login, /_next, /favicon → 통과 (인증 불필요)
2. 쿠키에서 JWT 토큰 확인
   → 없음 → /login으로 리다이렉트
3. JWT 검증 (서버 SECRET_KEY로)
   → 실패 → /login으로 리다이렉트
4. role 확인
   → admin → 통과
   → tester → 허용된 페이지 목록과 현재 경로 비교
     → 허용됨 → 통과
     → 비허용 → 403 페이지 또는 대시보드로 리다이렉트
```

---

## 7. 구현 계획

| 순서 | 작업 | 위치 | 예상 시간 |
|------|------|------|----------|
| 1 | DB 모델 (accounts, page_permissions) | Server | 30m |
| 2 | 로그인 API (`/auth/login`, `/auth/me`) | Server | 1h |
| 3 | 계정/권한 관리 API (`/admin/*`) | Server | 1h |
| 4 | Next.js Middleware (인증 검사) | Admin | 1h |
| 5 | 로그인 페이지 UI | Admin | 30m |
| 6 | 접근 제어 설정 페이지 UI | Admin | 1.5h |
| 7 | 사이드바 필터링 (역할 기반) | Admin | 30m |
| 8 | 마이그레이션 + 초기 데이터 | Server | 30m |

**총 예상 시간: ~6.5h**

---

## 8. 보안 고려사항

- 비밀번호는 **bcrypt** 해시로 저장
- JWT 토큰은 **HttpOnly 쿠키**로 전달 (XSS 방지)
- 토큰 만료: 7일 (설정 가능)
- Server API에도 인증 미들웨어 추가 (JWT 검증)
- admin 전용 API는 role 체크 필수
