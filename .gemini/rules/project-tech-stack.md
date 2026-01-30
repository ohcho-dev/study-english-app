# 📘 AI 영어 회화 서비스 - 기술 스택 및 아키텍처 규칙

> **프로젝트명:** AI 영어 회화 서비스 (1:1 시뮬레이션 & 그룹 교실)
> **핵심 철학:** "Productivity First" & "Modular Design"
> **작성일:** 2026-01-30

---

## 1. 기술 스택 (Tech Stack)

### 1.1. Frontend
| 구분 | 기술 | 비고 |
|------|------|------|
| **Framework** | React Native (Expo) | iOS/Android 동시 개발, OTA 업데이트 |
| **Language** | TypeScript (v5.x) | Strict Mode 필수 |
| **Routing** | expo-router | 파일 기반 라우팅 |
| **Styling** | NativeWind v4 | Tailwind CSS 문법 (`className="flex-1 bg-white"`) |
| **Component** | React Native Reusables | shadcn/ui 철학, `cva`, `cn` 유틸리티 |
| **State** | TanStack Query (React Query) | 서버 데이터 캐싱 |
| **Video** | react-native-video | 배경 루프 영상 재생 |
| **Audio** | expo-av | 음성 녹음/재생 |
| **Chat UI** | react-native-gifted-chat | 채팅 인터페이스 |
| **File** | expo-file-system | 로컬 캐싱 |

### 1.2. Backend
| 구분 | 기술 | 비고 |
|------|------|------|
| **Framework** | Python (FastAPI) | AI 연동성, 비동기 성능 |
| **Socket** | python-socketio (Async) | 실시간 통신 |
| **Validation** | Pydantic | 데이터 검증 + OpenAPI 자동 생성 |
| **State Store** | Python In-Memory → Redis | MVP → Scale-out |

### 1.3. Infrastructure
| 구분 | 기술 | 비고 |
|------|------|------|
| **Auth/DB** | Supabase | PostgreSQL + Auth (소셜 로그인) |
| **AI** | Google Gemini 3.0 Pro/Flash | Native Audio 멀티모달 |
| **TTS** | Google Cloud TTS | 음성 변환 (100만 자/월 무료) |
| **Payment** | PortOne V2 | 국내 결제 (카카오페이, 네이버페이) |
| **Admin** | Retool | 노코드 운영 툴 |
| **Monitoring** | Sentry | 크래시 리포팅 |

### 1.4. Deployment
| 구분 | 기술 | 비고 |
|------|------|------|
| **Mobile** | EAS (Expo) | 클라우드 빌드, OTA 업데이트 |
| **Backend** | Docker + Railway/Fly.io | GitHub Push → 자동 배포 |
| **Channel** | preview / production | 테스트/배포 분리 |

---

## 2. 모노레포 구조 (Turborepo)

```
root/
├── apps/
│   └── mobile/            # React Native (FSD 아키텍처)
├── backend/               # FastAPI (모듈러 모놀리스)
│   └── app/modules/
│       ├── auth/          # 인증
│       ├── simulation/    # 1:1 회화
│       └── classroom/     # 그룹 회화 (Socket)
├── packages/
│   └── api-client/        # TS 타입 자동 생성 (OpenAPI Generator)
├── turbo.json
└── package.json           # "npm run dev:all"
```

### 타입 자동 동기화 워크플로우
1. FastAPI Pydantic 수정 → `openapi.json` 자동 생성
2. `npm run sync-api` 실행
3. `packages/api-client`에 TypeScript Interface 자동 생성
4. API 스펙 변경 시 프론트엔드 컴파일 단계에서 에러 발생 → 버그 원천 차단

---

## 3. 아키텍처 패턴

### 3.1. Frontend: FSD (Feature-Sliced Design)
```
app/        # Provider, Routing Entry
pages/      # 화면 단위 조합 (Home, Simulation, Classroom)
features/   # 사용자 상호작용 로직 (AudioRecorder, SocketHandler)
entities/   # 비즈니스 데이터 모델 (User, Session)
shared/     # 재사용 컴포넌트 및 유틸리티
```

### 3.2. Backend: 모듈러 모놀리스 + 계층형 아키텍처
```
Router   → HTTP 요청 파싱, Pydantic 검증
Service  → [핵심] 비즈니스 로직, AI 호출, 점수 계산
Repository → Supabase Client 래핑, DB 쿼리
```

### 3.3. 하이브리드 트래픽 분산
- **Direct 연결 (빠른 속도):** 로그인, 프로필 조회 → Supabase 직접
- **Server 경유 (보안 필수):** AI 처리, 결제 검증, 복합 Write → FastAPI

---

## 4. 설계 원칙 (SOLID 재해석)

### SRP (단일 책임 원칙)
- **Frontend:** View와 Logic 분리 (Custom Hooks)
- **Backend:** Router와 Service 분리

### DIP (의존성 역전 원칙)
- **Frontend:** Composition & Props 주입
- **Backend:** FastAPI `Depends()` DI → 테스트 시 Mock 교체

---

## 5. 보안 및 안정성

### Supabase RLS (Row Level Security)
```sql
CREATE POLICY "User Select" ON "profiles" 
FOR SELECT USING (auth.uid() = user_id);
```

### 장애 대응
- **Retry:** Exponential Backoff
- **Graceful Degradation:** 장애 시 오프라인 모드

---

## 6. AI 모델 선정 기준

### Gemini vs GPT 비교 (Gemini 선정)
| 비교 항목 | OpenAI (GPT-4o) | Google Gemini 3.0 |
|-----------|-----------------|-------------------|
| 처리 구조 | 2단계 (Whisper → GPT) | 1단계 (Native Audio) |
| 인식 정보 | 텍스트만 | 오디오+텍스트 (톤/감정) |
| 비용 | STT + LLM 이중 비용 | 멀티모달 통합 비용 |

### Gemini 모델 라인업
| 모델 | 용도 |
|------|------|
| **Pro** | 추론 능력, 뉘앙스 파악 (튜터용 권장) |
| **Flash** | 속도/가성비 (테스트 후 결정) |

---

## 7. 비용 최적화 전략

### 7.1. 2-Tier Caching System

**Tier 1 (Client):**
- `expo-file-system`으로 로컬 파일 캐싱
- 반복 청취 시 서버 통신 0회

**Tier 2 (Server):**
- 텍스트 Hash (MD5/SHA-256) → DB에 URL 저장
- 동일 문장 TTS 재생성 방지

### 7.2. 캐시 적중률 극대화
- `Temperature = 0` 설정 → 결정론적(Deterministic) 답변 유도
- 항상 같은 텍스트 → 해시 매칭 성공 → TTS 비용 90%+ 절감

### 7.3. Google Cloud TTS 무료 티어
| Voice Type | 월 무료 한도 |
|------------|-------------|
| Standard | 400만 자 |
| WaveNet/Neural2 | 100만 자 |

---

## 8. 기각된 기술 (Reference)

### 3D 관련 기술 기각 사유
| 기술 | 기각 사유 |
|------|----------|
| Three.js / R3F | 배터리 광탈, GPU 발열 |
| AI 3D 생성툴 | 복합 공간 생성 불가, Polygon Bomb |
| Unity Full 3D | 수작업 병목, 높은 러닝커브 |

### 최종 솔루션: 시네마틱 2D
- 루프 비디오 (MP4) 배경 + `react-native-video`
- AI 비디오 생성 (Runway, Sora) 또는 스톡 비디오 활용
