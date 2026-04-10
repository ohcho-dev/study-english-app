// Types
export type {
    ConversationMode,
    ParticipantType,
    SessionStatus,
    TurnType,
    FeedbackCardType,
    VoiceSettings,
    VoiceInfo,
    Participant,
    ParticipantCreate,
    Template,
    TemplateListItem,
    TemplateCreate,
    TemplateUpdate,
    Session,
    SessionListItem,
    SessionCreate,
    Turn,
    Run0VoiceResponse,
    Run0LogRequest,
    Run0LogResponse,
    SessionMetrics,
    PaginatedResponse,
} from './model/types';

// Template hooks
export {
    useTemplates,
    useTemplate,
    useCreateTemplate,
    useUpdateTemplate,
    useDeleteTemplate,
    useDuplicateTemplate,
    templateKeys,
} from './model/useTemplates';

// Session hooks
export {
    useSessions,
    useSession,
    useSessionTurns,
    useSessionMetrics,
    useCreateSession,
    useEndSession,
    sessionKeys,
} from './model/useSessions';

// RUN0 hooks
export {
    useRun0,
    useTestPhrases,
    DEFAULT_RUN0_CONFIG,
    type Run0Config,
    type Run0State,
    type LatencyMetrics,
    type TestResult,
} from './model/useRun0';

// Voice recorder hook
export {
    useVoiceRecorder,
    type RecordingState,
    type RecordingResult,
    type UseVoiceRecorderOptions,
} from './model/useVoiceRecorder';

export { useVoiceOptions } from './model/useVoiceOptions';

// Audio storage hook
export {
    useAudioStorage,
    type AudioEntry,
    type AudioStorageType,
} from './model/useAudioStorage';

// Streaming STT hook
export {
    useStreamingSTT,
    type StreamingSTTConfig,
    type StreamingSTTResult,
} from './model/useStreamingSTT';

// API
export {
    getTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    getSessions,
    getSession,
    createSession,
    endSession,
    getSessionTurns,
    getSessionMetrics,
    processVoice,
    logClientTimestamp,
    getTestPhrases,
    getAvailableVoices,
    getPipelineLogs,
    getTemplatePrompts,
    updateTemplatePrompts,
} from './api/conversationsApi';
export type { PipelineLog, PipelineLogsResponse, TemplatePrompts } from './api/conversationsApi';

// UI Components
export { VoiceRecorder } from './ui/VoiceRecorder';
export { Run0ConfigPanel } from './ui/Run0ConfigPanel';
export { MetricsDashboard } from './ui/MetricsDashboard';
export { Run0Runner } from './ui/Run0Runner';
export { TemplateEditor } from './ui/TemplateEditor';
export { TemplateList } from './ui/TemplateList';
export { SessionList } from './ui/SessionList';
export { TemplateSelector } from './ui/TemplateSelector';

// Stage UI Components (My Turn v2)
export { ConversationStage } from './ui/ConversationStage';
export { ParticipantCircle } from './ui/ParticipantCircle';
export { TranscriptTimeline } from './ui/TranscriptTimeline';
export { RecordingBar } from './ui/RecordingBar';
export { SettingsDrawer } from './ui/SettingsDrawer';

// Legacy (kept for backward compatibility, will be removed)
export { MyTurnRunner } from './ui/MyTurnRunner';
export { SessionSettings } from './ui/SessionSettings';
export { ReportingPromptModal } from './ui/ReportingPromptModal';

// ============================================================================
// Session Observation
// ============================================================================

export type {
    SessionObservation,
    ObservationLayer1,
    ObservationLayer2,
    ObservationLayer3,
    ElaborationTurn,
} from './model/types';

export {
    useSessionObservation,
    useGenerateObservation,
    useAnalyzeObservation,
} from './model/useSessions';

export {
    getSessionObservation,
    generateSessionObservation,
    analyzeSessionObservation,
    exportObservationExcel,
} from './api/conversationsApi';

// ============================================================================
// Reporting LLM Prompt
// ============================================================================

export type {
    ReportingPromptSetting,
    ReportingPromptHistoryItem,
} from './model/types';

export {
    useReportingPrompt,
    useUpdateReportingPrompt,
} from './model/useSessions';

export {
    getReportingPrompt,
    updateReportingPrompt,
    getDefaultReportingPrompt,
    getReportingPromptHistory,
} from './api/conversationsApi';
