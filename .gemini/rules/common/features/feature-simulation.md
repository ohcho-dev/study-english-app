# 🎬 핵심 기능 1: 개인 시뮬레이션 학습 (Voice-to-Action)

> **기능 설명:** 사용자가 영문 발화 → AI가 상황 판단 → 배경 전환 + 음성 응답
> **예시:** "I'm going to work" → 화면이 '버스 정류장'으로 전환 → AI: "Bus or Taxi?"

---

## 1. 구현 전략: 시네마틱 2D (Cinematic 2D)

**"3D처럼 보이지만, 기술적으로는 2D 영상"**

- 1인칭 시점 고화질 실사 영상을 배경으로 재생
- AI 비디오 생성 (Runway, Sora) 또는 스톡 비디오 (Shutterstock) 활용
- `react-native-video`로 루프 재생

---

## 2. 기술 스택

| 구분 | 기술 | 역할 |
|------|------|------|
| Visual Core | react-native-video | 배경 루프 영상 재생 |
| AI (Brain) | Gemini 3.0 Pro/Flash | Native Audio 멀티모달 분석 |
| TTS (Voice) | Google Cloud TTS | 텍스트 → 음성 변환 |
| Local Cache | expo-file-system | 오디오 파일 로컬 저장 |

---

## 3. 시스템 플로우

```
📱 사용자: "How much is it?" (녹음)
    ↓
⚡ FastAPI 서버: 오디오 파일 수신
    ↓
🧠 Gemini 3.0 Pro (Native Audio Processing)
    • 발화 내용 받아쓰기 (Transcript)
    • 미션 성공 여부 판단 (Intent)
    • 목소리 톤 분석 (자신감)
    • 3-Mood 추천 표현 생성
    ↓
🗣️ Google Cloud TTS: 응답 음성 생성
    ↓
📱 클라이언트: 결과 수신 (JSON + Audio)
    ├─ ✅ 성공 → 다음 Scene 전환 + 추천 표현 표시
    └─ ❌ 실패 → 힌트 표시 + 재시도
```

---

## 4. AI 프롬프트 구조

### 4.1. 멀티모달 분석 프롬프트
```
이 오디오를 직접 듣고 분석해줘.
1. 발화 내용 받아쓰기 (Transcript)
2. 미션 성공 여부 (Intent)
3. 목소리 톤(자신감) 분석
4. 3가지 무드(친근/정중/네이티브) 추천 표현
```

### 4.2. 3-Mood Suggestions (핵심 차별화 기능)
사용자 발화 후 AI가 3가지 무드로 개선된 표현 제안:
1. **Friendly (친근하게)**
2. **Formal (격식있게)**
3. **Native (원어민스럽게)**

---

## 5. 채점 로직

### Intent-based Scoring (의도 기반 채점)
- 기존 방식: 문자열 비교 → "How much is it?" ≠ "How much?"
- 새로운 방식: LLM이 맥락상 의미 판단 → 유연한 정답 처리

### Context Injection (컨텍스트 주입)
- Fine-tuning ❌, Prompt Engineering ✅
- DB에 저장된 '현재 장면의 정답지(Mission & Context)'를 프롬프트에 포함

---

## 6. 비용 최적화: 2-Tier Caching

### Tier 1: Client (로컬 캐싱)
```javascript
// expo-file-system 활용
const localPath = FileSystem.cacheDirectory + 'abc.mp3';
if (await FileSystem.getInfoAsync(localPath).exists) {
  // 로컬 재생 (서버 통신 0회)
} else {
  // 다운로드 후 저장
}
```

### Tier 2: Server (해시 기반 캐싱)
```python
# 텍스트 해싱
hash_id = md5("Try again.").hexdigest()

# DB 확인
cached = db.query(tts_cache).filter(id=hash_id).first()
if cached:
    return cached.audio_url  # TTS 비용 0원
else:
    # Google TTS 호출 → 저장 → 반환
```

### 캐시 적중률 극대화
- `Temperature = 0` 설정 → 결정론적(Deterministic) 답변
- 같은 입력 → 항상 같은 출력 → 해시 매칭 성공

---

## 7. 개발 체크리스트

- [ ] 배경 루프 영상 5종 확보 (집, 버스, 사무실 등)
- [ ] 시나리오별 Mission & Key Expressions JSON 데이터 구축
- [ ] Gemini 3.0 Pro/Flash 멀티모달 API 연동
- [ ] Google Cloud TTS 연동 + 캐싱 시스템 구축
- [ ] Intent-based Scoring 프롬프트 튜닝
- [ ] 3-Mood Suggestions 기능 구현
