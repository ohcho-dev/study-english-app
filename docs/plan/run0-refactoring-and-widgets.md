# Run0 고도화 및 모델 선택 위젯 기획안

## 1. 개요 (Overview)
본 문서는 "Latency Lab (Run0)"을 순수 레이턴시 측정 도구로 고도화하고, 시스템 전반에서 재사용 가능한 "모델 선택 위젯"을 도입하기 위한 기획 및 구현 계획을 담고 있습니다.

## 2. 목표 (Objectives)
1.  **Run0(Latency Lab)의 순수화**: 
    - 템플릿, 시나리오, 페르소나 등 "대화 맥락"에 대한 의존성을 제거합니다.
    - 오직 `HTTP 연결` -> `STT` -> `LLM` -> `TTS` -> `응답` 사이클의 속도 측정에만 집중할 수 있도록 구조를 단순화합니다.
2.  **재사용 가능한 모델 선택 위젯 개발**: 
    - 각 모델(STT, LLM, TTS)의 특성과 용도를 설명하는 카드 형태의 UI 컴포넌트를 개발합니다.
    - 이를 Run0뿐만 아니라 My Turn 및 다른 실험실에서도 쉽게 재사용할 수 있도록 모듈화합니다.
3.  **정밀한 레이턴시 분석**:
    - 평균값뿐만 아니라 개별 실행(Turn)에 대한 상세 로그를 기록합니다.
    - TTS 구간을 "서버 생성(Synthesis)"과 "클라이언트 로드(Load)"로 분리하여 분석합니다.

## 3. 현황 및 개선 필요사항 (Current Status & Gap Analysis)
현재 Run0 시스템은 기본적인 ASR -> LLM -> TTS 파이프라인을 갖추고 있으나, 다음과 같은 한계점이 존재합니다.

*   **모델 선택의 경직성**: 주요 모델(Google STT, Gemini Flash, WaveNet)이 코드 내에 하드코딩되어 있어, 새로운 모델(Gemini 3.0 등) 테스트 시 코드 수정이 필요합니다.
*   **템플릿 의존성**: 레이턴시 테스트만을 위한 독립적인 실행이 불가능하며, 불필요한 시나리오/페르소나 로직이 포함되어 있습니다.
*   **지표의 단순성**: 평균 레이턴시 위주로만 확인 가능하며, 개별 실행(Turn)에 대한 상세 로그 및 TTS 구간의 세분화(생성 vs 로딩)가 부족합니다.

## 4. 세부 구현 계획 (Proposed Implementation)

### 4.1 지표 고도화 (Advanced Metrics)
기존의 3단계(STT, LLM, TTS) 지표를 **4단계 상세 지표**로 확장하여 로그를 수집합니다.

1.  **STT Latency**: 음성 인식 소요 시간 (`t1` - `t0`)
2.  **LLM Latency**: 토큰 생성 소요 시간 (`t2` - `t1`)
3.  **TTS Synthesis (Server)**: 서버에서 오디오 생성 완료 시간 (`t2.5` - `t2`)
4.  **Client Load (Network/Init)**: 오디오 다운로드 및 재생 시작 시간 (`t3` - `t2.5`)
    *   *Calculation*: `E2E Total` - `Server Total`
5.  **E2E Total**: 발화 종료(`t0`)부터 오디오 재생 시작(`t3`)까지의 총 시간

### 4.2 Frontend: 모델 옵션 Hooks (Server-Driven Data)
모델 정보는 하드코딩하지 않고 백엔드 API를 통해 동적으로 가져옵니다.

#### [NEW] `features/conversations/model/useModelOptions.ts`
*   **`useSTTOptions`**: `/api/v1/ai-lab/models/stt` 호출
    - 반환값: `List[STTModelInfo]` (id, label, description, tags including 'Chirp 2', 'Latest Long' etc.)
*   **`useLLMOptions`**: `/api/v1/ai-lab/models/llm` 호출
    - 반환값: `List[LLMModelInfo]` (id, label, description, tags including 'Gemini 3.0 Flash/Pro')
*   **`useTTSOptions`**: `/api/v1/ai-lab/models/tts` 호출
    - 반환값: 
        ```typescript
        interface TTSOptionsResponse {
            providers: { id: string; label: string; description: string; }[]; // Google, Gemini
            languages: { code: string; label: string; }[]; // For Google TTS
            google_models: string[]; // Neural2, WaveNet, Journey, Polyglot...
            // Voices are fetched dynamically or filtered on client based on full list
        }
        ```

### 4.3 Frontend: UI 컴포넌트 (`ModelSelectorWidget`)
재사용 가능한 카드 형태의 위젯을 구현합니다.

#### [NEW] `shared/ui/widgets/ModelSelectorCard.tsx`
*   **Props**: `title`, `description`, `options`, `value`, `onChange`, `icon`
*   **UI 구성 (TTS 예시)**:
    *   **Header**: 아이콘 + 제목 (예: "TTS Model")
    *   **Provider Select**: `RadioGroup` (Google Cloud vs Gemini)
    *   **Body (Provider에 따라 동적 변경)**:
        *   **Google Cloud**: `Language` Select -> `Model Type` Select -> `Voice` Select
        *   **Gemini**: `Model` Select (e.g., 2.0 Flash) -> `Voice` Select (e.g., Puck)
    *   **Footer**: 선택된 조합에 대한 설명

### 4.4 Frontend: Run0 페이지 리팩토링

#### [MODIFY] `Run0ConfigPanel` -> `Run0ControlPanel`
*   **Pipeline Config**: `ModelSelectorCard` 3종(STT, LLM, TTS) 배치.
*   **Latency Config**: Target Latency 설정.

#### [NEW] `Run0LogTable`
*   테스트 실행마다 쌓이는 로그를 테이블 형태로 표시합니다.
*   **Columns**: `Turn #`, `Transcript`, `STT(ms)`, `LLM(ms)`, `TTS Gen(ms)`, `Client Load(ms)`, `Total E2E(ms)`

#### [MODIFY] `features/conversations/model/useRun0.ts`
*   **템플릿 의존성 제거**: `templateId` 파라미터 삭제.
*   **로그 데이터 관리**: `results` 배열에 각 Turn의 상세 지표(4.1 참조)를 저장하도록 로직 수정.

### 4.5 Backend: 서비스 로직 수정

#### [NEW] `app/api/v1/ai_lab.py` (Endpoints)
*   `GET /models/stt`, `/models/llm`, `/models/tts`: 최신 모델 리스트 반환.

#### [MODIFY] `run0_service.py`
*   **Input**: 모든 모델 파라미터(`stt_model`, `llm_model`, `tts_provider`, `tts_model`, `tts_voice`) 수신.
*   **Logging**: `log_client_timestamp` 호출 시 `Client Load` 지표 계산 및 저장 로직 추가.

#### [MODIFY] `stt_service.py`
*   `transcribe` 메서드에 `model` 파라미터 추가.

## 5. 검증 계획 (Verification Plan)

1.  **UI 검증**: 
    - 모델 선택 위젯이 서버 데이터에 따라 동적으로 옵션을 렌더링하는지 확인.
    - TTS Provider 변경(Google <-> Gemini) 시 하위 선택 UI가 즉시 변경되는지 확인.
2.  **데이터 검증**:
    - 로그 테이블에 `TTS Synthesis`와 `Client Load` 시간이 구분되어 찍히는지 확인.
    - `Client Load`가 비정상적으로 높을 경우(네트워크 이슈 등)를 식별할 수 있는지 확인.
3.  **기능 검증**:
    - **Google STT**: `Chirp 2` 모델 선택 후 다국어 인식 테스트.
    - **Gemini LLM**: `Gemini 3.0 Flash` 선택 후 응답 속도 및 퀄리티 확인.
    - **TTS**: `Journey` 보이스 및 `Gemini` 네이티브 보이스 출력 확인.
