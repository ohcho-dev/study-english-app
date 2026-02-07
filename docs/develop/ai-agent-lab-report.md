# AI Agent Lab 개발 완료 보고서

**작성일**: 2026-02-08  
**상태**: ✅ 개발 완료

---

## 📋 개요

AI Agent Lab은 어드민에서 여러 AI 에이전트를 연결한 파이프라인을 생성하고, 다양한 AI 모델로 실험을 수행하며, 결과를 로깅하는 기능입니다.

---

## ✅ 구현된 기능

### 🔌 서버 (Backend)

#### 1. DB 모델 (4개)

| 파일 | 모델 | 설명 |
|------|------|------|
| `ai_lab_pipeline.py` | `Pipeline` | 파이프라인 메타데이터 (이름, 설명, 시스템 프롬프트) |
| `ai_lab_pipeline.py` | `PipelineAgent` | 파이프라인 내 에이전트 (역할, 프롬프트, 순서) |
| `ai_lab_experiment.py` | `AILabExperimentLog` | 실험 로그 (입력, 결과, 토큰, 비용) |
| `ai_lab_experiment.py` | `AILabExperimentLogStep` | 단계별 상세 로그 |

#### 2. Pydantic 스키마

`app/schemas/ai_lab.py`에서 정의:
- Pipeline 관련: `PipelineCreate`, `PipelineUpdate`, `PipelineResponse`, `PipelineListItem`
- Agent 관련: `AgentCreate`, `AgentResponse`
- Experiment 관련: `ExperimentRunRequest`, `ExperimentRunResponse`, `StepResult`
- Log 관련: `ExperimentLogSummary`, `ExperimentLogDetail`, `ExperimentLogStep`
- Model 관련: `ModelInfo`

#### 3. 서비스 레이어

| 파일 | 클래스 | 역할 |
|------|--------|------|
| `pipeline_service.py` | `PipelineService` | 파이프라인 CRUD |
| `experiment_service.py` | `ExperimentService` | 실험 실행, 로그 저장/조회 |
| `chain_builder.py` | `ChainBuilder` | LangChain 기반 AI 체인 구성 |
| `model_registry.py` | `MODEL_REGISTRY` | 모델 정보 및 비용 계산 |

#### 4. API 엔드포인트

`app/api/v1/ai_lab.py`에서 다음 API 제공:

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/ai-lab/pipelines` | 파이프라인 목록 |
| POST | `/api/v1/ai-lab/pipelines` | 파이프라인 생성 |
| GET | `/api/v1/ai-lab/pipelines/{id}` | 파이프라인 상세 |
| PUT | `/api/v1/ai-lab/pipelines/{id}` | 파이프라인 수정 |
| DELETE | `/api/v1/ai-lab/pipelines/{id}` | 파이프라인 삭제 |
| POST | `/api/v1/ai-lab/experiments/run` | 실험 실행 |
| GET | `/api/v1/ai-lab/experiments/logs` | 로그 목록 (페이지네이션) |
| GET | `/api/v1/ai-lab/experiments/logs/{id}` | 로그 상세 |
| GET | `/api/v1/ai-lab/models` | 사용 가능한 모델 목록 |
| POST | `/api/v1/ai-lab/upload` | 파일 업로드 |

---

### 🖥️ 어드민 (Frontend)

#### 1. Feature 모듈 구조

```
apps/admin/src/(fsd)/features/ai-lab/
├── index.ts           # Public exports
├── model/
│   ├── types.ts       # TypeScript 타입 정의
│   ├── usePipeline.ts # 파이프라인 React Query 훅
│   └── useExperiment.ts # 실험 React Query 훅
├── api/
│   └── aiLabApi.ts    # API 클라이언트
└── ui/
    ├── AgentEditor.tsx     # 에이전트 편집기
    ├── PipelineCard.tsx    # 파이프라인 카드
    ├── ExperimentRunner.tsx # 실험 실행 폼
    ├── ExperimentResult.tsx # 실험 결과 표시
    ├── RecentLogs.tsx      # 최근 로그 테이블
    └── LogDetailModal.tsx  # 로그 상세 모달
```

#### 2. 페이지 (5개)

| 경로 | 설명 |
|------|------|
| `/ai-lab/pipelines` | 파이프라인 목록 |
| `/ai-lab/pipelines/new` | 새 파이프라인 생성 |
| `/ai-lab/pipelines/[id]/edit` | 파이프라인 편집 |
| `/ai-lab/experiment` | 실험 테스트 |
| `/ai-lab/logs` | 로그 조회 |

#### 3. 사이드바 메뉴

`AppSidebar.tsx`에 **🤖 AI Agent Lab** 메뉴 그룹 추가:
- 파이프라인
- 실험 테스트
- 실험 로그

---

## 🔧 지원 AI 모델

| 모델 ID | 이름 | 제공사 | 입력 비용 ($/1M) | 출력 비용 ($/1M) | 멀티모달 |
|---------|------|--------|------------------|------------------|----------|
| gemini-pro | Gemini Pro | Google | $1.25 | $5.00 | ✅ |
| gemini-flash | Gemini Flash | Google | $0.075 | $0.30 | ✅ |
| gpt-4o | GPT-4o | OpenAI | $5.00 | $15.00 | ✅ |
| gpt-4-turbo | GPT-4 Turbo | OpenAI | $10.00 | $30.00 | ✅ |

> ⚠️ 현재 Gemini 모델만 활성화됨. OpenAI는 추후 구현 필요.

---

## 📊 데이터 전달 방식

| 모드 | 이름 | 설명 |
|------|------|------|
| A | 최종 출력만 | 이전 에이전트의 마지막 응답만 전달 |
| B | 전체 히스토리 | 누적된 모든 대화 내용 전달 |
| C | JSON 필드 추출 | JSON 결과에서 특정 필드만 전달 |

---

## ✅ 검증 결과

| 항목 | 상태 | 명령어 |
|------|------|--------|
| TypeScript 컴파일 | ✅ 통과 | `cd apps/admin && npx tsc --noEmit` |
| Python 모델 import | ✅ 성공 | `poetry run python -c "from app.models import Pipeline..."` |
| Python 서비스 import | ✅ 성공 | `poetry run python -c "from app.services.ai_lab import PipelineService..."` |
| DB 마이그레이션 | ✅ 적용 | `poetry run alembic upgrade head` |

---

## 🚀 실행 방법

### 서버 실행
```bash
cd apps/server
poetry run uvicorn app.main:app --reload
```

### 어드민 실행
```bash
cd apps/admin
npm run dev
```

### 접속
- 어드민: http://localhost:3000
- AI Lab 파이프라인: http://localhost:3000/ai-lab/pipelines
- 실험 테스트: http://localhost:3000/ai-lab/experiment
- 실험 로그: http://localhost:3000/ai-lab/logs
- API 문서: http://localhost:8000/docs

---

## 📁 생성/수정된 파일 목록

### 서버 (apps/server)

**새로 생성**:
- `app/models/ai_lab_pipeline.py` - Pipeline, PipelineAgent 모델
- `app/models/ai_lab_experiment.py` - AILabExperimentLog, AILabExperimentLogStep 모델
- `app/schemas/ai_lab.py` - AI Lab Pydantic 스키마
- `app/services/ai_lab/__init__.py` - 서비스 모듈 초기화
- `app/services/ai_lab/pipeline_service.py` - 파이프라인 서비스
- `app/services/ai_lab/experiment_service.py` - 실험 서비스
- `app/services/ai_lab/chain_builder.py` - LangChain 체인 빌더
- `app/services/ai_lab/model_registry.py` - 모델 레지스트리
- `app/api/v1/ai_lab.py` - API 라우터
- `migrations/versions/xxx_add_ai_lab_models.py` - 마이그레이션

**수정**:
- `app/models/__init__.py` - AI Lab 모델 export 추가
- `app/api/v1/router.py` - AI Lab 라우터 등록

### 어드민 (apps/admin)

**새로 생성**:
- `src/(fsd)/features/ai-lab/index.ts`
- `src/(fsd)/features/ai-lab/model/types.ts`
- `src/(fsd)/features/ai-lab/model/usePipeline.ts`
- `src/(fsd)/features/ai-lab/model/useExperiment.ts`
- `src/(fsd)/features/ai-lab/api/aiLabApi.ts`
- `src/(fsd)/features/ai-lab/ui/AgentEditor.tsx`
- `src/(fsd)/features/ai-lab/ui/PipelineCard.tsx`
- `src/(fsd)/features/ai-lab/ui/ExperimentRunner.tsx`
- `src/(fsd)/features/ai-lab/ui/ExperimentResult.tsx`
- `src/(fsd)/features/ai-lab/ui/RecentLogs.tsx`
- `src/(fsd)/features/ai-lab/ui/LogDetailModal.tsx`
- `src/app/(dashboard)/ai-lab/pipelines/page.tsx`
- `src/app/(dashboard)/ai-lab/pipelines/new/page.tsx`
- `src/app/(dashboard)/ai-lab/pipelines/[id]/edit/page.tsx`
- `src/app/(dashboard)/ai-lab/experiment/page.tsx`
- `src/app/(dashboard)/ai-lab/logs/page.tsx`

**수정**:
- `src/(fsd)/shared/config/constants.ts` - AI Lab 라우트 추가
- `src/(fsd)/widgets/sidebar/ui/AppSidebar.tsx` - AI Lab 메뉴 추가

### 문서 (docs)

**새로 생성**:
- `docs/plan/ai-agent-lab.md` - 서비스 기획 문서
- `docs/develop/ai-agent-lab-api.md` - 개발 기획 문서
- `docs/guide/ai-agent-lab-usage.md` - 사용 가이드
- `docs/develop/ai-agent-lab-report.md` - 개발 완료 보고서 (본 문서)

---

## 📝 참고 사항

### 환경 변수

서버 `.env` 파일에 다음 설정 필요:

```env
GOOGLE_AI_API_KEY=your-google-ai-api-key
```

### 향후 개선 사항

1. **OpenAI 모델 지원**: GPT-4 등 OpenAI 모델 연동
2. **실시간 스트리밍**: 실험 결과를 실시간으로 표시
3. **파이프라인 템플릿**: 자주 사용하는 파이프라인 템플릿 제공
4. **비용 알림**: 예상 비용이 임계값을 초과하면 경고
5. **A/B 테스트**: 동일 입력으로 여러 모델 비교 실험
