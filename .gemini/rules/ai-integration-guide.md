# 🧠 AI 통합 가이드 (Gemini & TTS)

> AI 모델 선정 기준, 프롬프트 설계 원칙, 비용 최적화 전략을 정의합니다.

---

## 1. AI 모델: Google Gemini

### 1.1. 선정 이유 (vs OpenAI GPT)

| 비교 항목 | OpenAI GPT-4o | Google Gemini 3.0 | 결론 |
|-----------|---------------|-------------------|------|
| 처리 구조 | 2단계 (Whisper STT → GPT) | 1단계 (Native Audio) | **Gemini** |
| 인식 정보 | 텍스트만 (톤/억양 손실) | 오디오+텍스트 (감정 파악) | **Gemini** |
| 비용 | STT + LLM 이중 비용 | 멀티모달 통합 비용 | **Gemini** |

### 1.2. 모델 라인업

| 모델 | 특징 | 프로젝트 적합성 |
|------|------|----------------|
| Ultra | 가장 똑똑하지만 무겁고 비쌈 | ❌ 오버스펙 |
| **Pro** | 성능과 속도의 균형, 복잡한 추론 | ✅ 튜터용 권장 |
| **Flash** | 속도/가성비 특화 | ✅ 테스트 후 결정 |
| Nano | 온디바이스 | ❌ 고성능 오디오 분석 불가 |

### 1.3. 비용 계획
- 초기 개발: Google AI Studio **Free Tier** 활용
- 프로덕션: 사용량 기반 과금

---

## 2. 프롬프트 설계 원칙

### 2.1. Context Injection (컨텍스트 주입)
- Fine-tuning ❌ → Prompt Engineering ✅
- DB에 저장된 '현재 장면의 정답지'를 프롬프트에 포함

### 2.2. 결정론적 답변 유도
```python
# 캐싱 최적화를 위해 Temperature 0 사용
response = model.generate(
    prompt=prompt,
    temperature=0  # 항상 같은 답변 출력
)
```

### 2.3. 구조화된 출력 강제
```python
# Pydantic으로 JSON 구조 검증
class EvaluationResult(BaseModel):
    is_passed: bool
    deficiency: Literal["too_short", "off_topic", "none"]
    follow_up_audio_script: str
```

---

## 3. 주요 프롬프트 템플릿

### 3.1. 시뮬레이션 - 멀티모달 분석
```
이 오디오를 직접 듣고 분석해줘.
1. 발화 내용 받아쓰기 (Transcript)
2. 미션 성공 여부 (Intent): {MISSION_DESCRIPTION}
3. 목소리 톤(자신감) 분석
4. 3가지 무드(친근/정중/네이티브) 추천 표현

출력 형식: JSON
```

### 3.2. 그룹 교실 - 앵커 AI (Strict Mode)
```
Role: You are the model student.

Constraint 1: Ensure the response is exactly 3 sentences.
Constraint 2: Structure must be [Opinion] -> [Personal Experience] -> [Reason].
Constraint 3: Use the keyword "{TOPIC}".
```

### 3.3. 그룹 교실 - 사용자 평가
```
Analyze the user's audio based on the following criteria:
1. Structure: Does it contain at least 2-3 sentences? (Boolean)
2. Content: Is it relevant to the topic '{TOPIC}'? (Boolean)

Output Format (JSON):
{
  "is_passed": boolean,
  "deficiency": "too_short" | "off_topic" | "none",
  "follow_up_audio_script": "..."
}
```

---

## 4. TTS: Google Cloud TTS

### 4.1. 무료 티어 한도 (월별)

| Voice Type | 무료 한도 | 초과 요금 (100만 자당) |
|------------|----------|----------------------|
| Standard | 400만 자 | $4 (~5,500원) |
| WaveNet | 100만 자 | $16 (~22,000원) |
| Neural2 | 100만 자 | $16 (~22,000원) |
| Studio | 100만 자 | $160 (~220,000원) |

### 4.2. 권장 설정
- **개발/테스트:** Standard (넉넉한 무료)
- **프로덕션:** WaveNet 또는 Neural2 (자연스러운 음성)

---

## 5. 비용 최적화: 2-Tier Caching

### Tier 1: Client (로컬 캐싱)
```javascript
// expo-file-system
const cachedPath = FileSystem.cacheDirectory + hash + '.mp3';
const info = await FileSystem.getInfoAsync(cachedPath);

if (info.exists) {
  return cachedPath;  // 서버 통신 0회
} else {
  await FileSystem.downloadAsync(serverUrl, cachedPath);
  return cachedPath;
}
```

### Tier 2: Server (해시 기반 캐싱)
```python
import hashlib

def get_or_create_tts(text: str) -> str:
    hash_id = hashlib.md5(text.encode()).hexdigest()
    
    # DB에서 캐시 확인
    cached = db.query(TTSCache).filter_by(id=hash_id).first()
    if cached:
        return cached.audio_url  # TTS 비용 0원
    
    # 캐시 미스: TTS 생성 후 저장
    audio_url = google_tts.synthesize(text)
    db.add(TTSCache(id=hash_id, audio_url=audio_url))
    db.commit()
    return audio_url
```

### 캐시 적중률 극대화 전략
1. `Temperature = 0` → 결정론적 답변
2. 정형화된 피드백 문구 사전 정의
3. 프롬프트에 "일관된 표현 사용" 지시

---

## 6. 에러 처리 & 안정성

### Retry with Exponential Backoff
```python
import time
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10)
)
def call_gemini_api(prompt: str):
    return gemini_client.generate(prompt)
```

### Graceful Degradation
- AI API 장애 시 → 사전 정의된 기본 응답 반환
- TTS 장애 시 → 텍스트만 표시
