# AI Lab 추후 개선 사항 (TODO)

## 🔴 우선순위 높음

### 1. 오디오 저장 방식 개선
- **현재**: Base64로 DB에 직접 저장 (무거움)
- **개선**: Supabase Storage 또는 S3에 파일 저장 → DB에는 URL만 저장
- **영향 파일**:
  - `apps/server/app/services/ai_lab/tts_service.py`
  - `apps/server/app/schemas/ai_lab.py` (audio_base64 → audio_url)

### 2. Gemini 3 TTS 지원 대기
- **현재**: Gemini 2.5 TTS 모델만 지원
- **대기**: Google에서 Gemini 3 TTS 출시 시 모델 레지스트리 업데이트

---

## 🟡 우선순위 중간

### 3. 에이전트별 모델 선택 기능
- 파이프라인 생성 시 각 에이전트마다 다른 모델 지정 가능
- UI/UX 복잡도 증가 고려 필요
- **기획 진행 중** (이 대화에서 작성 예정)

### 4. 로그 스키마 C 모드 완전 제거
- **현재**: DB Enum에는 A/B/C 존재, Python/TS에서는 A/B만 사용
- **개선**: DB 마이그레이션으로 C 제거 또는 deprecated 처리

---

## 🟢 우선순위 낮음

### 5. 모델별 사용량/할당량 대시보드와 토큰/비용 계산 기능(토큰 카운팅 정확도 개선 포함)
- Gemini 3 Preview 모델의 토큰 카운트가 0으로 반환되는 경우 있음
- `tiktoken` 라이브러리로 클라이언트 측 카운팅 고려

### 6. 실험 결과 내보내기
- JSON/CSV 형식으로 실험 결과 다운로드 기능
