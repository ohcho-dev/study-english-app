# TASK-002: RUN0 대화 시나리오 검증 구현 (Latency Lab)

> **Note**: Run0는 현재 **Latency Lab**으로 명명되어 기술 베이스라인 측정 용도로 사용됩니다.

| 항목 | 내용 |
|------|------|
| **생성일** | 2026-02-09 |
| **상태** | 🟡 In Progress |
| **우선순위** | High |

---

## 📋 배경 (Background)

"My Turn" 학습 시나리오의 기술적 실현 가능성을 검증하기 위한 RUN0 (Voice Tech Baseline) 구현.

### 구현 방향 결정사항

| 항목 | 결정 |
|------|------|
| 모듈 구조 | ✅ 기존 AI Lab과 **완전히 별도 모듈**로 구현 |
| 로그 테이블 | ✅ **새로운 테이블** 생성 (기존 파이프라인과 분리) |
| UI 범위 | ✅ **전체 UI** 구현 (사용성 중시) |
| STT/TTS | ✅ **Google Cloud** STT/TTS 사용 |

---

## ✅ 체크리스트 (Checklist)

### Phase 1: 백엔드 기반 작업

#### 1.1 데이터베이스 (DB) ✅
- [x] SQLAlchemy 모델 정의 (`app/models/conversation.py`)
  - [x] ENUM 타입 정의 (ConversationMode, ParticipantType, SessionStatus, TurnType)
  - [x] `ConversationTemplate` 모델
  - [x] `ConversationParticipant` 모델
  - [x] `ConversationSession` 모델
  - [x] `ConversationTurn` 모델
  - [x] `MeasurementConfig` 모델
  - [x] `SessionMetrics` 모델
- [x] models/__init__.py에 export 추가
- [ ] Alembic 마이그레이션 생성 및 적용 👈 **사용자 실행 필요**

#### 1.2 Pydantic 스키마 ✅
- [x] `app/schemas/conversation.py` 생성
  - [x] Template 관련 스키마 (Create, Update, Response, List)
  - [x] Participant 관련 스키마
  - [x] Session 관련 스키마
  - [x] Measurement 관련 스키마
  - [x] RUN0 Voice 관련 스키마
  - [x] Dashboard 관련 스키마
  - [x] Pagination 스키마

#### 1.3 서버 설정 업데이트 ✅
- [x] `app/core/config.py`에 GOOGLE_CLOUD_STT_TTS_API_KEY 추가
- [x] `.env.example` 업데이트

#### 1.4 STT/TTS 서비스 ✅
- [x] `app/services/conversation/__init__.py` 생성
- [x] `app/services/conversation/stt_service.py` - Google Cloud STT
- [x] `app/services/conversation/tts_service.py` - Google Cloud TTS

#### 1.5 비즈니스 로직 서비스 ✅
- [x] `app/services/conversation/template_service.py`
- [x] `app/services/conversation/session_service.py`
- [x] `app/services/conversation/run0_service.py`

#### 1.6 API 라우터 ✅
- [x] `app/api/v1/conversations.py` 생성
  - [x] Template CRUD 엔드포인트
  - [x] Session 엔드포인트
  - [x] RUN0 통합 엔드포인트 (`/run0/voice`, `/run0/log`)
  - [x] Voice configuration 엔드포인트
- [x] `app/api/v1/router.py`에 라우터 등록

---

### Phase 2: 프론트엔드 구현

#### 2.1 공통 설정
- [ ] app 라우트 구조 생성 (`app/(dashboard)/conversations/...`)
- [ ] 사이드바에 "대화 시나리오 검증" 메뉴 추가

#### 2.2 Feature 모듈 (`features/conversations/`)
- [ ] API 클라이언트 (`api/conversationsApi.ts`)
- [ ] 타입 정의 (`model/types.ts`)
- [ ] 커스텀 훅 (`model/useTemplates.ts`, `useSessions.ts`)
- [ ] 음성 녹음 훅 (`model/useVoiceRecorder.ts`)

#### 2.3 UI 컴포넌트
- [ ] `TemplateEditor.tsx`
- [ ] `ParticipantEditor.tsx`
- [ ] `SessionRunner.tsx`
- [ ] `VoiceRecorder.tsx`
- [ ] `MetricsDashboard.tsx`

#### 2.4 페이지
- [ ] `TemplatesPage.tsx`
- [ ] `SessionsPage.tsx`
- [ ] `DashboardPage.tsx`

---

### Phase 3: 통합 및 검증

- [ ] RUN0 전체 플로우 테스트
- [ ] 타임스탬프 정확도 검증
- [ ] E2E 레이턴시 측정 (10회)

---

## 📝 진행 기록 (Progress Log)

### 2026-02-09
- 구현 계획서 작성 및 승인
- Google Cloud STT/TTS API 설정 완료
- **Phase 1 백엔드 코드 구현 완료**
  - SQLAlchemy 모델 6개 테이블
  - Pydantic 스키마 전체
  - STT/TTS 서비스
  - Template, Session, Run0 서비스
  - API 라우터 및 등록
- ⏳ 마이그레이션 및 의존성 설치 대기 중

---

## 🔧 사용자 실행 필요 사항

```bash
# 1. 의존성 설치
cd apps/server
poetry add pydub google-cloud-speech google-cloud-texttospeech

# 2. ffmpeg 설치 (pydub 의존성)
brew install ffmpeg

# 3. DB 마이그레이션
alembic revision --autogenerate -m "Add conversation tables"
alembic upgrade head
```

---

## 🔗 관련 문서

- [기획 문서](../plan/conversation-scenario-validation.md)
- [AI Agent Lab 가이드](../guide/ai-agent-lab-guide.md)
- [기술 스택](../../.gemini/rules/common/tech-stack.md)
