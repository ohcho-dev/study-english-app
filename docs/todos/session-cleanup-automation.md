# Session Cleanup Automation

## 개요
세션이 시작된 후 사용자가 새로고침이나 페이지 이탈로 종료하지 않으면 DB에서 계속 `active` 상태로 남는 문제.

## 현재 상황
- 세션 시작 시 `status = 'active'`로 저장
- `endSession` API 호출 없이 종료하면 상태가 그대로 유지
- 세션 기록에 모든 과거 테스트 세션이 "진행 중"으로 표시

## 제안 해결책

### 1. 자동 만료 처리 (Cron Job / Background Task)
```python
# 매 시간 실행
async def cleanup_stale_sessions():
    threshold = datetime.utcnow() - timedelta(hours=24)
    await db.execute(
        update(ConversationSession)
        .where(ConversationSession.status == 'active')
        .where(ConversationSession.updated_at < threshold)
        .values(status='expired')
    )
```

### 2. 브라우저 beforeunload 이벤트 활용
```typescript
// Admin 또는 Mobile에서
useEffect(() => {
    const handleBeforeUnload = () => {
        if (sessionId) {
            navigator.sendBeacon(`/api/sessions/${sessionId}/end`);
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [sessionId]);
```

### 3. WebSocket disconnect 이벤트 활용
- 향후 WebRTC/WebSocket 통합 시 연결 해제 감지하여 자동 종료

## 우선순위
- **낮음** (Phase 2+ 또는 운영 환경 배포 전)

## 관련 파일
- `apps/server/app/services/conversation/session_service.py`
- `apps/admin/src/(fsd)/features/conversations/model/useRun0.ts`
