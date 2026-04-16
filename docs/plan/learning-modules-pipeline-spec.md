# Visual Pipeline Builder — AI Lab 기획서

> **상태**: 설계 완료 / 구현 대기  
> **작성일**: 2026-04-16  
> **대상 구현자**: Claude Sonnet / Codex 에이전트 (이 문서만으로 구현 가능하도록 자기 완결적으로 작성)

## 한국어 요약

### 무엇을 만드는가
n8n/Dify와 같은 **시각적 노드 기반 파이프라인 빌더**를 AI Lab 어드민 대시보드에 구축한다. 현재 `my_turn_service.py`에 하드코딩된 v0.2 파이프라인(Evaluator → Planner → Conductor)을 대체하여, 관리자가 드래그 앤 드롭으로 세션 로직을 자유롭게 설계할 수 있게 한다.

### 왜 만드는가
- 현재 새로운 학습 세션 로직을 만들려면 Python 코드를 직접 수정해야 함
- 병렬 분석(에너지 흐름, 감정 분석 등)을 추가하려면 코드 변경 필요
- 조건 분기(발화 패턴에 따른 다른 개입 모듈 라우팅)가 하드코딩됨
- AI Lab의 실험용 파이프라인과 실제 세션용 파이프라인이 분리되어 재사용 불가

### 핵심 설계
- **고정 엔드포인트**: 사용자 발화 녹음/STT(시작) ↔ AI 발화/TTS(끝)는 그대로 유지
- **자유 구성 구간**: 시작~끝 사이 모든 단계를 노드 그래프로 정의
- **9개 노드 타입**: Start, End, LLM, Code, Router, Parallel, Merge, UIEvent, Delay
- **React Flow v12**: 어드민 UI의 비주얼 에디터 라이브러리
- **graph_json JSONB**: React Flow의 `{ nodes, edges, viewport }` 그대로 DB에 저장
- **기존 호환**: `pipeline_mode = "visual"` 추가, basic/v0.2 기존 세션은 변경 없음

### 프로젝트 기술 스택
| 영역 | 기술 |
|------|------|
| Server | FastAPI + SQLAlchemy 2.0 async + PostgreSQL 15 + Redis 7 |
| Admin | Next.js 16 + Tailwind CSS v4 + shadcn/ui + Zustand + TanStack Query |
| Mobile | React Native 0.81 + Expo SDK 54 |
| AI | Google GenAI (Gemini), Google Cloud Speech/TTS |
| Architecture | FSD (Feature-Sliced Design) for frontend, Layered for backend |

### 구현 Phase (5단계)
1. **Phase 1**: 서버 데이터 모델 + 파이프라인 러너 엔진
2. **Phase 2**: 세션 통합 (process_user_turn에 visual 분기 추가)
3. **Phase 3**: 어드민 비주얼 에디터 UI (React Flow)
4. **Phase 4**: 실행 모니터링 + 템플릿 연결 UI
5. **Phase 5**: 마이그레이션 도구 + UX 개선

---

## 1. Executive Summary

The existing English learning platform runs a hardcoded v0.2 pipeline (Evaluator -> Planner -> Conductor) inside `my_turn_service.py` to analyze user speech and generate AI responses during learning sessions. This hardcoded flow prevents non-developer iteration on session logic, limits experimentation with parallel analysis branches, and makes it impossible to create new session types without code changes. The AI Lab admin section currently offers a sequential-agent pipeline editor with form-based CRUD, but it operates independently from actual learning sessions -- it is an experiment sandbox, not the session engine.

This specification defines a visual node-based pipeline builder (modeled on n8n/Dify) that replaces both the hardcoded v0.2 pipeline and the separate AI Lab pipeline system with a single, unified visual programming interface. Administrators will drag-and-drop nodes onto a canvas, connect them with edges, configure each node through a side panel, and deploy the pipeline as the actual session logic for conversation templates. The pipeline definition becomes the session engine: when a user speaks, the server loads the pipeline graph, executes it as a DAG with support for parallel branches and conditional routing, and produces the AI response plus any UI events.

The design preserves the existing fixed endpoints (user speech recording/STT at the start, AI speech/TTS at the end) while making everything in between fully configurable. It supports parallel processing (e.g., one branch handles the main pedagogical flow while another computes energy flow analysis and pushes UI updates via WebSocket), conditional routing (e.g., classify a speech pattern and route to different intervention modules), and real-time execution visualization in the admin dashboard.

---

## 2. System Architecture

### 2.1 High-Level Component Diagram

```
+---------------------+     +---------------------------+     +---------------------+
|   Mobile App        |     |   Admin Dashboard         |     |   FastAPI Server     |
|   (React Native)    |     |   (Next.js 16)            |     |   (Python 3.11+)    |
|                     |     |                           |     |                     |
|  STT Recording ---->|---->|  Visual Pipeline Editor   |     |  Pipeline Runner    |
|  TTS Playback  <----|<----|  (React Flow canvas)      |     |  (DAG Executor)     |
|  UI Events    <-----|<----|                           |     |                     |
|  (WebSocket)        |     |  Pipeline Monitor         |     |  Node Executors     |
+---------------------+     |  (Live execution view)    |     |  (LLM, Code, etc.)  |
                             +---------------------------+     +---------------------+
                                        |                              |
                                        |  REST API (CRUD)             |
                                        |  WebSocket (execution events)|
                                        +------------------------------+
                                                    |
                                            +-------v-------+
                                            |  PostgreSQL    |
                                            |  (Pipeline     |
                                            |   definitions, |
                                            |   logs, etc.)  |
                                            +----------------+
```

### 2.2 How It Fits Into Existing Architecture

The pipeline builder adds three new subsystems:

1. **Pipeline Definition Store** -- New database tables storing pipeline graphs (nodes, edges, versions). Replaces `ai_lab_pipelines` + `ai_lab_pipeline_agents` for session-driving pipelines.
2. **Pipeline Runner Engine** -- A new service (`apps/server/app/services/pipeline_runner/`) that loads a pipeline definition, topologically sorts nodes, executes them as an async DAG, and emits WebSocket events. Replaces the hardcoded `if pipeline_mode == "v0.2"` branch in `process_user_turn()`.
3. **Visual Editor UI** -- A new page in the admin dashboard (`/ai-lab/pipeline-editor/[id]`) using React Flow for the canvas. Replaces the form-based `AgentEditor` for pipeline construction.

### 2.3 Execution Flow (User Turn)

```
User speaks -> Mobile STT -> Server receives transcript
                                    |
                                    v
                          process_user_turn()
                                    |
                          [pipeline_mode check]
                           /        |        \
                     "basic"    "v0.2"    "visual"  <-- NEW
                        |          |          |
                  ScenarioDir  hardcoded   PipelineRunner.execute(
                               Eval->Plan    pipeline_id,
                               ->Conduct     context
                                           )
                                             |
                                      DAG execution
                                      (parallel branches,
                                       conditional routing,
                                       WS events at each node)
                                             |
                                      PipelineResult
                                             |
                                    process_ai_turn()
                                    (consumes result,
                                     generates AI speech)
                                             |
                                    TTS -> Mobile playback
```

---

## 3. Data Model

### 3.1 New Tables

All new tables use UUID primary keys and timestamp columns following existing project conventions (`Base` from `app/models/base.py`).

#### 3.1.1 `visual_pipelines`

The top-level pipeline definition. Each pipeline has immutable versions.

```python
# app/models/visual_pipeline.py

class VisualPipeline(Base):
    """Visual pipeline definition."""
    __tablename__ = "visual_pipelines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    # The full graph definition as JSON (React Flow compatible)
    # Contains: { nodes: [...], edges: [...], viewport: {...} }
    graph_json = Column(JSONB, nullable=False, default=dict)
    # Pipeline version (incremented on each publish)
    version = Column(Integer, nullable=False, default=1)
    # Whether this version is a draft or published
    status = Column(String(20), nullable=False, default="draft")  # "draft" | "published" | "archived"
    # Global pipeline settings
    timeout_ms = Column(Integer, nullable=False, default=15000)  # Max execution time
    # Metadata
    created_by = Column(UUID(as_uuid=True), nullable=True)  # FK accounts.id
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    versions = relationship("VisualPipelineVersion", back_populates="pipeline", cascade="all, delete-orphan")
```

**Design decision: graph_json (single JSONB) vs separate node/edge tables.**  
We store the entire graph as a single JSONB column rather than normalized node/edge tables. Rationale:
- React Flow natively serializes/deserializes `{ nodes, edges, viewport }` as JSON. Storing it as-is eliminates impedance mismatch.
- Pipeline graphs are small (typically 5-30 nodes). The performance benefit of normalization is negligible.
- Atomic saves: updating the graph is a single row update, not a complex multi-table transaction.
- The server validates the graph structure (DAG check, required fields) before saving.
- Querying individual nodes is done in application code after loading the JSON, not via SQL.

#### 3.1.2 `visual_pipeline_versions`

Immutable snapshots for version history.

```python
class VisualPipelineVersion(Base):
    """Immutable snapshot of a pipeline version."""
    __tablename__ = "visual_pipeline_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("visual_pipelines.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    graph_json = Column(JSONB, nullable=False)
    change_reason = Column(Text, nullable=True)
    timeout_ms = Column(Integer, nullable=False, default=15000)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    pipeline = relationship("VisualPipeline", back_populates="versions")
```

#### 3.1.3 `template_visual_pipeline_links`

Links conversation templates to visual pipelines. Replaces the need for `pipeline_mode` column additions.

```python
class TemplateVisualPipelineLink(Base):
    """Links a conversation template to a visual pipeline."""
    __tablename__ = "template_visual_pipeline_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey("conversation_templates.id", ondelete="CASCADE"), nullable=False, unique=True)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("visual_pipelines.id", ondelete="RESTRICT"), nullable=False)
    pipeline_version = Column(Integer, nullable=True)  # NULL = use latest published
    overrides = Column(JSONB, nullable=True)  # Per-template node config overrides
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
```

#### 3.1.4 `pipeline_execution_logs`

Per-node execution logs for visual pipeline runs.

```python
class PipelineExecutionLog(Base):
    """Log entry for a single node execution within a visual pipeline run."""
    __tablename__ = "pipeline_execution_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    trace_id = Column(String(36), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("conversation_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    pipeline_id = Column(UUID(as_uuid=True), nullable=False)
    pipeline_version = Column(Integer, nullable=False)
    turn_index = Column(Integer, nullable=False)
    node_id = Column(String(100), nullable=False)  # React Flow node ID
    node_type = Column(String(50), nullable=False)  # "llm", "code", "router", etc.
    node_label = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False)  # "running", "completed", "failed", "skipped"
    input_json = Column(JSONB, nullable=True)
    output_json = Column(JSONB, nullable=True)
    duration_ms = Column(Float, nullable=True)
    model_name = Column(String(100), nullable=True)
    prompt_used = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("ConversationSession")
```

### 3.2 Graph JSON Schema

The `graph_json` column stores React Flow-compatible data plus custom node configurations:

```typescript
interface PipelineGraph {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  viewport: { x: number; y: number; zoom: number };
}

interface PipelineNode {
  id: string;                    // Unique within pipeline (e.g., "evaluator-1")
  type: NodeType;                // "start" | "end" | "llm" | "code" | "router" | "parallel" | "merge" | "ui_event" | "delay"
  position: { x: number; y: number };
  data: NodeData;                // Type-specific configuration (see Section 4)
}

interface PipelineEdge {
  id: string;
  source: string;               // Source node ID
  target: string;               // Target node ID
  sourceHandle?: string;        // For nodes with multiple outputs (e.g., router branches)
  targetHandle?: string;
  label?: string;               // Edge label (e.g., condition name for router outputs)
  animated?: boolean;
}
```

### 3.3 Changes to Existing Tables

**`conversation_templates`**: Add a new value to `pipeline_mode`: `"visual"`. No new columns needed -- the `template_visual_pipeline_links` table handles the association.

**`pipeline_logs`**: No changes. The existing table continues to serve v0.2 logs. New visual pipeline logs go to `pipeline_execution_logs`.

---

## 4. Node Type System

Every node has a `type` field and a `data` object containing type-specific configuration. Below are all node types with their complete schemas.

### 4.1 Start Node

Fixed entry point. Every pipeline has exactly one. Receives the user turn context.

```typescript
interface StartNodeData {
  label: string;  // Default: "User Input"
}

// Output: PipelineContext (see Section 5.2)
// - transcript: string
// - session_id: string
// - turn_index: number
// - history: string
// - topic: string
// - scene_context: string
// - participants: ParticipantInfo[]
// - variant: Record<string, any>
// - measured_wpm: number | null
// - response_delay_sec: number | null
```

### 4.2 End Node

Fixed exit point. Every pipeline has exactly one. Collects the final pipeline result.

```typescript
interface EndNodeData {
  label: string;  // Default: "Pipeline Output"
  // Defines which input fields map to the output contract
  output_mapping: {
    feedback_text: string;         // Expression like "{{conductor.feedback_text}}"
    feedback_instruction: string;
    level: string;
    level_instruction: string;
    corrections: string;
    better_expressions: string;
    speaker_scripts: string;
    user_emotion: string;
    question_progress: string;
    energy_flow?: string;
    engine_trace?: string;
  };
}
```

The End node enforces the **output contract** required by `process_ai_turn()`. The `output_mapping` uses template expressions referencing upstream node outputs.

### 4.3 LLM Node

Calls an LLM with a configured prompt. The primary workhorse node.

```typescript
interface LLMNodeData {
  label: string;           // e.g., "Evaluator", "Planner", "Conductor"
  model: string;           // e.g., "gemini-2.5-flash", "gemini-2.0-flash"
  prompt: string;          // System/instruction prompt with {{variable}} placeholders
  temperature: number;     // Default: 0
  max_output_tokens?: number;
  response_format?: "text" | "json";  // "json" enables structured output
  output_schema?: Record<string, any>;  // JSON Schema for structured output validation
  retry_count: number;     // Default: 2
  timeout_ms: number;      // Default: 10000
  // Input variable bindings
  input_variables: {
    [varName: string]: string;  // e.g., { "transcript": "{{start.transcript}}", "history": "{{start.history}}" }
  };
}

// Output: { result: string | object, input_tokens: number, output_tokens: number, model: string }
```

**Prompt variable syntax**: `{{node_id.field_path}}` where `node_id` references an upstream node's output. Special prefix `start.*` references the initial context.

### 4.4 Code Node

Executes a Python function for data transformation, computation, or metric calculation.

```typescript
interface CodeNodeData {
  label: string;           // e.g., "WPM Calculator", "Score Aggregator"
  code: string;            // Python code string (executed in sandbox)
  // The function signature must be:
  // async def execute(inputs: dict) -> dict:
  //     ...
  //     return {"result": ...}
  input_variables: {
    [varName: string]: string;
  };
  timeout_ms: number;      // Default: 5000
}
```

Code nodes execute in a restricted scope with access to `math`, `json`, `re`, `datetime`, `statistics` modules. No filesystem or network access.

### 4.5 Router Node (Conditional)

Routes execution to one of multiple output branches based on conditions.

```typescript
interface RouterNodeData {
  label: string;           // e.g., "Score Router"
  // The variable to evaluate
  input_variable: string;  // e.g., "{{evaluator.result.overall_score}}"
  // Routing rules evaluated in order; first match wins
  routes: Array<{
    id: string;            // Matches sourceHandle on outgoing edges
    label: string;         // e.g., "Low Score", "High Score"
    condition: {
      operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "in" | "regex";
      value: string | number | boolean | string[];
    };
  }>;
  // Default route if no conditions match
  default_route: string;   // Route ID
}
```

The router has multiple output handles (one per route + default). Only one branch executes per run.

### 4.6 Parallel Node (Fork)

Splits execution into multiple parallel branches that run concurrently.

```typescript
interface ParallelNodeData {
  label: string;           // e.g., "Parallel Analysis"
  // No additional config needed -- parallel branches are defined
  // by the edges connecting from this node's output handles
  branches: Array<{
    id: string;            // Handle ID
    label: string;         // e.g., "Main Flow", "UI Sidecar"
    affects_turn_flow: boolean;  // false = sidecar (doesn't block End node)
  }>;
}
```

### 4.7 Merge Node (Join)

Waits for all incoming parallel branches to complete, then merges their outputs.

```typescript
interface MergeNodeData {
  label: string;           // e.g., "Merge Results"
  merge_strategy: "all" | "first" | "custom";
  // "all": Collects all branch outputs into a dict keyed by source node ID
  // "first": Takes the first branch to complete
  // "custom": Uses a custom merge expression
  custom_merge_expression?: string;  // Python expression for "custom" strategy
  timeout_ms: number;      // Max wait for slowest branch. Default: 12000
  // For sidecar branches (affects_turn_flow=false):
  // If a sidecar hasn't completed by timeout, proceed without it
  skip_sidecar_on_timeout: boolean;  // Default: true
}
```

### 4.8 UI Event Node

Emits a WebSocket event to the mobile client during pipeline execution. Does not transform data.

```typescript
interface UIEventNodeData {
  label: string;           // e.g., "Show Loading", "Update Score Display"
  event_type: string;      // Custom event name: "pipeline:ui_update", "pipeline:metric", etc.
  // Payload template with variable references
  payload_template: Record<string, string>;  // e.g., { "score": "{{evaluator.result.overall_score}}" }
  // Target
  target: "session" | "admin";  // "session" = mobile client, "admin" = admin dashboard
}
```

### 4.9 Delay Node

Introduces an intentional delay (e.g., waiting for response_delay_sec to pass).

```typescript
interface DelayNodeData {
  label: string;
  delay_ms: number | string;  // Fixed ms or "{{start.response_delay_sec * 1000}}"
}
```

### 4.10 Node Type Registry (Python)

```python
# app/services/pipeline_runner/node_registry.py

from enum import Enum

class NodeType(str, Enum):
    START = "start"
    END = "end"
    LLM = "llm"
    CODE = "code"
    ROUTER = "router"
    PARALLEL = "parallel"
    MERGE = "merge"
    UI_EVENT = "ui_event"
    DELAY = "delay"
```

---

## 5. Pipeline Runner Engine

### 5.1 Architecture

The runner is a pure async Python service that:
1. Loads and validates a pipeline graph
2. Topologically sorts nodes
3. Executes nodes respecting dependencies (serial), concurrency (parallel), and routing (conditional)
4. Passes a shared context object between nodes
5. Emits WebSocket events at node boundaries
6. Returns the final pipeline result

```
apps/server/app/services/pipeline_runner/
  __init__.py
  runner.py              # Main PipelineRunner class
  context.py             # PipelineContext dataclass
  dag.py                 # DAG validation and topological sort
  node_executors/
    __init__.py
    base.py              # BaseNodeExecutor abstract class
    llm_executor.py      # LLM node execution
    code_executor.py     # Code node execution
    router_executor.py   # Conditional routing
    parallel_executor.py # Fork/join logic
    merge_executor.py    # Merge logic
    ui_event_executor.py # WebSocket emission
    delay_executor.py    # Delay execution
  variable_resolver.py   # {{variable}} template resolution
  output_contract.py     # Validates End node output against contract
```

### 5.2 PipelineContext

```python
# app/services/pipeline_runner/context.py

from dataclasses import dataclass, field
from typing import Any, Optional
from uuid import UUID

@dataclass
class PipelineContext:
    """Runtime context passed through the pipeline."""
    # Immutable inputs (set once at start)
    trace_id: str
    session_id: UUID
    turn_index: int
    transcript: str
    history: str
    topic: Optional[str]
    scene_context: Optional[str]
    participants: list[dict]
    variant: dict
    measured_wpm: Optional[float]
    response_delay_sec: Optional[float]

    # Mutable state (accumulated during execution)
    node_outputs: dict[str, Any] = field(default_factory=dict)
    # Maps node_id -> output dict

    # Execution metadata
    node_statuses: dict[str, str] = field(default_factory=dict)
    # Maps node_id -> "pending" | "running" | "completed" | "failed" | "skipped"
    node_durations: dict[str, float] = field(default_factory=dict)
    errors: dict[str, str] = field(default_factory=dict)
    logs: list[dict] = field(default_factory=list)

    def get_node_output(self, node_id: str, field_path: str = "") -> Any:
        """Resolve a node output by ID and optional dot-separated field path."""
        output = self.node_outputs.get(node_id)
        if output is None:
            return None
        if not field_path:
            return output
        for key in field_path.split("."):
            if isinstance(output, dict):
                output = output.get(key)
            else:
                return None
        return output
```

### 5.3 DAG Execution Algorithm

```python
# app/services/pipeline_runner/runner.py

import asyncio
import time
import uuid
from typing import Any

from app.services.pipeline_runner.context import PipelineContext
from app.services.pipeline_runner.dag import validate_dag, topological_layers
from app.services.pipeline_runner.variable_resolver import resolve_variables
from app.services.conversation.signaling import manager


class PipelineRunner:
    """Executes a visual pipeline as an async DAG."""

    def __init__(self, db, pipeline_graph: dict, pipeline_id: str, pipeline_version: int):
        self.db = db
        self.graph = pipeline_graph
        self.pipeline_id = pipeline_id
        self.pipeline_version = pipeline_version
        self.nodes = {n["id"]: n for n in pipeline_graph["nodes"]}
        self.edges = pipeline_graph["edges"]
        self._build_adjacency()

    def _build_adjacency(self):
        """Build adjacency lists and reverse map from edges."""
        self.successors: dict[str, list[str]] = {}  # node_id -> [target_ids]
        self.predecessors: dict[str, list[str]] = {}  # node_id -> [source_ids]
        self.edge_map: dict[str, dict] = {}  # edge_id -> edge_data

        for node_id in self.nodes:
            self.successors[node_id] = []
            self.predecessors[node_id] = []

        for edge in self.edges:
            src, tgt = edge["source"], edge["target"]
            self.successors.setdefault(src, []).append(tgt)
            self.predecessors.setdefault(tgt, []).append(src)
            self.edge_map[edge["id"]] = edge

    async def execute(self, context: PipelineContext) -> dict:
        """Execute the pipeline and return the final result."""
        # Validate DAG
        validate_dag(self.nodes, self.edges)

        # Find start and end nodes
        start_node = next(n for n in self.graph["nodes"] if n["type"] == "start")
        end_node = next(n for n in self.graph["nodes"] if n["type"] == "end")

        # Set start node output to context inputs
        context.node_outputs[start_node["id"]] = {
            "transcript": context.transcript,
            "history": context.history,
            "topic": context.topic,
            "scene_context": context.scene_context,
            "participants": context.participants,
            "variant": context.variant,
            "measured_wpm": context.measured_wpm,
            "response_delay_sec": context.response_delay_sec,
            "session_id": str(context.session_id),
            "turn_index": context.turn_index,
        }
        context.node_statuses[start_node["id"]] = "completed"

        # Emit pipeline start event
        await self._emit_ws_event(context, "pipeline:started", {
            "trace_id": context.trace_id,
            "pipeline_id": self.pipeline_id,
            "node_count": len(self.nodes),
        })

        # Execute DAG using ready-set algorithm
        completed = {start_node["id"]}
        active_routes: set[str] | None = None  # None means all routes active

        while True:
            # Find ready nodes: all predecessors completed and not yet processed
            ready = []
            for node_id, node in self.nodes.items():
                if node_id in completed:
                    continue
                if context.node_statuses.get(node_id) == "skipped":
                    continue
                preds = self.predecessors.get(node_id, [])
                if all(
                    p in completed or context.node_statuses.get(p) == "skipped"
                    for p in preds
                ):
                    ready.append(node_id)

            if not ready:
                break

            # Execute ready nodes concurrently
            tasks = [self._execute_node(node_id, context) for node_id in ready]
            await asyncio.gather(*tasks, return_exceptions=True)

            for node_id in ready:
                if context.node_statuses.get(node_id) in ("completed", "failed"):
                    completed.add(node_id)

        # Extract final result from End node
        return self._build_final_result(context, end_node)

    async def _execute_node(self, node_id: str, context: PipelineContext):
        """Execute a single node."""
        node = self.nodes[node_id]
        node_type = node["type"]
        node_data = node.get("data", {})

        context.node_statuses[node_id] = "running"
        start_time = time.time()

        # Emit node start event
        await self._emit_ws_event(context, "pipeline:node_started", {
            "trace_id": context.trace_id,
            "node_id": node_id,
            "node_type": node_type,
            "node_label": node_data.get("label", node_id),
        })

        try:
            # Dispatch to appropriate executor
            executor = self._get_executor(node_type)
            result = await asyncio.wait_for(
                executor.execute(node_id, node_data, context, self),
                timeout=node_data.get("timeout_ms", 10000) / 1000
            )

            context.node_outputs[node_id] = result
            context.node_statuses[node_id] = "completed"
            duration_ms = (time.time() - start_time) * 1000
            context.node_durations[node_id] = duration_ms

            # Log to DB
            await self._log_node_execution(context, node_id, node, result, duration_ms)

            # Emit node completed event
            await self._emit_ws_event(context, "pipeline:node_completed", {
                "trace_id": context.trace_id,
                "node_id": node_id,
                "node_type": node_type,
                "node_label": node_data.get("label", node_id),
                "duration_ms": round(duration_ms, 1),
                "output_preview": str(result)[:200] if result else None,
            })

        except asyncio.TimeoutError:
            context.node_statuses[node_id] = "failed"
            context.errors[node_id] = "Timeout"
            await self._emit_ws_event(context, "pipeline:node_failed", {
                "node_id": node_id, "error": "Timeout"
            })
        except Exception as e:
            context.node_statuses[node_id] = "failed"
            context.errors[node_id] = str(e)
            await self._emit_ws_event(context, "pipeline:node_failed", {
                "node_id": node_id, "error": str(e)
            })

    async def _emit_ws_event(self, context: PipelineContext, event_type: str, payload: dict):
        """Emit WebSocket event to both session client and admin monitors."""
        message = {"type": event_type, **payload}
        # To mobile client
        await manager.send_message(str(context.session_id), message)
        # To admin monitors (separate channel keyed by "admin:<session_id>")
        await manager.send_message(f"admin:{context.session_id}", message)
```

### 5.4 Variable Resolution

```python
# app/services/pipeline_runner/variable_resolver.py

import re
from typing import Any

VARIABLE_PATTERN = re.compile(r"\{\{([^}]+)\}\}")

def resolve_template(template: str, context: "PipelineContext") -> str:
    """Resolve {{node_id.field.path}} references in a template string."""
    def replacer(match):
        path = match.group(1).strip()
        parts = path.split(".", 1)
        node_id = parts[0]
        field_path = parts[1] if len(parts) > 1 else ""

        if node_id == "start":
            # Special: references the start node's output
            start_id = _find_start_node_id(context)
            value = context.get_node_output(start_id, field_path)
        else:
            value = context.get_node_output(node_id, field_path)

        if value is None:
            return ""
        if isinstance(value, (dict, list)):
            import json
            return json.dumps(value, ensure_ascii=False)
        return str(value)

    return VARIABLE_PATTERN.sub(replacer, template)


def resolve_variables(variables: dict[str, str], context: "PipelineContext") -> dict[str, Any]:
    """Resolve a dict of variable bindings."""
    resolved = {}
    for key, template in variables.items():
        resolved[key] = resolve_template(template, context)
    return resolved
```

### 5.5 Output Contract Validation

```python
# app/services/pipeline_runner/output_contract.py

REQUIRED_OUTPUT_FIELDS = {
    "feedback_text": str,
    "feedback_instruction": str,
    "level": int,
    "level_instruction": str,
    "corrections": list,
    "better_expressions": list,
    "speaker_scripts": dict,
    "user_emotion": str,
}

OPTIONAL_OUTPUT_FIELDS = {
    "question_progress": dict,
    "energy_flow": dict,
    "engine_trace": dict,
}

def validate_output_contract(result: dict) -> tuple[bool, list[str]]:
    """Validate that pipeline output satisfies the contract for process_ai_turn()."""
    errors = []
    for field, expected_type in REQUIRED_OUTPUT_FIELDS.items():
        if field not in result:
            errors.append(f"Missing required field: {field}")
        elif not isinstance(result[field], expected_type):
            errors.append(f"Field '{field}' expected {expected_type.__name__}, got {type(result[field]).__name__}")
    return (len(errors) == 0, errors)
```

### 5.6 Error Handling Strategy

| Scenario | Behavior |
|---|---|
| LLM node fails (network/API error) | Retry up to `retry_count` times with 1s backoff. On final failure, mark node as failed. |
| LLM node timeout | Cancel the call, mark as failed, emit `pipeline:node_failed` event. |
| Sidecar branch fails (`affects_turn_flow=false`) | Log failure, skip the merge for this branch, continue main flow. |
| Main flow node fails after retries | Abort pipeline, return fallback response ("I had a brief issue, let me try again"), set session error flag. |
| Pipeline global timeout | Cancel all running nodes, assemble partial result from completed nodes, return best-effort response. |
| Router: no matching condition | Use `default_route`. If no default, fail the node. |
| Merge timeout | Proceed with branches that completed; skip timed-out branches. |

---

## 6. Pipeline-Session Integration

### 6.1 Template Pipeline Mode Resolution

In `my_turn_service.py`, the `process_user_turn()` method currently checks `pipeline_mode`:

```python
# Current code (line ~1189):
if pipeline_mode == "v0.2":
    # hardcoded Evaluator -> Planner -> Conductor
```

The new integration adds a third branch:

```python
# New code:
pipeline_mode = getattr(session.template, 'pipeline_mode', 'basic') or 'basic'

if pipeline_mode == "visual":
    # Load linked visual pipeline
    from app.services.pipeline_runner.runner import PipelineRunner
    link = await _get_template_pipeline_link(self.db, session.template.id)
    if not link:
        raise ValueError("Template has visual pipeline mode but no linked pipeline")

    pipeline = await _load_pipeline_graph(self.db, link.pipeline_id, link.pipeline_version)
    runner = PipelineRunner(self.db, pipeline.graph_json, str(pipeline.id), pipeline.version)

    context = PipelineContext(
        trace_id=str(uuid.uuid4()),
        session_id=session.id,
        turn_index=session.current_turn_index,
        transcript=transcript,
        history=history,
        topic=session.template.topic,
        scene_context=effective_scene_context,
        participants=participant_summaries,
        variant=variant,
        measured_wpm=measured_wpm,
        response_delay_sec=response_delay_sec,
    )

    pipeline_result = await runner.execute(context)
    # Store result in variant for process_ai_turn() to consume
    variant["_pipeline_result"] = pipeline_result
    session.variant = json.dumps(variant)
    await self.db.commit()

elif pipeline_mode == "v0.2":
    # existing hardcoded pipeline (unchanged)
    ...
else:
    # basic mode (ScenarioDirector) (unchanged)
    ...
```

### 6.2 Output Contract Compatibility

The visual pipeline's End node must produce an output matching the existing `_pipeline_result` structure consumed by `process_ai_turn()`:

```python
_pipeline_result = {
    "feedback_text": str,            # Moderator feedback for user
    "feedback_instruction": str,     # How to deliver feedback (tone/style)
    "level": int,                    # Current difficulty level (1-10)
    "level_instruction": str,        # Instructions for AI at this level
    "corrections": list[str],        # Grammar/expression corrections
    "better_expressions": list[str], # Suggested improvements
    "speaker_scripts": {             # Pre-generated scripts per AI participant
        "<speaker_name>": {
            "text": str,
            "instruction": str,
        }
    },
    "user_emotion": str,             # Detected emotion
    "question_progress": dict,       # Question tracking state
    "energy_flow": dict | None,      # Energy flow visualization data
    "engine_trace": dict | None,     # Debug/trace data
}
```

This contract is enforced by the End node's `output_mapping` configuration and validated at save-time and runtime.

### 6.3 Variant State Management

The runner writes execution results to `session.variant["_pipeline_result"]` just like the current v0.2 code does. This ensures `process_ai_turn()` works identically regardless of pipeline mode. Session-persistent state (like `_pipeline_state`, `_question_progress`) is managed through the context object and flushed to variant after execution.

---

## 7. Admin UI: Visual Pipeline Editor

### 7.1 Library Selection

- **React Flow v12** (`@xyflow/react`): The core node-based editor. React 19 compatible, SSR-safe with dynamic import, extensive customization API. Install as `@xyflow/react`.
- **Zustand**: Already in the project. Used for pipeline editor state management.
- **Monaco Editor** (`@monaco-editor/react`): Already in the project. Used for code node editing and prompt editing.
- **shadcn/ui**: Already in the project. Used for all configuration panels.

### 7.2 Page Structure

```
apps/admin/src/
  app/(dashboard)/ai-lab/
    pipeline-editor/
      [id]/
        page.tsx              # Route: /ai-lab/pipeline-editor/:id
        edit/
          page.tsx            # Route: /ai-lab/pipeline-editor/:id/edit (alias)
      new/
        page.tsx              # Route: /ai-lab/pipeline-editor/new
    pipelines/
      page.tsx                # Existing: pipeline list (updated to show visual pipelines)
```

### 7.3 FSD Module Structure

```
(fsd)/features/pipeline-editor/
  model/
    types.ts                  # TypeScript types for all node types, graph, etc.
    usePipelineEditor.ts      # Zustand store for editor state
    usePipelineExecution.ts   # WebSocket hook for live execution monitoring
    usePipelineMutations.ts   # TanStack Query mutations (save, publish, etc.)
    constants.ts              # Node type registry, default configs
  ui/
    PipelineCanvas.tsx         # Main React Flow canvas wrapper
    NodePalette.tsx            # Draggable node palette sidebar
    NodeConfigPanel.tsx        # Right sidebar: node configuration form
    ExecutionOverlay.tsx       # Overlay showing live execution state on nodes
    PipelineToolbar.tsx        # Top toolbar: save, publish, version, run test
    nodes/                     # Custom React Flow node components
      StartNode.tsx
      EndNode.tsx
      LLMNode.tsx
      CodeNode.tsx
      RouterNode.tsx
      ParallelNode.tsx
      MergeNode.tsx
      UIEventNode.tsx
      DelayNode.tsx
    edges/
      AnimatedEdge.tsx         # Custom edge with data flow animation
    panels/
      LLMConfigPanel.tsx       # Config form for LLM nodes
      CodeConfigPanel.tsx      # Config form with Monaco editor
      RouterConfigPanel.tsx    # Config form for router conditions
      ParallelConfigPanel.tsx  # Config form for parallel branches
      MergeConfigPanel.tsx     # Config form for merge strategy
      UIEventConfigPanel.tsx   # Config form for UI events
      EndConfigPanel.tsx       # Config form for output mapping
  api/
    pipelineEditorApi.ts       # API client for visual pipeline CRUD
  index.ts                     # Barrel exports
```

### 7.4 Editor State (Zustand)

```typescript
// (fsd)/features/pipeline-editor/model/usePipelineEditor.ts

import { create } from 'zustand';
import { type Node, type Edge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';

interface PipelineEditorState {
  // Pipeline metadata
  pipelineId: string | null;
  pipelineName: string;
  pipelineDescription: string;

  // React Flow state
  nodes: Node[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };

  // Selection
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  // Execution monitoring
  isExecuting: boolean;
  executionTraceId: string | null;
  nodeStatuses: Record<string, 'pending' | 'running' | 'completed' | 'failed' | 'skipped'>;

  // Dirty tracking
  isDirty: boolean;
  lastSavedAt: string | null;

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: any) => void;
  addNode: (type: string, position: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, data: Partial<any>) => void;
  removeNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  setExecutionState: (traceId: string, statuses: Record<string, string>) => void;
  updateNodeStatus: (nodeId: string, status: string) => void;
  loadPipeline: (pipeline: any) => void;
  reset: () => void;
}

export const usePipelineEditor = create<PipelineEditorState>((set, get) => ({
  // ... implementation
}));
```

### 7.5 Custom Node Component Example

```tsx
// (fsd)/features/pipeline-editor/ui/nodes/LLMNode.tsx

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Card } from '@/shared/ui';
import { Brain } from 'lucide-react';

export const LLMNode = ({ data, selected, id }: NodeProps) => {
  const nodeStatus = usePipelineEditor(s => s.nodeStatuses[id]);

  const statusColor = {
    running: 'border-yellow-500 animate-pulse',
    completed: 'border-green-500',
    failed: 'border-red-500',
    pending: 'border-border',
  }[nodeStatus || 'pending'];

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Card className={`w-56 p-3 ${statusColor} border-2 ${selected ? 'ring-2 ring-primary' : ''}`}>
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium truncate">{data.label || 'LLM Node'}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 truncate">
          {data.model || 'No model selected'}
        </div>
        {nodeStatus === 'running' && (
          <div className="text-xs text-yellow-400 mt-1">Running...</div>
        )}
      </Card>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
};
```

### 7.6 Node Palette (Drag-and-Drop)

```tsx
// (fsd)/features/pipeline-editor/ui/NodePalette.tsx

const NODE_TYPES = [
  { type: 'llm', label: 'LLM', icon: Brain, description: 'Call an LLM with a prompt', color: 'purple' },
  { type: 'code', label: 'Code', icon: Code2, description: 'Run Python code', color: 'green' },
  { type: 'router', label: 'Router', icon: GitBranch, description: 'Conditional branching', color: 'orange' },
  { type: 'parallel', label: 'Parallel', icon: GitFork, description: 'Run branches concurrently', color: 'blue' },
  { type: 'merge', label: 'Merge', icon: GitMerge, description: 'Join parallel branches', color: 'blue' },
  { type: 'ui_event', label: 'UI Event', icon: Zap, description: 'Send WebSocket event', color: 'yellow' },
  { type: 'delay', label: 'Delay', icon: Clock, description: 'Wait before continuing', color: 'gray' },
];
```

Users drag nodes from the palette onto the canvas. The Start and End nodes are pre-placed and cannot be deleted.

### 7.7 Node Configuration Panel

When a node is selected, the right panel shows a type-specific form:

- **LLM**: Model selector (dropdown from `/api/v1/ai-lab/models`), prompt editor (Monaco), temperature slider, input variable bindings, response format toggle, output schema editor.
- **Code**: Code editor (Monaco, Python syntax), input variable bindings, timeout slider.
- **Router**: Input variable selector, condition rows (add/remove), operator dropdowns, value inputs.
- **Parallel/Merge**: Branch labels, affects_turn_flow toggles, merge strategy selector.
- **UI Event**: Event type input, payload template editor (JSON), target selector.
- **End**: Output mapping form with auto-complete for upstream node outputs.

### 7.8 Pipeline Canvas Component

```tsx
// (fsd)/features/pipeline-editor/ui/PipelineCanvas.tsx

'use client';

import { useCallback } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Panel } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { usePipelineEditor } from '../model/usePipelineEditor';
import { StartNode } from './nodes/StartNode';
import { EndNode } from './nodes/EndNode';
import { LLMNode } from './nodes/LLMNode';
import { CodeNode } from './nodes/CodeNode';
import { RouterNode } from './nodes/RouterNode';
import { ParallelNode } from './nodes/ParallelNode';
import { MergeNode } from './nodes/MergeNode';
import { UIEventNode } from './nodes/UIEventNode';
import { DelayNode } from './nodes/DelayNode';
import { AnimatedEdge } from './edges/AnimatedEdge';
import { NodePalette } from './NodePalette';
import { NodeConfigPanel } from './NodeConfigPanel';
import { PipelineToolbar } from './PipelineToolbar';

const nodeTypes = {
  start: StartNode,
  end: EndNode,
  llm: LLMNode,
  code: CodeNode,
  router: RouterNode,
  parallel: ParallelNode,
  merge: MergeNode,
  ui_event: UIEventNode,
  delay: DelayNode,
};

const edgeTypes = {
  animated: AnimatedEdge,
};

export const PipelineCanvas = () => {
  const {
    nodes, edges, onNodesChange, onEdgesChange, onConnect,
    selectedNodeId, selectNode, addNode,
  } = usePipelineEditor();

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/pipeline-node-type');
    if (!type) return;
    // Calculate position from drop coordinates
    const position = { x: event.clientX - 250, y: event.clientY - 100 };
    addNode(type, position);
  }, [addNode]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div className="h-[calc(100vh-64px)] w-full flex">
      <NodePalette />
      <div className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver}>
        <PipelineToolbar />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: 'animated', animated: true }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => selectNode(node.id)}
          onPaneClick={() => selectNode(null)}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      {selectedNodeId && <NodeConfigPanel />}
    </div>
  );
};
```

---

## 8. API Design

### 8.1 Visual Pipeline CRUD

All endpoints under `/api/v1/visual-pipelines`. Added to a new router file.

```
POST   /api/v1/visual-pipelines
       Body: { name, description?, graph_json, timeout_ms? }
       Response: VisualPipelineResponse (201)

GET    /api/v1/visual-pipelines
       Query: ?status=draft|published|archived
       Response: VisualPipelineListItem[]

GET    /api/v1/visual-pipelines/{id}
       Response: VisualPipelineResponse (includes full graph_json)

PUT    /api/v1/visual-pipelines/{id}
       Body: { name?, description?, graph_json?, timeout_ms? }
       Response: VisualPipelineResponse
       Note: Only drafts can be updated. Published pipelines must create new version.

DELETE /api/v1/visual-pipelines/{id}
       Response: { message: string }
       Note: Fails if linked to any template (RESTRICT).

POST   /api/v1/visual-pipelines/{id}/publish
       Body: { change_reason? }
       Response: VisualPipelineVersionResponse
       Note: Creates immutable version snapshot, increments version number.

GET    /api/v1/visual-pipelines/{id}/versions
       Response: VisualPipelineVersionResponse[]

GET    /api/v1/visual-pipelines/{id}/versions/{version}
       Response: VisualPipelineVersionResponse (includes graph_json)

POST   /api/v1/visual-pipelines/{id}/validate
       Body: { graph_json }
       Response: { valid: bool, errors: string[] }
       Note: Validates DAG structure without saving.

POST   /api/v1/visual-pipelines/{id}/duplicate
       Response: VisualPipelineResponse (new pipeline with copied graph)
```

### 8.2 Template-Pipeline Linking

```
PUT    /api/v1/conversations/templates/{template_id}/visual-pipeline
       Body: { pipeline_id, pipeline_version? }
       Response: TemplateVisualPipelineLinkResponse
       Note: Also sets template.pipeline_mode = "visual"

GET    /api/v1/conversations/templates/{template_id}/visual-pipeline
       Response: TemplateVisualPipelineLinkResponse | null

DELETE /api/v1/conversations/templates/{template_id}/visual-pipeline
       Response: { message: string }
       Note: Resets template.pipeline_mode to "basic"
```

### 8.3 Pipeline Execution (Test Run)

```
POST   /api/v1/visual-pipelines/{id}/test-run
       Body: {
         transcript: string,
         session_context?: {
           topic?, scene_context?, history?, participants?, variant?
         }
       }
       Response: {
         trace_id: string,
         result: PipelineResult,
         node_logs: NodeExecutionLog[],
         total_duration_ms: number,
         total_input_tokens: number,
         total_output_tokens: number,
         estimated_cost_usd: number,
       }
```

### 8.4 Execution Logs

```
GET    /api/v1/visual-pipelines/execution-logs
       Query: ?session_id=&trace_id=&pipeline_id=&page=1&size=30
       Response: PaginatedResponse<PipelineExecutionLogSummary>

GET    /api/v1/visual-pipelines/execution-logs/{trace_id}
       Response: PipelineExecutionLogDetail (all node logs for a trace)
```

### 8.5 Pydantic Schemas

```python
# app/schemas/visual_pipeline.py

from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class VisualPipelineCreate(BaseModel):
    name: str = Field(max_length=255)
    description: Optional[str] = None
    graph_json: dict  # Validated server-side
    timeout_ms: int = Field(default=15000, ge=1000, le=60000)


class VisualPipelineUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    graph_json: Optional[dict] = None
    timeout_ms: Optional[int] = Field(None, ge=1000, le=60000)


class VisualPipelineResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    graph_json: dict
    version: int
    status: str
    timeout_ms: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VisualPipelineListItem(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    version: int
    status: str
    node_count: int
    edge_count: int
    created_at: datetime
    updated_at: datetime


class VisualPipelineVersionResponse(BaseModel):
    id: UUID
    pipeline_id: UUID
    version: int
    graph_json: dict
    change_reason: Optional[str]
    timeout_ms: int
    created_at: datetime

    class Config:
        from_attributes = True


class PublishRequest(BaseModel):
    change_reason: Optional[str] = None


class ValidateRequest(BaseModel):
    graph_json: dict


class ValidateResponse(BaseModel):
    valid: bool
    errors: list[str]


class TestRunRequest(BaseModel):
    transcript: str
    session_context: Optional[dict] = None


class TemplatePipelineLinkRequest(BaseModel):
    pipeline_id: UUID
    pipeline_version: Optional[int] = None  # NULL = latest published


class TemplatePipelineLinkResponse(BaseModel):
    id: UUID
    template_id: UUID
    pipeline_id: UUID
    pipeline_version: Optional[int]
    pipeline_name: str
    created_at: datetime

    class Config:
        from_attributes = True
```

---

## 9. WebSocket Protocol

### 9.1 Event Types for Pipeline Execution Monitoring

All events are sent as JSON via the existing WebSocket connection at `/api/v1/conversations/sessions/{session_id}/ws`. Admin monitoring connects to a parallel WebSocket at `/api/v1/visual-pipelines/monitor/{session_id}/ws`.

```typescript
// Pipeline lifecycle events
type PipelineEvent =
  | { type: "pipeline:started"; trace_id: string; pipeline_id: string; node_count: number }
  | { type: "pipeline:completed"; trace_id: string; duration_ms: number; success: boolean }
  | { type: "pipeline:failed"; trace_id: string; error: string }

// Node lifecycle events
  | { type: "pipeline:node_started"; trace_id: string; node_id: string; node_type: string; node_label: string }
  | { type: "pipeline:node_completed"; trace_id: string; node_id: string; node_type: string; node_label: string; duration_ms: number; output_preview?: string }
  | { type: "pipeline:node_failed"; trace_id: string; node_id: string; error: string }
  | { type: "pipeline:node_skipped"; trace_id: string; node_id: string; reason: string }

// UI Event node emissions (sent to mobile client)
  | { type: "pipeline:ui_update"; event_type: string; payload: Record<string, any> }
  | { type: "pipeline:metric"; node_id: string; metric_name: string; value: any }

// Existing event types remain unchanged:
  | { type: "turn_changed"; ... }
  | { type: "session_completed" }
  | { type: "error"; message: string }
```

### 9.2 Admin Monitor WebSocket

```python
# New endpoint in conversations.py or visual_pipelines.py

@router.websocket("/visual-pipelines/monitor/{session_id}/ws")
async def pipeline_monitor_ws(websocket: WebSocket, session_id: UUID):
    """WebSocket for admin to monitor live pipeline execution."""
    admin_key = f"admin:{session_id}"
    await manager.connect(admin_key, websocket)
    try:
        while True:
            # Keep alive -- admin doesn't send data, just receives events
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(admin_key)
```

### 9.3 Execution Overlay in Admin

The `ExecutionOverlay` component in the pipeline editor listens to WebSocket events and updates node visual states in real-time:

```typescript
// (fsd)/features/pipeline-editor/model/usePipelineExecution.ts

export const usePipelineExecution = (sessionId: string | null) => {
  const updateNodeStatus = usePipelineEditor(s => s.updateNodeStatus);
  const setExecutionState = usePipelineEditor(s => s.setExecutionState);

  useEffect(() => {
    if (!sessionId) return;
    const ws = new WebSocket(`${WS_URL}/api/v1/visual-pipelines/monitor/${sessionId}/ws`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'pipeline:started':
          setExecutionState(data.trace_id, {});
          break;
        case 'pipeline:node_started':
          updateNodeStatus(data.node_id, 'running');
          break;
        case 'pipeline:node_completed':
          updateNodeStatus(data.node_id, 'completed');
          break;
        case 'pipeline:node_failed':
          updateNodeStatus(data.node_id, 'failed');
          break;
        case 'pipeline:node_skipped':
          updateNodeStatus(data.node_id, 'skipped');
          break;
      }
    };

    return () => ws.close();
  }, [sessionId]);
};
```

---

## 10. Migration Strategy

### 10.1 Principles

- **Zero downtime**: Existing basic and v0.2 templates continue working unchanged.
- **Additive only**: New tables, new endpoints, new UI pages. No modification to existing tables or removal of existing code.
- **Opt-in migration**: Templates switch to visual pipeline one-by-one by an admin action.

### 10.2 Phase-by-Phase Migration

**Phase 0: Coexistence**
- The `pipeline_mode` column gains a new value `"visual"` alongside `"basic"` and `"v0.2"`.
- `process_user_turn()` gains a third branch for `"visual"` mode.
- All existing sessions continue using their current pipeline mode.

**Phase 1: v0.2 Template Conversion**
- For each v0.2 template, create a visual pipeline that replicates the Evaluator->Planner->Conductor flow:
  - Start node -> LLM node (Evaluator) -> LLM node (Planner) -> LLM node (Conductor) -> End node
  - Copy prompts from `conversation_templates.evaluator_prompt`, `planner_prompt`, `conductor_prompt` into the respective LLM node configs.
  - Copy model selections from `evaluator_llm_model`, `planner_llm_model`, `conductor_llm_model`.
- Provide a one-click migration button in admin: "Convert to Visual Pipeline".
- After conversion, the template's `pipeline_mode` changes to `"visual"`.

**Phase 2: Basic Template Conversion**
- Basic mode templates use `ScenarioDirector` which is a single LLM call.
- Convert to: Start node -> LLM node (Director) -> End node.
- The Director prompt comes from `conversation_templates.director_system_prompt`.

**Phase 3: Deprecation**
- Once all templates are migrated, the v0.2 hardcoded path and ScenarioDirector path remain in code but are no longer actively used.
- They can be removed in a future cleanup release.
- The original `ai_lab_pipelines` and `ai_lab_pipeline_agents` tables remain for the AI Lab experiment feature (separate concern from session pipelines).

### 10.3 Alembic Migration

```python
# migrations/versions/xxxx_add_visual_pipeline_tables.py

def upgrade():
    # Create visual_pipelines table
    op.create_table(
        "visual_pipelines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("graph_json", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("timeout_ms", sa.Integer, nullable=False, server_default="15000"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # Create visual_pipeline_versions table
    op.create_table(
        "visual_pipeline_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("pipeline_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("visual_pipelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("graph_json", postgresql.JSONB, nullable=False),
        sa.Column("change_reason", sa.Text, nullable=True),
        sa.Column("timeout_ms", sa.Integer, nullable=False, server_default="15000"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_vpv_pipeline_version", "visual_pipeline_versions", ["pipeline_id", "version"], unique=True)

    # Create template_visual_pipeline_links table
    op.create_table(
        "template_visual_pipeline_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("template_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("conversation_templates.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("pipeline_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("visual_pipelines.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("pipeline_version", sa.Integer, nullable=True),
        sa.Column("overrides", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # Create pipeline_execution_logs table
    op.create_table(
        "pipeline_execution_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("trace_id", sa.String(36), nullable=False, index=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("conversation_sessions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("pipeline_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pipeline_version", sa.Integer, nullable=False),
        sa.Column("turn_index", sa.Integer, nullable=False),
        sa.Column("node_id", sa.String(100), nullable=False),
        sa.Column("node_type", sa.String(50), nullable=False),
        sa.Column("node_label", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("input_json", postgresql.JSONB, nullable=True),
        sa.Column("output_json", postgresql.JSONB, nullable=True),
        sa.Column("duration_ms", sa.Float, nullable=True),
        sa.Column("model_name", sa.String(100), nullable=True),
        sa.Column("prompt_used", sa.Text, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

def downgrade():
    op.drop_table("pipeline_execution_logs")
    op.drop_table("template_visual_pipeline_links")
    op.drop_table("visual_pipeline_versions")
    op.drop_table("visual_pipelines")
```

---

## 11. Implementation Phases

### Phase 1: Data Model + Pipeline Runner (Server Only)
**Duration**: 3-4 days  
**Deliverable**: Pipeline definitions can be stored and executed via API.

1. Create Alembic migration for all 4 new tables.
2. Create SQLAlchemy models in `app/models/visual_pipeline.py`.
3. Create Pydantic schemas in `app/schemas/visual_pipeline.py`.
4. Implement DAG validation in `app/services/pipeline_runner/dag.py`.
5. Implement `PipelineContext` in `app/services/pipeline_runner/context.py`.
6. Implement variable resolver in `app/services/pipeline_runner/variable_resolver.py`.
7. Implement node executors (LLM first, then Code, Router, Parallel, Merge, UIEvent, Delay).
8. Implement `PipelineRunner` in `app/services/pipeline_runner/runner.py`.
9. Implement output contract validation in `app/services/pipeline_runner/output_contract.py`.
10. Create CRUD service in `app/services/pipeline_runner/pipeline_crud_service.py`.
11. Create API router in `app/api/v1/visual_pipelines.py` (CRUD + test-run + validate).
12. Register router in `app/api/v1/router.py`.

**Dependencies**: None (fully additive).

### Phase 2: Pipeline-Session Integration (Server)
**Duration**: 2-3 days  
**Deliverable**: Templates can use visual pipelines for actual learning sessions.

1. Add `template_visual_pipeline_links` CRUD to template service.
2. Add template-pipeline linking API endpoints.
3. Add `"visual"` branch to `process_user_turn()` in `my_turn_service.py`.
4. Add WebSocket events for pipeline execution monitoring.
5. Add admin monitor WebSocket endpoint.
6. Add pipeline execution log API endpoints.

**Dependencies**: Phase 1.

### Phase 3: Visual Editor UI (Frontend)
**Duration**: 5-7 days  
**Deliverable**: Admins can create/edit pipelines visually in the browser.

1. Install `@xyflow/react` package.
2. Create FSD module structure: `(fsd)/features/pipeline-editor/`.
3. Implement TypeScript types for all node types.
4. Implement Zustand store (`usePipelineEditor`).
5. Implement API client (`pipelineEditorApi.ts`).
6. Implement custom node components (Start, End, LLM, Code, Router, Parallel, Merge, UIEvent, Delay).
7. Implement custom animated edge component.
8. Implement `NodePalette` with drag-and-drop.
9. Implement `PipelineCanvas` with React Flow.
10. Implement `NodeConfigPanel` with type-specific forms.
11. Implement `PipelineToolbar` (save, publish, version history, test run).
12. Create page routes (`/ai-lab/pipeline-editor/new`, `/ai-lab/pipeline-editor/[id]`).
13. Update pipeline list page to show visual pipelines alongside AI Lab pipelines.

**Dependencies**: Phase 1 API must be deployed.

### Phase 4: Execution Monitoring + Template Linking UI (Frontend)
**Duration**: 2-3 days  
**Deliverable**: Admins can monitor live execution and link pipelines to templates.

1. Implement `usePipelineExecution` WebSocket hook.
2. Implement `ExecutionOverlay` component (real-time node status on canvas).
3. Add "Test Run" dialog with transcript input and live result view.
4. Add pipeline selector to template editor page.
5. Add "Convert to Visual Pipeline" button for v0.2 templates.
6. Add pipeline execution log viewer page.

**Dependencies**: Phases 2 and 3.

### Phase 5: Polish + Migration Tooling
**Duration**: 2-3 days  
**Deliverable**: Automated v0.2-to-visual conversion, validation edge cases, UX polish.

1. Implement v0.2-to-visual automatic conversion script.
2. Add graph validation warnings in the editor (disconnected nodes, missing configs, cycle detection).
3. Add undo/redo support (Zustand middleware).
4. Add pipeline import/export (JSON download/upload).
5. Add node copy/paste shortcuts.
6. Comprehensive error handling and loading states.

**Dependencies**: Phase 4.

---

## 12. File-Level Implementation Guide

### Phase 1 Files

| Action | File Path |
|---|---|
| CREATE | `apps/server/app/models/visual_pipeline.py` |
| CREATE | `apps/server/app/schemas/visual_pipeline.py` |
| CREATE | `apps/server/app/services/pipeline_runner/__init__.py` |
| CREATE | `apps/server/app/services/pipeline_runner/runner.py` |
| CREATE | `apps/server/app/services/pipeline_runner/context.py` |
| CREATE | `apps/server/app/services/pipeline_runner/dag.py` |
| CREATE | `apps/server/app/services/pipeline_runner/variable_resolver.py` |
| CREATE | `apps/server/app/services/pipeline_runner/output_contract.py` |
| CREATE | `apps/server/app/services/pipeline_runner/pipeline_crud_service.py` |
| CREATE | `apps/server/app/services/pipeline_runner/node_executors/__init__.py` |
| CREATE | `apps/server/app/services/pipeline_runner/node_executors/base.py` |
| CREATE | `apps/server/app/services/pipeline_runner/node_executors/llm_executor.py` |
| CREATE | `apps/server/app/services/pipeline_runner/node_executors/code_executor.py` |
| CREATE | `apps/server/app/services/pipeline_runner/node_executors/router_executor.py` |
| CREATE | `apps/server/app/services/pipeline_runner/node_executors/parallel_executor.py` |
| CREATE | `apps/server/app/services/pipeline_runner/node_executors/merge_executor.py` |
| CREATE | `apps/server/app/services/pipeline_runner/node_executors/ui_event_executor.py` |
| CREATE | `apps/server/app/services/pipeline_runner/node_executors/delay_executor.py` |
| CREATE | `apps/server/app/api/v1/visual_pipelines.py` |
| CREATE | `apps/server/migrations/versions/xxxx_add_visual_pipeline_tables.py` |
| MODIFY | `apps/server/app/models/__init__.py` (add imports) |
| MODIFY | `apps/server/app/api/v1/router.py` (add visual_pipelines router) |

### Phase 2 Files

| Action | File Path |
|---|---|
| MODIFY | `apps/server/app/services/conversation/my_turn_service.py` (add "visual" branch in `process_user_turn()`) |
| MODIFY | `apps/server/app/api/v1/conversations.py` (add template-pipeline link endpoints, add admin monitor WS) |
| MODIFY | `apps/server/app/services/conversation/signaling.py` (ensure admin key namespace support) |
| MODIFY | `apps/server/app/services/conversation/template_service.py` (add pipeline link CRUD) |

### Phase 3 Files

| Action | File Path |
|---|---|
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/index.ts` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/model/types.ts` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/model/usePipelineEditor.ts` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/model/usePipelineExecution.ts` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/model/usePipelineMutations.ts` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/model/constants.ts` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/api/pipelineEditorApi.ts` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/PipelineCanvas.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/NodePalette.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/NodeConfigPanel.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/PipelineToolbar.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/ExecutionOverlay.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/nodes/StartNode.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/nodes/EndNode.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/nodes/LLMNode.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/nodes/CodeNode.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/nodes/RouterNode.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/nodes/ParallelNode.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/nodes/MergeNode.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/nodes/UIEventNode.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/nodes/DelayNode.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/edges/AnimatedEdge.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/panels/LLMConfigPanel.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/panels/CodeConfigPanel.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/panels/RouterConfigPanel.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/panels/ParallelConfigPanel.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/panels/MergeConfigPanel.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/panels/UIEventConfigPanel.tsx` |
| CREATE | `apps/admin/src/(fsd)/features/pipeline-editor/ui/panels/EndConfigPanel.tsx` |
| CREATE | `apps/admin/src/app/(dashboard)/ai-lab/pipeline-editor/new/page.tsx` |
| CREATE | `apps/admin/src/app/(dashboard)/ai-lab/pipeline-editor/[id]/page.tsx` |
| MODIFY | `apps/admin/package.json` (add `@xyflow/react` dependency) |

### Phase 4 Files

| Action | File Path |
|---|---|
| MODIFY | `apps/admin/src/(fsd)/features/pipeline-editor/ui/PipelineToolbar.tsx` (add test run dialog) |
| MODIFY | `apps/admin/src/(fsd)/features/conversations/ui/TemplateEditor.tsx` (add pipeline selector) |
| CREATE | `apps/admin/src/app/(dashboard)/ai-lab/pipeline-logs/page.tsx` |

---

### Critical Files for Implementation

> 모든 경로는 프로젝트 루트(`study-english/`) 기준 상대 경로입니다.

| 파일 | 역할 | 구현 시 참고 사항 |
|------|------|-------------------|
| `apps/server/app/services/conversation/my_turn_service.py` | 핵심 통합 지점 | `process_user_turn()`에 `"visual"` 분기 추가 (현재 ~1189행) |
| `apps/server/app/services/conversation/signaling.py` | WebSocket ConnectionManager | admin 모니터링 채널 (`admin:<session_id>`) 지원 필요 |
| `apps/server/app/models/conversation.py` | ConversationTemplate/Session 모델 | `pipeline_mode="visual"` 지원, `variant` JSONB에 파이프라인 결과 저장 |
| `apps/server/app/schemas/pipeline_schemas.py` | v0.2 출력 계약 | `ConductorOutput`, `EvaluatorOutput`, `PlannerOutput` — End 노드가 호환해야 할 구조 |
| `apps/server/app/services/ai_lab/chain_builder.py` | LLM 호출 엔진 | LLM 노드 executor 구현 시 재사용 가능한 Gemini/OpenAI 호출 패턴 |
| `apps/server/app/services/ai_lab/experiment_service.py` | AI Lab 실험 실행 | 기존 파이프라인 실행 패턴 참고 (순차 에이전트, 토큰 카운팅, 벤치마크) |
| `apps/server/app/api/v1/router.py` | v1 라우터 통합 | 새 `visual_pipelines` 라우터 등록 위치 |
| `apps/server/app/models/__init__.py` | 모델 임포트 | 새 `VisualPipeline` 등 모델 임포트 추가 |
| `apps/admin/src/(fsd)/features/ai-lab/model/types.ts` | TypeScript 타입 패턴 참조 | API 클라이언트 컨벤션, 인터페이스 스타일 참고 |
| `apps/admin/src/(fsd)/features/ai-lab/ui/ExperimentRunner.tsx` | 기존 실험 UI 참조 | 모델 선택, 파일 업로드, 결과 표시 패턴 참고 (32KB) |